using System.Globalization;
using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

/// <summary>Atributos = sensores normalizados (ver <see cref="Sensores"/>).</summary>
public record Posicion(decimal Lat, decimal Lng, DateTime Fecha, decimal? VelocidadKmh, decimal? Rumbo = null, decimal? AltitudM = null,
    System.Text.Json.Nodes.JsonObject? Atributos = null);

/// <summary>EquipoId = el equipo con ese GpsId (null si ninguno lo tiene).</summary>
public record GpsDispositivo(string UniqueId, string Nombre, string? Estado, Posicion? UltimaPosicion, Guid? EquipoId);

/// <summary>Configurado = hay Traccar:Url y Traccar:Token. Si Traccar no responde: configurado y sin dispositivos.</summary>
public record GpsLectura(bool Configurado, List<GpsDispositivo> Dispositivos)
{
    public static readonly GpsLectura SinGps = new(false, []);
}

/// <summary>Dispositivos y última posición del GPS de flota (Traccar).</summary>
public interface IGps
{
    Task<GpsLectura> Leer(CancellationToken ct);
}

public record GpsTablero(bool Configurado);

public record ViajeActual(Guid RemisionId, Guid PedidoId, string PedidoFolio, EstadoViaje Estado, DateTime Entrega,
    DateTime? SalidaProgramada, DateTime? RegresoEstimado, int? DuracionMin);

public record OperadorTablero(Guid Id, string Nombre, DateOnly? LicenciaVence);

/// <summary>Motivo: por qué no está disponible (null si lo está). Operador = el habitual del catálogo. PlantaNombre = la principal;
/// PlantaNombres = todas donde opera.</summary>
public record EquipoTablero(Equipo Equipo, string? PlantaNombre, ViajeActual? Viaje, bool Disponible, string? Motivo, Posicion? Posicion,
    OperadorTablero? Operador, List<string> PlantaNombres);

public record TableroFlota(GpsTablero Gps, List<EquipoTablero> Equipos);

/// <summary>Un viaje (remisión) de una orden. Posicion solo mientras no termina. SalidaProgramada–RegresoEstimado = lo que ocupa a la
/// unidad (DuracionMin); null en viajes de antes de los tiempos.</summary>
public record ViajeOrden(Guid Id, string Folio, Guid? EquipoId, string? NumeroEconomico, TipoEquipo? TipoEquipo, string? Placas,
    string? OperadorNombre, decimal VolumenM3, EstadoViaje Estado, DateTime? SalidaEn, DateTime? LlegadaEstimada, DateTime? LlegadaEn,
    DateTime? TerminadaEn, Posicion? Posicion, DateTime? SalidaProgramada, DateTime? RegresoEstimado, int? DuracionMin);

/// <summary>Flota: disponibilidad de equipos, viajes de las órdenes (una remisión = un viaje) y GPS.</summary>
public partial class FlotaServicio(IAppDbContext db, VentasServicio ventas, IGps gps)
{
    /// <summary>Viajes de antes de los tiempos (sin ventana): ocupan ±4 h alrededor de su entrega.</summary>
    public const int VentanaHoras = 4;

    record Activa(Guid EquipoId, Guid RemisionId, Guid PedidoId, string Folio, EstadoViaje Estado, DateTime Entrega, Guid SucursalId,
        DateTime? Salida, DateTime? Regreso);

    public static bool OperaEn(Equipo e, Guid sucursalId) => e.SucursalId == sucursalId || e.SucursalIds.Contains(sucursalId);

    async Task<(Guid, string)> PlantaDe(Pedido p, CancellationToken ct) =>
        (p.SucursalId, await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Id == p.SucursalId).Select(s => s.Nombre).FirstAsync(ct));

    static int? Duracion(DateTime? salida, DateTime? regreso) =>
        salida is DateTime s && regreso is DateTime r ? (int)Math.Round((r - s).TotalMinutes) : null;

    /// <summary>Viajes sin terminar de esos equipos, de pedidos no cancelados, de cualquier planta (un camión ocupado lo está para todos).</summary>
    async Task<List<Activa>> Activas(List<Guid> equipoIds, CancellationToken ct) =>
        await (from r in db.Set<Remision>().IgnoreQueryFilters()
               join p in db.Set<Pedido>().IgnoreQueryFilters() on r.PedidoId equals p.Id
               where !r.IsDeleted && !p.IsDeleted && r.EquipoId != null && equipoIds.Contains(r.EquipoId.Value)
                     && r.Estado != EstadoViaje.Terminado && p.Estado != EstadoPedido.Cancelado
               select new Activa(r.EquipoId!.Value, r.Id, p.Id, p.Folio, r.Estado, p.FechaHoraEntrega, p.SucursalId,
                   r.SalidaProgramada, r.RegresoEstimado)).ToListAsync(ct);

    async Task<Dictionary<Guid, string?>> Zonas(IEnumerable<Guid> sucursales, CancellationToken ct)
    {
        var ids = sucursales.Distinct().ToList();
        return await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => (string?)s.ZonaHoraria, ct);
    }

    /// <summary>para = la ventana del viaje que se quiere asignar (null = disponible ahora mismo); vencido = su primer documento
    /// vencido ese día. Ocupada si esa ventana se cruza con la de otro viaje sin terminar (±4 h de la entrega si no tiene ventana).</summary>
    static (bool Disponible, string? Motivo) Disponibilidad(Equipo e, IEnumerable<Activa> suyas, VentanaViaje? para, Dictionary<Guid, string?> zonas,
        DocumentoEquipo? vencido, (Guid Id, string Nombre)? plantaPedido = null, DateTime? rechazadaEn = null)
    {
        if (para is not null && suyas.Any(a => a.PedidoId == para.PedidoId)) return (false, "Ya va en esta orden");
        if (!e.Activo) return (false, "Dado de baja");
        if (e.Estado == EstadoEquipo.Mantenimiento) return (false, "En mantenimiento");
        if (e.Estado == EstadoEquipo.FueraDeServicio) return (false, "Fuera de servicio");
        if (plantaPedido is var (pid, pnombre) && !OperaEn(e, pid)) return (false, $"No opera en {pnombre}");
        if (rechazadaEn is DateTime rech)
            return (false, $"Inspección rechazada el {Fecha(DateOnly.FromDateTime(VentasServicio.HoraLocal(rech, zonas.GetValueOrDefault(e.SucursalId))))}");
        if (vencido is not null) return (false, $"{Vencido(vencido.Tipo)} el {Fecha(vencido.Vence!.Value)}");
        if (para is null)
            return suyas.OrderByDescending(a => a.Estado).FirstOrDefault() is { } a ? (false, $"En viaje {a.Folio}") : (true, null);
        var choque = suyas.Where(a => a.Salida is DateTime s && a.Regreso is DateTime r
                ? s < para.Regreso && para.Salida < r
                : Math.Abs((a.Entrega - para.Entrega).TotalHours) <= VentanaHoras)
            .OrderBy(a => a.Salida ?? a.Entrega).FirstOrDefault();
        if (choque is null) return (true, null);
        string Hora(DateTime utc) => VentasServicio.HoraLocal(utc, zonas.GetValueOrDefault(choque.SucursalId)).ToString("HH:mm", CultureInfo.InvariantCulture);
        return (false, choque is { Salida: DateTime cs, Regreso: DateTime cr }
            ? $"Ocupado con {choque.Folio} de {Hora(cs)} a {Hora(cr)}"
            : $"Ocupado con {choque.Folio} a las {Hora(choque.Entrega)}");
    }

    /// <summary>Equipos visibles con su viaje en curso, disponibilidad (para pedidoId si viene) y posición GPS.</summary>
    public async Task<TableroFlota> Tablero(Guid? pedidoId, CancellationToken ct)
    {
        Pedido? para = null;
        if (pedidoId is Guid pid)
            para = await db.Set<Pedido>().AsNoTracking().FirstOrDefaultAsync(p => p.Id == pid, ct)
                   ?? throw new ReglaException("El pedido no existe.", 404);
        var equipos = await db.Set<Equipo>().AsNoTracking().OrderBy(e => e.NumeroEconomico).ToListAsync(ct);
        var activas = (await Activas([.. equipos.Select(e => e.Id)], ct)).ToLookup(a => a.EquipoId);
        var plantaIds = equipos.SelectMany(e => e.SucursalIds.Append(e.SucursalId)).Concat(para is null ? [] : [para.SucursalId]).Distinct().ToList();
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => plantaIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        (Guid, string)? plantaPedido = para is null ? null : (para.SucursalId, plantas[para.SucursalId].Nombre);
        var zonas = await Zonas(activas.SelectMany(a => a).Select(a => a.SucursalId).Concat(para is null ? [] : [para.SucursalId]), ct);
        var vencidos = await Vencidos(equipos, e => Dia(para, zonas, plantas.GetValueOrDefault(e.SucursalId)?.ZonaHoraria), ct);
        var rechazadas = await Rechazadas([.. equipos.Select(e => e.Id)], ct);
        // Con pedido: la ventana de una olla para esa orden.
        VentanaViaje? ventana = null;
        if (para is not null && await Tiempos(para, ct) is var t) ventana = Ventana(para, t.TransporteMin, t.ServicioMin);
        var opIds = equipos.Select(e => e.OperadorId).OfType<Guid>().Distinct().ToList();
        var operadores = await db.Set<Operador>().IgnoreQueryFilters().Where(o => opIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, o => new OperadorTablero(o.Id, o.Nombre, o.LicenciaVence), ct);
        var lectura = await gps.Leer(ct);
        var posiciones = PorGpsId(lectura);
        return new(new GpsTablero(lectura.Configurado), [.. equipos.Select(e =>
        {
            var suyas = activas[e.Id].ToList();
            var (disponible, motivo) = Disponibilidad(e, suyas, ventana, zonas, vencidos.GetValueOrDefault(e.Id), plantaPedido,
                rechazadas.TryGetValue(e.Id, out var rech) ? rech : null);
            var viaje = suyas.OrderByDescending(a => a.Estado).ThenBy(a => a.Entrega).FirstOrDefault();
            return new EquipoTablero(e, plantas.GetValueOrDefault(e.SucursalId)?.Nombre,
                viaje is null ? null : new ViajeActual(viaje.RemisionId, viaje.PedidoId, viaje.Folio, viaje.Estado, viaje.Entrega,
                    viaje.Salida, viaje.Regreso, Duracion(viaje.Salida, viaje.Regreso)),
                disponible, motivo, e.GpsId is { } g ? posiciones.GetValueOrDefault(g) : null,
                e.OperadorId is Guid o ? operadores.GetValueOrDefault(o) : null,
                [.. e.SucursalIds.Prepend(e.SucursalId).Distinct().Select(s => plantas.GetValueOrDefault(s)?.Nombre).OfType<string>()]);
        })]);
    }

    /// <summary>Día que cuenta para vencimientos: el de la entrega en la hora de su planta, o hoy en la planta del equipo.</summary>
    static DateOnly Dia(Pedido? para, Dictionary<Guid, string?> zonas, string? zonaEquipo) =>
        DateOnly.FromDateTime(para is null ? VentasServicio.HoraLocal(DateTime.UtcNow, zonaEquipo)
            : VentasServicio.HoraLocal(para.FechaHoraEntrega, zonas.GetValueOrDefault(para.SucursalId)));

    /// <summary>Por equipo, su documento vencido antes de ese día (el que venció primero).</summary>
    async Task<Dictionary<Guid, DocumentoEquipo>> Vencidos(List<Equipo> equipos, Func<Equipo, DateOnly> dia, CancellationToken ct)
    {
        var ids = equipos.Select(e => e.Id).ToList();
        var porId = equipos.ToDictionary(e => e.Id);
        var docs = await db.Set<DocumentoEquipo>().AsNoTracking().Where(d => ids.Contains(d.EquipoId) && d.Vence != null).ToListAsync(ct);
        return docs.Where(d => d.Vence < dia(porId[d.EquipoId])).GroupBy(d => d.EquipoId)
            .ToDictionary(g => g.Key, g => g.OrderBy(d => d.Vence).First());
    }

    public static string Fecha(DateOnly d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    public static string NombreDocumento(TipoDocumentoEquipo t) => t switch
    {
        TipoDocumentoEquipo.Seguro => "Seguro",
        TipoDocumentoEquipo.Verificacion => "Verificación",
        TipoDocumentoEquipo.TarjetaCirculacion => "Tarjeta de circulación",
        TipoDocumentoEquipo.PermisoSct => "Permiso SCT",
        TipoDocumentoEquipo.Tenencia => "Tenencia",
        TipoDocumentoEquipo.Calibracion => "Calibración",
        _ => "Documento",
    };

    static string Vencido(TipoDocumentoEquipo t) =>
        NombreDocumento(t) + (t is TipoDocumentoEquipo.Verificacion or TipoDocumentoEquipo.TarjetaCirculacion or TipoDocumentoEquipo.Tenencia
                or TipoDocumentoEquipo.Calibracion
            ? " vencida" : " vencido");

    static Dictionary<string, Posicion> PorGpsId(GpsLectura l) =>
        l.Dispositivos.Where(d => d.UltimaPosicion is not null).GroupBy(d => d.UniqueId).ToDictionary(g => g.Key, g => g.First().UltimaPosicion!);

    /// <summary>Dispositivos del GPS con el equipo que los tiene, para vincularlos.</summary>
    public async Task<GpsLectura> Gps(CancellationToken ct)
    {
        var lectura = await gps.Leer(ct);
        if (lectura.Dispositivos.Count == 0) return lectura;
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && e.GpsId != null)
            .Select(e => new { e.Id, e.GpsId }).ToListAsync(ct);
        return lectura with { Dispositivos = [.. lectura.Dispositivos.Select(d => d with { EquipoId = equipos.FirstOrDefault(e => e.GpsId == d.UniqueId)?.Id })] };
    }

    /// <summary>Posición actual de esos equipos (los que tienen GPS y reportan).</summary>
    public async Task<Dictionary<Guid, Posicion>> Posiciones(IEnumerable<Guid> equipoIds, CancellationToken ct)
    {
        var ids = equipoIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        var lectura = await gps.Leer(ct);
        if (lectura.Dispositivos.Count == 0) return [];
        var posiciones = PorGpsId(lectura);
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => ids.Contains(e.Id) && e.GpsId != null)
            .Select(e => new { e.Id, e.GpsId }).ToListAsync(ct);
        return equipos.Where(e => posiciones.ContainsKey(e.GpsId!)).ToDictionary(e => e.Id, e => posiciones[e.GpsId!]);
    }

    // ---------------------------------------------------------------------------------------------
    // Viajes de una orden
    // ---------------------------------------------------------------------------------------------

    public async Task<List<ViajeOrden>> Viajes(Guid pedidoId, CancellationToken ct)
    {
        if (!await db.Set<Pedido>().AnyAsync(p => p.Id == pedidoId, ct)) throw new ReglaException("El pedido no existe.", 404);
        return await Armar(await db.Set<Remision>().AsNoTracking().Where(r => r.PedidoId == pedidoId)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToListAsync(ct), ct);
    }

    async Task<List<ViajeOrden>> Armar(List<Remision> rs, CancellationToken ct)
    {
        var ids = rs.Select(r => r.EquipoId).OfType<Guid>().Distinct().ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().AsNoTracking().Where(e => ids.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);
        var posiciones = await Posiciones(rs.Where(r => r.Estado != EstadoViaje.Terminado).Select(r => r.EquipoId).OfType<Guid>(), ct);
        return [.. rs.Select(r =>
        {
            var e = r.EquipoId is Guid id ? equipos.GetValueOrDefault(id) : null;
            return new ViajeOrden(r.Id, r.Folio, r.EquipoId, e?.NumeroEconomico, e?.Tipo, e?.Placas, r.OperadorNombre, r.VolumenM3, r.Estado,
                r.SalidaEn, r.LlegadaEstimada, r.LlegadaEn, r.TerminadaEn,
                r.Estado != EstadoViaje.Terminado && r.EquipoId is Guid q ? posiciones.GetValueOrDefault(q) : null,
                r.SalidaProgramada, r.RegresoEstimado, Duracion(r.SalidaProgramada, r.RegresoEstimado));
        })];
    }

    /// <summary>Asigna un camión a una orden confirmada (o enviada a planta): nace "programado" con el siguiente folio de remisión
    /// de la planta y su ventana (salida programada – regreso estimado).</summary>
    // shortcut: dos asignaciones simultáneas del mismo camión pueden pasar las dos; si estorba, bloquear el equipo (FOR UPDATE).
    public async Task<ViajeOrden> Asignar(Guid pedidoId, AsignarViajeRequest r, CancellationToken ct)
    {
        var p = await ventas.Pedido(pedidoId, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        if (p.Estado is EstadoPedido.Cancelado or EstadoPedido.Entregado)
            throw new ReglaException(p.Estado == EstadoPedido.Cancelado ? "La orden está cancelada." : "La orden ya se entregó.", 409);
        if (p.ConfirmadaEn is null && p.EstatusPlanta is not (EstatusPlanta.Enviado or EstatusPlanta.Actualizacion))
            throw new ReglaException("Confirma la orden antes de asignarle camiones.", 409);
        var e = await db.Set<Equipo>().FirstOrDefaultAsync(x => x.Id == r.EquipoId, ct) ?? throw new ReglaException("El equipo no existe.", 404);
        var suyas = await Activas([e.Id], ct);
        var zonas = await Zonas(suyas.Select(a => a.SucursalId).Append(p.SucursalId), ct);
        var dia = Dia(p, zonas, null);
        var tiempos = await Tiempos(p, ct);
        var ventana = Ventana(p, tiempos.TransporteMin, await Servicio(p, e, tiempos, ct), r.SalidaProgramada);
        var (disponible, motivo) = Disponibilidad(e, suyas, ventana, zonas, (await Vencidos([e], _ => dia, ct)).GetValueOrDefault(e.Id),
            await PlantaDe(p, ct), (await Rechazadas([e.Id], ct)).TryGetValue(e.Id, out var rech) ? rech : null);
        if (!disponible) throw new ReglaException(motivo!, 409);

        // Operador: el indicado; si no se indica ninguno, el habitual del equipo (catálogo o solo nombre).
        var operadorId = r.OperadorId ?? (string.IsNullOrWhiteSpace(r.OperadorNombre) ? e.OperadorId : null);
        Operador? op = null;
        if (operadorId is Guid oid)
        {
            op = await db.Set<Operador>().FirstOrDefaultAsync(o => o.Id == oid, ct) ?? throw new ReglaException("El operador no existe.", 404);
            if (!op.Activo) throw new ReglaException($"{op.Nombre} está dado de baja.", 409);
            if (op.LicenciaVence is DateOnly v && v < dia) throw new ReglaException($"La licencia de {op.Nombre} venció el {Fecha(v)}.", 409);
        }

        // Solo las ollas llevan el concreto; bombas y demás acompañan toda la orden y no cuentan m³.
        if (e.Tipo == TipoEquipo.Revolvedor)
        {
            var volumen = await ventas.VolumenConcreto(p.Lineas, ct);
            var asignados = await M3Ollas(p.Id, ct);
            if (asignados + r.VolumenM3 > volumen)
                throw new ReglaException($"Quedan {Math.Max(0, volumen - asignados).ToString("0.##", CultureInfo.InvariantCulture)} m³ por asignar.");
        }
        if (!string.IsNullOrWhiteSpace(r.MetodoPago)) p.MetodoPago = ReglaException.Opcion<MetodoPago>(r.MetodoPago);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var viaje = new Remision
        {
            PedidoId = p.Id,
            Folio = await db.SiguienteFolioAsync(p.EmpresaId, p.SucursalId, "remision", ct),
            EquipoId = e.Id,
            OperadorId = op?.Id,
            OperadorNombre = op?.Nombre ?? (string.IsNullOrWhiteSpace(r.OperadorNombre) ? e.OperadorNombre : r.OperadorNombre.Trim()),
            VolumenM3 = r.VolumenM3,
            Estado = EstadoViaje.Programado,
            SalidaProgramada = ventana.Salida,
            RegresoEstimado = ventana.Regreso,
            LlegadaEstimada = p.FechaHoraEntrega,
        };
        db.Set<Remision>().Add(viaje);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await Armar([viaje], ct))[0];
    }

    /// <summary>Solo hacia adelante. Pone salida, llegada y término al pasar por esos estados y sincroniza la orden.</summary>
    public async Task<ViajeOrden> CambiarEstado(Guid viajeId, string estado, CancellationToken ct)
    {
        var r = await db.Set<Remision>().FirstOrDefaultAsync(x => x.Id == viajeId, ct) ?? throw new ReglaException("El viaje no existe.", 404);
        var nuevo = ReglaException.Opcion<EstadoViaje>(estado);
        if (nuevo <= r.Estado) throw new ReglaException("El viaje solo avanza.", 409);
        var p = await ventas.Pedido(r.PedidoId, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        if (p.Estado == EstadoPedido.Cancelado) throw new ReglaException("La orden está cancelada.", 409);

        var ahora = DateTime.UtcNow;
        r.Estado = nuevo;
        if (nuevo >= EstadoViaje.Cargando) r.CargandoEn ??= ahora;
        if (nuevo >= EstadoViaje.EnRuta) r.SalidaEn ??= ahora;
        if (nuevo >= EstadoViaje.EnObra) r.LlegadaEn ??= ahora;
        if (nuevo >= EstadoViaje.Regresando) r.RegresandoEn ??= ahora;
        if (nuevo == EstadoViaje.Terminado)
        {
            r.TerminadaEn ??= ahora;
            await TrayectoDeEntrega(r, p, ct);
        }

        var viajes = await db.Set<Remision>().Where(x => x.PedidoId == p.Id).ToListAsync(ct);
        if (EstadoDeOrden(viajes) is { } e) p.Estado = e;
        else if (viajes.All(v => v.Estado == EstadoViaje.Terminado) && await M3Ollas(p.Id, ct) >= await ventas.VolumenConcreto(p.Lineas, ct))
            p.Estado = EstadoPedido.Entregado;
        await db.SaveChangesAsync(ct);
        return (await Armar([r], ct))[0];
    }

    /// <summary>Al terminar un viaje queda su recorrido (tipo entrega) con los km estimados de ida y vuelta; uno por viaje.</summary>
    async Task TrayectoDeEntrega(Remision r, Pedido p, CancellationToken ct)
    {
        if (r.EquipoId is not Guid equipo || await db.Set<Trayecto>().IgnoreQueryFilters().AnyAsync(t => t.RemisionId == r.Id && !t.IsDeleted, ct)) return;
        var planta = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Id == p.SucursalId).Select(s => s.Nombre).FirstAsync(ct);
        var destino = p.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().Where(x => x.Id == o).Select(x => x.Nombre).FirstOrDefaultAsync(ct)
            : p.EntregaDireccion;
        db.Set<Trayecto>().Add(new Trayecto
        {
            EquipoId = equipo, SucursalId = p.SucursalId, Tipo = TipoTrayecto.Entrega,
            Inicio = r.SalidaEn ?? r.SalidaProgramada ?? r.TerminadaEn!.Value, Fin = r.TerminadaEn,
            Origen = planta, Destino = destino is { Length: > 200 } ? destino[..200] : destino,
            Km = (await KmRecorrido([p], ct))[p.Id], KmEstimado = true,
            PedidoId = p.Id, RemisionId = r.Id, OperadorId = r.OperadorId,
        });
    }

    /// <summary>m³ en viajes de revolvedores (ollas) de la orden: los únicos que cuentan contra su volumen.</summary>
    Task<decimal> M3Ollas(Guid pedidoId, CancellationToken ct) =>
        (from r in db.Set<Remision>()
         join e in db.Set<Equipo>().IgnoreQueryFilters() on r.EquipoId equals e.Id
         // IgnoreQueryFilters vale para toda la consulta: el borrado lógico va explícito.
         where r.PedidoId == pedidoId && !r.IsDeleted && e.Tipo == TipoEquipo.Revolvedor
         select r.VolumenM3).SumAsync(ct);

    /// <summary>El del viaje sin terminar más avanzado (cargando → en planta, en ruta, en obra); null si ninguno está en esos.</summary>
    public static EstadoPedido? EstadoDeOrden(IEnumerable<Remision> viajes) =>
        viajes.Where(v => v.Estado != EstadoViaje.Terminado).Select(v => v.Estado switch
        {
            EstadoViaje.Cargando => EstadoPedido.EnPlanta,
            EstadoViaje.EnRuta => EstadoPedido.EnRuta,
            EstadoViaje.EnObra => EstadoPedido.EnObra,
            _ => (EstadoPedido?)null,
        }).Max();

    /// <summary>Quita la asignación mientras el viaje no carga.</summary>
    public async Task Quitar(Guid pedidoId, Guid viajeId, CancellationToken ct)
    {
        var r = await db.Set<Remision>().FirstOrDefaultAsync(x => x.Id == viajeId && x.PedidoId == pedidoId, ct)
                ?? throw new ReglaException("El viaje no existe.", 404);
        if (r.Estado != EstadoViaje.Programado) throw new ReglaException("Solo se quita un viaje programado (que aún no carga).", 409);
        db.Set<Remision>().Remove(r);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Llena Unidades (números económicos de todos sus viajes), M3Asignados (solo ollas), Tiempos, ReagendaPendiente y
    /// ClienteTieneCorreo de cada pedido.</summary>
    public async Task Completar(IReadOnlyCollection<Pedido> pedidos, CancellationToken ct)
    {
        var ids = pedidos.Select(p => p.Id).ToList();
        var viajes = (await (from r in db.Set<Remision>()
                             join e in db.Set<Equipo>().IgnoreQueryFilters() on r.EquipoId equals e.Id into eq
                             from e in eq.DefaultIfEmpty()
                             where ids.Contains(r.PedidoId) && !r.IsDeleted
                             orderby r.CreatedAt
                             select new { r.PedidoId, r.VolumenM3, Eco = e == null ? null : e.NumeroEconomico, Olla = e != null && e.Tipo == TipoEquipo.Revolvedor })
                            .ToListAsync(ct))
            .ToLookup(v => v.PedidoId);
        var tiempos = await Tiempos(pedidos, ct);
        var pendientes = await db.Set<SolicitudReagenda>().AsNoTracking()
            .Where(s => ids.Contains(s.PedidoId) && s.Estado == EstadoSolicitud.Pendiente)
            .ToDictionaryAsync(s => s.PedidoId, s => new ReagendaPendiente(s.Id, s.FechaPropuesta, s.Motivo, s.Origen), ct);
        var conCorreo = await ConCorreo(pedidos.Select(p => p.ClienteId), ct);
        foreach (var p in pedidos)
        {
            p.Unidades = [.. viajes[p.Id].Select(v => v.Eco).OfType<string>().Distinct()];
            p.M3Asignados = viajes[p.Id].Where(v => v.Olla).Sum(v => v.VolumenM3);
            p.Tiempos = tiempos[p.Id];
            p.ReagendaPendiente = pendientes.GetValueOrDefault(p.Id);
            p.ClienteTieneCorreo = conCorreo.Contains(p.ClienteId);
        }
    }

    /// <summary>Clientes con a quién avisar: contacto principal con correo o correo del cliente.</summary>
    async Task<HashSet<Guid>> ConCorreo(IEnumerable<Guid> clienteIds, CancellationToken ct)
    {
        var ids = clienteIds.Distinct().ToList();
        return [.. await db.Set<Cliente>().IgnoreQueryFilters()
            .Where(c => ids.Contains(c.Id) && (c.Correo != null && c.Correo != ""
                || db.Set<ClienteContacto>().IgnoreQueryFilters().Any(k => k.ClienteId == c.Id && !k.IsDeleted && k.Principal && k.Correo != null && k.Correo != "")))
            .Select(c => c.Id).ToListAsync(ct)];
    }
}
