using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Contracts.Auth;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[AllowAnonymous]
public class AuthController(IAppDbContext db, Tokens tokens) : ControllerBase
{
    public static readonly PasswordHasher<Usuario> Hasher = new();
    const int MaxIntentos = 5;
    static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);

    /// <summary>Iniciar sesión</summary>
    /// <remarks>Devuelve el token (15 min), el refresh token (14 días), las empresas con sus plantas y los permisos. 5 intentos fallidos bloquean al usuario 15 min (429).</remarks>
    [HttpPost("login")]
    public async Task<ActionResult<SesionResponse>> Login(LoginRequest r, CancellationToken ct)
    {
        var correo = r.Correo.Trim().ToLowerInvariant();
        var u = await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Correo == correo, ct);
        var ahora = DateTime.UtcNow;
        if (u is null || !u.Activo) return Rechazo();
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

        var accesos = await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id).ToListAsync(ct);
        if (r.EmpresaId is Guid pedida && accesos.All(a => a.EmpresaId != pedida))
            return Problem("No tienes acceso a esa empresa.", statusCode: 403);
        if (u.Tipo == TipoUsuario.Interno && accesos.Count == 0)
            return Problem("Tu usuario no tiene acceso a ninguna empresa.", statusCode: 403);

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
        return await Respuesta(u, sesion, refresh, accesos, ct);
    }

    /// <summary>Renovar token</summary>
    /// <remarks>Cambia el refresh token por uno nuevo (rotación) y emite otro token.</remarks>
    [HttpPost("refresh")]
    public async Task<ActionResult<SesionResponse>> Refresh(RefreshRequest r, CancellationToken ct)
    {
        var hash = Tokens.Hash(r.RefreshToken);
        var sesion = await db.Set<Sesion>().FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, ct);
        var u = sesion is null ? null : await db.Set<Usuario>().FirstOrDefaultAsync(x => x.Id == sesion.UsuarioId, ct);
        if (sesion is null || sesion.RevocadaEn is not null || sesion.ExpiraEn <= DateTime.UtcNow || u is not { Activo: true })
            return Problem("La sesión expiró; vuelve a entrar.", statusCode: 401);

        var accesos = await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id).ToListAsync(ct);
        var refresh = Tokens.NuevoRefresh();
        sesion.RefreshTokenHash = Tokens.Hash(refresh);
        await db.SaveChangesAsync(ct);
        return await Respuesta(u, sesion, refresh, accesos, ct);
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

    ObjectResult Rechazo() => Problem("Correo o contraseña incorrectos.", statusCode: 401);

    async Task<SesionResponse> Respuesta(Usuario u, Sesion sesion, string refresh, List<UsuarioAcceso> accesos, CancellationToken ct)
    {
        // shortcut: los permisos son la unión de los roles de todas sus empresas (no por empresa); si alguien
        // necesita roles distintos por razón social, revisar el permiso contra la empresa del registro.
        var rolIds = accesos.Select(a => a.RolId).Distinct().ToList();
        var permisos = await db.Set<RolPermiso>().Where(p => rolIds.Contains(p.RolId)).Select(p => p.Permiso).Distinct().ToListAsync(ct);

        var empresaIds = accesos.Select(a => a.EmpresaId).Distinct().ToList();
        var empresas = await db.Set<Empresa>().IgnoreQueryFilters()
            .Where(e => empresaIds.Contains(e.Id) && !e.IsDeleted).ToListAsync(ct);
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters()
            .Where(s => empresaIds.Contains(s.EmpresaId) && !s.IsDeleted && s.Activa).OrderBy(s => s.Codigo).ToListAsync(ct);

        var (token, expira) = tokens.Acceso(u, sesion.Id, empresas.FirstOrDefault()?.OrganizacionId, empresas.Select(e => e.Id), permisos);
        return new SesionResponse(
            new UsuarioSesion(u.Id, u.Nombre, u.Correo),
            sesion.EmpresaId,
            token,
            expira,
            refresh,
            [.. empresas.OrderBy(e => e.RazonSocial).Select(e => new EmpresaSesion(e.Id, e.NombreComercial,
                [.. plantas
                    .Where(p => p.EmpresaId == e.Id && accesos.Any(a => a.EmpresaId == e.Id && (a.SucursalId == null || a.SucursalId == p.Id)))
                    .Select(p => new PlantaSesion(p.Id, p.Codigo, p.Nombre, p.ZonaHoraria, p.Lat, p.Lng))]))],
            permisos);
    }
}
