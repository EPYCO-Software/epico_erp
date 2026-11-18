using System.Security.Cryptography;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Correo;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using EPICO.Infrastructure.Correo;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

public record CuentaPortal(Guid UsuarioId, Guid ContactoId, string Correo, string Nombre, bool Activa, DateTime? UltimoAcceso);

/// <summary>CorreoEnviado = el correo quedó en la bandeja con un servidor para salir (false si no hay servidor de correo).</summary>
public record CuentaPortalCreada(Guid UsuarioId, Guid ContactoId, string Correo, string Nombre, bool Activa, DateTime? UltimoAcceso,
    bool CorreoEnviado);

public record CorreoEnviadoResponse(bool CorreoEnviado);

/// <summary>
/// Cuenta del portal de un cliente: un usuario Tipo=Portal ligado a uno de sus contactos. Se crea desde la ficha del
/// cliente con una contraseña temporal que solo viaja por correo (nunca en la respuesta). Ver y crear piden
/// ventas.clientes.crear o .editar (alta del cliente con su cuenta en un paso); reenviar y activar, .editar.
/// El usuario siempre es Tipo=Portal, sin rol, accesos ni permisos del ERP.
/// </summary>
[ApiController]
[Route("api/v1/clientes/{id:guid}/cuenta-portal")]
public class CuentaPortalController(IAppDbContext db, IUsuarioActual yo, IConfiguration cfg) : ControllerBase
{
    const string Crea = "ventas.clientes.crear", Edita = "ventas.clientes.editar";

    /// <summary>403 si no tiene ninguno de los permisos.</summary>
    ObjectResult? SinPermiso(params string[] permisos) =>
        permisos.Any(yo.Tiene) ? null : PermisoAttribute.SinPermiso(string.Join(" o ", permisos));

    /// <summary>Cliente visible para el usuario (los filtros ya aplican organización y razón social restringida).</summary>
    Task<Cliente?> ClienteVisible(Guid id, CancellationToken ct) => db.Set<Cliente>().FirstOrDefaultAsync(c => c.Id == id, ct);

    async Task<(ClienteContacto Contacto, Usuario Usuario)?> Cuenta(Guid clienteId, CancellationToken ct)
    {
        var r = await db.Set<ClienteContacto>().Where(k => k.ClienteId == clienteId && k.UsuarioId != null)
            .Join(db.Set<Usuario>().Where(u => u.Tipo == TipoUsuario.Portal), k => k.UsuarioId, u => u.Id, (k, u) => new { k, u })
            .OrderBy(x => x.k.CreatedAt).FirstOrDefaultAsync(ct);
        return r is null ? null : (r.k, r.u);
    }

    static CuentaPortal Dto(ClienteContacto k, Usuario u) =>
        new(u.Id, k.Id, u.Correo, u.Apellidos is null ? u.Nombre : $"{u.Nombre} {u.Apellidos}", u.Activo, u.UltimoAcceso);

    /// <summary>Cuenta del portal del cliente</summary>
    /// <remarks>404 si el cliente no existe o no tiene cuenta.</remarks>
    [HttpGet]
    public async Task<ActionResult<CuentaPortal>> Ver(Guid id, CancellationToken ct) =>
        SinPermiso(Crea, Edita) is { } no ? no
        : await ClienteVisible(id, ct) is not null && await Cuenta(id, ct) is var (k, u) ? Dto(k, u) : NotFound();

    /// <summary>Crear cuenta del portal</summary>
    /// <remarks>contactoId = usa el correo y nombre de ese contacto; sin él, crea un contacto (principal si no hay otro) con
    /// correo y nombre. Manda al correo una contraseña temporal y el enlace {Correo:UrlPortal}/login. 409 si el cliente ya
    /// tiene cuenta, es público en general o el correo ya es de otro usuario; 400 si no hay correo.</remarks>
    [HttpPost]
    public async Task<ActionResult<CuentaPortalCreada>> Crear(Guid id, CuentaPortalRequest r, CancellationToken ct)
    {
        if (SinPermiso(Crea, Edita) is { } no) return no;
        var c = await ClienteVisible(id, ct);
        if (c is null) return NotFound();
        if (c.EsPublicoGeneral) return Problem("El cliente público en general no tiene cuenta del portal.", statusCode: 409);
        if (await Cuenta(id, ct) is not null) return Problem("El cliente ya tiene cuenta del portal.", statusCode: 409);

        ClienteContacto k;
        if (r.ContactoId is Guid kid)
        {
            var existente = await db.Set<ClienteContacto>().FirstOrDefaultAsync(x => x.Id == kid && x.ClienteId == id, ct);
            if (existente is null) return Problem("El contacto no existe o es de otro cliente.", statusCode: 404);
            k = existente;
            if (k.UsuarioId is not null) return Problem("Ese contacto ya tiene un usuario.", statusCode: 409);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(r.Nombre)) return Problem("Falta el nombre del contacto.", statusCode: 400);
            k = new ClienteContacto
            {
                ClienteId = id, Nombre = r.Nombre.Trim(), Correo = r.Correo?.Trim().ToLowerInvariant(),
                Principal = !await db.Set<ClienteContacto>().AnyAsync(x => x.ClienteId == id && x.Principal, ct),
            };
            db.Set<ClienteContacto>().Add(k);
        }
        var correo = k.Correo?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(correo)) return Problem("Falta el correo: la cuenta entra con él.", statusCode: 400);
        if (await db.Set<Usuario>().IgnoreQueryFilters().AnyAsync(u => u.Correo == correo, ct))
            return Problem("Ese correo ya es de otro usuario.", statusCode: 409);

        var u = new Usuario
        {
            Correo = correo, Tipo = TipoUsuario.Portal, Nombre = k.Nombre, Apellidos = k.Apellidos, Telefono = k.Telefono, Puesto = k.Puesto,
        };
        var password = PasswordTemporal();
        u.PasswordHash = AuthController.Hasher.HashPassword(u, password);
        db.Set<Usuario>().Add(u);
        k.UsuarioId = u.Id;
        Bienvenida(c, u, password);
        Historial(c, $"Cuenta del portal creada para {u.Correo}");
        await db.SaveChangesAsync(ct);
        var d = Dto(k, u);
        return CreatedAtAction(nameof(Ver), new { id }, new CuentaPortalCreada(d.UsuarioId, d.ContactoId, d.Correo, d.Nombre, d.Activa,
            d.UltimoAcceso, await HayServidor(c.OrganizacionId, ct)));
    }

    /// <summary>Reenviar credenciales</summary>
    /// <remarks>Nueva contraseña temporal por correo; cierra sus sesiones y quita el bloqueo. 409 si la cuenta está desactivada.</remarks>
    [HttpPost("reenviar")]
    public async Task<ActionResult<CorreoEnviadoResponse>> Reenviar(Guid id, CancellationToken ct)
    {
        if (SinPermiso(Edita) is { } no) return no;
        var c = await ClienteVisible(id, ct);
        if (c is null || await Cuenta(id, ct) is not var (_, u)) return NotFound();
        if (!u.Activo) return Problem("La cuenta está desactivada: actívala antes de reenviar.", statusCode: 409);
        var password = PasswordTemporal();
        u.PasswordHash = AuthController.Hasher.HashPassword(u, password);
        (u.IntentosFallidos, u.BloqueadoHasta) = (0, null);
        await CerrarSesiones(u.Id, ct);
        Bienvenida(c, u, password);
        Historial(c, $"Credenciales del portal reenviadas a {u.Correo}");
        await db.SaveChangesAsync(ct);
        return new CorreoEnviadoResponse(await HayServidor(c.OrganizacionId, ct));
    }

    /// <summary>Activar o desactivar la cuenta</summary>
    /// <remarks>Desactivar cierra sus sesiones (el access token vive hasta 15 min).</remarks>
    [HttpPut("activa")]
    public async Task<IActionResult> Activa(Guid id, CuentaPortalActivaRequest r, CancellationToken ct)
    {
        if (SinPermiso(Edita) is { } no) return no;
        var c = await ClienteVisible(id, ct);
        if (c is null || await Cuenta(id, ct) is not var (_, u)) return NotFound();
        if (u.Activo == r.Activa) return NoContent();
        u.Activo = r.Activa;
        if (!r.Activa) await CerrarSesiones(u.Id, ct);
        Historial(c, r.Activa ? $"Cuenta del portal activada ({u.Correo})" : $"Cuenta del portal desactivada ({u.Correo})");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    async Task CerrarSesiones(Guid usuarioId, CancellationToken ct)
    {
        var ahora = DateTime.UtcNow;
        foreach (var s in await db.Set<Sesion>().Where(s => s.UsuarioId == usuarioId && s.RevocadaEn == null).ToListAsync(ct))
            s.RevocadaEn = ahora;
    }

    void Historial(Cliente c, string texto) => db.Set<Evento>().Add(new Evento
    {
        OrganizacionId = c.OrganizacionId, RegistroTipo = nameof(Cliente), RegistroId = c.Id, Fecha = DateTime.UtcNow,
        AutorId = yo.Id, SesionId = yo.SesionId, Tipo = TipoEvento.Sistema, Texto = texto,
    });

    void Bienvenida(Cliente c, Usuario u, string password)
    {
        var url = cfg["Correo:UrlPortal"]?.TrimEnd('/');
        db.Set<CorreoSaliente>().Add(Plantilla.Crear(u.Correo, "Tu acceso al portal de EPICO",
            $"Hola {u.Nombre}: ya tienes acceso al portal de clientes de EPICO para {c.Nombre}. Entra con tu correo {u.Correo} " +
            $"y la contraseña temporal {password}",
            ("Entrar al portal", $"{url}/login"),
            "Te recomendamos cambiarla en Mi perfil o con \"¿Olvidaste tu contraseña?\" en la pantalla de entrada.",
            c.OrganizacionId));
    }

    /// <summary>¿Hay por dónde salir el correo? Un servidor activo de la organización o el global (Correo__Host).</summary>
    async Task<bool> HayServidor(Guid organizacionId, CancellationToken ct) =>
        CuentaSmtp.Global(cfg) is not null
        || await db.Set<ServidorCorreo>().IgnoreQueryFilters().AnyAsync(s => s.OrganizacionId == organizacionId && s.Activo && !s.IsDeleted, ct);

    /// <summary>14 caracteres sin ambiguos (0/O, 1/l/I), con mayúscula, minúscula y número.</summary>
    internal static string PasswordTemporal()
    {
        const string letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        while (true)
        {
            var p = RandomNumberGenerator.GetString(letras, 14);
            if (p.Any(char.IsUpper) && p.Any(char.IsLower) && p.Any(char.IsDigit)) return p;
        }
    }
}
