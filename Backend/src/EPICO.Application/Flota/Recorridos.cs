using System.Text.Json;
using System.Text.Json.Nodes;
using EPICO.Application.Common;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

/// <summary>
/// Sensores de Traccar → atributos normalizados. Se reconocen estas claves (configúralas en Traccar como atributos calculados si el
/// equipo las nombra distinto): tamborRpm|drumRpm (con signo: + carga, − descarga), tamborSentido|drumDirection
/// (carga|charge|load · descarga|discharge|unload · detenido|stop), motorEncendido|ignition, combustiblePct|fuel|fuelLevel,
/// temperaturaC|temp1|deviceTemp|temperature. El resto va tal cual en "otros".
/// </summary>
public static class Sensores
{
    static readonly string[] Rpm = ["tamborRpm", "drumRpm"], Sentido = ["tamborSentido", "drumDirection"], Motor = ["motorEncendido", "ignition"],
        Combustible = ["combustiblePct", "fuel", "fuelLevel"], Temperatura = ["temperaturaC", "temp1", "deviceTemp", "temperature"];

    public static JsonObject? Normalizar(IReadOnlyDictionary<string, JsonElement>? attrs)
    {
        if (attrs is null || attrs.Count == 0) return null;
        JsonElement? Uno(string[] claves) => claves.Select(c => attrs.TryGetValue(c, out var v) ? v : (JsonElement?)null).FirstOrDefault(v => v is not null);
        static decimal? Num(JsonElement? v) => v switch
        {
            { ValueKind: JsonValueKind.Number } n => n.GetDecimal(),
            { ValueKind: JsonValueKind.String } s when decimal.TryParse(s.GetString(), System.Globalization.CultureInfo.InvariantCulture, out var d) => d,
            _ => null,
        };
        var o = new JsonObject();
        var rpm = Num(Uno(Rpm));
        if (rpm is decimal r) o["tamborRpm"] = Math.Abs(r);
        var sentido = Uno(Sentido) switch
        {
            { ValueKind: JsonValueKind.String } s => s.GetString()!.ToLowerInvariant() switch
            {
                "carga" or "charge" or "load" or "loading" => "carga",
                "descarga" or "discharge" or "unload" or "unloading" => "descarga",
                "detenido" or "stop" or "stopped" => "detenido",
                _ => null,
            },
            { ValueKind: JsonValueKind.Number } n => n.GetDecimal() switch { > 0 => "carga", < 0 => "descarga", _ => "detenido" },
            _ => rpm switch { null => null, > 0 => "carga", < 0 => "descarga", _ => "detenido" },
        };
        if (sentido is not null) o["tamborSentido"] = sentido;
        if (Uno(Motor) is { ValueKind: JsonValueKind.True or JsonValueKind.False } m) o["motorEncendido"] = m.GetBoolean();
        if (Num(Uno(Combustible)) is decimal f) o["combustiblePct"] = f;
        if (Num(Uno(Temperatura)) is decimal t) o["temperaturaC"] = t;
        var conocidas = Rpm.Concat(Sentido).Concat(Motor).Concat(Combustible).Concat(Temperatura).ToHashSet();
        var otros = new JsonObject();
        foreach (var (k, v) in attrs.Where(a => !conocidas.Contains(a.Key))) otros[k] = JsonNode.Parse(v.GetRawText());
        if (otros.Count > 0) o["otros"] = otros;
        return o;
    }
}

public record ViajeEnMapa(Guid Id, string PedidoFolio, EstadoViaje Estado);

/// <summary>Última posición (≤ 7 días) de una unidad activa.</summary>
public record PosicionUnidad(Guid EquipoId, string NumeroEconomico, TipoEquipo Tipo, List<string> PlantaNombres, decimal Lat, decimal Lng, DateTime Fecha,
    decimal? VelocidadKmh, decimal? Rumbo, decimal? AltitudM, JsonDocument? Atributos, ViajeEnMapa? Viaje);

public record PuntoRecorrido(DateTime Fecha, decimal Lat, decimal Lng, decimal? VelocidadKmh, decimal? Rumbo, decimal? AltitudM, JsonDocument? Atributos);

public record ViajeRecorrido(Guid Id, string Folio, string PedidoFolio, EstadoViaje Estado, DateTime? SalidaEn, DateTime? LlegadaEn,
    DateTime? RegresandoEn, DateTime? TerminadaEn);

/// <summary>Km = suma haversine de todos los puntos; promedio solo en movimiento (> 5 km/h).</summary>
public record ResumenRecorrido(decimal Km, decimal? VelocidadMaxKmh, decimal? VelocidadPromKmh, int EnMovimientoMin, int DetenidoMin);

public record Recorrido(List<PuntoRecorrido> Puntos, List<ViajeRecorrido> Viajes, ResumenRecorrido Resumen);

public partial class FlotaServicio
{
    public const int MaxPuntos = 2000, DiasPosicionVigente = 7, DiasMaxRecorrido = 7;
    public const decimal KmhEnMovimiento = 5;

    /// <summary>Última posición de cada unidad activa visible (de los últimos 7 días), con su viaje en curso.</summary>
    public async Task<List<PosicionUnidad>> PosicionesActuales(CancellationToken ct)
    {
        var equipos = await db.Set<Equipo>().AsNoTracking().Where(e => e.Activo).ToDictionaryAsync(e => e.Id, ct);
        var ids = equipos.Keys.ToList();
        var desde = DateTime.UtcNow.AddDays(-DiasPosicionVigente);
        var ultimas = await db.Set<PosicionEquipo>().AsNoTracking().Where(p => ids.Contains(p.EquipoId) && p.Fecha >= desde)
            .GroupBy(p => p.EquipoId).Select(g => g.OrderByDescending(p => p.Fecha).First()).ToListAsync(ct);
        var activas = (await Activas([.. ultimas.Select(p => p.EquipoId)], ct)).ToLookup(a => a.EquipoId);
        var plantas = await NombresPlantas(ultimas.Select(p => equipos[p.EquipoId]), ct);
        return [.. ultimas.OrderBy(p => equipos[p.EquipoId].NumeroEconomico).Select(p =>
        {
            var e = equipos[p.EquipoId];
            var v = activas[e.Id].OrderByDescending(a => a.Estado).FirstOrDefault();
            return new PosicionUnidad(e.Id, e.NumeroEconomico, e.Tipo, PlantasDe(e, plantas), p.Lat, p.Lng, p.Fecha, p.VelocidadKmh, p.Rumbo, p.AltitudM,
                p.Atributos, v is null ? null : new ViajeEnMapa(v.RemisionId, v.Folio, v.Estado));
        })];
    }

    async Task<Dictionary<Guid, string>> NombresPlantas(IEnumerable<Equipo> equipos, CancellationToken ct)
    {
        var ids = equipos.SelectMany(e => e.SucursalIds.Append(e.SucursalId)).Distinct().ToList();
        return await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Nombre, ct);
    }

    static List<string> PlantasDe(Equipo e, Dictionary<Guid, string> nombres) =>
        [.. e.SucursalIds.Prepend(e.SucursalId).Distinct().Select(s => nombres.GetValueOrDefault(s)).OfType<string>()];

    /// <summary>Recorrido de la unidad entre desde y hasta (por omisión las últimas 12 h; máximo 7 días).</summary>
    public async Task<Recorrido> RecorridoDeEquipo(Guid equipoId, DateTimeOffset? desde, DateTimeOffset? hasta, CancellationToken ct)
    {
        var h = hasta?.UtcDateTime ?? DateTime.UtcNow;
        var d = desde?.UtcDateTime ?? h.AddHours(-12);
        if (d >= h) throw new ReglaException("desde debe ser antes de hasta.");
        if (h - d > TimeSpan.FromDays(DiasMaxRecorrido)) throw new ReglaException($"El rango máximo es de {DiasMaxRecorrido} días.");
        if (!await db.Set<Equipo>().AnyAsync(e => e.Id == equipoId, ct)) throw new ReglaException("El equipo no existe.", 404);
        return await Recorrer(equipoId, d, h, ct);
    }

    /// <summary>Recorrido de un viaje: de su salida (o la programada) a su término (o ahora).</summary>
    public async Task<Recorrido> RecorridoDeViaje(Guid viajeId, CancellationToken ct)
    {
        var r = await db.Set<Remision>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == viajeId, ct) ?? throw new ReglaException("El viaje no existe.", 404);
        if (r.EquipoId is not Guid equipo) throw new ReglaException("El viaje no tiene unidad.", 409);
        var d = r.CargandoEn ?? r.SalidaEn ?? r.SalidaProgramada ?? r.CreatedAt;
        var h = r.TerminadaEn ?? DateTime.UtcNow;
        return await Recorrer(equipo, d, h < d ? d : h, ct);
    }

    async Task<Recorrido> Recorrer(Guid equipoId, DateTime d, DateTime h, CancellationToken ct)
    {
        var puntos = await db.Set<PosicionEquipo>().AsNoTracking().Where(p => p.EquipoId == equipoId && p.Fecha >= d && p.Fecha <= h)
            .OrderBy(p => p.Fecha).ToListAsync(ct);
        var viajes = await (from r in db.Set<Remision>().AsNoTracking()
                            join p in db.Set<Pedido>().IgnoreQueryFilters() on r.PedidoId equals p.Id
                            where r.EquipoId == equipoId && (r.CargandoEn ?? r.SalidaEn ?? r.SalidaProgramada) <= h
                                  && (r.TerminadaEn == null || r.TerminadaEn >= d) && (r.CargandoEn ?? r.SalidaEn ?? r.SalidaProgramada) != null
                            orderby r.SalidaEn ?? r.SalidaProgramada
                            select new ViajeRecorrido(r.Id, r.Folio, p.Folio, r.Estado, r.SalidaEn, r.LlegadaEn, r.RegresandoEn, r.TerminadaEn)).ToListAsync(ct);
        return new([.. Muestrear(puntos, MaxPuntos).Select(p => new PuntoRecorrido(p.Fecha, p.Lat, p.Lng, p.VelocidadKmh, p.Rumbo, p.AltitudM, p.Atributos))],
            viajes, Resumir(puntos));
    }

    /// <summary>A lo más max puntos, repartidos parejo; siempre el primero y el último.</summary>
    public static List<T> Muestrear<T>(IReadOnlyList<T> xs, int max)
    {
        if (xs.Count <= max) return [.. xs];
        var paso = (double)(xs.Count - 1) / (max - 1);
        return [.. Enumerable.Range(0, max).Select(i => xs[(int)Math.Round(i * paso)])];
    }

    /// <summary>Más rápido que esto entre dos puntos es un salto del GPS, no un recorrido.</summary>
    public const decimal KmhImposible = 150;

    /// <summary>
    /// Km (haversine), velocidad máxima y promedio en movimiento, y minutos en movimiento/detenido (según el punto anterior). Los km
    /// solo suman tramos en movimiento (punto anterior a más de 5 km/h: lo demás es deriva del GPS parado) y sin saltos imposibles
    /// (más de 150 km/h implícitos entre los dos puntos).
    /// </summary>
    public static ResumenRecorrido Resumir(IReadOnlyList<PosicionEquipo> ps)
    {
        decimal km = 0, mov = 0, det = 0;
        for (var i = 1; i < ps.Count; i++)
        {
            var min = (decimal)(ps[i].Fecha - ps[i - 1].Fecha).TotalMinutes;
            var moviendose = ps[i - 1].VelocidadKmh > KmhEnMovimiento;
            if (moviendose) mov += min; else det += min;
            var tramo = Km(ps[i - 1].Lat, ps[i - 1].Lng, ps[i].Lat, ps[i].Lng);
            if (moviendose && (min <= 0 ? tramo == 0 : tramo / (min / 60) <= KmhImposible)) km += tramo;
        }
        var enMovimiento = ps.Where(p => p.VelocidadKmh > KmhEnMovimiento).Select(p => p.VelocidadKmh!.Value).ToList();
        return new(Math.Round(km, 2), ps.Max(p => p.VelocidadKmh), enMovimiento.Count > 0 ? Math.Round(enMovimiento.Average(), 1) : null,
            (int)Math.Round(mov), (int)Math.Round(det));
    }

    /// <summary>Guarda la última posición de cada dispositivo vinculado a una unidad si es más nueva que la guardada.</summary>
    public async Task<int> GuardarPosiciones(GpsLectura lectura, CancellationToken ct)
    {
        var conPos = lectura.Dispositivos.Where(x => x.UltimaPosicion is not null).ToList();
        if (conPos.Count == 0) return 0;
        var gpsIds = conPos.Select(x => x.UniqueId).ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && e.GpsId != null && gpsIds.Contains(e.GpsId))
            .ToDictionaryAsync(e => e.GpsId!, e => e.Id, ct);
        var ids = equipos.Values.ToList();
        var ultimas = await db.Set<PosicionEquipo>().IgnoreQueryFilters().Where(p => ids.Contains(p.EquipoId)).GroupBy(p => p.EquipoId)
            .Select(g => new { g.Key, Fecha = g.Max(p => p.Fecha) }).ToDictionaryAsync(x => x.Key, x => x.Fecha, ct);
        var n = 0;
        foreach (var x in conPos)
        {
            if (!equipos.TryGetValue(x.UniqueId, out var eq)) continue;
            var p = x.UltimaPosicion!;
            // Al milisegundo (lo que da Traccar): Postgres guarda microsegundos y así no se duplica la misma lectura.
            var fecha = new DateTime(p.Fecha.Ticks - p.Fecha.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
            if (ultimas.TryGetValue(eq, out var ya) && fecha <= ya) continue;
            db.Set<PosicionEquipo>().Add(new PosicionEquipo
            {
                EquipoId = eq, Fecha = fecha, Lat = p.Lat, Lng = p.Lng, VelocidadKmh = p.VelocidadKmh, Rumbo = p.Rumbo, AltitudM = p.AltitudM,
                Atributos = p.Atributos is null ? null : JsonSerializer.SerializeToDocument(p.Atributos), Fuente = FuentePosicion.Traccar,
            });
            n++;
        }
        await db.SaveChangesAsync(ct);
        return n;
    }
}
