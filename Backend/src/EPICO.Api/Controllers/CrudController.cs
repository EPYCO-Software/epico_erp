using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json.Serialization;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Domain.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

/// <summary>
/// CRUD de una tabla: GET lista, GET {id}, POST, PUT {id}, DELETE {id} (lógico si tiene IsDeleted).
/// Permiso por verbo: {Recurso}.ver / .crear / .editar / .eliminar. Los filtros globales (borrado, empresa,
/// organización) ya limitan lo que se lee; PermitidoAsync revisa lo que se escribe.
/// </summary>
[ApiController]
public abstract class CrudController<T>(IAppDbContext db, IUsuarioActual yo) : ControllerBase, IAsyncActionFilter
    where T : class, IEntidad
{
    protected IAppDbContext Db => db;
    protected IUsuarioActual Yo => yo;

    /// <summary>Prefijo del permiso, p. ej. config.empresas.</summary>
    protected abstract string Recurso { get; }

    protected virtual IQueryable<T> Consulta() => db.Set<T>();

    /// <summary>¿Puede el usuario escribir este registro? Se revisa con el valor guardado y con el nuevo.</summary>
    protected virtual Task<bool> PermitidoAsync(T x, CancellationToken ct) => Task.FromResult(yo.EsRoot ||
        (x is not IDeEmpresa e || yo.EmpresaIds.Contains(e.EmpresaId)) &&
        (x is not IDeOrganizacion o || o.OrganizacionId == yo.OrganizacionId) &&
        (x is not IRestringible r || r.EmpresaRestringidaId is not Guid er || yo.EmpresaIds.Contains(er)));

    /// <summary>Para tablas que cuelgan de otra (contactos de un cliente…): se puede escribir si se ve el padre.</summary>
    protected Task<bool> PadreVisible<TPadre>(Guid id, CancellationToken ct) where TPadre : class, IEntidad =>
        db.Set<TPadre>().AnyAsync(p => p.Id == id, ct);

    /// <summary>
    /// Datos que el cliente puede omitir, antes de revisar permisos. Base: organizacionId vacío = la del registro guardado
    /// (al editar) o la del usuario (al crear).
    /// </summary>
    protected virtual void Completar(T x, T? actual)
    {
        if (x is not IDeOrganizacion { OrganizacionId: var o } d || o != Guid.Empty) return;
        if (actual is IDeOrganizacion a) d.OrganizacionId = a.OrganizacionId;
        else if (yo.OrganizacionId is Guid org) d.OrganizacionId = org;
    }

    /// <summary>Último paso antes de guardar (dentro de la transacción del alta): folios, valores derivados…</summary>
    protected virtual Task AntesDeGuardar(T x, bool nuevo, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Filtros de GET lista. Base: igualdad por campo (FiltroQuery); un CRUD puede sumar los suyos (?q=…).</summary>
    protected virtual IQueryable<T> Filtrar(IQueryable<T> q) => FiltroQuery.Aplicar(q, Request.Query);

    /// <summary>Para impedir el borrado (lanza ReglaException) si el registro está en uso.</summary>
    protected virtual Task AntesDeBorrar(T x, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Lista</summary>
    /// <remarks>Hasta 500 por página (skip/take). Filtra por igualdad con cualquier campo en la query:
    /// <c>?clienteId=…&amp;activo=true&amp;estado=por_cobrar</c>; un campo que no existe da 400.</remarks>
    [HttpGet]
    public async Task<List<T>> Lista([FromQuery, Range(0, int.MaxValue)] int skip = 0, [FromQuery, Range(1, 500)] int take = 100, CancellationToken ct = default) =>
        await Filtrar(Consulta().AsNoTracking()).OrderBy(x => x.Id).Skip(skip).Take(take).ToListAsync(ct);

    /// <summary>Uno por id</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<T>> Uno(Guid id, CancellationToken ct) =>
        await Consulta().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) is { } x ? x : NotFound();

    /// <summary>Crear</summary>
    /// <remarks>Id, auditoría e isDeleted se ignoran. organizacionId vacío = la del usuario.</remarks>
    [HttpPost]
    public async Task<ActionResult<T>> Crear(T x, CancellationToken ct)
    {
        x.Id = Guid.Empty; // lo genera EF
        if (x is BaseEntity b) b.IsDeleted = false;
        Completar(x, null);
        if (!await PermitidoAsync(x, ct)) return SinAcceso();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await AntesDeGuardar(x, true, ct);
        db.Set<T>().Add(x);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return CreatedAtAction(nameof(Uno), new { id = x.Id }, x);
    }

    /// <summary>Editar</summary>
    /// <remarks>Manda el registro completo; los campos de solo lectura se ignoran.</remarks>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<T>> Editar(Guid id, T x, CancellationToken ct)
    {
        var actual = await Consulta().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (actual is null) return NotFound();
        Completar(x, actual);
        if (!await PermitidoAsync(actual, ct) || !await PermitidoAsync(x, ct)) return SinAcceso();

        var entry = db.Entry(actual);
        foreach (var p in entry.Properties)
            if (p.Metadata.PropertyInfo is { } info && Editable(info))
                p.CurrentValue = info.GetValue(x);
        await AntesDeGuardar(actual, false, ct);
        await db.SaveChangesAsync(ct);
        return actual;
    }

    /// <summary>Eliminar</summary>
    /// <remarks>Borrado lógico si la tabla lo tiene.</remarks>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var actual = await Consulta().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (actual is null) return NotFound();
        if (!await PermitidoAsync(actual, ct)) return SinAcceso();
        await AntesDeBorrar(actual, ct);
        db.Set<T>().Remove(actual);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    static readonly HashSet<string> Base = [.. typeof(BaseEntity).GetProperties().Select(p => p.Name)];

    /// <summary>Lo que el cliente puede cambiar: ni la base, ni lo oculto ([JsonIgnore]), ni lo de solo lectura.</summary>
    internal static bool Editable(PropertyInfo p) =>
        !Base.Contains(p.Name) && p.CanWrite &&
        p.GetCustomAttribute<JsonIgnoreAttribute>() is null &&
        p.GetCustomAttribute<EditableAttribute>() is not { AllowEdit: false };

    protected ObjectResult SinAcceso() =>
        Problem("No tienes acceso a ese registro (empresa u organización).", statusCode: 403);

    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext c, ActionExecutionDelegate next)
    {
        var permiso = PermisoAttribute.DeCrud(Recurso, Request.Method);
        if (yo.Tiene(permiso)) await next();
        else c.Result = PermisoAttribute.SinPermiso(permiso);
    }
}
