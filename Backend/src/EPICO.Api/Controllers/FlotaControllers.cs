using System.Globalization;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Application.Flota;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

[ApiController]
[Route("api/v1/flota")]
public class FlotaController(FlotaServicio flota, IUsuarioActual yo) : ControllerBase
{
    /// <summary>Tablero de flota</summary>
    /// <remarks>Equipos visibles con planta, viaje en curso, disponibilidad y posición GPS (null sin GPS).
    /// Sin pedidoId: disponible = activo, estado disponible y sin viaje sin terminar. Con pedidoId: ocupado si tiene otro viaje
    /// sin terminar de una orden con entrega a ±4 h de esta; los que ya van en esta orden salen no disponibles.
    /// Pide flota.equipos.ver o ventas.pedidos.ver.</remarks>
    [HttpGet("tablero")]
    public async Task<ActionResult<TableroFlota>> Tablero([FromQuery] Guid? pedidoId, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "flota.equipos.ver", "ventas.pedidos.ver") is { } no ? no : await flota.Tablero(pedidoId, ct);

    /// <summary>Dispositivos GPS</summary>
    /// <remarks>Los de Traccar con su última posición y el equipo vinculado (Equipo.GpsId = uniqueId). configurado=false si falta
    /// Traccar:Url o Traccar:Token.</remarks>
    [HttpGet("gps"), Permiso("flota.equipos.ver")]
    public Task<GpsLectura> Gps(CancellationToken ct) => flota.Gps(ct);

    /// <summary>Posiciones actuales</summary>
    /// <remarks>Última posición (de los últimos 7 días) de cada unidad activa visible, con sensores y su viaje en curso.
    /// Pide flota.equipos.ver u operacion.remisiones.ver.</remarks>
    [HttpGet("posiciones")]
    public async Task<ActionResult<List<PosicionUnidad>>> Posiciones(CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "flota.equipos.ver", "operacion.remisiones.ver") is { } no ? no : await flota.PosicionesActuales(ct);

    /// <summary>Línea de tiempo del día</summary>
    /// <remarks>Por unidad activa visible (que opere en sucursalId, si viene; también las que no tienen viajes): sus viajes de órdenes
    /// con entrega ese día (fecha YYYY-MM-DD en la hora de la planta) con etapas carga · ida · obra · regreso (reales con los timestamps
    /// del viaje, la en curso hasta ahora y el resto planeado) y sus mantenimientos. Pide flota.equipos.ver u operacion.remisiones.ver.</remarks>
    [HttpGet("linea-tiempo")]
    public async Task<ActionResult<List<LineaUnidad>>> LineaTiempo([FromQuery] DateOnly fecha, [FromQuery] Guid? sucursalId, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "flota.equipos.ver", "operacion.remisiones.ver") is { } no ? no : await flota.LineaDeTiempo(fecha, sucursalId, ct);

    /// <summary>Indicadores de operación</summary>
    /// <remarks>Viajes de órdenes no canceladas con entrega en desde/hasta (ISO 8601; por omisión los últimos 30 días), de sucursalId si
    /// viene: totales, por unidad, conductor, cliente, vendedor y día, y los prolongados (más de 90 min en obra). Ciclo = terminadaEn −
    /// (cargandoEn ?? salidaEn); en obra = regresandoEn − llegadaEn; m³ solo de ollas.</remarks>
    [HttpGet("indicadores"), Permiso("operacion.remisiones.ver")]
    public Task<IndicadoresFlota> Indicadores([FromQuery] DateTimeOffset? desde, [FromQuery] DateTimeOffset? hasta, [FromQuery] Guid? sucursalId,
        CancellationToken ct) => flota.Indicadores(desde, hasta, sucursalId, ct);

    /// <summary>Checklist de inspección</summary>
    /// <remarks>tipo = un TipoEquipo (revolvedor, bomba_pluma, volteo…): la lista fija de su categoría (olla, bomba, carga o maquinaria).
    /// crítico = si falla, la inspección queda rechazada.</remarks>
    [HttpGet("checklist")]
    public ActionResult<ItemChecklist[]> Checklist([FromQuery] string tipo) =>
        ViajesController.SinPermiso(yo, "flota.equipos.ver", "flota.inspecciones.ver") is { } no ? no
        : Application.Flota.Checklist.De(ReglaException.Opcion<Domain.Common.TipoEquipo>(tipo));

    /// <summary>Despacho del día</summary>
    /// <remarks>Órdenes no canceladas con entrega ese día (fecha YYYY-MM-DD en la hora de su planta), por hora de entrega, con sus
    /// viajes. Incluye las por confirmar (confirmadaEn null). Pide operacion.remisiones.ver o ventas.pedidos.ver.</remarks>
    [HttpGet("despacho")]
    public async Task<ActionResult<List<DespachoOrden>>> Despacho([FromQuery] DateOnly fecha, [FromQuery] Guid? sucursalId, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "operacion.remisiones.ver", "ventas.pedidos.ver") is { } no ? no : await flota.Despacho(fecha, sucursalId, ct);

    /// <summary>Vencimientos</summary>
    /// <remarks>Documentos de unidades, licencias de operadores activos y mantenimientos programados (programadoPara) vencidos o
    /// que vencen en los próximos <c>dias</c> (30 por omisión), por fecha. Solo unidades activas.</remarks>
    [HttpGet("vencimientos"), Permiso("flota.equipos.ver")]
    public Task<List<Vencimiento>> Vencimientos(CancellationToken ct, [FromQuery] int dias = 30) => flota.Vencimientos(dias, ct);
}

[Route("api/v1/operadores")]
public class OperadoresController(IAppDbContext db, IUsuarioActual yo) : CrudController<Operador>(db, yo)
{
    protected override string Recurso => "flota.operadores";

    protected override async Task<bool> PermitidoAsync(Operador x, CancellationToken ct) =>
        await base.PermitidoAsync(x, ct) && (x.SucursalId is not Guid s || await PadreVisible<Sucursal>(s, ct));
}

/// <remarks>Lista: ?equipoId=…</remarks>
[Route("api/v1/equipo-documentos")]
public class EquipoDocumentosController(IAppDbContext db, IUsuarioActual yo) : CrudController<DocumentoEquipo>(db, yo)
{
    protected override string Recurso => "flota.equipos";
    protected override Task<bool> PermitidoAsync(DocumentoEquipo x, CancellationToken ct) => PadreVisible<Equipo>(x.EquipoId, ct);
}

/// <summary>Cargas de combustible. Al guardar actualizan el último odómetro y horómetro del equipo.</summary>
/// <remarks>Lista: ?equipoId=…&amp;desde=…&amp;hasta=… (fecha ISO 8601, hasta exclusivo).</remarks>
[Route("api/v1/cargas-combustible")]
public class CargasCombustibleController(IAppDbContext db, IUsuarioActual yo) : CrudController<CargaCombustible>(db, yo)
{
    protected override string Recurso => "flota.combustible";
    protected override Task<bool> PermitidoAsync(CargaCombustible x, CancellationToken ct) => PadreVisible<Equipo>(x.EquipoId, ct);

    protected override IQueryable<CargaCombustible> Filtrar(IQueryable<CargaCombustible> q)
    {
        if (DateTimeOffset.TryParse(Request.Query["desde"], CultureInfo.InvariantCulture, out var d)) q = q.Where(c => c.Fecha >= d.UtcDateTime);
        if (DateTimeOffset.TryParse(Request.Query["hasta"], CultureInfo.InvariantCulture, out var h)) q = q.Where(c => c.Fecha < h.UtcDateTime);
        return FiltroQuery.Aplicar(q, Request.Query, "desde", "hasta");
    }

    /// <summary>Sin planta = la del equipo. Odómetro y horómetro no bajan respecto a las cargas anteriores de la unidad ni pasan a
    /// las siguientes (400; al editar no cuenta la propia carga).</summary>
    // shortcut: editar o borrar una carga no recalcula el último odómetro del equipo (se queda el mayor visto).
    protected override async Task AntesDeGuardar(CargaCombustible x, bool nuevo, CancellationToken ct)
    {
        var e = await Db.Set<Equipo>().FirstAsync(q => q.Id == x.EquipoId, ct);
        if (x.SucursalId == Guid.Empty) x.SucursalId = e.SucursalId;
        if (x.Fecha == default) x.Fecha = DateTime.UtcNow;
        var anteriores = Db.Set<CargaCombustible>().Where(c => c.EquipoId == x.EquipoId && c.Id != x.Id && c.Fecha <= x.Fecha);
        if (x.OdometroKm is decimal km && await anteriores.MaxAsync(c => c.OdometroKm, ct) is decimal antes && km < antes)
            throw new ReglaException($"El odómetro no puede ser menor al de la carga anterior ({Num(antes)} km).");
        if (x.Horometro is decimal hr && await anteriores.MaxAsync(c => c.Horometro, ct) is decimal antesH && hr < antesH)
            throw new ReglaException($"El horómetro no puede ser menor al de la carga anterior ({Num(antesH)} h).");
        // Una carga con fecha atrasada tampoco puede pasar a las siguientes (daría rendimiento negativo).
        var siguientes = Db.Set<CargaCombustible>().Where(c => c.EquipoId == x.EquipoId && c.Id != x.Id && c.Fecha > x.Fecha);
        if (x.OdometroKm is decimal km2 && await siguientes.MinAsync(c => c.OdometroKm, ct) is decimal despues && km2 > despues)
            throw new ReglaException($"El odómetro no puede ser mayor al de la carga siguiente ({Num(despues)} km).");
        if (x.Horometro is decimal hr2 && await siguientes.MinAsync(c => c.Horometro, ct) is decimal despuesH && hr2 > despuesH)
            throw new ReglaException($"El horómetro no puede ser mayor al de la carga siguiente ({Num(despuesH)} h).");
        if (x.OdometroKm > (e.UltimoOdometroKm ?? 0)) e.UltimoOdometroKm = x.OdometroKm;
        if (x.Horometro > (e.UltimoHorometro ?? 0)) e.UltimoHorometro = x.Horometro;
    }

    static string Num(decimal n) => n.ToString("#,0.#", CultureInfo.InvariantCulture);
}

/// <summary>Trayectos (recorridos) de las unidades. Con los dos odómetros, km = fin − inicio y deja de ser estimado.
/// Al terminar un viaje se crea uno de tipo entrega con km estimados.</summary>
/// <remarks>Lista: ?equipoId=…&amp;desde=…&amp;hasta=… (por inicio, ISO 8601, hasta exclusivo).</remarks>
[Route("api/v1/trayectos")]
public class TrayectosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Trayecto>(db, yo)
{
    protected override string Recurso => "flota.trayectos";
    protected override Task<bool> PermitidoAsync(Trayecto x, CancellationToken ct) => PadreVisible<Equipo>(x.EquipoId, ct);

    protected override IQueryable<Trayecto> Filtrar(IQueryable<Trayecto> q)
    {
        if (DateTimeOffset.TryParse(Request.Query["desde"], CultureInfo.InvariantCulture, out var d)) q = q.Where(t => t.Inicio >= d.UtcDateTime);
        if (DateTimeOffset.TryParse(Request.Query["hasta"], CultureInfo.InvariantCulture, out var h)) q = q.Where(t => t.Inicio < h.UtcDateTime);
        return FiltroQuery.Aplicar(q, Request.Query, "desde", "hasta");
    }

    protected override Task AntesDeGuardar(Trayecto x, bool nuevo, CancellationToken ct)
    {
        if (x.Fin < x.Inicio) throw new ReglaException("El fin no puede ser antes del inicio.");
        if (x is { OdometroInicio: decimal ini, OdometroFin: decimal fin })
        {
            if (fin < ini) throw new ReglaException("El odómetro final no puede ser menor al inicial.");
            (x.Km, x.KmEstimado) = (fin - ini, false);
        }
        return Task.CompletedTask;
    }
}

/// <summary>Inspecciones de las unidades. El resultado lo calcula la API con el checklist (GET /flota/checklist).</summary>
/// <remarks>Lista: ?equipoId=…&amp;desde=…&amp;hasta=… (por fecha, ISO 8601, hasta exclusivo).</remarks>
[Route("api/v1/inspecciones")]
public class InspeccionesController(IAppDbContext db, IUsuarioActual yo) : CrudController<InspeccionEquipo>(db, yo)
{
    protected override string Recurso => "flota.inspecciones";
    protected override Task<bool> PermitidoAsync(InspeccionEquipo x, CancellationToken ct) => PadreVisible<Equipo>(x.EquipoId, ct);

    protected override IQueryable<InspeccionEquipo> Filtrar(IQueryable<InspeccionEquipo> q)
    {
        if (DateTimeOffset.TryParse(Request.Query["desde"], CultureInfo.InvariantCulture, out var d)) q = q.Where(i => i.Fecha >= d.UtcDateTime);
        if (DateTimeOffset.TryParse(Request.Query["hasta"], CultureInfo.InvariantCulture, out var h)) q = q.Where(i => i.Fecha < h.UtcDateTime);
        return FiltroQuery.Aplicar(q, Request.Query, "desde", "hasta");
    }

    protected override Task AntesDeGuardar(InspeccionEquipo x, bool nuevo, CancellationToken ct)
    {
        if (x.Fecha == default) x.Fecha = DateTime.UtcNow;
        x.Puntos ??= [];
        x.FotoArchivoIds ??= [];
        if (x.Puntos.Any(p => string.IsNullOrWhiteSpace(p.Clave))) throw new ReglaException("Cada punto lleva su clave.");
        x.Resultado = Checklist.Resultado(x.Puntos);
        return Task.CompletedTask;
    }
}

/// <remarks>Lista: ?equipoId=…&amp;estado=programado. Nace programado; el estado cambia con POST /mantenimientos/{id}/estado.</remarks>
[Route("api/v1/mantenimientos")]
public class MantenimientosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Mantenimiento>(db, yo)
{
    protected override string Recurso => "flota.mantenimiento";
    protected override Task<bool> PermitidoAsync(Mantenimiento x, CancellationToken ct) => PadreVisible<Equipo>(x.EquipoId, ct);

    protected override Task AntesDeGuardar(Mantenimiento x, bool nuevo, CancellationToken ct)
    {
        if (nuevo) x.Estado = EstadoMantenimiento.Programado;
        return Task.CompletedTask;
    }
}

[ApiController]
public class MantenimientoEstadoController(FlotaServicio flota) : ControllerBase
{
    /// <summary>Cambiar estado de un mantenimiento</summary>
    /// <remarks>en_proceso (desde programado): pone inicioEn y la unidad en mantenimiento; 409 "DMA-01 va en un viaje (PED-…): termínalo
    /// antes." si tiene un viaje sin terminar. terminado: pone finEn y regresa la unidad a disponible si no le queda otro en proceso.
    /// cancelado: solo desde programado.</remarks>
    [HttpPost("api/v1/mantenimientos/{id:guid}/estado"), Permiso("flota.mantenimiento.editar")]
    public Task<Mantenimiento> Estado(Guid id, EstadoMantenimientoRequest r, CancellationToken ct) => flota.CambiarEstadoMantenimiento(id, r.Estado, ct);
}

[ApiController]
public class ViajesController(FlotaServicio flota, IUsuarioActual yo) : ControllerBase
{
    /// <summary>403 si no tiene ninguno de los permisos.</summary>
    internal static ObjectResult? SinPermiso(IUsuarioActual yo, params string[] permisos) =>
        permisos.Any(yo.Tiene) ? null : PermisoAttribute.SinPermiso(string.Join(" o ", permisos));

    /// <summary>Viajes de una orden</summary>
    /// <remarks>Del primero al último asignado. Pide ventas.pedidos.ver u operacion.remisiones.ver.</remarks>
    [HttpGet("api/v1/pedidos/{id:guid}/viajes")]
    public async Task<ActionResult<List<ViajeOrden>>> Lista(Guid id, CancellationToken ct) =>
        SinPermiso(yo, "ventas.pedidos.ver", "operacion.remisiones.ver") is { } no ? no : await flota.Viajes(id, ct);

    /// <summary>Asignar camión</summary>
    /// <remarks>La orden debe estar confirmada y no cancelada ni entregada (409); el equipo, disponible para ella (409 con el motivo).
    /// Si es revolvedor, los m³ de sus ollas no pasan del volumen de la orden (400 "Quedan X m³ por asignar"); bombas y demás
    /// unidades no cuentan m³. Nace "programado".</remarks>
    [HttpPost("api/v1/pedidos/{id:guid}/viajes"), Permiso("operacion.remisiones.crear")]
    public async Task<ActionResult<ViajeOrden>> Asignar(Guid id, AsignarViajeRequest r, CancellationToken ct)
    {
        var v = await flota.Asignar(id, r, ct);
        return Created($"/api/v1/pedidos/{id}/viajes", v);
    }

    /// <summary>Quitar camión</summary>
    /// <remarks>Solo mientras el viaje está programado (409 si ya carga).</remarks>
    [HttpDelete("api/v1/pedidos/{id:guid}/viajes/{viajeId:guid}"), Permiso("operacion.remisiones.editar")]
    public async Task<IActionResult> Quitar(Guid id, Guid viajeId, CancellationToken ct)
    {
        await flota.Quitar(id, viajeId, ct);
        return NoContent();
    }

    /// <summary>Avanzar un viaje</summary>
    /// <remarks>Solo hacia adelante (409). Pone salidaEn (en_ruta), llegadaEn (en_obra) y terminadaEn (terminado). La orden toma el
    /// estado del viaje sin terminar más avanzado (cargando → en_planta, en_ruta, en_obra); con todos terminados y los m³ de las ollas completos,
    /// entregado.</remarks>
    /// <summary>Recorrido del viaje</summary>
    /// <remarks>Puntos GPS de su salida (o la programada) a su término (o ahora), como /equipos/{id}/recorrido.
    /// Pide operacion.remisiones.ver o flota.equipos.ver.</remarks>
    [HttpGet("api/v1/viajes/{id:guid}/recorrido")]
    public async Task<ActionResult<Recorrido>> Recorrido(Guid id, CancellationToken ct) =>
        SinPermiso(yo, "operacion.remisiones.ver", "flota.equipos.ver") is { } no ? no : await flota.RecorridoDeViaje(id, ct);

    /// <summary>Remisión para imprimir</summary>
    /// <remarks>Empresa, planta, cliente, obra, producto, m³ del viaje y acumulado del pedido (ollas), unidad, placas, operador, horas
    /// reales, sello (huella de los datos) y firma. Pide operacion.remisiones.ver o ventas.pedidos.ver.</remarks>
    [HttpGet("api/v1/viajes/{id:guid}/remision")]
    public async Task<ActionResult<RemisionImprimible>> Remision(Guid id, CancellationToken ct) =>
        SinPermiso(yo, "operacion.remisiones.ver", "ventas.pedidos.ver") is { } no ? no : await flota.Imprimible(id, ct);

    /// <summary>Firma de recibido</summary>
    /// <remarks>archivoId = la imagen de la firma subida a /archivos; recibeNombre = quién recibe. Devuelve la remisión.</remarks>
    [HttpPost("api/v1/viajes/{id:guid}/firma"), Permiso("operacion.remisiones.editar")]
    public Task<RemisionImprimible> Firma(Guid id, FirmaRequest r, CancellationToken ct) => flota.Firmar(id, r.ArchivoId, r.RecibeNombre, ct);

    [HttpPost("api/v1/viajes/{id:guid}/estado"), Permiso("operacion.remisiones.editar")]
    public Task<ViajeOrden> Estado(Guid id, EstadoViajeRequest r, CancellationToken ct) => flota.CambiarEstado(id, r.Estado, ct);
}
