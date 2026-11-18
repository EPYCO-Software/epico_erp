using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

/// <summary>Ciclo = terminadaEn − (cargandoEn ?? salidaEn); tiempo en obra = regresandoEn − llegadaEn; promedios en minutos (null sin datos).</summary>
public record TotalesFlota(int Remisiones, decimal M3, int ViajesTerminados, decimal? CicloPromMin, decimal? TiempoObraPromMin, int Prolongados);
public record IndicadorUnidad(Guid EquipoId, string NumeroEconomico, int Viajes, decimal M3, decimal? CicloPromMin, decimal? TiempoObraPromMin);
public record IndicadorConductor(Guid? OperadorId, string Nombre, int Viajes, decimal M3, decimal? CicloPromMin);
public record IndicadorCliente(Guid ClienteId, string Nombre, int Viajes, decimal M3, decimal? CicloPromMin, decimal? TiempoObraPromMin);
public record IndicadorVendedor(Guid? VendedorId, string Nombre, int Viajes, decimal M3);
public record IndicadorDia(DateOnly Dia, int Viajes, decimal M3);
public record ViajeProlongado(Guid ViajeId, string Folio, string PedidoFolio, string? NumeroEconomico, string ClienteNombre, string? ObraNombre,
    DateTime LlegadaEn, DateTime SalidaObraEn, int Minutos);
public record IndicadoresFlota(TotalesFlota Totales, List<IndicadorUnidad> PorUnidad, List<IndicadorConductor> PorConductor,
    List<IndicadorCliente> PorCliente, List<IndicadorVendedor> PorVendedor, List<IndicadorDia> PorDia, List<ViajeProlongado> Prolongados);

public partial class FlotaServicio
{
    /// <summary>Más de esto en obra es un viaje prolongado.</summary>
    public const int ProlongadoMin = 90;

    record Fila(Remision R, Pedido P, Equipo? E)
    {
        public bool Olla => E?.Tipo == TipoEquipo.Revolvedor;
        public double? Ciclo => R is { TerminadaEn: DateTime t } && (R.CargandoEn ?? R.SalidaEn) is DateTime i ? (t - i).TotalMinutes : null;
        public double? Obra => R is { RegresandoEn: DateTime g, LlegadaEn: DateTime l } ? (g - l).TotalMinutes : null;
    }

    static decimal? Prom(IEnumerable<double?> xs) => xs.OfType<double>().ToList() is { Count: > 0 } l ? Math.Round((decimal)l.Average(), 1) : null;

    /// <summary>Viajes de órdenes con entrega en el periodo (por omisión, los últimos 30 días); m³ solo de ollas.</summary>
    public async Task<IndicadoresFlota> Indicadores(DateTimeOffset? desde, DateTimeOffset? hasta, Guid? sucursalId, CancellationToken ct)
    {
        var h = hasta?.UtcDateTime ?? DateTime.UtcNow;
        var d = desde?.UtcDateTime ?? h.AddDays(-30);
        var q = from r in db.Set<Remision>().AsNoTracking()
                join p in db.Set<Pedido>().AsNoTracking() on r.PedidoId equals p.Id
                where p.Estado != EstadoPedido.Cancelado && p.FechaHoraEntrega >= d && p.FechaHoraEntrega < h
                select new { r, p };
        if (sucursalId is Guid s) q = q.Where(x => x.p.SucursalId == s);
        var datos = await q.ToListAsync(ct);
        var eqIds = datos.Select(x => x.r.EquipoId).OfType<Guid>().Distinct().ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().AsNoTracking().Where(e => eqIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);
        var filas = datos.Select(x => new Fila(x.r, x.p, x.r.EquipoId is Guid e ? equipos.GetValueOrDefault(e) : null)).ToList();
        var (clientes, obras) = await Nombres(filas.Select(f => f.P.ClienteId), filas.Select(f => f.P.ObraId), ct);
        var vendIds = filas.Select(f => f.P.VendedorId).OfType<Guid>().Distinct().ToList();
        var vendedores = await db.Set<Usuario>().IgnoreQueryFilters().Where(u => vendIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Apellidos == null ? u.Nombre : u.Nombre + " " + u.Apellidos, ct);
        var opIds = filas.Select(f => f.R.OperadorId).OfType<Guid>().Distinct().ToList();
        var operadores = await db.Set<Operador>().IgnoreQueryFilters().Where(o => opIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.Nombre, ct);
        var zonas = await Zonas(filas.Select(f => f.P.SucursalId), ct);
        decimal M3(IEnumerable<Fila> fs) => fs.Where(f => f.Olla).Sum(f => f.R.VolumenM3);
        var prolongados = filas.Where(f => f.Obra > ProlongadoMin).OrderByDescending(f => f.Obra).Select(f => new ViajeProlongado(f.R.Id, f.R.Folio, f.P.Folio,
            f.E?.NumeroEconomico, clientes.GetValueOrDefault(f.P.ClienteId, ""), Lugar(f.P.ObraId, f.P.EntregaDireccion, obras), f.R.LlegadaEn!.Value,
            f.R.RegresandoEn!.Value, (int)Math.Round(f.Obra!.Value))).ToList();

        return new(
            new TotalesFlota(filas.Count, M3(filas), filas.Count(f => f.R.Estado == EstadoViaje.Terminado), Prom(filas.Select(f => f.Ciclo)),
                Prom(filas.Select(f => f.Obra)), prolongados.Count),
            [.. filas.Where(f => f.E is not null).GroupBy(f => f.E!).OrderBy(g => g.Key.NumeroEconomico)
                .Select(g => new IndicadorUnidad(g.Key.Id, g.Key.NumeroEconomico, g.Count(), M3(g), Prom(g.Select(f => f.Ciclo)), Prom(g.Select(f => f.Obra))))],
            [.. filas.GroupBy(f => (f.R.OperadorId, Nombre: f.R.OperadorId is Guid o ? operadores.GetValueOrDefault(o, f.R.OperadorNombre ?? "") : f.R.OperadorNombre ?? "Sin operador"))
                .OrderByDescending(g => g.Count()).Select(g => new IndicadorConductor(g.Key.OperadorId, g.Key.Nombre, g.Count(), M3(g), Prom(g.Select(f => f.Ciclo))))],
            [.. filas.GroupBy(f => f.P.ClienteId).OrderByDescending(g => M3(g))
                .Select(g => new IndicadorCliente(g.Key, clientes.GetValueOrDefault(g.Key, ""), g.Count(), M3(g), Prom(g.Select(f => f.Ciclo)), Prom(g.Select(f => f.Obra))))],
            [.. filas.GroupBy(f => f.P.VendedorId).OrderByDescending(g => M3(g))
                .Select(g => new IndicadorVendedor(g.Key, g.Key is Guid v ? vendedores.GetValueOrDefault(v, "") : "Sin vendedor", g.Count(), M3(g)))],
            [.. filas.GroupBy(f => DateOnly.FromDateTime(VentasServicio.HoraLocal(f.P.FechaHoraEntrega, zonas.GetValueOrDefault(f.P.SucursalId))))
                .OrderBy(g => g.Key).Select(g => new IndicadorDia(g.Key, g.Count(), M3(g)))],
            prolongados);
    }
}
