using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

public record EquipoLinea(Guid Id, string NumeroEconomico, TipoEquipo Tipo, List<string> PlantaNombres, EstadoEquipo Estado);

public record ViajeLinea(Guid Id, string Folio, Guid PedidoId, string PedidoFolio, string ClienteNombre, string? ObraNombre, EstadoViaje Estado,
    DateTime? SalidaProgramada, DateTime? RegresoEstimado, List<EtapaViaje> Etapas);

/// <summary>etapa: carga · ida · obra · regreso. real = ya empezó (con su timestamp); la que va en curso termina "ahora".</summary>
public record EtapaViaje(string Etapa, DateTime Inicio, DateTime Fin, bool Real);

public record MantenimientoLinea(Guid Id, string Descripcion, DateTime Inicio, DateTime Fin);

public record LineaUnidad(EquipoLinea Equipo, List<ViajeLinea> Viajes, List<MantenimientoLinea> Mantenimientos);

public partial class FlotaServicio
{
    public const int CargaMin = 15;
    static readonly string[] NombresEtapa = ["carga", "ida", "obra", "regreso"];

    /// <summary>
    /// Etapas de un viaje. Las fronteras reales son cargandoEn, salidaEn, llegadaEn, regresandoEn y terminadaEn; la etapa en curso
    /// termina ahora; lo que falta se planea desde la salida programada (carga 15 min antes, ida = transporte/2, obra = servicio,
    /// regreso = transporte/2) o, si ya empezó, desde el fin de la etapa anterior.
    /// </summary>
    public static List<EtapaViaje> Etapas(Remision r, DateTime salidaPlan, int transporteMin, int servicioMin, DateTime ahora)
    {
        DateTime?[] reales = [r.CargandoEn, r.SalidaEn, r.LlegadaEn, r.RegresandoEn, r.TerminadaEn];
        int[] duracion = [CargaMin, transporteMin / 2, servicioMin, transporteMin - transporteMin / 2];
        // Etapa en curso según el estado: cargando = carga (0) … regresando = regreso (3).
        var enCurso = r.Estado switch
        {
            EstadoViaje.Cargando => 0, EstadoViaje.EnRuta => 1, EstadoViaje.EnObra => 2, EstadoViaje.Regresando => 3, _ => -1,
        };
        var etapas = new List<EtapaViaje>();
        var inicio = reales[0] ?? salidaPlan.AddMinutes(-CargaMin);
        for (var k = 0; k < 4; k++)
        {
            var real = reales[k] is not null;
            var fin = reales[k + 1] ?? (k == enCurso ? (ahora > inicio ? ahora : inicio) : inicio.AddMinutes(duracion[k]));
            etapas.Add(new EtapaViaje(NombresEtapa[k], inicio, fin, real));
            inicio = reales[k + 1] ?? fin;
        }
        return etapas;
    }

    /// <summary>Unidades activas visibles (que operan en la planta, si viene) con sus viajes de órdenes de ese día y sus mantenimientos.</summary>
    public async Task<List<LineaUnidad>> LineaDeTiempo(DateOnly fecha, Guid? sucursalId, CancellationToken ct)
    {
        var equipos = (await db.Set<Equipo>().AsNoTracking().Where(e => e.Activo).OrderBy(e => e.NumeroEconomico).ToListAsync(ct))
            .Where(e => sucursalId is not Guid s || OperaEn(e, s)).ToList();
        var ids = equipos.Select(e => e.Id).ToList();
        var nombres = await NombresPlantas(equipos, ct);
        var ahora = DateTime.UtcNow;

        // Órdenes con entrega ese día en la hora de su planta (margen de un día en UTC, como el despacho).
        var desde = fecha.AddDays(-1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var candidatos = await (from r in db.Set<Remision>().AsNoTracking()
                                join p in db.Set<Pedido>() on r.PedidoId equals p.Id
                                where r.EquipoId != null && ids.Contains(r.EquipoId.Value) && p.Estado != EstadoPedido.Cancelado
                                      && p.FechaHoraEntrega >= desde && p.FechaHoraEntrega < desde.AddDays(3)
                                select new { R = r, P = p }).ToListAsync(ct);
        var zonas = await Zonas(candidatos.Select(x => x.P.SucursalId), ct);
        var delDia = candidatos.Where(x => DateOnly.FromDateTime(VentasServicio.HoraLocal(x.P.FechaHoraEntrega, zonas.GetValueOrDefault(x.P.SucursalId))) == fecha).ToList();
        var pedidos = delDia.Select(x => x.P).DistinctBy(p => p.Id).ToList();
        var tiempos = await Tiempos(pedidos, ct);
        var (clientes, obras) = await Nombres(pedidos.Select(p => p.ClienteId), pedidos.Select(p => p.ObraId), ct);

        // Mantenimientos que tocan el día (programados: todo su día; en proceso: hasta ahora).
        var zonaDia = sucursalId is Guid sid ? (await Zonas([sid], ct)).GetValueOrDefault(sid) : null;
        var diaIni = VentasServicio.HoraLocal(DateTime.UtcNow, zonaDia) - DateTime.UtcNow; // desfase de la zona
        var ini = fecha.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) - diaIni;
        var fin = ini.AddDays(1);
        var mants = (await db.Set<Mantenimiento>().AsNoTracking()
                .Where(m => ids.Contains(m.EquipoId) && m.Estado != EstadoMantenimiento.Cancelado).ToListAsync(ct))
            .Select(m => (m, Inicio: m.InicioEn ?? m.ProgramadoPara?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) - diaIni,
                Fin: m.FinEn ?? (m.Estado == EstadoMantenimiento.EnProceso ? ahora : m.ProgramadoPara?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) - diaIni + TimeSpan.FromDays(1))))
            .Where(x => x.Inicio is not null && x.Fin is not null && x.Inicio < fin && x.Fin > ini)
            .ToLookup(x => x.m.EquipoId);

        var porEquipo = delDia.ToLookup(x => x.R.EquipoId!.Value);
        return [.. equipos.Select(e => new LineaUnidad(
            new EquipoLinea(e.Id, e.NumeroEconomico, e.Tipo, PlantasDe(e, nombres), e.Estado),
            [.. porEquipo[e.Id].OrderBy(x => x.R.SalidaProgramada ?? x.P.FechaHoraEntrega).Select(x =>
            {
                var t = tiempos[x.P.Id];
                var salida = x.R.SalidaProgramada ?? x.P.FechaHoraEntrega.AddMinutes(-t.TransporteMin / 2.0);
                var servicio = x.R is { SalidaProgramada: DateTime s, RegresoEstimado: DateTime g }
                    ? Math.Max(0, (int)Math.Round((g - s).TotalMinutes) - t.TransporteMin) : t.ServicioMin;
                return new ViajeLinea(x.R.Id, x.R.Folio, x.P.Id, x.P.Folio, clientes.GetValueOrDefault(x.P.ClienteId, ""), Lugar(x.P.ObraId, x.P.EntregaDireccion, obras),
                    x.R.Estado, x.R.SalidaProgramada, x.R.RegresoEstimado, Etapas(x.R, salida, t.TransporteMin, servicio, ahora));
            })],
            [.. mants[e.Id].Select(x => new MantenimientoLinea(x.m.Id, x.m.Descripcion, x.Inicio!.Value, x.Fin!.Value))]))];
    }
}
