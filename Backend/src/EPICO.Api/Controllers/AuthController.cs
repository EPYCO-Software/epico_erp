using System.Buffers.Text;
using System.Security.Cryptography;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Contracts.Auth;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Correo;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[AllowAnonymous]
public class AuthController(IAppDbContext db, Tokens tokens, IConfiguration cfg) : ControllerBase
{
    public static readonly PasswordHasher<Usuario> Hasher = new();
    const int MaxIntentos = 5;
    static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);

    /// <summary>Iniciar sesión</summary>
    /// <remarks>Devuelve el token (15 min), el refresh token (14 días), las empresas con sus plantas y los permisos. 5 intentos fallidos bloquean al usuario 15 min (429); bloqueado por un administrador, 403. app: erp (por omisión) o portal; cada una solo deja entrar a sus usuarios (403).</remarks>
    [HttpPost("login")]
    public async Task<ActionResult<SesionResponse>> Login(LoginRequest r, CancellationToken ct)
    {
        var correo = r.Correo.Trim().ToLowerInvariant();
        var u = await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Correo == correo, ct);
        var ahora = DateTime.UtcNow;
        if (u is null || !u.Activo) return Rechazo();
        // El bloqueo por intentos dura Bloqueo; uno más largo lo puso un administrador.
        if (u.BloqueadoHasta > ahora.Add(Bloqueo))
            return Problem("Tu cuenta está bloqueada; pide al administrador que la desbloquee.", statusCode: 403);
        if (u.BloqueadoHasta > ahora)
            return Problem("Demasiados intentos fallidos; intenta de nuevo más tarde.", statusCode: 429);

        var verificacion = Hasher.VerifyHashedPassword(u, u.PasswordHash, r.Password);
        if (verificacion == PasswordVerificationResult.Failed)
        {
            if (++u.IntentosFallidos >= MaxIntentos)
            {
                u.BloqueadoHasta = ahora.Add(Bloqueo);
                u.IntentosFallidos = 0;
            }
            await db.SaveChangesAsync(ct);
            return Rechazo();
        }
        if (verificacion == PasswordVerificationResult.SuccessRehashNeeded)
            u.PasswordHash = Hasher.HashPassword(u, r.Password);

        if ((r.App == "portal") != (u.Tipo == TipoUsuario.Portal))
            return Problem(u.Tipo == TipoUsuario.Portal ? "Este usuario es del portal de clientes: entra por el portal."
                : "Este usuario es del ERP: entra por el ERP.", statusCode: 403);
        var accesos = await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id).ToListAsync(ct);
        if (r.EmpresaId is Guid pedida && accesos.All(a => a.EmpresaId != pedida))
            return Problem("No tienes acceso a esa empresa.", statusCode: 403);
        if (u.Tipo == TipoUsuario.Interno && accesos.Count == 0)
            return Problem("Tu usuario no tiene acceso a ninguna empresa.", statusCode: 403);
        var cliente = await ClienteDe(u, ct);
        if (u.Tipo == TipoUsuario.Portal && cliente is null)
            return Problem("Tu usuario no está ligado a ningún cliente.", statusCode: 403);

        u.IntentosFallidos = 0;
        u.BloqueadoHasta = null;
        u.UltimoAcceso = ahora;
        var refresh = Tokens.NuevoRefresh();
        var sesion = new Sesion
        {
            UsuarioId = u.Id,
            EmpresaId = r.EmpresaId ?? (accesos.FirstOrDefault(a => a.Predeterminado) ?? accesos.FirstOrDefault())?.EmpresaId,
            RefreshTokenHash = Tokens.Hash(refresh),
            CreadaEn = ahora,
            ExpiraEn = ahora.Add(Tokens.DuracionSesion),
            Ip = HttpContext.Connection.RemoteIpAddress,
            Agente = Request.Headers.UserAgent.ToString(),
        };
        db.Set<Sesion>().Add(sesion);
        await db.SaveChangesAsync(ct);
        return await Respuesta(u, sesion, refresh, accesos, cliente, ct);
    }

    /// <summary>Renovar token</summary>
    /// <remarks>Cambia el refresh token por uno nuevo (rotación) y emite otro token, con permisos y empresas recalculados.
    /// 401 si la sesión venció, se revocó o el token ya se usó; si el usuario está inactivo o bloqueado; o si un usuario
    /// interno ya no tiene acceso a ninguna empresa. Si perdió la empresa de la sesión, pasa a su predeterminada.</remarks>
    [HttpPost("refresh")]
    public async Task<ActionResult<SesionResponse>> Refresh(RefreshRequest r, CancellationToken ct)
    {
        var ahora = DateTime.UtcNow;
        var hash = Tokens.Hash(r.RefreshToken);
        var sesion = await db.Set<Sesion>().FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, ct);
        var u = sesion is null ? null : await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Id == sesion.UsuarioId, ct);
        if (sesion is null || sesion.RevocadaEn is not null || sesion.ExpiraEn <= ahora || u is not { Activo: true } || u.BloqueadoHasta > ahora)
            return Problem("La sesión expiró; vuelve a entrar.", statusCode: 401);

        var accesos = await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id).ToListAsync(ct);
        if (u.Tipo == TipoUsuario.Interno && accesos.Count == 0)
            return Problem("Tu usuario ya no tiene acceso a ninguna empresa.", statusCode: 401);
        var cliente = await ClienteDe(u, ct);
        if (u.Tipo == TipoUsuario.Portal && cliente is null)
            return Problem("Tu usuario ya no está ligado a ningún cliente.", statusCode: 401);
        if (sesion.EmpresaId is Guid e && accesos.All(a => a.EmpresaId != e))
            sesion.EmpresaId = (accesos.FirstOrDefault(a => a.Predeterminado) ?? accesos.FirstOrDefault())?.EmpresaId;
        var refresh = Tokens.NuevoRefresh();
        sesion.RefreshTokenHash = Tokens.Hash(refresh);
        await db.SaveChangesAsync(ct);
        return await Respuesta(u, sesion, refresh, accesos, cliente, ct);
    }

    /// <summary>Cerrar sesión</summary>
    /// <remarks>Revoca la sesión del refresh token.</remarks>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest r, CancellationToken ct)
    {
        var hash = Tokens.Hash(r.RefreshToken);
        var sesion = await db.Set<Sesion>().FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, ct);
        if (sesion is { RevocadaEn: null })
        {
            sesion.RevocadaEn = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    static readonly TimeSpan VigenciaEnlace = TimeSpan.FromMinutes(30);

    /// <summary>Olvidé mi contraseña</summary>
    /// <remarks>Si el correo es de un usuario activo le envía un enlace de un solo uso que vence en 30 min:
    /// {Correo:UrlErp o Correo:UrlPortal}/restablecer?token=…. Responde 204 siempre, exista o no el correo, para no
    /// revelar quién está registrado. Un enlace por minuto por usuario; 10 llamadas cada 5 min por IP (429).</remarks>
    [HttpPost("olvide")]
    [EnableRateLimiting("correo")]
    public async Task<IActionResult> Olvide(OlvidePasswordRequest r, CancellationToken ct)
    {
        var correo = r.Correo.Trim().ToLowerInvariant();
        var ahora = DateTime.UtcNow;
        var u = await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Correo == correo && x.Activo, ct);
        if (u is null || await db.Set<RestablecimientoPassword>().AnyAsync(x => x.UsuarioId == u.Id && x.CreadoEn > ahora.AddMinutes(-1), ct))
            return NoContent();

        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        db.Set<RestablecimientoPassword>().Add(new RestablecimientoPassword
        {
            UsuarioId = u.Id, TokenHash = Tokens.Hash(token), CreadoEn = ahora, ExpiraEn = ahora.Add(VigenciaEnlace),
        });
        var url = cfg[u.Tipo == TipoUsuario.Portal ? "Correo:UrlPortal" : "Correo:UrlErp"]?.TrimEnd('/');
        db.Set<CorreoSaliente>().Add(Plantilla.Crear(u.Correo, "Restablece tu contraseña",
            $"Hola {u.Nombre}: recibimos una solicitud para cambiar tu contraseña. El enlace vence en 30 minutos y sirve una sola vez.",
            ("Cambiar contraseña", $"{url}/restablecer?token={token}"),
            "Si no lo pediste, ignora este correo: tu contraseña sigue igual."));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Restablecer contraseña</summary>
    /// <remarks>Con el token del enlace. Cambia la contraseña, quita el bloqueo, cierra todas las sesiones, invalida
    /// los demás enlaces y avisa por correo. 400 si el enlace no existe, ya se usó o venció.</remarks>
    [HttpPost("restablecer")]
    [EnableRateLimiting("correo")]
    public async Task<IActionResult> Restablecer(RestablecerPasswordRequest r, CancellationToken ct)
    {
        var hash = Tokens.Hash(r.Token);
        var ahora = DateTime.UtcNow;
        var enlace = await db.Set<RestablecimientoPassword>().FirstOrDefaultAsync(x => x.TokenHash == hash, ct);
        var u = enlace is null ? null : await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Id == enlace.UsuarioId, ct);
        if (enlace is null || enlace.UsadoEn is not null || enlace.ExpiraEn <= ahora || u is not { Activo: true })
            return Problem("El enlace no es válido o ya venció; pide otro.", statusCode: 400);

        u.PasswordHash = Hasher.HashPassword(u, r.Password);
        (u.IntentosFallidos, u.BloqueadoHasta) = (0, null);
        foreach (var e in await db.Set<RestablecimientoPassword>().Where(x => x.UsuarioId == u.Id && x.UsadoEn == null).ToListAsync(ct))
            e.UsadoEn = ahora;
        foreach (var s in await db.Set<Sesion>().Where(s => s.UsuarioId == u.Id && s.RevocadaEn == null).ToListAsync(ct))
            s.RevocadaEn = ahora;
        db.Set<CorreoSaliente>().Add(Plantilla.Crear(u.Correo, "Tu contraseña cambió",
            $"Hola {u.Nombre}: tu contraseña se cambió el {ahora:dd/MM/yyyy HH:mm} (UTC) y se cerraron tus sesiones abiertas.",
            pie: "Si no fuiste tú, avisa de inmediato al administrador."));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    ObjectResult Rechazo() => Problem("Correo o contraseña incorrectos.", statusCode: 401);

    /// <summary>Cliente del usuario del portal (por su contacto); null si es interno o ya no está ligado.</summary>
    async Task<Cliente?> ClienteDe(Usuario u, CancellationToken ct) => u.Tipo != TipoUsuario.Portal ? null
        : await db.Set<Cliente>().IgnoreQueryFilters().FirstOrDefaultAsync(c => !c.IsDeleted &&
            db.Set<ClienteContacto>().Any(k => k.ClienteId == c.Id && k.UsuarioId == u.Id), ct);

    async Task<SesionResponse> Respuesta(Usuario u, Sesion sesion, string refresh, List<UsuarioAcceso> accesos, Cliente? cliente, CancellationToken ct)
    {
        // Los mismos permisos en todas sus empresas: su rol + agregados − quitados.
        List<string> permisos = cliente is null ? (await UsuariosController.PermisosDe(db, u.Id, ct)).Efectivos : [];
        var root = permisos.Contains("*");

        // Root: todas las empresas y plantas. Portal: las de la organización de su cliente (o solo la restringida).
        var empresaIds = root ? await db.Set<Empresa>().IgnoreQueryFilters().Where(e => !e.IsDeleted).Select(e => e.Id).ToListAsync(ct)
            : cliente is null ? accesos.Select(a => a.EmpresaId).Distinct().ToList()
            : cliente.EmpresaRestringidaId is Guid r ? [r]
            : await db.Set<Empresa>().IgnoreQueryFilters().Where(e => e.OrganizacionId == cliente.OrganizacionId && !e.IsDeleted).Select(e => e.Id).ToListAsync(ct);
        var empresas = await db.Set<Empresa>().IgnoreQueryFilters()
            .Where(e => empresaIds.Contains(e.Id) && !e.IsDeleted).ToListAsync(ct);
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters()
            .Where(s => empresaIds.Contains(s.EmpresaId) && !s.IsDeleted && s.Activa).OrderBy(s => s.Codigo).ToListAsync(ct);

        var organizacion = cliente?.OrganizacionId
            ?? empresas.FirstOrDefault(e => e.Id == sesion.EmpresaId)?.OrganizacionId ?? empresas.FirstOrDefault()?.OrganizacionId;
        // Empresas donde todos sus accesos son de una planta: solo esas plantas (filtro "planta" en AppDbContext).
        var porPlanta = root || cliente is not null ? null
            : accesos.GroupBy(a => a.EmpresaId).Where(g => g.All(a => a.SucursalId != null))
                .SelectMany(g => g.Select(a => (g.Key, Planta: a.SucursalId!.Value))).ToLookup(x => x.Key, x => x.Planta);
        var (token, expira) = tokens.Acceso(u, sesion.Id, organizacion, empresas.Select(e => e.Id), permisos, cliente?.Id, porPlanta);
        return new SesionResponse(
            new UsuarioSesion(u.Id, u.Nombre, u.Correo),
            sesion.EmpresaId,
            organizacion,
            token,
            expira,
            refresh,
            [.. empresas.OrderBy(e => e.RazonSocial).Select(e => new EmpresaSesion(e.Id, e.NombreComercial,
                [.. plantas
                    .Where(p => p.EmpresaId == e.Id && (cliente is not null || root || accesos.Any(a => a.EmpresaId == e.Id && (a.SucursalId == null || a.SucursalId == p.Id))))
                    .Select(p => new PlantaSesion(p.Id, p.Codigo, p.Nombre, p.ZonaHoraria, p.Lat, p.Lng, p.KmIncluidos, p.PrecioKm))]))],
            permisos,
            cliente is null ? null : new ClienteSesion(cliente.Id, cliente.Nombre));
    }
}
