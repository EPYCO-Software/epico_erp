using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Contracts.Comun;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

// ------------------------------------------------------------------------------------------------
// Clientes y CRM
// ------------------------------------------------------------------------------------------------

[Route("api/v1/clientes")]
public class ClientesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Cliente>(db, yo)
{
    protected override string Recurso => "ventas.clientes";

    protected override async Task AntesDeBorrar(Cliente x, CancellationToken ct)
    {
        if (x.EsPublicoGeneral) throw new ReglaException("El cliente público en general no se elimina.", 409);
        // Sin filtros: cuentan también los de razones sociales que el usuario no ve.
        if (await Db.Set<Cotizacion>().IgnoreQueryFilters().AnyAsync(c => c.ClienteId == x.Id && !c.IsDeleted, ct)
            || await Db.Set<Pedido>().IgnoreQueryFilters().AnyAsync(p => p.ClienteId == x.Id && !p.IsDeleted, ct)
            || await Db.Set<Obra>().IgnoreQueryFilters().AnyAsync(o => o.ClienteId == x.Id && !o.IsDeleted, ct))
            throw new ReglaException("No se puede eliminar: lo usan cotizaciones, pedidos u obras.", 409);
    }
}

[Route("api/v1/cliente-contactos")]
public class ClienteContactosController(IAppDbContext db, IUsuarioActual yo) : CrudController<ClienteContacto>(db, yo)
{
    protected override string Recurso => "ventas.clientes";
    protected override Task<bool> PermitidoAsync(ClienteContacto x, CancellationToken ct) => PadreVisible<Cliente>(x.ClienteId, ct);
}

[Route("api/v1/cliente-datos-fiscales")]
public class ClienteDatosFiscalesController(IAppDbContext db, IUsuarioActual yo) : CrudController<ClienteDatoFiscal>(db, yo)
{
    protected override string Recurso => "ventas.clientes";
    protected override Task<bool> PermitidoAsync(ClienteDatoFiscal x, CancellationToken ct) => PadreVisible<Cliente>(x.ClienteId, ct);
}

/// <summary>Obras de un cliente o generales (clienteId null) de la organización.</summary>
/// <remarks>Lista: además de ?clienteId=…, ?sinCliente=true|false y ?q= (nombre, dirección o municipio).</remarks>
[Route("api/v1/obras")]
public class ObrasController(IAppDbContext db, IUsuarioActual yo) : CrudController<Obra>(db, yo)
{
    protected override string Recurso => "ventas.obras";

    protected override IQueryable<Obra> Filtrar(IQueryable<Obra> q)
    {
        if (bool.TryParse(Request.Query["sinCliente"], out var sin)) q = q.Where(o => (o.ClienteId == null) == sin);
        if (Request.Query["q"].ToString().Trim().ToLower() is { Length: > 0 } t)
            q = q.Where(o => o.Nombre.ToLower().Contains(t) || o.Direccion.ToLower().Contains(t) || o.Municipio!.ToLower().Contains(t));
        return FiltroQuery.Aplicar(q, Request.Query, "q", "sinCliente");
    }

    protected override async Task AntesDeGuardar(Obra x, bool nuevo, CancellationToken ct)
    {
        if (x.ClienteId is Guid c && !await Db.Set<Cliente>().AnyAsync(p => p.Id == c && p.OrganizacionId == x.OrganizacionId, ct))
            throw new ReglaException("El cliente no existe o es de otra organización.");
    }

    protected override async Task AntesDeBorrar(Obra x, CancellationToken ct)
    {
        // Sin filtros: cuentan también las de razones sociales que el usuario no ve.
        if (await Db.Set<Cotizacion>().IgnoreQueryFilters().AnyAsync(c => c.ObraId == x.Id && !c.IsDeleted, ct)
            || await Db.Set<Pedido>().IgnoreQueryFilters().AnyAsync(p => p.ObraId == x.Id && !p.IsDeleted, ct))
            throw new ReglaException("La obra tiene cotizaciones o pedidos", 409);
    }
}

[Route("api/v1/prospectos")]
public class ProspectosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Prospecto>(db, yo)
{
    protected override string Recurso => "crm.prospectos";
}

// ------------------------------------------------------------------------------------------------
// Productos, inventario y equipos
// ------------------------------------------------------------------------------------------------

[Route("api/v1/categorias-producto")]
public class CategoriasProductoController(IAppDbContext db, IUsuarioActual yo) : CrudController<CategoriaProducto>(db, yo)
{
    protected override string Recurso => "ventas.productos";
    // Las del sistema (sin organización) solo las toca root.
    protected override Task<bool> PermitidoAsync(CategoriaProducto x, CancellationToken ct) =>
        Task.FromResult(Yo.EsRoot || x.OrganizacionId != null && x.OrganizacionId == Yo.OrganizacionId);
}

[Route("api/v1/productos")]
/// <remarks>Lista: además de la igualdad por campo, ?solucion=pavimento (productos con esa solución).</remarks>
public class ProductosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Producto>(db, yo)
{
    protected override string Recurso => "ventas.productos";

    protected override IQueryable<Producto> Filtrar(IQueryable<Producto> q)
    {
        if (Request.Query["solucion"].ToString() is { Length: > 0 } s) q = q.Where(p => p.Soluciones.Contains(s));
        return FiltroQuery.Aplicar(q, Request.Query, "solucion");
    }

    protected override async Task AntesDeGuardar(Producto x, bool nuevo, CancellationToken ct)
    {
        x.Soluciones = [.. (x.Soluciones ?? []).Select(s => s.Trim().ToLowerInvariant()).Distinct()];
        if (x.Soluciones.FirstOrDefault(s => !Soluciones.Todas.Contains(s)) is { } mala) throw new ReglaException($"Solución desconocida: {mala}.");
        if (x.Soluciones.Count > 0 && x.Tipo != Domain.Common.TipoProducto.Concreto) throw new ReglaException("Solo los concretos llevan soluciones.");
        // El cotizador cobra el aditivo "fibra-sintetica" con el producto AJ-ADT-FIBRA-SINTETICA.
        if (await Db.Set<CategoriaProducto>().AnyAsync(c => c.Id == x.CategoriaId && c.Clave == "aditivo", ct)
            && !System.Text.RegularExpressions.Regex.IsMatch(x.Codigo, "^AJ-ADT-[A-Z0-9]+(-[A-Z0-9]+)*$"))
            throw new ReglaException("El código de un aditivo es AJ-ADT- y su clave en mayúsculas, sin acentos ni espacios (p. ej. AJ-ADT-FIBRA-SINTETICA).");
    }
}

[Route("api/v1/unidades-medida")]
public class UnidadesMedidaController(IAppDbContext db, IUsuarioActual yo) : CrudController<UnidadMedida>(db, yo)
{
    protected override string Recurso => "ventas.productos";
    // Catálogo global: solo root lo cambia.
    protected override Task<bool> PermitidoAsync(UnidadMedida x, CancellationToken ct) => Task.FromResult(Yo.EsRoot);
}

[Route("api/v1/impuestos")]
public class ImpuestosController(IAppDbContext db, IUsuarioActual yo) : CrudController<Impuesto>(db, yo)
{
    protected override string Recurso => "config.impuestos";
    protected override Task<bool> PermitidoAsync(Impuesto x, CancellationToken ct) =>
        Task.FromResult(Yo.EsRoot || x.EmpresaId is Guid e && Yo.EmpresaIds.Contains(e));
}

[Route("api/v1/equipos")]
public class EquiposController(IAppDbContext db, IUsuarioActual yo) : CrudController<Equipo>(db, yo)
{
    protected override string Recurso => "flota.equipos";
    protected override Task<bool> PermitidoAsync(Equipo x, CancellationToken ct) => PadreVisible<Sucursal>(x.SucursalId, ct);
}

[Route("api/v1/producto-equipos")]
public class ProductoEquiposController(IAppDbContext db, IUsuarioActual yo) : CrudController<ProductoEquipo>(db, yo)
{
    protected override string Recurso => "ventas.productos";
    protected override async Task<bool> PermitidoAsync(ProductoEquipo x, CancellationToken ct) =>
        await PadreVisible<Producto>(x.ProductoId, ct) && await PadreVisible<Equipo>(x.EquipoId, ct);
}

/// <summary>Solo lectura: las existencias cambian con movimientos de inventario.</summary>
[Route("api/v1/existencias")]
public class ExistenciasController(IAppDbContext db, IUsuarioActual yo) : CrudController<Existencia>(db, yo)
{
    protected override string Recurso => "inventario.existencias";
    protected override Task<bool> PermitidoAsync(Existencia x, CancellationToken ct) => Task.FromResult(false);
}

[ApiController]
[Route("api/v1/movimientos-inventario")]
public class MovimientosInventarioController(IAppDbContext db, IUsuarioActual yo) : ControllerBase
{
    /// <summary>Lista</summary>
    /// <remarks>Filtros por igualdad en la query, como los CRUD.</remarks>
    [HttpGet, Permiso("inventario.movimientos.ver")]
    public Task<List<MovimientoInventario>> Lista([FromQuery] int skip = 0, [FromQuery] int take = 100, CancellationToken ct = default) =>
        FiltroQuery.Aplicar(db.Set<MovimientoInventario>().AsNoTracking(), Request.Query)
            .OrderByDescending(m => m.Fecha).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 500)).ToListAsync(ct);

    /// <summary>Registrar movimiento</summary>
    /// <remarks>Entrada (+), salida (−) o ajuste (con signo). Guarda el movimiento y suma la existencia en una transacción.</remarks>
    [HttpPost, Permiso("inventario.movimientos.crear")]
    public async Task<ActionResult<MovimientoInventario>> Crear(MovimientoInventario m, CancellationToken ct)
    {
        if (!await db.Set<Sucursal>().AnyAsync(s => s.Id == m.SucursalId, ct) || !await db.Set<Producto>().AnyAsync(p => p.Id == m.ProductoId, ct))
            return Problem("La planta o el producto no existen o no tienes acceso.", statusCode: 403);
        var delta = m.Tipo switch
        {
            Domain.Common.TipoMovimientoInventario.Entrada => Math.Abs(m.Cantidad),
            Domain.Common.TipoMovimientoInventario.Salida => -Math.Abs(m.Cantidad),
            _ => m.Cantidad,
        };
        m.Id = Guid.Empty;
        m.Fecha = DateTime.UtcNow;
        m.UsuarioId = yo.Id;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Set<MovimientoInventario>().Add(m);
        await db.SaveChangesAsync(ct);
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO "Existencia" ("Id", "ProductoId", "SucursalId", "Cantidad", "UpdatedAt")
            VALUES ({Guid.CreateVersion7()}, {m.ProductoId}, {m.SucursalId}, {delta}, now())
            ON CONFLICT ("ProductoId", "SucursalId")
            DO UPDATE SET "Cantidad" = "Existencia"."Cantidad" + EXCLUDED."Cantidad", "UpdatedAt" = now()
            """, ct);
        await tx.CommitAsync(ct);
        return m;
    }
}

// ------------------------------------------------------------------------------------------------
// Listas de precios y programas
// ------------------------------------------------------------------------------------------------

[Route("api/v1/listas-precios")]
public class ListasPreciosController(IAppDbContext db, IUsuarioActual yo) : CrudController<ListaPrecios>(db, yo)
{
    protected override string Recurso => "ventas.listas_precios";
}

[Route("api/v1/lista-precios-sucursales")]
public class ListaPreciosSucursalesController(IAppDbContext db, IUsuarioActual yo) : CrudController<ListaPreciosSucursal>(db, yo)
{
    protected override string Recurso => "ventas.listas_precios";
    protected override async Task<bool> PermitidoAsync(ListaPreciosSucursal x, CancellationToken ct) =>
        await PadreVisible<ListaPrecios>(x.ListaPreciosId, ct) && await PadreVisible<Sucursal>(x.SucursalId, ct);
}

[Route("api/v1/reglas-precio")]
public class ReglasPrecioController(IAppDbContext db, IUsuarioActual yo) : CrudController<ReglaPrecio>(db, yo)
{
    protected override string Recurso => "ventas.listas_precios";
    protected override Task<bool> PermitidoAsync(ReglaPrecio x, CancellationToken ct) => PadreVisible<ListaPrecios>(x.ListaPreciosId, ct);
}

[Route("api/v1/programas-descuento")]
public class ProgramasDescuentoController(IAppDbContext db, IUsuarioActual yo) : CrudController<ProgramaDescuento>(db, yo)
{
    protected override string Recurso => "ventas.programas";
}

[Route("api/v1/cupones")]
public class CuponesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Cupon>(db, yo)
{
    protected override string Recurso => "ventas.programas";
    protected override Task<bool> PermitidoAsync(Cupon x, CancellationToken ct) => PadreVisible<ProgramaDescuento>(x.ProgramaId, ct);
}

[Route("api/v1/saldos-lealtad")]
public class SaldosLealtadController(IAppDbContext db, IUsuarioActual yo) : CrudController<SaldoLealtad>(db, yo)
{
    protected override string Recurso => "ventas.programas";
    protected override Task<bool> PermitidoAsync(SaldoLealtad x, CancellationToken ct) => PadreVisible<ProgramaDescuento>(x.ProgramaId, ct);
}

// ------------------------------------------------------------------------------------------------
// Documentos
// ------------------------------------------------------------------------------------------------

[ApiController]
[Route("api/v1/cotizaciones")]
public class CotizacionesController(IAppDbContext db, VentasServicio ventas) : ControllerBase
{
    /// <summary>Lista</summary>
    /// <remarks>Paginada, de la más reciente a la más vieja. <c>incluir=partidas</c> trae partidas y líneas.
    /// desde/hasta (ISO 8601, hasta exclusivo) filtran por fecha. Filtros por igualdad, repetibles:
    /// <c>?estado=enviada&amp;clienteId=…&amp;sucursalId=a&amp;sucursalId=b&amp;serie=…</c></remarks>
    [HttpGet, Permiso("ventas.cotizaciones.ver")]
    public async Task<Pagina<Cotizacion>> Lista([FromQuery] string? incluir, [FromQuery] DateTimeOffset? desde, [FromQuery] DateTimeOffset? hasta,
        [FromQuery] int pagina = 1, [FromQuery] int tamano = 50, CancellationToken ct = default)
    {
        var q = FiltroQuery.Aplicar(db.Set<Cotizacion>().AsNoTracking(), Request.Query, Listas.Claves);
        if (desde is { } d) q = q.Where(c => c.Fecha >= d.UtcDateTime);
        if (hasta is { } h) q = q.Where(c => c.Fecha < h.UtcDateTime);
        if (Listas.Incluir(incluir, "partidas")) q = q.Include(c => c.Partidas.OrderBy(p => p.Orden)).ThenInclude(p => p.Lineas).AsSplitQuery();
        return await Listas.Paginar(q.OrderByDescending(c => c.Fecha).ThenBy(c => c.Id), pagina, tamano, ct);
    }

    /// <summary>Una completa</summary>
    /// <remarks>Con partidas (en orden) y sus líneas.</remarks>
    [HttpGet("{id:guid}"), Permiso("ventas.cotizaciones.ver")]
    public async Task<ActionResult<Cotizacion>> Uno(Guid id, CancellationToken ct) =>
        await ventas.Cotizacion(id, ct) is { } c ? c : NotFound();

    /// <summary>Crear</summary>
    /// <remarks>Queda en borrador con el siguiente folio de la planta. La API calcula todos los importes. revisionDeId = nueva revisión de una enviada ({serie}-R1…); baseId = nueva basada en otra.</remarks>
    [HttpPost, Permiso("ventas.cotizaciones.crear")]
    public async Task<ActionResult<Cotizacion>> Crear(CotizacionRequest r, CancellationToken ct)
    {
        var c = await ventas.CrearCotizacion(r, ct);
        return CreatedAtAction(nameof(Uno), new { id = c.Id }, c);
    }

    /// <summary>Editar</summary>
    /// <remarks>Solo en recibida o borrador (si no, 409). Partidas y líneas con id se editan, sin id se agregan y las que no vengan se quitan.</remarks>
    [HttpPut("{id:guid}"), Permiso("ventas.cotizaciones.editar")]
    public Task<Cotizacion> Editar(Guid id, CotizacionRequest r, CancellationToken ct) => ventas.EditarCotizacion(id, r, ct);

    /// <summary>Enviar al cliente</summary>
    /// <remarks>Pasa a enviada; desde ahí ya no se edita (se hace una revisión).</remarks>
    [HttpPost("{id:guid}/enviar"), Permiso("ventas.cotizaciones.enviar")]
    public Task<Cotizacion> Enviar(Guid id, CancellationToken ct) => ventas.Enviar(id, ct);

    /// <summary>Ocultar o mostrar al cliente</summary>
    [HttpPost("{id:guid}/ocultar"), Permiso("ventas.cotizaciones.editar")]
    public Task<Cotizacion> Ocultar(Guid id, OcultarRequest r, CancellationToken ct) => ventas.Ocultar(id, r.Oculta, ct);

    /// <summary>Cancelar</summary>
    [HttpPost("{id:guid}/cancelar"), Permiso("ventas.cotizaciones.cancelar")]
    public Task<Cotizacion> Cancelar(Guid id, CancellationToken ct) => ventas.Cancelar(id, ct);

    /// <summary>Confirmar → pedidos</summary>
    /// <remarks>Genera un pedido por partida, con su parte del descuento, y devuelve los pedidos. Pide cliente, obra y fecha de entrega en cada partida.</remarks>
    [HttpPost("{id:guid}/confirmar"), Permiso("ventas.cotizaciones.confirmar")]
    public Task<List<Pedido>> Confirmar(Guid id, CancellationToken ct) => ventas.Confirmar(id, ct);
}

[ApiController]
[Route("api/v1/pedidos")]
public class PedidosController(IAppDbContext db, VentasServicio ventas) : ControllerBase
{
    /// <summary>Lista</summary>
    /// <remarks>Paginada, por fecha de entrega (la más lejana primero). <c>incluir=lineas</c> trae las líneas.
    /// desde/hasta (ISO 8601, hasta exclusivo) filtran por entrega. Filtros por igualdad, repetibles:
    /// <c>?cobro=por_cobrar&amp;estado=…&amp;sucursalId=a&amp;sucursalId=b&amp;cotizacionId=…</c></remarks>
    [HttpGet, Permiso("ventas.pedidos.ver")]
    public async Task<Pagina<Pedido>> Lista([FromQuery] string? incluir, [FromQuery] DateTimeOffset? desde, [FromQuery] DateTimeOffset? hasta,
        [FromQuery] int pagina = 1, [FromQuery] int tamano = 50, CancellationToken ct = default)
    {
        var q = FiltroQuery.Aplicar(db.Set<Pedido>().AsNoTracking(), Request.Query, Listas.Claves);
        if (desde is { } d) q = q.Where(p => p.FechaHoraEntrega >= d.UtcDateTime);
        if (hasta is { } h) q = q.Where(p => p.FechaHoraEntrega < h.UtcDateTime);
        if (Listas.Incluir(incluir, "lineas")) q = q.Include(p => p.Lineas).AsSplitQuery();
        return await Listas.Paginar(q.OrderByDescending(p => p.FechaHoraEntrega).ThenBy(p => p.Id), pagina, tamano, ct);
    }

    /// <summary>Uno completo</summary>
    /// <remarks>Con sus líneas.</remarks>
    [HttpGet("{id:guid}"), Permiso("ventas.pedidos.ver")]
    public async Task<ActionResult<Pedido>> Uno(Guid id, CancellationToken ct) =>
        await ventas.Pedido(id, ct) is { } p ? p : NotFound();

    /// <summary>Orden directa</summary>
    /// <remarks>Pedido sin cotización. La API calcula los importes.</remarks>
    [HttpPost, Permiso("ventas.pedidos.crear")]
    public async Task<ActionResult<Pedido>> Crear(PedidoRequest r, CancellationToken ct)
    {
        var p = await ventas.CrearPedido(r, ct);
        return CreatedAtAction(nameof(Uno), new { id = p.Id }, p);
    }

    /// <summary>Editar</summary>
    /// <remarks>Solo programados. Si cambia la entrega o el volumen, se reenvía a planta.</remarks>
    [HttpPut("{id:guid}"), Permiso("ventas.pedidos.editar")]
    public Task<Pedido> Editar(Guid id, PedidoRequest r, CancellationToken ct) => ventas.EditarPedido(id, r, ct);

    /// <summary>Cambiar estado de cobro</summary>
    /// <remarks>valor: por_cobrar, por_facturar, facturado, credito, pagado, finalizado.</remarks>
    [HttpPost("{id:guid}/cobro"), Permiso("ventas.pedidos.cobrar")]
    public Task<Pedido> Cobro(Guid id, ValorRequest r, CancellationToken ct) => ventas.CambiarCobro(id, r.Valor, ct);

    /// <summary>Cambiar método de pago</summary>
    /// <remarks>valor: sin_metodo, transferencia.</remarks>
    [HttpPost("{id:guid}/metodo-pago"), Permiso("ventas.pedidos.editar")]
    public Task<Pedido> MetodoPago(Guid id, ValorRequest r, CancellationToken ct) => ventas.CambiarMetodoPago(id, r.Valor, ct);

    /// <summary>Cambiar estado de entrega</summary>
    /// <remarks>valor: un EstadoPedido.</remarks>
    [HttpPost("{id:guid}/estado"), Permiso("ventas.pedidos.estado")]
    public Task<Pedido> Estado(Guid id, ValorRequest r, CancellationToken ct) => ventas.CambiarEstado(id, r.Valor, ct);

    /// <summary>Flujo con planta</summary>
    /// <remarks>accion: enviar · confirmar · actualizacion (la planta pide otra fecha, con nota) · rechazar (con nota) · aceptar_actualizacion. Una transición inválida da 409.</remarks>
    [HttpPost("{id:guid}/planta"), Permiso("ventas.pedidos.planta")]
    public Task<Pedido> Planta(Guid id, PlantaRequest r, CancellationToken ct) => ventas.Planta(id, r, ct);

    /// <summary>Cancelar</summary>
    [HttpPost("{id:guid}/cancelar"), Permiso("ventas.pedidos.cancelar")]
    public Task<Pedido> Cancelar(Guid id, CancellationToken ct) => ventas.CancelarPedido(id, ct);
}

[Route("api/v1/remisiones")]
public class RemisionesController(IAppDbContext db, IUsuarioActual yo) : CrudController<Remision>(db, yo)
{
    protected override string Recurso => "operacion.remisiones";
    protected override Task<bool> PermitidoAsync(Remision x, CancellationToken ct) => PadreVisible<Pedido>(x.PedidoId, ct);

    protected override async Task AntesDeGuardar(Remision x, bool nuevo, CancellationToken ct)
    {
        if (!nuevo || !string.IsNullOrWhiteSpace(x.Folio)) return;
        var p = await Db.Set<Pedido>().FirstAsync(p => p.Id == x.PedidoId, ct);
        x.Folio = await Db.SiguienteFolioAsync(p.EmpresaId, p.SucursalId, "remision", ct);
    }
}

[ApiController]
[Route("api/v1/monedas")]
public class MonedasController(IAppDbContext db) : ControllerBase
{
    [HttpGet]
    public Task<List<Moneda>> Lista(CancellationToken ct) => db.Set<Moneda>().AsNoTracking().OrderBy(m => m.Codigo).ToListAsync(ct);
}

/// <summary>Paginación e "incluir" de las listas de documentos.</summary>
static class Listas
{
    public static readonly string[] Claves = ["incluir", "desde", "hasta", "pagina", "tamano"];

    public static bool Incluir(string? incluir, string valido) =>
        incluir is null ? false
        : incluir.Equals(valido, StringComparison.OrdinalIgnoreCase) ? true
        : throw new ReglaException($"incluir solo acepta «{valido}».");

    public static async Task<Pagina<T>> Paginar<T>(IQueryable<T> q, int pagina, int tamano, CancellationToken ct)
    {
        if (pagina < 1 || tamano is < 1 or > 500) throw new ReglaException("pagina empieza en 1 y tamano va de 1 a 500.");
        return new(await q.Skip((pagina - 1) * tamano).Take(tamano).ToListAsync(ct), await q.CountAsync(ct));
    }
}
