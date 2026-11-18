using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

/// <summary>ObraNombre = la obra, o el texto del lugar de entrega. Producto = el concreto de la orden. M3Asignados = solo ollas.</summary>
public record DespachoPedido(Guid Id, string Folio, Guid ClienteId, string ClienteNombre, string? ObraNombre, DateTime FechaHoraEntrega,
    string? ZonaHoraria, Guid SucursalId, string PlantaNombre, string? Producto, decimal VolumenM3, decimal M3Asignados, EstadoPedido Estado,
    MetodoPago MetodoPago, DateTime? ConfirmadaEn, TiemposPedido Tiempos, EstatusPlanta EstatusPlanta, ReagendaPendiente? ReagendaPendiente,
    Ubicacion? Ubicacion, Ubicacion? PlantaUbicacion);

public record Ubicacion(decimal Lat, decimal Lng);

public record UltimaCarga(DateTime Fecha, decimal? OdometroKm, decimal? Horometro);

/// <summary>Del periodo: trayectos, km (y cuántos son estimados), viajes, m³ (solo revolvedor), litros y costo de diésel y
/// rendimiento. UltimaCarga, UltimoOdometroKm y KmDesdeUltimaCarga son a la fecha, no del periodo.</summary>
public record ResumenEquipo(int Trayectos, decimal Km, decimal KmEstimados, int Viajes, decimal? M3, decimal Litros, decimal CostoCombustible,
    decimal? RendimientoKmL, UltimaCarga? UltimaCarga, decimal? UltimoOdometroKm, decimal KmDesdeUltimaCarga);

/// <summary>Unidad a la que le toca registrar carga y odómetro: Vence = última carga + 7 días (sin cargas, su alta).</summary>
public record CombustiblePendiente(Equipo Equipo, DateOnly Vence, bool Vencido, decimal KmDesdeUltimaCarga);

public record DespachoOrden(DespachoPedido Pedido, List<ViajeOrden> Viajes);

public record ViajeEquipo(ViajeOrden Viaje, Guid PedidoId, string PedidoFolio, string ClienteNombre, string? ObraNombre, DateTime FechaHoraEntrega);

/// <summary>M3 solo para revolvedores (null en los demás). UltimoViaje = la entrega más reciente.</summary>
public record ResumenViajes(int Viajes, decimal? M3, DateTime? UltimoViaje);

public record FichaViajes(List<ViajeEquipo> Items, int Total, ResumenViajes Resumen);

/// <summary>Tipo: documento · licencia · mantenimiento. Vencido = antes de hoy.</summary>
public record Vencimiento(string Tipo, Guid RegistroId, Guid? EquipoId, Guid? OperadorId, string Titulo, DateOnly Vence, bool Vencido);

public partial class FlotaServicio
{
    /// <summary>Órdenes no canceladas con entrega ese día en la hora de su planta (las por confirmar también), con sus viajes.</summary>
    public async Task<List<DespachoOrden>> Despacho(DateOnly fecha, Guid? sucursalId, CancellationToken ct)
    {
        // Margen de un día a cada lado en UTC; el día exacto se decide con la zona de cada planta.
        var desde = fecha.AddDays(-1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var q = db.Set<Pedido>().AsNoTracking().Include(p => p.Lineas)
            .Where(p => p.Estado != EstadoPedido.Cancelado && p.FechaHoraEntrega >= desde && p.FechaHoraEntrega < desde.AddDays(3));
        if (sucursalId is Guid s) q = q.Where(p => p.SucursalId == s);
        var candidatos = await q.ToListAsync(ct);
        var plantaIds = candidatos.Select(p => p.SucursalId).Distinct().ToList();
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters().Where(x => plantaIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var pedidos = candidatos
            .Where(p => DateOnly.FromDateTime(VentasServicio.HoraLocal(p.FechaHoraEntrega, plantas[p.SucursalId].ZonaHoraria)) == fecha)
            .OrderBy(p => p.FechaHoraEntrega).ThenBy(p => p.Folio).ToList();
        if (pedidos.Count == 0) return [];

        var (clientes, obras) = await Nombres(pedidos.Select(p => p.ClienteId), pedidos.Select(p => p.ObraId), ct);
        var prodIds = pedidos.SelectMany(p => p.Lineas).Select(l => l.ProductoId).Distinct().ToList();
        var concretos = await db.Set<Producto>().IgnoreQueryFilters()
            .Where(x => prodIds.Contains(x.Id) && x.Tipo == TipoProducto.Concreto && !x.Codigo.StartsWith("AJ-"))
            .ToDictionaryAsync(x => x.Id, x => x.Nombre, ct);
        await Completar(pedidos, ct);
        var obraIds = pedidos.Select(p => p.ObraId).OfType<Guid>().Distinct().ToList();
        var coordenadas = await db.Set<Obra>().IgnoreQueryFilters().Where(o => obraIds.Contains(o.Id) && o.Lat != null && o.Lng != null)
            .ToDictionaryAsync(o => o.Id, o => new Ubicacion(o.Lat!.Value, o.Lng!.Value), ct);
        var ids = pedidos.Select(p => p.Id).ToList();
        var rs = await db.Set<Remision>().AsNoTracking().Where(r => ids.Contains(r.PedidoId)).OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToListAsync(ct);
        var viajes = rs.Zip(await Armar(rs, ct)).ToLookup(x => x.First.PedidoId, x => x.Second);

        return [.. pedidos.Select(p =>
        {
            var planta = plantas[p.SucursalId];
            var deConcreto = p.Lineas.Where(l => concretos.ContainsKey(l.ProductoId)).ToList();
            return new DespachoOrden(new DespachoPedido(p.Id, p.Folio, p.ClienteId, clientes.GetValueOrDefault(p.ClienteId, ""),
                Lugar(p.ObraId, p.EntregaDireccion, obras), p.FechaHoraEntrega, planta.ZonaHoraria, p.SucursalId, planta.Nombre,
                deConcreto.Select(l => concretos[l.ProductoId]).FirstOrDefault(), deConcreto.Sum(l => l.Cantidad), p.M3Asignados ?? 0,
                p.Estado, p.MetodoPago, p.ConfirmadaEn, p.Tiempos!, p.EstatusPlanta, p.ReagendaPendiente,
                p.ObraId is Guid o && coordenadas.TryGetValue(o, out var u) ? u
                    : p is { ObraId: null, EntregaLat: decimal lat, EntregaLng: decimal lng } ? new Ubicacion(lat, lng) : null,
                planta is { Lat: decimal pl, Lng: decimal pg } ? new Ubicacion(pl, pg) : null), [.. viajes[p.Id]]);
        })];
    }

    static string? Lugar(Guid? obraId, string? direccion, Dictionary<Guid, string> obras) =>
        obraId is Guid o ? obras.GetValueOrDefault(o) : direccion;

    async Task<(Dictionary<Guid, string> Clientes, Dictionary<Guid, string> Obras)> Nombres(IEnumerable<Guid> clienteIds, IEnumerable<Guid?> obraIds,
        CancellationToken ct)
    {
        var cs = clienteIds.Distinct().ToList();
        var os = obraIds.OfType<Guid>().Distinct().ToList();
        return (await db.Set<Cliente>().IgnoreQueryFilters().Where(c => cs.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Nombre, ct),
            await db.Set<Obra>().IgnoreQueryFilters().Where(o => os.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.Nombre, ct));
    }

    /// <summary>Viajes de un equipo (entrega más reciente primero), filtrados por entrega, con su resumen.</summary>
    public async Task<FichaViajes> ViajesDeEquipo(Guid equipoId, DateTimeOffset? desde, DateTimeOffset? hasta, int pagina, int tamano, CancellationToken ct)
    {
        if (pagina < 1 || tamano is < 1 or > 500) throw new ReglaException("pagina empieza en 1 y tamano va de 1 a 500.");
        var e = await db.Set<Equipo>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == equipoId, ct) ?? throw new ReglaException("El equipo no existe.", 404);
        var q = from r in db.Set<Remision>().AsNoTracking()
                join p in db.Set<Pedido>() on r.PedidoId equals p.Id
                where r.EquipoId == equipoId
                select new { R = r, p.Folio, p.ClienteId, p.ObraId, p.EntregaDireccion, p.FechaHoraEntrega };
        if (desde is { } d) q = q.Where(x => x.FechaHoraEntrega >= d.UtcDateTime);
        if (hasta is { } h) q = q.Where(x => x.FechaHoraEntrega < h.UtcDateTime);

        var total = await q.CountAsync(ct);
        var m3 = e.Tipo == TipoEquipo.Revolvedor ? await q.SumAsync(x => x.R.VolumenM3, ct) : (decimal?)null;
        var ultimo = await q.MaxAsync(x => (DateTime?)x.FechaHoraEntrega, ct);
        var pag = await q.OrderByDescending(x => x.FechaHoraEntrega).ThenByDescending(x => x.R.CreatedAt)
            .Skip((pagina - 1) * tamano).Take(tamano).ToListAsync(ct);
        var viajes = await Armar([.. pag.Select(x => x.R)], ct);
        var (clientes, obras) = await Nombres(pag.Select(x => x.ClienteId), pag.Select(x => x.ObraId), ct);
        return new([.. pag.Zip(viajes, (x, v) => new ViajeEquipo(v, x.R.PedidoId, x.Folio, clientes.GetValueOrDefault(x.ClienteId, ""),
            Lugar(x.ObraId, x.EntregaDireccion, obras), x.FechaHoraEntrega))], total, new(total, m3, ultimo));
    }

    /// <summary>Documentos, licencias y mantenimientos programados vencidos o que vencen en los próximos días, por fecha.</summary>
    public async Task<List<Vencimiento>> Vencimientos(int dias, CancellationToken ct)
    {
        if (dias is < 0 or > 3650) throw new ReglaException("dias va de 0 a 3650.");
        var hoy = DateOnly.FromDateTime(VentasServicio.HoraLocal(DateTime.UtcNow, null));
        var limite = hoy.AddDays(dias);
        var equipos = await db.Set<Equipo>().AsNoTracking().Where(e => e.Activo).ToDictionaryAsync(e => e.Id, e => e.NumeroEconomico, ct);
        var docs = await db.Set<DocumentoEquipo>().AsNoTracking().Where(d => d.Vence != null && d.Vence <= limite).ToListAsync(ct);
        var licencias = await db.Set<Operador>().AsNoTracking().Where(o => o.Activo && o.LicenciaVence != null && o.LicenciaVence <= limite).ToListAsync(ct);
        var mants = await db.Set<Mantenimiento>().AsNoTracking()
            .Where(m => m.Estado == EstadoMantenimiento.Programado && m.ProgramadoPara != null && m.ProgramadoPara <= limite).ToListAsync(ct);

        var combustible = (await Combustible(hoy, ct)).Where(c => c.Vencido || c.Vence <= limite)
            .Select(c => new Vencimiento("combustible", c.Equipo.Id, c.Equipo.Id, null, $"Registrar carga y odómetro · {c.Equipo.NumeroEconomico}",
                c.Vence, c.Vencido));

        Vencimiento V(string tipo, Guid id, Guid? equipo, Guid? operador, string titulo, DateOnly vence) =>
            new(tipo, id, equipo, operador, titulo, vence, vence < hoy);
        return [.. docs.Where(d => equipos.ContainsKey(d.EquipoId))
                .Select(d => V("documento", d.Id, d.EquipoId, null, $"{NombreDocumento(d.Tipo)} · {equipos[d.EquipoId]}", d.Vence!.Value))
            .Concat(licencias.Select(o => V("licencia", o.Id, null, o.Id, $"Licencia · {o.Nombre}", o.LicenciaVence!.Value)))
            .Concat(mants.Where(m => equipos.ContainsKey(m.EquipoId))
                .Select(m => V("mantenimiento", m.Id, m.EquipoId, null, $"{m.Descripcion} · {equipos[m.EquipoId]}", m.ProgramadoPara!.Value)))
            .Concat(combustible)
            .OrderBy(v => v.Vence).ThenBy(v => v.Titulo)];
    }

    // ---------------------------------------------------------------------------------------------
    // Combustible y kilómetros
    // ---------------------------------------------------------------------------------------------

    /// <summary>Cada cuánto hay que registrar carga y odómetro de una unidad: 7 días o 500 km recorridos desde la última carga.</summary>
    public const int DiasEntreCargas = 7;
    public const decimal KmEntreCargas = 500;

    /// <summary>Unidades que cargan diésel y llevan odómetro: ollas, bombas y de carga (la maquinaria menor no).</summary>
    public static readonly TipoEquipo[] TiposConCombustible =
    [
        TipoEquipo.Revolvedor, TipoEquipo.BombaPluma, TipoEquipo.BombaEstacionaria, TipoEquipo.Volteo, TipoEquipo.Plataforma,
        TipoEquipo.Tractocamion, TipoEquipo.Pipa, TipoEquipo.Camioneta,
    ];

    /// <summary>Por unidad activa con combustible: cuándo le toca registrar carga y si ya se pasó (por días o por km).</summary>
    // shortcut: suma en memoria los km de los trayectos posteriores a la última carga; con mucho historial, sumar en SQL.
    public async Task<List<CombustiblePendiente>> Combustible(DateOnly hoy, CancellationToken ct)
    {
        var equipos = await db.Set<Equipo>().AsNoTracking().Where(e => e.Activo && TiposConCombustible.Contains(e.Tipo)).ToListAsync(ct);
        var ids = equipos.Select(e => e.Id).ToList();
        var ultimas = await db.Set<CargaCombustible>().Where(c => ids.Contains(c.EquipoId)).GroupBy(c => c.EquipoId)
            .Select(g => new { g.Key, Fecha = g.Max(c => c.Fecha) }).ToDictionaryAsync(x => x.Key, x => x.Fecha, ct);
        var zonas = await Zonas(equipos.Select(e => e.SucursalId), ct);
        var trayectos = (await db.Set<Trayecto>().Where(t => ids.Contains(t.EquipoId) && t.Km != null)
            .Select(t => new { t.EquipoId, t.Inicio, Km = t.Km!.Value }).ToListAsync(ct)).ToLookup(t => t.EquipoId);
        return [.. equipos.Select(e =>
        {
            var desde = ultimas.TryGetValue(e.Id, out var u) ? u : e.CreatedAt;
            var vence = DateOnly.FromDateTime(VentasServicio.HoraLocal(desde, zonas.GetValueOrDefault(e.SucursalId)))
                .AddDays(ultimas.ContainsKey(e.Id) ? DiasEntreCargas : 0);
            var km = trayectos[e.Id].Where(t => t.Inicio > desde).Sum(t => t.Km);
            return new CombustiblePendiente(e, vence, vence < hoy || km >= KmEntreCargas, km);
        })];
    }

    /// <summary>Resumen de la unidad en el periodo (por omisión, los últimos 30 días).</summary>
    public async Task<ResumenEquipo> ResumenDeEquipo(Guid id, DateTimeOffset? desde, DateTimeOffset? hasta, CancellationToken ct)
    {
        var e = await db.Set<Equipo>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new ReglaException("El equipo no existe.", 404);
        var h = hasta?.UtcDateTime ?? DateTime.UtcNow;
        var d = desde?.UtcDateTime ?? h.AddDays(-30);
        var trayectos = await db.Set<Trayecto>().AsNoTracking().Where(t => t.EquipoId == id && t.Inicio >= d && t.Inicio < h)
            .Select(t => new { t.Km, t.KmEstimado }).ToListAsync(ct);
        var viajes = await (from r in db.Set<Remision>().AsNoTracking()
                            join p in db.Set<Pedido>() on r.PedidoId equals p.Id
                            where r.EquipoId == id && p.FechaHoraEntrega >= d && p.FechaHoraEntrega < h
                            select r.VolumenM3).ToListAsync(ct);
        var cargas = await db.Set<CargaCombustible>().AsNoTracking().Where(c => c.EquipoId == id && c.Fecha >= d && c.Fecha < h)
            .OrderBy(c => c.Fecha).ToListAsync(ct);
        var ultima = await db.Set<CargaCombustible>().AsNoTracking().Where(c => c.EquipoId == id).OrderByDescending(c => c.Fecha).FirstOrDefaultAsync(ct);
        var desdeCarga = ultima?.Fecha ?? e.CreatedAt;
        var kmDesde = await db.Set<Trayecto>().Where(t => t.EquipoId == id && t.Inicio > desdeCarga).SumAsync(t => t.Km, ct) ?? 0;
        return new(trayectos.Count, trayectos.Sum(t => t.Km ?? 0), trayectos.Where(t => t.KmEstimado).Sum(t => t.Km ?? 0),
            viajes.Count, e.Tipo == TipoEquipo.Revolvedor ? viajes.Sum() : null, cargas.Sum(c => c.Litros), cargas.Sum(c => c.CostoTotal),
            Rendimiento(cargas), ultima is null ? null : new UltimaCarga(ultima.Fecha, ultima.OdometroKm, ultima.Horometro),
            e.UltimoOdometroKm, kmDesde);
    }

    /// <summary>Km de odómetro entre la primera y la última carga con odómetro, entre los litros cargados después de la primera.</summary>
    public static decimal? Rendimiento(IReadOnlyList<CargaCombustible> cargas)
    {
        var conOdometro = cargas.Where(c => c.OdometroKm is not null).OrderBy(c => c.Fecha).ToList();
        if (conOdometro.Count < 2) return null;
        var (primera, ultima) = (conOdometro[0], conOdometro[^1]);
        var km = ultima.OdometroKm!.Value - primera.OdometroKm!.Value;
        var litros = cargas.Where(c => c.Fecha > primera.Fecha && c.Fecha <= ultima.Fecha).Sum(c => c.Litros);
        return km > 0 && litros > 0 ? Math.Round(km / litros, 2) : null;
    }

    /// <summary>
    /// en_proceso (desde programado): pone inicioEn y el equipo en mantenimiento; 409 si el equipo tiene un viaje sin terminar.
    /// terminado: pone finEn y regresa el equipo a disponible si no le queda otro en proceso. cancelado: solo desde programado.
    /// </summary>
    public async Task<Mantenimiento> CambiarEstadoMantenimiento(Guid id, string estado, CancellationToken ct)
    {
        var m = await db.Set<Mantenimiento>().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new ReglaException("El mantenimiento no existe.", 404);
        var nuevo = ReglaException.Opcion<EstadoMantenimiento>(estado);
        var e = await db.Set<Equipo>().IgnoreQueryFilters().FirstAsync(x => x.Id == m.EquipoId, ct);
        var ahora = DateTime.UtcNow;
        switch (nuevo)
        {
            case EstadoMantenimiento.EnProceso:
                if (m.Estado != EstadoMantenimiento.Programado) throw new ReglaException("Solo se inicia un mantenimiento programado.", 409);
                if ((await Activas([e.Id], ct)).OrderByDescending(a => a.Estado).FirstOrDefault() is { } viaje)
                    throw new ReglaException($"{e.NumeroEconomico} va en un viaje ({viaje.Folio}): termínalo antes.", 409);
                m.InicioEn ??= ahora;
                e.Estado = EstadoEquipo.Mantenimiento;
                break;
            case EstadoMantenimiento.Terminado:
                if (m.Estado is not (EstadoMantenimiento.Programado or EstadoMantenimiento.EnProceso))
                    throw new ReglaException("Ese mantenimiento ya se cerró.", 409);
                m.FinEn ??= ahora;
                if (e.Estado == EstadoEquipo.Mantenimiento && !await db.Set<Mantenimiento>()
                        .AnyAsync(x => x.EquipoId == e.Id && x.Id != m.Id && x.Estado == EstadoMantenimiento.EnProceso, ct))
                    e.Estado = EstadoEquipo.Disponible;
                break;
            case EstadoMantenimiento.Cancelado:
                if (m.Estado != EstadoMantenimiento.Programado) throw new ReglaException("Solo se cancela un mantenimiento programado.", 409);
                break;
            default:
                throw new ReglaException("Un mantenimiento no vuelve a programado.", 409);
        }
        m.Estado = nuevo;
        await db.SaveChangesAsync(ct);
        return m;
    }
}
