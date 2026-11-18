using System.Text.Json;
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
    // Los roles del sistema (sin organización) solo los crea el seed: un alta va a la organización del usuario, también con root.
    // La organización no cambia al editar.
    protected override void Completar(Rol x, Rol? actual) =>
        x.OrganizacionId = actual is null ? x.OrganizacionId ?? Yo.OrganizacionId : actual.OrganizacionId;

    /// <summary>Roles con permisos y uso</summary>
    /// <remarks>Los mismos que GET /roles, con la lista de permisos y cuántos usuarios lo tienen.</remarks>
    [HttpGet("resumen")]
    public async Task<List<RolResumen>> Resumen(CancellationToken ct)
    {
        var roles = await Consulta().AsNoTracking().OrderBy(r => r.Nombre).ToListAsync(ct);
        var ids = roles.Select(r => r.Id).ToList();
        var permisos = await Db.Set<RolPermiso>().Where(p => ids.Contains(p.RolId)).ToListAsync(ct);
        var usos = await Db.Set<Usuario>().IgnoreQueryFilters().Where(u => !u.IsDeleted && u.RolId != null && ids.Contains(u.RolId.Value))
            .GroupBy(u => u.RolId!.Value).Select(g => new { g.Key, Total = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Total, ct);
        return [.. roles.Select(r => new RolResumen(r.Id, r.Nombre, r.Descripcion, r.OrganizacionId, r.OrganizacionId is null,
            [.. permisos.Where(p => p.RolId == r.Id).Select(p => p.Permiso).Order(StringComparer.Ordinal)], usos.GetValueOrDefault(r.Id)))];
    }

    /// <summary>Reemplazar permisos del rol</summary>
    /// <remarks>Manda la lista completa; se agregan los nuevos y se quitan los que falten. Cada permiso debe existir en
    /// GET /permisos (o ser un comodín como ventas.*). No puedes dar ni quitar permisos que tú no tienes; "*" solo root.
    /// Los roles del sistema solo los cambia root. Devuelve la lista final.</remarks>
    [HttpPut("{id:guid}/permisos")]
    public async Task<ActionResult<List<string>>> CambiarPermisos(Guid id, PermisosRolRequest r, CancellationToken ct)
    {
        var rol = await Consulta().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (rol is null) return NotFound();
        if (!await PermitidoAsync(rol, ct)) return SinAcceso();
        var nuevos = r.Permisos.Select(p => p.Trim()).Where(p => p != "").Distinct().ToList();
        if (nuevos.FirstOrDefault(p => !Permisos.Valido(p)) is { } invalido) return Problem($"No existe el permiso {invalido}.", statusCode: 400);

        var actuales = await Db.Set<RolPermiso>().Where(p => p.RolId == id).ToListAsync(ct);
        var quitar = actuales.Where(p => !nuevos.Contains(p.Permiso)).ToList();
        var agregar = nuevos.Where(p => actuales.All(a => a.Permiso != p)).ToList();
        if (quitar.Select(p => p.Permiso).Concat(agregar).FirstOrDefault(p => !Yo.Tiene(p)) is { } ajeno)
            return PermisoAttribute.SinPermiso(ajeno);

        Db.Set<RolPermiso>().RemoveRange(quitar);
        Db.Set<RolPermiso>().AddRange(agregar.Select(p => new RolPermiso { RolId = id, Permiso = p }));
        await Db.SaveChangesAsync(ct); // un solo SaveChanges = una transacción
        return nuevos.Order(StringComparer.Ordinal).ToList();
    }

    protected override async Task AntesDeBorrar(Rol x, CancellationToken ct)
    {
        if (await Db.Set<Usuario>().IgnoreQueryFilters().AnyAsync(u => u.RolId == x.Id && !u.IsDeleted, ct))
            throw new ReglaException("El rol lo tiene algún usuario: cámbialos de rol antes de eliminarlo.", 409);
    }

    /// <summary>¿Puede yo dar este rol? Visible para él y con permisos que él ya tiene ("*" solo root).</summary>
    public static async Task<bool> PuedeDar(IAppDbContext db, IUsuarioActual yo, Guid rolId, CancellationToken ct) =>
        await db.Set<Rol>().AnyAsync(r => r.Id == rolId && (yo.EsRoot || r.OrganizacionId == null || r.OrganizacionId == yo.OrganizacionId), ct)
        && (await db.Set<RolPermiso>().Where(p => p.RolId == rolId).Select(p => p.Permiso).ToListAsync(ct)).All(yo.Tiene);
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
    protected override Task AntesDeGuardar(RolPermiso x, bool nuevo, CancellationToken ct) =>
        Permisos.Valido(x.Permiso) ? Task.CompletedTask : throw new ReglaException($"No existe el permiso {x.Permiso}.");
}

[ApiController]
[Route("api/v1/permisos")]
public class PermisosController : ControllerBase
{
    /// <summary>Catálogo de permisos</summary>
    /// <remarks>Todos los que pide la API, para armar la pantalla de roles. Además se pueden asignar comodines
    /// por módulo o recurso (ventas.*, ventas.clientes.*); "*" es root.</remarks>
    [HttpGet, Permiso("config.roles.ver")]
    public List<PermisoInfo> Lista() => [.. Permisos.Catalogo()];
}

[Route("api/v1/usuario-accesos")]
public class UsuarioAccesosController(IAppDbContext db, IUsuarioActual yo) : CrudController<UsuarioAcceso>(db, yo)
{
    protected override string Recurso => "config.accesos";
    // El acceso solo dice a qué empresa y plantas entra; los permisos van en el rol del usuario.
    // A un usuario del portal no se le dan accesos internos.
    protected override async Task<bool> PermitidoAsync(UsuarioAcceso x, CancellationToken ct) =>
        await PuedeAsignar(Db, Yo, x, ct)
        && !await Db.Set<Usuario>().IgnoreQueryFilters().AnyAsync(u => u.Id == x.UsuarioId && u.Tipo == Domain.Common.TipoUsuario.Portal, ct);

    /// <summary>Empresa propia (o root) y planta de esa empresa a la que uno también entra.</summary>
    public static async Task<bool> PuedeAsignar(IAppDbContext db, IUsuarioActual yo, UsuarioAcceso x, CancellationToken ct)
    {
        if (yo.EsRoot) return x.SucursalId is not Guid s0 || await db.Set<Sucursal>().AnyAsync(p => p.Id == s0 && p.EmpresaId == x.EmpresaId, ct);
        if (!yo.EmpresaIds.Contains(x.EmpresaId)) return false;
        var mios = await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == yo.Id && a.EmpresaId == x.EmpresaId).ToListAsync(ct);
        if (x.SucursalId is not Guid s) return mios.Any(a => a.SucursalId == null); // todas las plantas: solo si yo entro a todas
        return await db.Set<Sucursal>().AnyAsync(p => p.Id == s && p.EmpresaId == x.EmpresaId, ct)
               && mios.Any(a => a.SucursalId == null || a.SucursalId == s);
    }
}

[Route("api/v1/usuarios")]
public class UsuariosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Usuario>(db, yo)
{
    protected override string Recurso => "config.usuarios";
    // Ve a los usuarios con acceso a sus empresas (UsuarioAcceso ya viene filtrado por empresa).
    // shortcut: un usuario recién creado sin accesos solo lo ve root. Los del portal no salen aquí: se administran desde la
    // ficha del cliente (/clientes/{id}/cuenta-portal).
    protected override IQueryable<Usuario> Consulta() => Db.Set<Usuario>().Where(u => u.Tipo != Domain.Common.TipoUsuario.Portal &&
        (Yo.EsRoot || Db.Set<UsuarioAcceso>().Any(a => a.UsuarioId == u.Id)));
    // No se toca a quien tiene permisos que uno no tiene (p. ej. un admin de empresa no edita al root).
    protected override async Task<bool> PermitidoAsync(Usuario x, CancellationToken ct) =>
        Yo.EsRoot || (await PermisosDe(Db, x.Id, ct)).Efectivos.All(Yo.Tiene);

    /// <summary>Cambio de rol (PUT /usuarios/{id} o alta): nadie cambia el suyo y solo se da un rol cuyos permisos uno tiene.</summary>
    protected override async Task AntesDeGuardar(Usuario x, bool nuevo, CancellationToken ct)
    {
        if (nuevo) x.Tipo = Domain.Common.TipoUsuario.Interno;
        var antes = nuevo ? null : (Guid?)Db.Entry(x).Property(nameof(Usuario.RolId)).OriginalValue;
        if (x.RolId == antes) return;
        if (x.Id == Yo.Id) throw new ReglaException("No puedes cambiar tu propio rol.", 403);
        if (x.RolId is Guid rol && !await RolesController.PuedeDar(Db, Yo, rol, ct))
            throw new ReglaException("No puedes dar ese rol: tiene permisos que tú no tienes o no existe.", 403);
    }

    /// <summary>Lo que le da su rol, sus ajustes y el resultado (igual en todas sus empresas). También lo usa el login.</summary>
    public static async Task<PermisosUsuario> PermisosDe(IAppDbContext db, Guid usuarioId, CancellationToken ct)
    {
        var delRol = await db.Set<Usuario>().IgnoreQueryFilters().Where(u => u.Id == usuarioId)
            .Join(db.Set<RolPermiso>(), u => u.RolId, p => p.RolId, (u, p) => p.Permiso).Distinct().ToListAsync(ct);
        var ajustes = await db.Set<UsuarioPermiso>().Where(p => p.UsuarioId == usuarioId).ToListAsync(ct);
        List<string> Lista(bool quitado) => [.. ajustes.Where(p => p.Quitado == quitado).Select(p => p.Permiso).Order(StringComparer.Ordinal)];
        var (agregados, quitados) = (Lista(false), Lista(true));
        return new(agregados, quitados, [.. delRol.Order(StringComparer.Ordinal)], Permisos.Efectivos(delRol, agregados, quitados));
    }

    /// <summary>Permisos del usuario</summary>
    /// <remarks>agregados y quitados (ajustes del usuario), delRol (permisos de su rol) y efectivos
    /// ((delRol ∪ agregados) menos lo que cubran los quitados; con quitados, los comodines se expanden).</remarks>
    [HttpGet("{id:guid}/permisos")]
    public async Task<ActionResult<PermisosUsuario>> VerPermisos(Guid id, CancellationToken ct) =>
        await Consulta().AnyAsync(x => x.Id == id, ct) ? await PermisosDe(Db, id, ct) : NotFound();

    /// <summary>Ajustar permisos del usuario</summary>
    /// <remarks>Reemplaza agregados y quitados (los quitados admiten comodín: ventas.*). Cada clave debe existir en GET /permisos.
    /// No puedes cambiarte a ti mismo, tocar a quien tiene permisos que tú no tienes, ni agregar o quitar un permiso que no tienes
    /// ("*" solo root). Queda en el historial del usuario. Aplica en su próximo login o refresh (máximo 15 min).</remarks>
    [HttpPut("{id:guid}/permisos")]
    public async Task<ActionResult<PermisosUsuario>> CambiarPermisos(Guid id, PermisosUsuarioRequest r, CancellationToken ct)
    {
        var u = await Consulta().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (u is null) return NotFound();
        if (id == Yo.Id) return Problem("No puedes cambiar tus propios permisos.", statusCode: 403);
        if (!await PermitidoAsync(u, ct)) return SinAcceso();
        var antes = await Db.Set<UsuarioPermiso>().Where(p => p.UsuarioId == id).ToListAsync(ct);
        var (agregados, quitados) = (antes.Where(p => !p.Quitado).Select(p => p.Permiso).ToList(), antes.Where(p => p.Quitado).Select(p => p.Permiso).ToList());
        if (await Ajustar(id, r.Agregados, r.Quitados, antes) is { } error) return error;

        var (nuevosA, nuevosQ) = (Limpia(r.Agregados), Limpia(r.Quitados));
        var detalles = nuevosA.Except(agregados).Select(p => $"Agregado: {p}")
            .Concat(nuevosQ.Except(quitados).Select(p => $"Quitado: {p}"))
            .Concat(agregados.Except(nuevosA).Concat(quitados.Except(nuevosQ)).Select(p => $"Vuelve a lo del rol: {p}")).ToList();
        if (detalles.Count > 0 && Yo.OrganizacionId is Guid org)
            Db.Set<Evento>().Add(new Evento
            {
                OrganizacionId = org, RegistroTipo = nameof(Usuario), RegistroId = id, Fecha = DateTime.UtcNow, AutorId = Yo.Id,
                SesionId = Yo.SesionId, Tipo = Domain.Common.TipoEvento.Cambio, Texto = "Permisos cambiados",
                Detalles = JsonSerializer.Serialize(detalles),
            });
        await Db.SaveChangesAsync(ct);
        return await PermisosDe(Db, id, ct);
    }

    static List<string> Limpia(IEnumerable<string>? permisos) =>
        [.. (permisos ?? []).Select(p => p.Trim()).Where(p => p != "").Distinct()];

    /// <summary>Valida y deja los ajustes nuevos en el contexto (sin guardar). Devuelve el error, o null si todo bien.</summary>
    async Task<ActionResult?> Ajustar(Guid usuarioId, IEnumerable<string>? agregar, IEnumerable<string>? quitar, List<UsuarioPermiso> antes)
    {
        var (agregados, quitados) = (Limpia(agregar), Limpia(quitar));
        if (agregados.Concat(quitados).FirstOrDefault(p => !Permisos.Valido(p)) is { } invalido)
            return Problem($"No existe el permiso {invalido}.", statusCode: 400);
        if (agregados.Intersect(quitados).FirstOrDefault() is { } doble)
            return Problem($"{doble} no puede estar agregado y quitado a la vez.", statusCode: 400);
        // Solo se revisa lo que cambia: nadie agrega ni quita (ni devuelve al rol) un permiso que no tiene.
        var iguales = antes.Where(p => p.Quitado ? quitados.Contains(p.Permiso) : agregados.Contains(p.Permiso)).Select(p => p.Permiso).ToHashSet();
        var cambiados = agregados.Concat(quitados).Concat(antes.Select(p => p.Permiso)).Where(p => !iguales.Contains(p));
        if (cambiados.FirstOrDefault(p => !Yo.Tiene(p)) is { } ajeno) return PermisoAttribute.SinPermiso(ajeno);

        Db.Set<UsuarioPermiso>().RemoveRange(antes);
        Db.Set<UsuarioPermiso>().AddRange(agregados.Select(p => new UsuarioPermiso { UsuarioId = usuarioId, Permiso = p })
            .Concat(quitados.Select(p => new UsuarioPermiso { UsuarioId = usuarioId, Permiso = p, Quitado = true })));
        return null;
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

    /// <summary>Alta con accesos</summary>
    /// <remarks>Crea el usuario interno, sus accesos, sus ajustes de permisos (agregados/quitados, opcionales) y (si viene)
    /// su contraseña en una sola transacción. Pide además
    /// config.accesos.crear. 403 si un rol tiene permisos que tú no tienes o la empresa no es tuya; 409 si el correo existe.</remarks>
    [HttpPost("alta")]
    public async Task<ActionResult<Usuario>> Alta(AltaUsuarioRequest r, CancellationToken ct)
    {
        if (!Yo.Tiene("config.accesos.crear")) return PermisoAttribute.SinPermiso("config.accesos.crear");
        var u = new Usuario
        {
            Correo = r.Correo, Nombre = r.Nombre, Apellidos = r.Apellidos, Telefono = r.Telefono, Puesto = r.Puesto,
            Tipo = Domain.Common.TipoUsuario.Interno,
        };
        if (r.Password is { } password) u.PasswordHash = AuthController.Hasher.HashPassword(u, password);
        if (r.RolId is Guid rol && !await RolesController.PuedeDar(Db, Yo, rol, ct)) return SinAcceso();
        u.RolId = r.RolId;
        Db.Set<Usuario>().Add(u); // aquí EF le da su Id; si algo falla abajo no se guarda nada
        var accesos = r.Accesos.Select(a => Acceso(u.Id, a)).ToList();
        foreach (var a in accesos)
            if (!await UsuarioAccesosController.PuedeAsignar(Db, Yo, a, ct)) return SinAcceso();

        Db.Set<UsuarioAcceso>().AddRange(accesos);
        if (await Ajustar(u.Id, r.Agregados, r.Quitados, []) is { } error) return error;
        await Db.SaveChangesAsync(ct); // un solo SaveChanges = una transacción
        return CreatedAtAction(nameof(Uno), new { id = u.Id }, u);
    }

    /// <summary>Reemplazar accesos</summary>
    /// <remarks>Deja exactamente estos accesos en las empresas que tú ves (los de otras empresas no se tocan). Pide además
    /// config.accesos.editar y las mismas reglas que el alta. Devuelve los accesos visibles resultantes.</remarks>
    [HttpPut("{id:guid}/accesos")]
    public async Task<ActionResult<List<UsuarioAcceso>>> Accesos(Guid id, AccesosRequest r, CancellationToken ct)
    {
        if (!Yo.Tiene("config.accesos.editar")) return PermisoAttribute.SinPermiso("config.accesos.editar");
        var u = await Consulta().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (u is null) return NotFound();
        if (!await PermitidoAsync(u, ct)) return SinAcceso();

        var actuales = await Db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == id).ToListAsync(ct); // ya filtrados por empresa
        var nuevos = r.Accesos.Select(a => Acceso(id, a)).ToList();
        foreach (var a in nuevos.Concat(actuales))
            if (!await UsuarioAccesosController.PuedeAsignar(Db, Yo, a, ct)) return SinAcceso();

        // Se conserva el renglón si coincide empresa y planta (solo cambia rol o predeterminado); el resto se quita o agrega.
        foreach (var a in actuales)
            if (nuevos.FirstOrDefault(n => n.EmpresaId == a.EmpresaId && n.SucursalId == a.SucursalId) is { } n)
            {
                a.Predeterminado = n.Predeterminado;
                nuevos.Remove(n);
            }
            else Db.Set<UsuarioAcceso>().Remove(a);
        Db.Set<UsuarioAcceso>().AddRange(nuevos);
        await Db.SaveChangesAsync(ct);
        return await Db.Set<UsuarioAcceso>().AsNoTracking().Where(a => a.UsuarioId == id).ToListAsync(ct);
    }

    static UsuarioAcceso Acceso(Guid usuarioId, AccesoRequest a) => new()
    {
        UsuarioId = usuarioId, EmpresaId = a.EmpresaId, SucursalId = a.SucursalId, Predeterminado = a.Predeterminado,
    };
}

[Route("api/v1/actividades")]
public class ActividadesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Actividad>(db, yo)
{
    protected override string Recurso => "general.actividades";

    /// <summary>Al programar, marcar hecha o cancelar, deja un evento en el hilo del registro al que pertenece.</summary>
    protected override async Task AntesDeGuardar(Actividad x, bool nuevo, CancellationToken ct)
    {
        var e = Db.Entry(x);
        bool Recien(string campo) => !nuevo && e.Property(campo).OriginalValue is null && e.Property(campo).CurrentValue is not null;
        var accion = nuevo ? "programada"
            : Recien(nameof(Actividad.HechaEn)) ? "realizada"
            : Recien(nameof(Actividad.CanceladaEn)) ? "cancelada"
            : null;
        if (accion is null) return;

        var asignada = await Db.Set<Usuario>().Where(u => u.Id == x.AsignadaAId)
            .Select(u => u.Apellidos == null ? u.Nombre : u.Nombre + " " + u.Apellidos).FirstOrDefaultAsync(ct);
        Db.Set<Evento>().Add(new Evento
        {
            OrganizacionId = x.OrganizacionId, RegistroTipo = x.RegistroTipo, RegistroId = x.RegistroId, Fecha = DateTime.UtcNow,
            AutorId = Yo.Id, SesionId = Yo.SesionId, Tipo = Domain.Common.TipoEvento.Actividad,
            Texto = $"Actividad {accion}: {Etiqueta(x.Tipo)} · {x.Resumen}",
            Detalles = JsonSerializer.Serialize(new[] { $"Fecha límite: {x.FechaLimite:dd/MM/yyyy}", $"Asignada a: {asignada}" }),
        });
    }

    static string Etiqueta(Domain.Common.TipoActividad t) => t switch
    {
        Domain.Common.TipoActividad.Reunion => "Reunión",
        _ => t.ToString(),
    };

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
