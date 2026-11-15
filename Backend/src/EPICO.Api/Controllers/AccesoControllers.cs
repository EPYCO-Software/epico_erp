using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Contracts.Auth;
using EPICO.Domain.Acceso;
using EPICO.Domain.Historial;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

// CRUD de organización, acceso e historial. Las reglas extra de cada tabla van en Consulta/PermitidoAsync.

[Route("api/v1/organizaciones")]
public class OrganizacionesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Organizacion>(db, yo)
{
    protected override string Recurso => "config.organizaciones";
    protected override IQueryable<Organizacion> Consulta() => Db.Set<Organizacion>().Where(o => Yo.EsRoot || o.Id == Yo.OrganizacionId);
    // Crear organizaciones solo lo hace root (el Id de una nueva nunca es la del usuario).
    protected override Task<bool> PermitidoAsync(Organizacion x, CancellationToken ct) => Task.FromResult(Yo.EsRoot || x.Id == Yo.OrganizacionId);
}

[Route("api/v1/empresas")]
public class EmpresasController(IAppDbContext db, IUsuarioActual yo) : CrudController<Empresa>(db, yo)
{
    protected override string Recurso => "config.empresas";
}

[Route("api/v1/sucursales")]
public class SucursalesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Sucursal>(db, yo)
{
    protected override string Recurso => "config.sucursales";
}

[Route("api/v1/secuencias")]
public class SecuenciasController(IAppDbContext db, IUsuarioActual yo) : CrudController<Secuencia>(db, yo)
{
    protected override string Recurso => "config.secuencias";
}

[Route("api/v1/roles")]
public class RolesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Rol>(db, yo)
{
    protected override string Recurso => "config.roles";
    // Se ven los roles del sistema y los de su organización; solo root toca los del sistema.
    protected override IQueryable<Rol> Consulta() =>
        Db.Set<Rol>().Where(r => Yo.EsRoot || r.OrganizacionId == null || r.OrganizacionId == Yo.OrganizacionId);
    protected override Task<bool> PermitidoAsync(Rol x, CancellationToken ct) =>
        Task.FromResult(Yo.EsRoot || x.OrganizacionId != null && x.OrganizacionId == Yo.OrganizacionId);
}

[Route("api/v1/rol-permisos")]
public class RolPermisosController(IAppDbContext db, IUsuarioActual yo) : CrudController<RolPermiso>(db, yo)
{
    protected override string Recurso => "config.roles";
    protected override IQueryable<RolPermiso> Consulta() =>
        Db.Set<RolPermiso>().Where(p => Db.Set<Rol>().Any(r => r.Id == p.RolId && (Yo.EsRoot || r.OrganizacionId == null || r.OrganizacionId == Yo.OrganizacionId)));
    // Nadie reparte un permiso que no tiene: "*" solo lo da root.
    protected override async Task<bool> PermitidoAsync(RolPermiso x, CancellationToken ct) =>
        Yo.Tiene(x.Permiso) && await Db.Set<Rol>().AnyAsync(r => r.Id == x.RolId && (Yo.EsRoot || r.OrganizacionId == Yo.OrganizacionId), ct);
}

[Route("api/v1/usuario-accesos")]
public class UsuarioAccesosController(IAppDbContext db, IUsuarioActual yo) : CrudController<UsuarioAcceso>(db, yo)
{
    protected override string Recurso => "config.accesos";
    // Además de la empresa: solo asigna roles cuyos permisos tiene él mismo (si no, cualquiera se haría admin).
    protected override async Task<bool> PermitidoAsync(UsuarioAcceso x, CancellationToken ct)
    {
        if (!await base.PermitidoAsync(x, ct)) return false;
        var permisos = await Db.Set<RolPermiso>().Where(p => p.RolId == x.RolId).Select(p => p.Permiso).ToListAsync(ct);
        return permisos.All(Yo.Tiene) && await Db.Set<Rol>().AnyAsync(r => r.Id == x.RolId, ct);
    }
}

[Route("api/v1/usuarios")]
public class UsuariosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Usuario>(db, yo)
{
    protected override string Recurso => "config.usuarios";
    // Ve a los usuarios con acceso a sus empresas (UsuarioAcceso ya viene filtrado por empresa).
    // shortcut: un usuario recién creado sin accesos solo lo ve root; los clientes del portal llegan con ClienteContacto.
    protected override IQueryable<Usuario> Consulta() =>
        Db.Set<Usuario>().Where(u => Yo.EsRoot || Db.Set<UsuarioAcceso>().Any(a => a.UsuarioId == u.Id));
    // No se toca a quien tiene permisos que uno no tiene (p. ej. un admin de empresa no edita al root).
    protected override async Task<bool> PermitidoAsync(Usuario x, CancellationToken ct)
    {
        if (Yo.EsRoot) return true;
        var permisos = await Db.Set<UsuarioAcceso>().IgnoreQueryFilters().Where(a => a.UsuarioId == x.Id)
            .Join(Db.Set<RolPermiso>(), a => a.RolId, p => p.RolId, (a, p) => p.Permiso).Distinct().ToListAsync(ct);
        return permisos.All(Yo.Tiene);
    }

    /// <summary>Asignar contraseña</summary>
    /// <remarks>El alta por POST deja al usuario sin poder entrar hasta que se le asigne. No se puede con usuarios que tengan permisos que tú no tienes.</remarks>
    [HttpPut("{id:guid}/password")]
    public async Task<IActionResult> Password(Guid id, PasswordRequest r, CancellationToken ct)
    {
        var u = await Consulta().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (u is null) return NotFound();
        if (!await PermitidoAsync(u, ct)) return SinAcceso();
        u.PasswordHash = AuthController.Hasher.HashPassword(u, r.Password);
        u.IntentosFallidos = 0;
        u.BloqueadoHasta = null;
        await Db.SaveChangesAsync(ct);
        return NoContent();
    }
}

[Route("api/v1/actividades")]
public class ActividadesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Actividad>(db, yo)
{
    protected override string Recurso => "general.actividades";

    /// <summary>Actividades de un registro</summary>
    /// <remarks>tipo = nombre de la tabla (Cotizacion, Cliente…).</remarks>
    [HttpGet("registro/{tipo}/{id:guid}")]
    public Task<List<Actividad>> DeRegistro(string tipo, Guid id, CancellationToken ct) =>
        Consulta().AsNoTracking().Where(a => a.RegistroTipo == tipo && a.RegistroId == id).OrderBy(a => a.FechaLimite).ToListAsync(ct);
}

[Route("api/v1/seguidores")]
public class SeguidoresController(IAppDbContext db, IUsuarioActual yo) : CrudController<Seguidor>(db, yo)
{
    protected override string Recurso => "general.seguidores";
    // shortcut: Seguidor no tiene organización; cualquiera con el permiso ve los de todas. Agregar OrganizacionId si importa.
}

[ApiController]
[Route("api/v1/historial")]
public class HistorialController(IAppDbContext db, IUsuarioActual yo) : ControllerBase
{
    /// <summary>Hilo de un registro</summary>
    /// <remarks>Eventos con sus cambios, del más nuevo al más viejo; incluye lo anotado en sus líneas (RegistroPadre). tipo = nombre de la tabla (Cotizacion, Empresa…).</remarks>
    [HttpGet("{tipo}/{id:guid}"), Permiso("general.historial.ver")]
    public Task<List<Evento>> Hilo(string tipo, Guid id, CancellationToken ct) =>
        db.Set<Evento>().AsNoTracking().Include(e => e.Cambios.OrderBy(c => c.Orden))
            .Where(e => e.RegistroTipo == tipo && e.RegistroId == id || e.RegistroPadreTipo == tipo && e.RegistroPadreId == id)
            .OrderByDescending(e => e.Fecha).ToListAsync(ct);

    /// <summary>Agregar nota</summary>
    /// <remarks>Nota interna en el hilo del registro.</remarks>
    [HttpPost("{tipo}/{id:guid}/notas"), Permiso("general.historial.crear")]
    public async Task<ActionResult<Evento>> Nota(string tipo, Guid id, NotaRequest r, CancellationToken ct)
    {
        if (yo.OrganizacionId is not Guid org) return Problem("Tu usuario no pertenece a una organización.", statusCode: 403);
        var ev = new Evento
        {
            OrganizacionId = org, RegistroTipo = tipo, RegistroId = id, Fecha = DateTime.UtcNow,
            AutorId = yo.Id, SesionId = yo.SesionId, Tipo = Domain.Common.TipoEvento.Nota, Texto = r.Texto,
        };
        db.Set<Evento>().Add(ev);
        await db.SaveChangesAsync(ct);
        return ev;
    }
}

[ApiController]
[Route("api/v1/sesiones")]
public class SesionesController(IAppDbContext db, IUsuarioActual yo) : ControllerBase
{
    IQueryable<Sesion> Visibles() =>
        db.Set<Sesion>().Where(s => yo.EsRoot || s.UsuarioId == yo.Id || db.Set<UsuarioAcceso>().Any(a => a.UsuarioId == s.UsuarioId));

    /// <summary>Sesiones de un usuario</summary>
    /// <remarks>Historial de accesos: ?usuarioId=…</remarks>
    [HttpGet, Permiso("config.sesiones.ver")]
    public async Task<List<SesionDto>> Lista([FromQuery] Guid usuarioId, CancellationToken ct) =>
        (await Visibles().AsNoTracking().Where(s => s.UsuarioId == usuarioId).OrderByDescending(s => s.CreadaEn).Take(200).ToListAsync(ct))
        .Select(s => new SesionDto(s.Id, s.UsuarioId, s.EmpresaId, s.CreadaEn, s.ExpiraEn, s.RevocadaEn, s.Ip?.ToString(), s.Agente))
        .ToList();

    /// <summary>Revocar sesión</summary>
    /// <remarks>Su refresh token deja de servir; el access token vive hasta 15 min.</remarks>
    [HttpDelete("{id:guid}"), Permiso("config.sesiones.eliminar")]
    public async Task<IActionResult> Revocar(Guid id, CancellationToken ct)
    {
        var s = await Visibles().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        s.RevocadaEn ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
