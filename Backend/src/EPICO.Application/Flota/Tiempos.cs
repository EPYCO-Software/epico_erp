using EPICO.Application.Common;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

/// <summary>Lo que ocupa un viaje a la unidad: sale de planta y regresa (transporte de ida y vuelta + servicio en la obra).</summary>
public record VentanaViaje(Guid PedidoId, DateTime Entrega, DateTime Salida, DateTime Regreso);

public partial class FlotaServicio
{
    /// <summary>Velocidad promedio para calcular el transporte con la distancia.</summary>
    public const int KmhTransporte = 40;
    public const int TransporteSinDistanciaMin = 60, TransporteMinimoMin = 30, ServicioConcretoMin = 60, ServicioOtraUnidadMin = 120;
    /// <summary>La línea recta × 1.3 ≈ la distancia por carretera.</summary>
    public const decimal FactorCarretera = 1.3m;

    /// <summary>Km de un sentido por carretera: el del traslado ya lo es; la línea recta se multiplica por el factor.</summary>
    public static decimal KmCarretera(decimal km, bool porCarretera) => porCarretera ? km : km * FactorCarretera;

    /// <summary>Ida y vuelta a 40 km/h, redondeado a 5 min, mínimo 30; sin distancia, 60 min.</summary>
    public static int TransporteCalculado(decimal? km, bool porCarretera = false) =>
        km is decimal k && k > 0
            ? Math.Max(TransporteMinimoMin, (int)Math.Round(KmCarretera(k, porCarretera) * 2 / KmhTransporte * 60 / 5, MidpointRounding.AwayFromZero) * 5)
            : TransporteSinDistanciaMin;

    /// <summary>Km de ida y vuelta por carretera de cada pedido (null sin distancia).</summary>
    public async Task<Dictionary<Guid, decimal?>> KmRecorrido(IReadOnlyCollection<Pedido> pedidos, CancellationToken ct) =>
        (await Distancias(pedidos, ct)).ToDictionary(x => x.Key, x => x.Value is var (km, carretera) ? Math.Round(KmCarretera(km, carretera) * 2, 1) : (decimal?)null);

    /// <summary>Distancia en línea recta (km) entre dos puntos.</summary>
    public static decimal Km(decimal lat1, decimal lng1, decimal lat2, decimal lng2)
    {
        static double R(decimal g) => (double)g * Math.PI / 180;
        var a = Math.Pow(Math.Sin((R(lat2) - R(lat1)) / 2), 2)
                + Math.Cos(R(lat1)) * Math.Cos(R(lat2)) * Math.Pow(Math.Sin((R(lng2) - R(lng1)) / 2), 2);
        return (decimal)(6371 * 2 * Math.Asin(Math.Sqrt(a)));
    }

    /// <summary>
    /// Tiempos por pedido. Transporte: el capturado o, si no, con la distancia de su partida (traslado) y si no la hay, en línea
    /// recta de la planta a la obra o al lugar de entrega. Servicio: el del concreto del pedido (60 sin dato).
    /// </summary>
    public async Task<Dictionary<Guid, TiemposPedido>> Tiempos(IReadOnlyCollection<Pedido> pedidos, CancellationToken ct)
    {
        var ids = pedidos.Select(p => p.Id).ToList();
        var distancias = await Distancias(pedidos, ct);
        var servicio = (await (from l in db.Set<PedidoLinea>().IgnoreQueryFilters()
                               join pr in db.Set<Producto>().IgnoreQueryFilters() on l.ProductoId equals pr.Id
                               where ids.Contains(l.PedidoId) && pr.Tipo == TipoProducto.Concreto && !pr.Codigo.StartsWith("AJ-")
                               select new { l.PedidoId, pr.TiempoServicioMin }).ToListAsync(ct))
            .GroupBy(x => x.PedidoId).ToDictionary(g => g.Key, g => g.First().TiempoServicioMin);
        return pedidos.ToDictionary(p => p.Id, p =>
        {
            var d = distancias[p.Id];
            var transporte = p.TiempoTransporteMin ?? TransporteCalculado(d?.Km, d?.Carretera ?? false);
            var srv = servicio.GetValueOrDefault(p.Id) ?? ServicioConcretoMin;
            return new TiemposPedido(transporte, p.TiempoTransporteMin is null, srv, transporte + srv);
        });
    }

    /// <summary>Un sentido: el traslado de su partida (por carretera) o, si no, la línea recta de la planta a la obra o al lugar.</summary>
    async Task<Dictionary<Guid, (decimal Km, bool Carretera)?>> Distancias(IReadOnlyCollection<Pedido> pedidos, CancellationToken ct)
    {
        var partidaIds = pedidos.Select(p => p.PartidaId).OfType<Guid>().ToList();
        var obraIds = pedidos.Select(p => p.ObraId).OfType<Guid>().ToList();
        var plantaIds = pedidos.Select(p => p.SucursalId).Distinct().ToList();
        var partidas = await db.Set<CotizacionPartida>().IgnoreQueryFilters().Where(x => partidaIds.Contains(x.Id) && x.TrasladoDistanciaKm != null)
            .ToDictionaryAsync(x => x.Id, x => x.TrasladoDistanciaKm!.Value, ct);
        var obras = await db.Set<Obra>().IgnoreQueryFilters().Where(o => obraIds.Contains(o.Id) && o.Lat != null && o.Lng != null)
            .ToDictionaryAsync(o => o.Id, o => (Lat: o.Lat!.Value, Lng: o.Lng!.Value), ct);
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => plantaIds.Contains(s.Id) && s.Lat != null && s.Lng != null)
            .ToDictionaryAsync(s => s.Id, s => (Lat: s.Lat!.Value, Lng: s.Lng!.Value), ct);
        (decimal, bool)? Distancia(Pedido p)
        {
            if (p.PartidaId is Guid pa && partidas.TryGetValue(pa, out var km)) return (km, true);
            if (!plantas.TryGetValue(p.SucursalId, out var planta)) return null;
            var destino = p.ObraId is Guid o && obras.TryGetValue(o, out var obra) ? obra
                : p is { EntregaLat: decimal lat, EntregaLng: decimal lng } ? (lat, lng) : default((decimal Lat, decimal Lng)?);
            return destino is var (dLat, dLng) ? (Km(planta.Lat, planta.Lng, dLat, dLng), false) : null;
        }
        return pedidos.ToDictionary(p => p.Id, Distancia);
    }

    public async Task<TiemposPedido> Tiempos(Pedido p, CancellationToken ct) => (await Tiempos([p], ct))[p.Id];

    /// <summary>Servicio de la unidad en ese pedido: olla = el del concreto; otra = el del producto del pedido con su tipo de equipo (120 sin dato).</summary>
    async Task<int> Servicio(Pedido p, Equipo e, TiemposPedido t, CancellationToken ct) =>
        e.Tipo == TipoEquipo.Revolvedor ? t.ServicioMin
        : await (from l in db.Set<PedidoLinea>().IgnoreQueryFilters()
                 join pr in db.Set<Producto>().IgnoreQueryFilters() on l.ProductoId equals pr.Id
                 where l.PedidoId == p.Id && pr.EquipoTipo == e.Tipo
                 select pr.TiempoServicioMin).FirstOrDefaultAsync(ct) ?? ServicioOtraUnidadMin;

    /// <summary>Sale a la mitad del transporte antes de la entrega (o a la hora indicada) y regresa tras transporte + servicio.</summary>
    static VentanaViaje Ventana(Pedido p, int transporteMin, int servicioMin, DateTime? salida = null)
    {
        var s = salida ?? p.FechaHoraEntrega.AddMinutes(-transporteMin / 2.0);
        return new(p.Id, p.FechaHoraEntrega, s, s.AddMinutes(transporteMin + servicioMin));
    }

    /// <summary>
    /// Recalcula la ventana de los viajes programados del pedido (tras cambiar su entrega o su transporte). quitarOcupados = quita
    /// los que ya no estén disponibles a la nueva hora y devuelve sus números económicos. No guarda.
    /// </summary>
    public async Task<List<string>> Reprogramar(Pedido p, bool quitarOcupados, CancellationToken ct)
    {
        var viajes = await db.Set<Remision>().Where(r => r.PedidoId == p.Id && r.Estado == EstadoViaje.Programado && r.EquipoId != null).ToListAsync(ct);
        if (viajes.Count == 0) return [];
        var t = await Tiempos(p, ct);
        var eqIds = viajes.Select(v => v.EquipoId!.Value).Distinct().ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => eqIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);
        var otras = (await Activas(eqIds, ct)).Where(a => a.PedidoId != p.Id).ToLookup(a => a.EquipoId);
        var zonas = await Zonas(otras.SelectMany(a => a).Select(a => a.SucursalId).Append(p.SucursalId), ct);
        var dia = Dia(p, zonas, null);
        var planta = await PlantaDe(p, ct);
        var vencidos = await Vencidos([.. equipos.Values], _ => dia, ct);
        var rechazadas = await Rechazadas(eqIds, ct);
        var quitados = new List<string>();
        foreach (var v in viajes)
        {
            var e = equipos[v.EquipoId!.Value];
            var ventana = Ventana(p, t.TransporteMin, await Servicio(p, e, t, ct));
            (v.SalidaProgramada, v.RegresoEstimado, v.LlegadaEstimada) = (ventana.Salida, ventana.Regreso, p.FechaHoraEntrega);
            if (quitarOcupados && !Disponibilidad(e, otras[e.Id], ventana, zonas, vencidos.GetValueOrDefault(e.Id), planta,
                    rechazadas.TryGetValue(e.Id, out var rech) ? rech : null).Disponible)
            {
                db.Set<Remision>().Remove(v);
                quitados.Add(e.NumeroEconomico);
            }
        }
        return quitados;
    }

    /// <summary>Cambia el transporte del pedido (null = calculado) y recalcula las ventanas de sus viajes programados.</summary>
    public async Task<Pedido> CambiarTiempos(Guid pedidoId, int? transporteMin, CancellationToken ct)
    {
        if (transporteMin is < 0 or > 10_000) throw new ReglaException("transporteMin va de 0 a 10000.");
        var p = await ventas.Pedido(pedidoId, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        p.TiempoTransporteMin = transporteMin;
        await Reprogramar(p, quitarOcupados: false, ct);
        await db.SaveChangesAsync(ct);
        await Completar([p], ct);
        return p;
    }
}
