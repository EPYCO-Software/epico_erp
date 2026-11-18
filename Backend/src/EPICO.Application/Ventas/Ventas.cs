using EPICO.Application.Common;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using System.Globalization;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Ventas;

/// <summary>
/// Importes de cotizaciones y pedidos, con las mismas reglas que lineasPartida/totales del front
/// (Frontend/projects/ui/src/lib/cotizacion/formato.ts): redondeo a centavos por línea, traslado por m³
/// después de los km incluidos, descuento antes del IVA.
/// </summary>
public static class Calculo
{
    public static decimal R(decimal x) => Math.Round(x, 2, MidpointRounding.AwayFromZero);

    public static decimal Importe(decimal precio, decimal cantidad) => R(precio * cantidad);

    /// <summary>Km que pasan de los incluidos, a un decimal (0 dentro del radio).</summary>
    public static decimal KmExtra(decimal distancia, decimal incluidos) =>
        Math.Max(0, Math.Round(distancia - incluidos, 1, MidpointRounding.AwayFromZero));

    /// <summary>Precio por m³ del traslado adicional (0 si no aplica).</summary>
    public static decimal TrasladoM3(CotizacionPartida p) =>
        p is { TrasladoDistanciaKm: decimal d, TrasladoIncluidosKm: decimal i, TrasladoPrecioKm: decimal k } && k > 0
            ? R(KmExtra(d, i) * k)
            : 0;

    public static decimal SubtotalPartida(CotizacionPartida p) =>
        Importe(p.PrecioM3 ?? 0, p.VolumenM3) + Importe(TrasladoM3(p), p.VolumenM3) + p.Lineas.Sum(l => l.Importe);

    public static void Totalizar(Cotizacion c, decimal descuentoPct, decimal tasaIva)
    {
        c.Subtotal = R(c.Partidas.Sum(SubtotalPartida));
        c.Descuento = R(c.Subtotal * descuentoPct / 100);
        c.Iva = R((c.Subtotal - c.Descuento) * tasaIva);
        c.Total = R(c.Subtotal - c.Descuento + c.Iva);
    }

    public static void Totalizar(Pedido p, decimal descuento, decimal tasaIva)
    {
        p.Subtotal = R(p.Lineas.Sum(l => l.Importe));
        p.Descuento = Math.Min(R(descuento), p.Subtotal);
        p.Iva = R((p.Subtotal - p.Descuento) * tasaIva);
        p.Total = R(p.Subtotal - p.Descuento + p.Iva);
    }
}

/// <summary>Cotizaciones y pedidos: alta, edición y cambios de estado. Los filtros globales limitan lo visible.</summary>
public class VentasServicio(IAppDbContext db, IUsuarioActual yo)
{
    public const string CodigoTraslado = "SRV-TRASLADO";

    // ---------------------------------------------------------------------------------------------
    // Cotizaciones
    // ---------------------------------------------------------------------------------------------

    public Task<Cotizacion?> Cotizacion(Guid id, CancellationToken ct, bool editar = false) =>
        (editar ? db.Set<Cotizacion>() : db.Set<Cotizacion>().AsNoTracking())
            .Include(c => c.Partidas.OrderBy(p => p.Orden)).ThenInclude(p => p.Lineas)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    /// <summary>portal = la pide un cliente: entra como "recibida" con origen portal y sin vendedor si su cliente no tiene.</summary>
    public async Task<Cotizacion> CrearCotizacion(CotizacionRequest r, CancellationToken ct, bool portal = false)
    {
        var suc = await Sucursal(r.SucursalId, ct);
        var c = new Cotizacion
        {
            EmpresaId = suc.EmpresaId,
            SucursalId = suc.Id,
            Estado = portal ? EstadoCotizacion.Recibida : EstadoCotizacion.Borrador,
            Origen = portal ? OrigenCotizacion.Portal : OrigenCotizacion.Erp,
            Fecha = DateTime.UtcNow,
            VendedorId = r.VendedorId ?? (portal ? null : yo.Id),
        };
        if (r.BaseId is Guid baseId && !await db.Set<Cotizacion>().AnyAsync(x => x.Id == baseId, ct))
            throw new ReglaException("La cotización base no existe.");
        c.BaseId = r.BaseId;
        await Encabezado(c, r, ct);
        if (r.ReemplazaId is Guid reemplazaId)
        {
            var anterior = await db.Set<Cotizacion>().FirstOrDefaultAsync(x => x.Id == reemplazaId, ct)
                           ?? throw new ReglaException("La oferta a mejorar no existe.");
            if (c.ClienteId is null || anterior.ClienteId != c.ClienteId) throw new ReglaException("La oferta a mejorar es de otro cliente.");
            Negociable(anterior);
            c.ReemplazaId = anterior.Id;
            c.BaseId ??= anterior.Id;
        }
        await Partidas(c, r.Partidas, ct);
        Calculo.Totalizar(c, r.DescuentoPct, await TasaIva(ct));

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (r.RevisionDeId is Guid origenId)
        {
            var origen = await db.Set<Cotizacion>().FirstOrDefaultAsync(x => x.Id == origenId, ct)
                         ?? throw new ReglaException("La cotización a revisar no existe.", 404);
            if (origen.EmpresaId != c.EmpresaId) throw new ReglaException("La revisión va en la misma razón social.");
            c.Serie = origen.Serie;
            c.BaseId ??= origen.BaseId;
            // El índice único (EmpresaId, Folio) evita dos revisiones con el mismo número a la vez (409).
            c.Revision = await db.Set<Cotizacion>().IgnoreQueryFilters()
                .Where(x => x.EmpresaId == c.EmpresaId && x.Serie == origen.Serie).MaxAsync(x => x.Revision, ct) + 1;
            c.Folio = $"{c.Serie}-R{c.Revision}";
        }
        else c.Folio = c.Serie = await db.SiguienteFolioAsync(c.EmpresaId, c.SucursalId, "cotizacion", ct);

        db.Set<Cotizacion>().Add(c);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return c;
    }

    public async Task<Cotizacion> EditarCotizacion(Guid id, CotizacionRequest r, CancellationToken ct)
    {
        var c = await Cotizacion(id, ct, editar: true) ?? throw new ReglaException("La cotización no existe.", 404);
        if (c.Estado is not (EstadoCotizacion.Recibida or EstadoCotizacion.Borrador))
            throw new ReglaException("Ya se envió: haz una revisión (revisionDeId) o una nueva basada en esta (baseId).", 409);
        if (r.SucursalId != c.SucursalId) throw new ReglaException("La planta no se cambia: el folio es de esa planta.");
        await Encabezado(c, r, ct);
        await Partidas(c, r.Partidas, ct);
        Calculo.Totalizar(c, r.DescuentoPct, await TasaIva(ct));
        await db.SaveChangesAsync(ct);
        return c;
    }

    /// <summary>Si mejora otra oferta (ReemplazaId), la anterior queda reemplazada por esta (su estado no cambia).</summary>
    public async Task<Cotizacion> Enviar(Guid id, CancellationToken ct)
    {
        var c = await Cotizacion(id, ct, editar: true) ?? throw new ReglaException("La cotización no existe.", 404);
        if (c.Estado is EstadoCotizacion.Pedido or EstadoCotizacion.Cancelada) throw Ya(c.Estado);
        await NoReemplazada(c, ct);
        ValidarLugar(c, obligatorio: true);
        Cotizadas(c);
        c.Estado = EstadoCotizacion.Enviada;
        c.OcultaAlCliente = false;
        if (c.ReemplazaId is Guid anteriorId
            && await db.Set<Cotizacion>().IgnoreQueryFilters().FirstAsync(x => x.Id == anteriorId, ct) is { } a && a.ReemplazadaPorId != c.Id)
        {
            Negociable(a);
            await NoReemplazada(a, ct);
            a.ReemplazadaPorId = c.Id;
            await Anotar(a, $"Reemplazada por la oferta {c.Folio} ({Dinero(a.Total)} → {Dinero(c.Total)})", ct);
            await Anotar(c, $"Mejora la oferta {a.Folio}", ct);
        }
        await db.SaveChangesAsync(ct);
        return c;
    }

    /// <summary>Pedido o cancelada: ya no se negocia (409).</summary>
    static void Negociable(Cotizacion a)
    {
        if (a.Estado is EstadoCotizacion.Pedido or EstadoCotizacion.Cancelada)
            throw new ReglaException("Esa cotización ya no se puede negociar.", 409);
    }

    async Task NoReemplazada(Cotizacion c, CancellationToken ct)
    {
        if (c.ReemplazadaPorId is Guid r)
            throw new ReglaException($"Esta oferta fue reemplazada por {await db.Set<Cotizacion>().IgnoreQueryFilters()
                .Where(x => x.Id == r).Select(x => x.Folio).FirstAsync(ct)}.", 409);
    }

    Task Anotar(Cotizacion c, string texto, CancellationToken ct) => Anotar(nameof(Domain.Ventas.Cotizacion), c.Id, c.EmpresaId, texto, ct);

    async Task Anotar(string tipo, Guid id, Guid empresaId, string texto, CancellationToken ct) => db.Set<Evento>().Add(new Evento
    {
        OrganizacionId = await db.Set<Empresa>().IgnoreQueryFilters().Where(e => e.Id == empresaId).Select(e => e.OrganizacionId).FirstAsync(ct),
        RegistroTipo = tipo, RegistroId = id, Fecha = DateTime.UtcNow, AutorId = yo.Id, SesionId = yo.SesionId,
        Tipo = TipoEvento.Sistema, Texto = texto,
    });

    static string Dinero(decimal? x) => "$" + (x ?? 0).ToString("N2", CultureInfo.InvariantCulture);

    public Task<Cotizacion> Ocultar(Guid id, bool oculta, CancellationToken ct) =>
        CambiarCotizacion(id, c => c.OcultaAlCliente = oculta, ct);

    /// <summary>Si era una oferta que reemplazó a otra, la anterior vuelve a valer.</summary>
    public async Task<Cotizacion> Cancelar(Guid id, CancellationToken ct)
    {
        var c = await Cotizacion(id, ct, editar: true) ?? throw new ReglaException("La cotización no existe.", 404);
        if (c.Estado == EstadoCotizacion.Pedido) throw Ya(c.Estado);
        c.Estado = EstadoCotizacion.Cancelada;
        if (c.ReemplazaId is Guid anteriorId
            && await db.Set<Cotizacion>().IgnoreQueryFilters().FirstAsync(x => x.Id == anteriorId, ct) is { } a && a.ReemplazadaPorId == c.Id)
        {
            a.ReemplazadaPorId = null;
            await Anotar(a, $"Vuelve a valer: se canceló la oferta {c.Folio}", ct);
        }
        await db.SaveChangesAsync(ct);
        return c;
    }

    /// <summary>Confirmar: un pedido por partida (cada entrega es una orden) y la cotización pasa a "pedido".</summary>
    /// <summary>confirmarOrdenes = los pedidos nacen confirmados por Ventas (el portal siempre los deja por confirmar).</summary>
    public async Task<List<Pedido>> Confirmar(Guid id, CancellationToken ct, bool confirmarOrdenes = false)
    {
        var c = await Cotizacion(id, ct, editar: true) ?? throw new ReglaException("La cotización no existe.", 404);
        if (c.Estado is EstadoCotizacion.Pedido or EstadoCotizacion.Cancelada) throw Ya(c.Estado);
        if (c.ClienteId is not Guid clienteId) throw new ReglaException("Para confirmar hace falta el cliente.");
        await NoReemplazada(c, ct);
        ValidarLugar(c, obligatorio: true);
        Cotizadas(c);
        foreach (var p in c.Partidas)
        {
            if (p.Entrega is null) throw new ReglaException($"Falta la entrega de «{p.Nombre}».");
            if (p.ProductoId is null && !p.Especial) throw new ReglaException($"«{p.Nombre}» no tiene producto de concreto.");
        }
        var prodIds = c.Partidas.Select(p => p.ProductoId).OfType<Guid>().Concat(c.Partidas.SelectMany(p => p.Lineas).Select(l => l.ProductoId)).ToHashSet();
        var minimos = await db.Set<Producto>().IgnoreQueryFilters().Where(x => prodIds.Contains(x.Id) && x.PedidoMinimo != null).ToDictionaryAsync(x => x.Id, ct);
        await PedidoMinimo(c.Partidas.Where(p => p.ProductoId is Guid g && minimos.ContainsKey(g)).Select(p => (minimos[p.ProductoId!.Value], p.VolumenM3))
            .Concat(c.Partidas.SelectMany(p => p.Lineas).Where(l => minimos.ContainsKey(l.ProductoId)).Select(l => (minimos[l.ProductoId], l.Cantidad))), ct);
        var traslado = c.Partidas.Any(p => Calculo.TrasladoM3(p) > 0) ? await ProductoTraslado(ct) : null;
        var especial = c.Partidas.Any(p => p.ProductoId is null) ? await ProductoEspecial(ct) : null;
        var iva = await TasaIva(ct);
        var fraccionDescuento = c.Subtotal == 0 ? 0 : c.Descuento / c.Subtotal;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var pedidos = new List<Pedido>();
        foreach (var p in c.Partidas)
        {
            var pedido = new Pedido
            {
                EmpresaId = c.EmpresaId,
                SucursalId = c.SucursalId,
                ClienteId = clienteId,
                CotizacionId = c.Id,
                PartidaId = p.Id,
                VendedorId = c.VendedorId,
                FechaHoraEntrega = p.Entrega!.Value,
                Folio = await db.SiguienteFolioAsync(c.EmpresaId, c.SucursalId, "pedido", ct),
                Lineas = LineasDePartida(p, traslado, especial),
            };
            CopiarLugar(c, pedido);
            Calculo.Totalizar(pedido, pedido.Lineas.Sum(l => l.Importe) * fraccionDescuento, iva);
            db.Set<Pedido>().Add(pedido);
            if (confirmarOrdenes) await MarcarConfirmada(pedido, ct);
            pedidos.Add(pedido);
        }
        c.Estado = EstadoCotizacion.Pedido;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return pedidos;
    }

    async Task<Cotizacion> CambiarCotizacion(Guid id, Action<Cotizacion> cambio, CancellationToken ct)
    {
        var c = await Cotizacion(id, ct, editar: true) ?? throw new ReglaException("La cotización no existe.", 404);
        cambio(c);
        await db.SaveChangesAsync(ct);
        return c;
    }

    async Task Encabezado(Cotizacion c, CotizacionRequest r, CancellationToken ct)
    {
        await ClienteYObra(r.ClienteId, r.ObraId, ct);
        if (r.ListaPreciosId is Guid lista && !await db.Set<ListaPrecios>().AnyAsync(x => x.Id == lista, ct))
            throw new ReglaException("La lista de precios no existe.");
        c.ClienteId = r.ClienteId;
        CopiarLugar(new Cotizacion { ObraId = r.ObraId, EntregaDireccion = r.EntregaDireccion, EntregaMunicipio = r.EntregaMunicipio,
            EntregaReferencias = r.EntregaReferencias, EntregaLat = r.EntregaLat, EntregaLng = r.EntregaLng }, c);
        ValidarLugar(c, obligatorio: false);
        c.ContactoNombre = r.ContactoNombre;
        c.ContactoTelefono = r.ContactoTelefono;
        c.VendedorId = r.VendedorId ?? c.VendedorId;
        c.VigenciaHasta = r.VigenciaHasta;
        c.ListaPreciosId = r.ListaPreciosId;
        c.Notas = r.Notas;
    }

    /// <summary>Partidas y líneas con Id se editan, sin Id se agregan y las que no vienen se quitan.</summary>
    async Task Partidas(Cotizacion c, List<PartidaRequest> reqs, CancellationToken ct)
    {
        var ids = reqs.Where(p => p.ProductoId is not null).Select(p => p.ProductoId!.Value)
            .Concat(reqs.SelectMany(p => p.Lineas ?? []).Select(l => l.ProductoId)).ToHashSet();
        var codigos = reqs.SelectMany(CodigosTarifa).ToHashSet();
        var productos = await db.Set<Producto>().Where(x => ids.Contains(x.Id) || codigos.Contains(x.Codigo)).ToListAsync(ct);
        Producto Buscar(Guid id) => productos.FirstOrDefault(x => x.Id == id) ?? throw new ReglaException("Un producto no existe.");
        var planta = await db.Set<Sucursal>().AsNoTracking().FirstAsync(s => s.Id == c.SucursalId, ct);
        var pedidas = new List<(Producto, decimal)>();

        foreach (var quitada in c.Partidas.Where(p => reqs.All(r => r.Id != p.Id)).ToList())
        {
            db.Set<CotizacionLinea>().RemoveRange(quitada.Lineas); // sin esto EF no deja quitar una partida con líneas
            db.Set<CotizacionPartida>().Remove(quitada); // borrado lógico, queda en el historial
            c.Partidas.Remove(quitada);
        }
        for (var i = 0; i < reqs.Count; i++)
        {
            var r = reqs[i];
            var p = r.Id is Guid pid
                ? c.Partidas.FirstOrDefault(x => x.Id == pid) ?? throw new ReglaException("La partida no es de esta cotización.")
                : new CotizacionPartida();
            if (r.Id is null) c.Partidas.Add(p);

            var concreto = r.ProductoId is Guid prod ? Buscar(prod) : productos.FirstOrDefault(x => x.Codigo == CodigoConcreto(r));
            p.Orden = (short)i;
            p.Nombre = r.Nombre;
            p.SolucionId = r.SolucionId;
            p.ProductoId = concreto?.Id;
            p.TipoResistencia = r.TipoResistencia;
            p.ResistenciaKgCm2 = r.ResistenciaKgCm2;
            p.EdadDias = r.EdadDias;
            p.RevenimientoCm = r.RevenimientoCm;
            p.TmaMm = r.TmaMm;
            p.Cemento = r.Cemento;
            p.Exposicion = r.Exposicion;
            p.Colocacion = r.Colocacion;
            p.Aditivos = r.Aditivos ?? [];
            if (p.Aditivos.FirstOrDefault(a => !productos.Any(x => x.Activo && x.Codigo == CodigoAditivo(a))) is { } falta)
                throw new ReglaException($"El aditivo «{falta}» no está en tus productos.");
            p.VolumenM3 = r.VolumenM3;
            if (concreto is not null) pedidas.Add((concreto, r.VolumenM3));
            p.Especial = r.Especial;
            p.PrecioM3 = r.PrecioM3 ?? Tarifa(r, concreto, productos)
                         ?? (r.Especial ? null : throw new ReglaException($"No hay tarifa para «{r.Nombre}» ({CodigoConcreto(r)}): indica el precio por m³."));
            p.Entrega = r.Entrega;
            p.TrasladoDistanciaKm = r.TrasladoDistanciaKm;
            // Con distancia y sin km incluidos o precio por km, se usan los de la planta.
            var conDistancia = r.TrasladoDistanciaKm is not null;
            p.TrasladoIncluidosKm = r.TrasladoIncluidosKm ?? (conDistancia ? planta.KmIncluidos : null);
            p.TrasladoPrecioKm = r.TrasladoPrecioKm ?? (conDistancia ? planta.PrecioKm : null);

            var lineas = r.Lineas ?? [];
            foreach (var quitada in p.Lineas.Where(l => lineas.All(x => x.Id != l.Id)).ToList())
            {
                db.Set<CotizacionLinea>().Remove(quitada);
                p.Lineas.Remove(quitada);
            }
            foreach (var lr in lineas)
            {
                var l = lr.Id is Guid lid
                    ? p.Lineas.FirstOrDefault(x => x.Id == lid) ?? throw new ReglaException("La línea no es de esta partida.")
                    : new CotizacionLinea();
                if (lr.Id is null) p.Lineas.Add(l);
                var producto = Buscar(lr.ProductoId);
                pedidas.Add((producto, lr.Cantidad));
                l.ProductoId = producto.Id;
                l.Concepto = lr.Concepto ?? producto.Nombre;
                l.Dias = lr.Dias;
                l.Cantidad = Math.Max(lr.Cantidad, producto.MinimoCobro ?? 0); // bombeo: 10 m³ mínimo…
                l.PrecioUnitario = lr.PrecioUnitario ?? producto.PrecioLista;
                l.Importe = Calculo.Importe(l.PrecioUnitario, l.Cantidad * (l.Dias ?? 1));
            }
        }
        await PedidoMinimo(pedidas, ct);
    }

    /// <summary>400 si alguna cantidad pedida no llega al PedidoMinimo de su producto (en la unidad del producto).</summary>
    async Task PedidoMinimo(IEnumerable<(Producto Producto, decimal Cantidad)> pedidas, CancellationToken ct)
    {
        var (bajo, _) = pedidas.FirstOrDefault(x => x.Producto.PedidoMinimo is decimal m && x.Cantidad < m);
        if (bajo is null) return;
        var unidad = await db.Set<UnidadMedida>().IgnoreQueryFilters().Where(u => u.Id == bajo.UnidadId).Select(u => u.Nombre).FirstOrDefaultAsync(ct);
        throw new ReglaException($"El pedido mínimo de {bajo.Nombre} es {bajo.PedidoMinimo!.Value.ToString("0.###", CultureInfo.InvariantCulture)} {unidad}.");
    }

    static string CodigoConcreto(PartidaRequest r) => $"CON-{r.TipoResistencia.ToUpperInvariant()}-{r.ResistenciaKgCm2}";

    static IEnumerable<string> CodigosTarifa(PartidaRequest r) =>
        [CodigoConcreto(r), $"AJ-EDAD-{r.EdadDias}", "AJ-CEM-RS", .. (r.Aditivos ?? []).Select(CodigoAditivo)];

    static string CodigoAditivo(string aditivo) => $"AJ-ADT-{aditivo.ToUpperInvariant()}";

    /// <summary>Precio de tarifa por m³: concreto + ajuste por edad + cemento RS + aditivos (precioConcreto del front).</summary>
    static decimal? Tarifa(PartidaRequest r, Producto? concreto, List<Producto> productos)
    {
        if (concreto is null) return null;
        decimal Ajuste(string codigo) => productos.FirstOrDefault(x => x.Codigo == codigo)?.PrecioLista ?? 0;
        return concreto.PrecioLista
               + Ajuste($"AJ-EDAD-{r.EdadDias}")
               + (r.Cemento == "CPC 30R RS" ? Ajuste("AJ-CEM-RS") : 0)
               + (r.Aditivos ?? []).Sum(a => Ajuste(CodigoAditivo(a)));
    }

    static void Cotizadas(Cotizacion c)
    {
        if (c.Partidas.Any(p => p.PrecioM3 is null))
            throw new ReglaException("Hay partidas de pedido especial sin precio: cotízalas antes.");
    }

    /// <summary>especial = producto genérico para la línea de concreto de una partida sin producto (pedido especial).</summary>
    static List<PedidoLinea> LineasDePartida(CotizacionPartida p, Producto? traslado, Producto? especial)
    {
        var tipo = p.TipoResistencia == "mr" ? "MR" : "f´c";
        var concreto = $"{p.Nombre}: concreto {tipo} {p.ResistenciaKgCm2} kg/cm² a {p.EdadDias} días, rev. {p.RevenimientoCm} cm, " +
                       $"TMA {p.TmaMm} mm, {p.Cemento}, {p.Colocacion}";
        if (p.Especial) concreto = $"Pedido especial · {concreto}";
        var r = new List<PedidoLinea> { Linea(p.ProductoId ?? especial!.Id, concreto, p.VolumenM3, p.PrecioM3!.Value) };
        if (Calculo.TrasladoM3(p) is > 0 and var precio)
            r.Add(Linea(traslado!.Id,
                $"Traslado adicional: {Calculo.KmExtra(p.TrasladoDistanciaKm!.Value, p.TrasladoIncluidosKm!.Value)} km después de los {p.TrasladoIncluidosKm} km incluidos",
                p.VolumenM3, precio));
        r.AddRange(p.Lineas.Select(l => new PedidoLinea
        {
            ProductoId = l.ProductoId,
            Descripcion = l.Dias is short d ? $"{l.Concepto} ({d} {(d == 1 ? "día" : "días")})" : l.Concepto,
            Cantidad = l.Cantidad * (l.Dias ?? 1),
            PrecioUnitario = l.PrecioUnitario,
            Importe = l.Importe,
        }));
        return r;
    }

    static PedidoLinea Linea(Guid producto, string descripcion, decimal cantidad, decimal precio) => new()
    {
        ProductoId = producto,
        Descripcion = descripcion.Length > 300 ? descripcion[..300] : descripcion,
        Cantidad = cantidad,
        PrecioUnitario = precio,
        Importe = Calculo.Importe(precio, cantidad),
    };

    // ---------------------------------------------------------------------------------------------
    // Pedidos (órdenes de venta)
    // ---------------------------------------------------------------------------------------------

    public Task<Pedido?> Pedido(Guid id, CancellationToken ct, bool editar = false) =>
        (editar ? db.Set<Pedido>() : db.Set<Pedido>().AsNoTracking())
            .Include(p => p.Lineas).FirstOrDefaultAsync(p => p.Id == id, ct);

    /// <summary>Orden directa, sin cotización.</summary>
    public async Task<Pedido> CrearPedido(PedidoRequest r, CancellationToken ct)
    {
        var suc = await Sucursal(r.SucursalId, ct);
        await ClienteYObra(r.ClienteId, r.ObraId, ct);
        var p = new Pedido
        {
            EmpresaId = suc.EmpresaId,
            SucursalId = suc.Id,
            ClienteId = r.ClienteId,
            VendedorId = r.VendedorId ?? yo.Id,
            FechaHoraEntrega = r.FechaHoraEntrega,
            MetodoPago = ReglaException.Opcion<MetodoPago>(r.MetodoPago),
        };
        LugarDePedido(p, r);
        await LineasPedido(p, r, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        p.Folio = await db.SiguienteFolioAsync(p.EmpresaId, p.SucursalId, "pedido", ct);
        db.Set<Pedido>().Add(p);
        if (r.Confirmada) await MarcarConfirmada(p, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return p;
    }

    /// <summary>Solo mientras está programado. Si ya estaba con planta y cambia la entrega o el volumen, se le reenvía.</summary>
    public async Task<Pedido> EditarPedido(Guid id, PedidoRequest r, CancellationToken ct)
    {
        var p = await Pedido(id, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        if (p.Estado != EstadoPedido.Programado) throw new ReglaException("Solo se edita mientras está programado.", 409);
        if (r.SucursalId != p.SucursalId || r.ClienteId != p.ClienteId)
            throw new ReglaException("La planta y el cliente de una orden no se cambian.");
        await ClienteYObra(r.ClienteId, r.ObraId, ct);

        var volumenAntes = await VolumenConcreto(p.Lineas, ct);
        var entregaAntes = p.FechaHoraEntrega;
        foreach (var l in p.Lineas.ToList())
        {
            db.Set<PedidoLinea>().Remove(l);
            p.Lineas.Remove(l);
        }
        LugarDePedido(p, r);
        p.VendedorId = r.VendedorId ?? p.VendedorId;
        p.FechaHoraEntrega = r.FechaHoraEntrega;
        p.MetodoPago = ReglaException.Opcion<MetodoPago>(r.MetodoPago);
        await LineasPedido(p, r, ct);

        if (p.EstatusPlanta is EstatusPlanta.Enviado or EstatusPlanta.Confirmado or EstatusPlanta.Actualizacion
            && (entregaAntes != p.FechaHoraEntrega || volumenAntes != await VolumenConcreto(p.Lineas, ct)))
        {
            p.EstatusPlanta = EstatusPlanta.Enviado;
            p.SolicitudPlantaFecha = null;
            p.SolicitudPlantaNota = null;
        }
        await db.SaveChangesAsync(ct);
        return p;
    }

    /// <summary>A crédito: el cliente debe tener límite y alcanzarle (409). CreditoDesde se fija al entrar y se borra al salir.</summary>
    public async Task<Pedido> CambiarCobro(Guid id, string valor, CancellationToken ct)
    {
        var p = await Pedido(id, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        var nuevo = ReglaException.Opcion<EstadoCobro>(valor);
        if (nuevo == EstadoCobro.Credito && p.Cobro != EstadoCobro.Credito)
        {
            var credito = await Credito(p.ClienteId, ct);
            if (credito.Limite is not > 0) throw new ReglaException("El cliente no tiene crédito asignado.", 409);
            if (credito.Usado + p.Total > credito.Limite)
                throw new ReglaException($"Excede el crédito del cliente: disponible {Dinero(credito.Disponible)}.", 409);
            p.CreditoDesde = DateTime.UtcNow;
        }
        else if (nuevo != EstadoCobro.Credito) p.CreditoDesde = null;
        p.Cobro = nuevo;
        await db.SaveChangesAsync(ct);
        return p;
    }

    /// <summary>Crédito del cliente: sus pedidos no cancelados con cobro "credito", de todas sus razones sociales y plantas.</summary>
    public async Task<CreditoCliente> Credito(Guid clienteId, CancellationToken ct)
    {
        var c = await db.Set<Cliente>().IgnoreQueryFilters().FirstAsync(x => x.Id == clienteId, ct);
        var ahora = DateTime.UtcNow;
        var pedidos = (await db.Set<Pedido>().IgnoreQueryFilters().AsNoTracking()
                .Where(p => p.ClienteId == clienteId && !p.IsDeleted && p.Cobro == EstadoCobro.Credito && p.Estado != EstadoPedido.Cancelado)
                .Select(p => new { p.Id, p.Folio, p.Total, Desde = p.CreditoDesde ?? p.CreatedAt }).ToListAsync(ct))
            .OrderBy(p => p.Desde)
            .Select(p => new PedidoCredito(p.Id, p.Folio, p.Total, p.Desde, p.Desde.AddDays(c.DiasCredito), p.Desde.AddDays(c.DiasCredito) < ahora))
            .ToList();
        var usado = pedidos.Sum(p => p.Importe);
        return new(c.LimiteCredito, c.DiasCredito, usado, c.LimiteCredito - usado, pedidos);
    }

    public Task<Pedido> CambiarMetodoPago(Guid id, string valor, CancellationToken ct) =>
        CambiarPedido(id, p => p.MetodoPago = ReglaException.Opcion<MetodoPago>(valor), ct);

    /// <summary>Avance de la entrega (programado → en planta → en ruta → en obra → entregado).</summary>
    public Task<Pedido> CambiarEstado(Guid id, string valor, CancellationToken ct) => CambiarPedido(id, p =>
    {
        if (p.Estado is EstadoPedido.Cancelado or EstadoPedido.Entregado) throw Ya(p.Estado);
        p.Estado = ReglaException.Opcion<EstadoPedido>(valor);
    }, ct);

    public Task<Pedido> CancelarPedido(Guid id, CancellationToken ct) => CambiarPedido(id, p =>
    {
        if (p.Estado != EstadoPedido.Programado) throw new ReglaException("Solo se cancela mientras está programado.", 409);
        p.Estado = EstadoPedido.Cancelado;
    }, ct);

    /// <summary>Confirmación de Ventas: la orden pasa de "por confirmar" a "confirmada".</summary>
    public async Task<Pedido> ConfirmarOrden(Guid id, CancellationToken ct)
    {
        var p = await Pedido(id, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        if (p.Estado == EstadoPedido.Cancelado) throw new ReglaException("La orden está cancelada.", 409);
        if (p.ConfirmadaEn is not null) throw new ReglaException("La orden ya está confirmada.", 409);
        await MarcarConfirmada(p, ct);
        await db.SaveChangesAsync(ct);
        return p;
    }

    /// <summary>Marca la orden confirmada por el usuario actual y lo anota con la entrega en la hora de su planta.</summary>
    async Task MarcarConfirmada(Pedido p, CancellationToken ct)
    {
        (p.ConfirmadaEn, p.ConfirmadaPorId) = (DateTime.UtcNow, yo.Id);
        var zona = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Id == p.SucursalId).Select(s => s.ZonaHoraria).FirstOrDefaultAsync(ct);
        var entrega = HoraLocal(p.FechaHoraEntrega, zona);
        await Anotar(nameof(Domain.Ventas.Pedido), p.Id, p.EmpresaId,
            $"Orden confirmada (entrega {entrega.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)})", ct);
    }

    /// <summary>Hora UTC → hora de la planta (zona IANA; sin zona, America/Mexico_City; si el sistema no la conoce, UTC).</summary>
    public static DateTime HoraLocal(DateTime utc, string? zona)
    {
        var tz = TimeZoneInfo.TryFindSystemTimeZoneById(string.IsNullOrEmpty(zona) ? "America/Mexico_City" : zona, out var z) ? z : TimeZoneInfo.Utc;
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), tz);
    }

    /// <summary>Al quedar "confirmado" con la planta, la orden se confirma sola si no lo estaba.</summary>
    public async Task<Pedido> Planta(Guid id, PlantaRequest r, CancellationToken ct)
    {
        var p = await CambiarPlanta(id, r, ct);
        if (p.EstatusPlanta == EstatusPlanta.Confirmado && p.ConfirmadaEn is null)
            await MarcarConfirmada(p, ct);
        // La propuesta de la planta va a la misma cola que las demás solicitudes de reagenda.
        var pendiente = await db.Set<SolicitudReagenda>().FirstOrDefaultAsync(s => s.PedidoId == p.Id && s.Estado == EstadoSolicitud.Pendiente, ct);
        if (r.Accion == "actualizacion")
        {
            if (pendiente is not null)
            {
                ResolverSolicitud(pendiente, EstadoSolicitud.Rechazada, "Reemplazada por la propuesta de la planta.");
                await db.SaveChangesAsync(ct); // el índice único deja solo una pendiente por pedido
            }
            db.Set<SolicitudReagenda>().Add(new SolicitudReagenda
            {
                PedidoId = p.Id, FechaPropuesta = p.SolicitudPlantaFecha!.Value, Motivo = r.Nota?.Trim() is { Length: > 0 } n ? n : "La planta propone otra fecha.",
                Origen = OrigenReagenda.Planta, SolicitadoPorId = yo.Id, SolicitadoEn = DateTime.UtcNow,
            });
        }
        else if (r.Accion == "aceptar_actualizacion" && pendiente is { Origen: OrigenReagenda.Planta })
            ResolverSolicitud(pendiente, EstadoSolicitud.Aceptada, null);
        await db.SaveChangesAsync(ct);
        return p;
    }

    public void ResolverSolicitud(SolicitudReagenda s, EstadoSolicitud estado, string? nota) =>
        (s.Estado, s.ResueltaPorId, s.ResueltaEn, s.NotaResolucion) = (estado, yo.Id, DateTime.UtcNow, nota);

    Task<Pedido> CambiarPlanta(Guid id, PlantaRequest r, CancellationToken ct) => CambiarPedido(id, p =>
    {
        if (p.Estado == EstadoPedido.Cancelado) throw Ya(p.Estado);
        var antes = p.EstatusPlanta;
        void Exigir(params EstatusPlanta[] desde)
        {
            if (!desde.Contains(antes))
                throw new ReglaException($"No se puede «{r.Accion}» con el estatus de planta {Clave(antes)}.", 409);
        }
        switch (r.Accion)
        {
            case "enviar":
                Exigir(EstatusPlanta.NoEnviado, EstatusPlanta.Rechazada, EstatusPlanta.Actualizacion);
                p.EstatusPlanta = EstatusPlanta.Enviado;
                break;
            case "confirmar":
                Exigir(EstatusPlanta.Enviado);
                p.EstatusPlanta = EstatusPlanta.Confirmado;
                break;
            case "actualizacion":
                Exigir(EstatusPlanta.Enviado, EstatusPlanta.Confirmado);
                p.SolicitudPlantaFecha = r.Fecha ?? throw new ReglaException("Indica la nueva fecha que propone la planta.");
                p.SolicitudPlantaNota = r.Nota;
                p.EstatusPlanta = EstatusPlanta.Actualizacion;
                break;
            case "rechazar":
                Exigir(EstatusPlanta.Enviado, EstatusPlanta.Confirmado);
                p.SolicitudPlantaNota = string.IsNullOrWhiteSpace(r.Nota) ? throw new ReglaException("Indica el motivo del rechazo.") : r.Nota;
                p.EstatusPlanta = EstatusPlanta.Rechazada;
                break;
            case "aceptar_actualizacion":
                Exigir(EstatusPlanta.Actualizacion);
                p.FechaHoraEntrega = p.SolicitudPlantaFecha!.Value;
                p.SolicitudPlantaFecha = null;
                p.EstatusPlanta = EstatusPlanta.Confirmado;
                break;
            default:
                throw new ReglaException($"Acción desconocida: {r.Accion}.");
        }
    }, ct);

    async Task<Pedido> CambiarPedido(Guid id, Action<Pedido> cambio, CancellationToken ct)
    {
        var p = await Pedido(id, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        cambio(p);
        await db.SaveChangesAsync(ct);
        return p;
    }

    async Task LineasPedido(Pedido p, PedidoRequest r, CancellationToken ct)
    {
        var ids = r.Lineas.Select(l => l.ProductoId).ToHashSet();
        var productos = await db.Set<Producto>().Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        foreach (var lr in r.Lineas)
        {
            var producto = productos.FirstOrDefault(x => x.Id == lr.ProductoId) ?? throw new ReglaException("Un producto no existe.");
            await PedidoMinimo([(producto, lr.Cantidad)], ct);
            p.Lineas.Add(Linea(producto.Id, lr.Descripcion ?? producto.Nombre,
                Math.Max(lr.Cantidad, producto.MinimoCobro ?? 0), lr.PrecioUnitario ?? producto.PrecioLista));
        }
        Calculo.Totalizar(p, p.Lineas.Sum(l => l.Importe) * r.DescuentoPct / 100, await TasaIva(ct));
    }

    /// <summary>m³ de concreto de la orden: sus líneas de productos de concreto, sin ajustes (AJ-).</summary>
    public async Task<decimal> VolumenConcreto(IEnumerable<PedidoLinea> lineas, CancellationToken ct)
    {
        var ids = lineas.Select(l => l.ProductoId).ToHashSet();
        var concretos = await db.Set<Producto>().IgnoreQueryFilters()
            .Where(x => ids.Contains(x.Id) && x.Tipo == TipoProducto.Concreto && !x.Codigo.StartsWith("AJ-"))
            .Select(x => x.Id).ToListAsync(ct);
        return lineas.Where(l => concretos.Contains(l.ProductoId)).Sum(l => l.Cantidad);
    }

    // ---------------------------------------------------------------------------------------------

    async Task<Sucursal> Sucursal(Guid id, CancellationToken ct) =>
        await db.Set<Sucursal>().FirstOrDefaultAsync(s => s.Id == id, ct)
        ?? throw new ReglaException("La planta no existe o no tienes acceso a ella.");

    static void LugarDePedido(Pedido p, PedidoRequest r)
    {
        CopiarLugar(new Pedido { ObraId = r.ObraId, EntregaDireccion = r.EntregaDireccion, EntregaMunicipio = r.EntregaMunicipio,
            EntregaReferencias = r.EntregaReferencias, EntregaLat = r.EntregaLat, EntregaLng = r.EntregaLng }, p);
        ValidarLugar(p, obligatorio: true);
    }

    static void CopiarLugar(ILugarEntrega de, ILugarEntrega a)
    {
        static string? Texto(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        a.ObraId = de.ObraId;
        a.EntregaDireccion = Texto(de.EntregaDireccion);
        a.EntregaMunicipio = Texto(de.EntregaMunicipio);
        a.EntregaReferencias = Texto(de.EntregaReferencias);
        (a.EntregaLat, a.EntregaLng) = (de.EntregaLat, de.EntregaLng);
    }

    /// <summary>Obra o lugar, no los dos; el lugar pide dirección y municipio. obligatorio = ya no puede faltar (enviar, confirmar, pedido).</summary>
    public static void ValidarLugar(ILugarEntrega x, bool obligatorio)
    {
        var lugar = x.EntregaDireccion is not null || x.EntregaMunicipio is not null || x.EntregaReferencias is not null
                    || x.EntregaLat is not null || x.EntregaLng is not null;
        if (x.ObraId is not null && lugar) throw new ReglaException("Elige una obra o captura un lugar de entrega, no los dos.");
        if (lugar && (x.EntregaDireccion is null || x.EntregaMunicipio is null))
            throw new ReglaException("Falta la dirección o el municipio de entrega.");
        if (obligatorio && x.ObraId is null && !lugar)
            throw new ReglaException(x is Pedido ? "El pedido no tiene obra ni lugar de entrega." : "La cotización no tiene obra ni lugar de entrega.");
    }

    async Task ClienteYObra(Guid? clienteId, Guid? obraId, CancellationToken ct)
    {
        if (clienteId is Guid c && !await db.Set<Cliente>().AnyAsync(x => x.Id == c, ct))
            throw new ReglaException("El cliente no existe.");
        if (obraId is Guid o && !await db.Set<Obra>().AnyAsync(x => x.Id == o && (clienteId == null || x.ClienteId == null || x.ClienteId == clienteId), ct))
            throw new ReglaException("La obra no existe o no es de ese cliente.");
    }

    async Task<decimal> TasaIva(CancellationToken ct) =>
        await db.Set<Impuesto>()
            .Where(i => i.EmpresaId == null && i.ImpuestoSat == "002" && i.Tipo == TipoImpuesto.Traslado)
            .Select(i => (decimal?)i.Tasa).FirstOrDefaultAsync(ct)
        ?? throw new ReglaException("Falta el IVA en Impuesto: corre el seed (--migrate).", 500);

    public const string CodigoEspecial = "CON-ESPECIAL";

    async Task<Producto> ProductoEspecial(CancellationToken ct) =>
        await db.Set<Producto>().FirstOrDefaultAsync(x => x.Codigo == CodigoEspecial, ct)
        ?? throw new ReglaException($"Falta el producto {CodigoEspecial}: corre el seed (--migrate).", 500);

    async Task<Producto> ProductoTraslado(CancellationToken ct) =>
        await db.Set<Producto>().FirstOrDefaultAsync(x => x.Codigo == CodigoTraslado, ct)
        ?? throw new ReglaException($"Falta el producto {CodigoTraslado}: corre el seed (--migrate).", 500);

    static string Clave(Enum e) => System.Text.Json.JsonNamingPolicy.SnakeCaseLower.ConvertName(e.ToString());

    static ReglaException Ya(Enum estado) => new($"Ya está {Clave(estado)}.", 409);
}
