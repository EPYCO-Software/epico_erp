using System.Text.Json;
using EPICO.Application.Common;
using EPICO.Contracts.Auth;
using EPICO.Contracts.Comun;
using EPICO.Domain.Acceso;
using EPICO.Domain.Historial;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

// Endpoints de cualquier usuario autenticado (sin permiso de RolPermiso): su perfil y datos de apoyo para el front.

[ApiController]
[Route("api/v1/me")]
public class MeController(IAppDbContext db, IUsuarioActual yo) : ControllerBase
{
    Task<Usuario?> Yo(CancellationToken ct) => db.Set<Usuario>().FirstOrDefaultAsync(u => u.Id == yo.Id, ct);

    /// <summary>Mi perfil</summary>
    [HttpGet]
    public async Task<ActionResult<Usuario>> Perfil(CancellationToken ct) => await Yo(ct) is { } u ? u : NotFound();

    /// <summary>Editar mi perfil</summary>
    /// <remarks>Nombre, apellidos, teléfono, puesto y foto (un Archivo ya subido). El correo y el tipo no se cambian aquí.</remarks>
    [HttpPut]
    public async Task<ActionResult<Usuario>> Editar(PerfilRequest r, CancellationToken ct)
    {
        if (await Yo(ct) is not { } u) return NotFound();
        if (r.FotoArchivoId is Guid foto && !await db.Set<Archivo>().AnyAsync(a => a.Id == foto, ct))
            return Problem("La foto no existe.", statusCode: 400);
        (u.Nombre, u.Apellidos, u.Telefono, u.Puesto, u.FotoArchivoId) = (r.Nombre, r.Apellidos, r.Telefono, r.Puesto, r.FotoArchivoId);
        await db.SaveChangesAsync(ct);
        return u;
    }

    /// <summary>Cambiar mi contraseña</summary>
    /// <remarks>Pide la actual (400 si no coincide). Cierra las demás sesiones del usuario; la actual sigue.</remarks>
    [HttpPut("password")]
    public async Task<IActionResult> Password(CambioPasswordRequest r, CancellationToken ct)
    {
        if (await Yo(ct) is not { } u) return NotFound();
        if (AuthController.Hasher.VerifyHashedPassword(u, u.PasswordHash, r.Actual) == PasswordVerificationResult.Failed)
            return Problem("La contraseña actual no es correcta.", statusCode: 400);
        u.PasswordHash = AuthController.Hasher.HashPassword(u, r.Nueva);
        await db.SaveChangesAsync(ct);
        await db.Set<Sesion>().Where(s => s.UsuarioId == u.Id && s.Id != yo.SesionId && s.RevocadaEn == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevocadaEn, DateTime.UtcNow), ct);
        return NoContent();
    }

    /// <summary>Mis sesiones abiertas</summary>
    /// <remarks>Dispositivos con sesión vigente (sin revocar ni vencer), la más reciente primero. actual = la de este token.</remarks>
    [HttpGet("sesiones")]
    public async Task<List<MiSesion>> Sesiones(CancellationToken ct) =>
        (await MisSesiones().AsNoTracking().OrderByDescending(s => s.CreadaEn).ToListAsync(ct))
        .Select(s => new MiSesion(s.Id, s.CreadaEn, s.ExpiraEn, s.Ip?.ToString(), s.Agente, s.Id == yo.SesionId))
        .ToList();

    /// <summary>Cerrar una de mis sesiones</summary>
    /// <remarks>Su refresh token deja de servir; el token vive hasta 15 min. Si es la actual, equivale a cerrar sesión.</remarks>
    [HttpDelete("sesiones/{id:guid}")]
    public async Task<IActionResult> CerrarSesion(Guid id, CancellationToken ct)
    {
        var s = await MisSesiones().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        s.RevocadaEn = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Mis notificaciones</summary>
    /// <remarks>Avisos del sistema, el más reciente primero, con el total y cuántas no he leído. Las genera el back al
    /// recibir una cotización del portal, confirmarse una cotización, cambiar un pedido de estado o de estatus de
    /// planta, asignarme una actividad o vencerse una mía. ruta = pantalla del ERP a la que lleva (puede ser null).</remarks>
    [HttpGet("notificaciones")]
    public async Task<PaginaNotificaciones<Notificacion>> Notificaciones([FromQuery] bool soloNoLeidas = false,
        [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        await AvisarVencidas(ct);
        var mias = db.Set<Notificacion>().AsNoTracking().Where(n => n.UsuarioId == yo.Id);
        var q = soloNoLeidas ? mias.Where(n => n.LeidaEn == null) : mias;
        return new(
            await q.OrderByDescending(n => n.Fecha).ThenByDescending(n => n.Id).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 100)).ToListAsync(ct),
            await q.CountAsync(ct),
            await mias.CountAsync(n => n.LeidaEn == null, ct));
    }

    /// <summary>Marcar una notificación como leída</summary>
    [HttpPut("notificaciones/{id:guid}/leida")]
    public async Task<IActionResult> Leida(Guid id, CancellationToken ct) =>
        await db.Set<Notificacion>().Where(n => n.Id == id && n.UsuarioId == yo.Id && n.LeidaEn == null)
            .ExecuteUpdateAsync(n => n.SetProperty(x => x.LeidaEn, DateTime.UtcNow), ct) > 0
        || await db.Set<Notificacion>().AnyAsync(n => n.Id == id && n.UsuarioId == yo.Id, ct)
            ? NoContent() : NotFound();

    /// <summary>Marcar todas como leídas</summary>
    [HttpPut("notificaciones/leidas")]
    public async Task<IActionResult> TodasLeidas(CancellationToken ct)
    {
        await db.Set<Notificacion>().Where(n => n.UsuarioId == yo.Id && n.LeidaEn == null)
            .ExecuteUpdateAsync(n => n.SetProperty(x => x.LeidaEn, DateTime.UtcNow), ct);
        return NoContent();
    }

    /// <summary>Un aviso por cada actividad mía pendiente que ya venció (una sola vez por actividad).</summary>
    async Task AvisarVencidas(CancellationToken ct)
    {
        // shortcut: se generan al consultar (el front consulta cada 60 s); si hace falta avisar por correo, moverlo a un BackgroundService.
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var vencidas = await db.Set<Actividad>().AsNoTracking()
            .Where(a => a.AsignadaAId == yo.Id && a.HechaEn == null && a.CanceladaEn == null && a.FechaLimite < hoy
                        && !db.Set<Notificacion>().Any(n => n.UsuarioId == yo.Id && n.Clave == "actividad-vencida:" + a.Id))
            .Take(50).ToListAsync(ct);
        if (vencidas.Count == 0) return;
        foreach (var a in vencidas)
            db.Set<Notificacion>().Add(new Notificacion
            {
                UsuarioId = a.AsignadaAId, Modulo = "crm", Titulo = "Actividad vencida", Fecha = DateTime.UtcNow,
                Texto = $"{a.Resumen} · venció el {a.FechaLimite:dd/MM/yyyy}", Clave = $"actividad-vencida:{a.Id}",
                Ruta = Infrastructure.Persistence.AppDbContext.RutaDe(a.RegistroTipo, a.RegistroId),
            });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { } // otra consulta simultánea ya las creó (índice único UsuarioId+Clave)
    }

    IQueryable<Sesion> MisSesiones() =>
        db.Set<Sesion>().Where(s => s.UsuarioId == yo.Id && s.RevocadaEn == null && s.ExpiraEn > DateTime.UtcNow);

    /// <summary>Mis preferencias</summary>
    /// <remarks>JSON libre que guarda el front (plantas elegidas, favoritos, calendario…). <c>{}</c> si no hay.</remarks>
    [HttpGet("preferencias")]
    public async Task<JsonElement> Preferencias(CancellationToken ct) =>
        (await db.Set<PreferenciaUsuario>().AsNoTracking().FirstOrDefaultAsync(p => p.UsuarioId == yo.Id, ct))?.Datos.RootElement
        ?? JsonDocument.Parse("{}").RootElement;

    /// <summary>Guardar mis preferencias</summary>
    /// <remarks>Reemplaza todo el objeto (hasta 64 KB).</remarks>
    [HttpPut("preferencias"), RequestSizeLimit(64 * 1024)]
    public async Task<ActionResult<JsonElement>> GuardarPreferencias(JsonElement datos, CancellationToken ct)
    {
        if (datos.ValueKind != JsonValueKind.Object) return Problem("Las preferencias van en un objeto JSON.", statusCode: 400);
        if (yo.Id is not Guid id) return Unauthorized();
        var p = await db.Set<PreferenciaUsuario>().FirstOrDefaultAsync(x => x.UsuarioId == id, ct);
        if (p is null) db.Set<PreferenciaUsuario>().Add(p = new PreferenciaUsuario { UsuarioId = id });
        p.Datos = JsonDocument.Parse(datos.GetRawText());
        p.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return datos;
    }
}

[ApiController]
[Route("api/v1/usuarios/resumen")]
public class UsuariosResumenController(IAppDbContext db, IUsuarioActual yo) : ControllerBase
{
    /// <summary>Usuarios de mi organización</summary>
    /// <remarks>Id y nombre completo de quien tiene acceso a alguna empresa de la organización (incluye inactivos,
    /// para mostrar autores viejos). Sin permiso de administración.</remarks>
    [HttpGet]
    public Task<List<UsuarioResumen>> Lista(CancellationToken ct) =>
        db.Set<Usuario>()
            .Where(u => db.Set<UsuarioAcceso>().IgnoreQueryFilters().Any(a => a.UsuarioId == u.Id &&
                db.Set<Empresa>().IgnoreQueryFilters().Any(e => e.Id == a.EmpresaId && e.OrganizacionId == yo.OrganizacionId)))
            .OrderBy(u => u.Nombre).ThenBy(u => u.Apellidos)
            .Select(u => new UsuarioResumen(u.Id, u.Apellidos == null ? u.Nombre : u.Nombre + " " + u.Apellidos, u.Activo))
            .ToListAsync(ct);
}

[ApiController]
[Route("api/v1/secuencias/siguiente")]
public class SiguienteFolioController(IAppDbContext db) : ControllerBase
{
    /// <summary>Folio que sigue</summary>
    /// <remarks>El que tendría el próximo documento de esa planta, sin consumirlo (otro usuario puede tomarlo antes).
    /// tipo: cotizacion, pedido, remision. 404 si la planta no tiene esa secuencia o es de otra empresa.</remarks>
    [HttpGet]
    public async Task<ActionResult<FolioResponse>> Siguiente([FromQuery] string tipo, [FromQuery] Guid sucursalId, CancellationToken ct) =>
        await db.Set<Secuencia>().AsNoTracking().FirstOrDefaultAsync(s => s.SucursalId == sucursalId && s.Tipo == tipo, ct) is { } s
            ? new FolioResponse(Secuencia.Folio(s.Prefijo, s.Siguiente))
            : NotFound();
}
