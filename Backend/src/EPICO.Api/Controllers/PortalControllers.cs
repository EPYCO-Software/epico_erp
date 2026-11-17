using System.Security.Claims;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Contracts.Auth;
using EPICO.Contracts.Comun;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

// Portal de clientes (/api/v1/portal). Solo usuarios Tipo=Portal, con el claim cli de su cliente: el candado de
// Program.cs no los deja salir de /portal, /me y /auth, y aquí todo se filtra por ese cliente.

[ApiController]
public abstract class PortalBase : ControllerBase
{
    protected Guid ClienteId => Guid.Parse(User.FindFirstValue(Tokens.Cliente)!);
}

/// <summary>CRUD de una tabla del cliente: solo ve y escribe los renglones de su cliente.</summary>
public abstract class PortalCrud<T>(IAppDbContext db) : PortalBase where T : BaseEntity, IDeCliente
{
    protected IAppDbContext Db => db;
    protected IQueryable<T> Mios() => db.Set<T>().Where(x => x.ClienteId == ClienteId);

    /// <summary>actual = null al crear.</summary>
    protected virtual Task AntesDeGuardar(T x, T? actual, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task AntesDeBorrar(T actual, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Lista</summary>
    [HttpGet]
    public Task<List<T>> Lista(CancellationToken ct) => Mios().AsNoTracking().OrderBy(x => x.CreatedAt).ToListAsync(ct);

    /// <summary>Uno</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<T>> Uno(Guid id, CancellationToken ct) =>
        await Mios().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) is { } x ? x : NotFound();

    /// <summary>Crear</summary>
    /// <remarks>clienteId, id y auditoría se ignoran: siempre es del cliente en sesión.</remarks>
    [HttpPost]
    public async Task<ActionResult<T>> Crear(T x, CancellationToken ct)
    {
        (x.Id, x.IsDeleted, x.ClienteId) = (Guid.Empty, false, ClienteId);
        await AntesDeGuardar(x, null, ct);
        db.Set<T>().Add(x);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Uno), new { id = x.Id }, x);
    }

    /// <summary>Editar</summary>
    /// <remarks>Manda el registro completo.</remarks>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<T>> Editar(Guid id, T x, CancellationToken ct)
    {
        var actual = await Mios().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (actual is null) return NotFound();
        x.ClienteId = ClienteId;
        await AntesDeGuardar(x, actual, ct);
        foreach (var p in db.Entry(actual).Properties)
            if (p.Metadata.PropertyInfo is { } info && CrudController<T>.Editable(info))
                p.CurrentValue = info.GetValue(x);
        await db.SaveChangesAsync(ct);
        return actual;
    }

    /// <summary>Eliminar</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var actual = await Mios().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (actual is null) return NotFound();
        await AntesDeBorrar(actual, ct);
        db.Set<T>().Remove(actual);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

[Route("api/v1/portal/datos-fiscales")]
public class PortalDatosFiscalesController(IAppDbContext db) : PortalCrud<ClienteDatoFiscal>(db)
{
    /// <summary>Solo uno predeterminado: al marcar uno se desmarcan los demás.</summary>
    protected override async Task AntesDeGuardar(ClienteDatoFiscal x, ClienteDatoFiscal? actual, CancellationToken ct)
    {
        if (x.Predeterminado)
            await Mios().Where(d => d.Predeterminado && d.Id != (actual == null ? Guid.Empty : actual.Id))
                .ExecuteUpdateAsync(d => d.SetProperty(y => y.Predeterminado, false), ct);
    }
}

[Route("api/v1/portal/obras")]
public class PortalObrasController(IAppDbContext db) : PortalCrud<Obra>(db)
{
    Task<bool> ConPedidos(Guid obra, bool soloEnCurso, CancellationToken ct) => Db.Set<Pedido>().AnyAsync(p => p.ObraId == obra &&
        (!soloEnCurso || p.Estado != EstadoPedido.Entregado && p.Estado != EstadoPedido.Cancelado), ct);

    protected override async Task AntesDeGuardar(Obra x, Obra? actual, CancellationToken ct)
    {
        x.OrganizacionId = await Db.Set<Cliente>().IgnoreQueryFilters().Where(c => c.Id == ClienteId).Select(c => c.OrganizacionId).FirstAsync(ct);
        x.EmpresaRestringidaId = actual?.EmpresaRestringidaId;
        if (actual is not null && await ConPedidos(actual.Id, true, ct))
            throw new ReglaException("La obra tiene pedidos en curso: pide el cambio a tu asesor.", 409);
    }

    protected override async Task AntesDeBorrar(Obra actual, CancellationToken ct)
    {
        if (await ConPedidos(actual.Id, false, ct))
            throw new ReglaException("La obra ya tiene pedidos: no se puede eliminar.", 409);
    }
}

[Route("api/v1/portal/disenos")]
public class PortalDisenosController(IAppDbContext db) : PortalCrud<DisenoPortal>(db);

// ------------------------------------------------------------------------------------------------

public record ClientePortal(Guid Id, string Nombre, string? Giro, string? Correo, string? Telefono, string? SitioWeb,
    int DiasCredito, decimal? LimiteCredito);

public record PerfilPortal(Usuario Usuario, ClientePortal Cliente);

public record PlantaPortal(Guid Id, Guid EmpresaId, string Empresa, string Codigo, string Nombre, string? Direccion,
    string? Telefono, string ZonaHoraria, decimal? Lat, decimal? Lng, decimal KmIncluidos, decimal PrecioKm);

/// <summary>Lista = la lista de precios del cliente (null = precios de lista); ListaPlantas vacía = aplica en todas.</summary>
public record CatalogoPortal(List<Producto> Productos, List<CategoriaProducto> Categorias, List<UnidadMedida> Unidades,
    ListaPrecios? Lista, List<ReglaPrecio> Reglas, List<Guid> ListaPlantas, List<PlantaPortal> Plantas, decimal Iva);

/// <summary>Pagado: el pedido completo cuando el cobro está pagado o finalizado (aún no hay pagos parciales).</summary>
public record CobroPortal(EstadoCobro Estado, decimal Subtotal, decimal Descuento, decimal Iva, decimal Total, decimal Pagado, decimal Pendiente);

/// <summary>Lat/Lng: posición del camión; siempre null mientras no haya GPS de flota.</summary>
public record ViajePortal(Guid Id, string Folio, Guid PedidoId, string PedidoFolio, EstadoViaje Estado, decimal VolumenM3,
    string? Camion, string? Operador, DateTime? SalidaEn, DateTime? LlegadaEstimada, DateTime? LlegadaEn, DateTime? TerminadaEn,
    decimal? Lat, decimal? Lng);

/// <summary>Lugar de entrega capturado sin obra.</summary>
public record LugarPortal(string? Direccion, string? Municipio, string? Referencias, decimal? Lat, decimal? Lng);

/// <summary>Obra o Lugar: uno de los dos viene (el otro null).</summary>
public record PedidoPortal(Guid Id, string Folio, Guid? CotizacionId, EstadoPedido Estado, EstatusPlanta EstatusPlanta,
    DateTime FechaHoraEntrega, Obra? Obra, LugarPortal? Lugar, PlantaPortal? Planta, CobroPortal Cobro, List<PedidoLinea>? Lineas, List<ViajePortal> Remisiones);

[Route("api/v1/portal")]
public class PortalController(IAppDbContext db, IUsuarioActual yo, VentasServicio ventas, IConfiguration cfg, IWebHostEnvironment env)
    : PortalBase
{
    // ---------------------------------------------------------------------------------------------
    // Perfil
    // ---------------------------------------------------------------------------------------------

    Task<Cliente> Cliente(CancellationToken ct) => db.Set<Cliente>().IgnoreQueryFilters().FirstAsync(c => c.Id == ClienteId && !c.IsDeleted, ct);

    /// <summary>Mi perfil y mi empresa</summary>
    /// <remarks>El usuario y el cliente que representa (solo lectura; sus datos los cambia el asesor).</remarks>
    [HttpGet("perfil")]
    public async Task<PerfilPortal> Perfil(CancellationToken ct)
    {
        var c = await Cliente(ct);
        var u = await db.Set<Usuario>().AsNoTracking().FirstAsync(x => x.Id == yo.Id, ct);
        return new(u, new(c.Id, c.Nombre, c.Giro, c.Correo, c.Telefono, c.SitioWeb, c.DiasCredito, c.LimiteCredito));
    }

    /// <summary>Editar mi perfil</summary>
    /// <remarks>Nombre, apellidos, teléfono, puesto y foto (subida con registroTipo=Usuario). Igual que PUT /me.</remarks>
    [HttpPut("perfil")]
    public async Task<ActionResult<PerfilPortal>> EditarPerfil(PerfilRequest r, CancellationToken ct)
    {
        var u = await db.Set<Usuario>().FirstAsync(x => x.Id == yo.Id, ct);
        if (r.FotoArchivoId is Guid foto && !await Visibles().AnyAsync(a => a.Id == foto, ct))
            return Problem("La foto no existe.", statusCode: 400);
        (u.Nombre, u.Apellidos, u.Telefono, u.Puesto, u.FotoArchivoId) = (r.Nombre, r.Apellidos, r.Telefono, r.Puesto, r.FotoArchivoId);
        await db.SaveChangesAsync(ct);
        return await Perfil(ct);
    }

    // ---------------------------------------------------------------------------------------------
    // Catálogo para cotizar
    // ---------------------------------------------------------------------------------------------

    /// <summary>Catálogo para cotizar</summary>
    /// <remarks>Productos activos, categorías, unidades, la lista de precios del cliente con sus reglas (se aplican igual que
    /// en el ERP), las plantas con ubicación y traslado, y la tasa de IVA.</remarks>
    [HttpGet("catalogo")]
    public async Task<CatalogoPortal> Catalogo(CancellationToken ct)
    {
        var c = await Cliente(ct);
        var lista = c.ListaPreciosId is Guid l ? await db.Set<ListaPrecios>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == l && x.Activa, ct) : null;
        var empresas = await db.Set<Empresa>().AsNoTracking().ToDictionaryAsync(e => e.Id, e => e.NombreComercial, ct);
        var plantas = await db.Set<Sucursal>().AsNoTracking().Where(s => s.Activa).OrderBy(s => s.Codigo).ToListAsync(ct);
        return new(
            await db.Set<Producto>().AsNoTracking().Where(p => p.Activo).OrderBy(p => p.Codigo).ToListAsync(ct),
            await db.Set<CategoriaProducto>().AsNoTracking().OrderBy(x => x.Nombre).ToListAsync(ct),
            await db.Set<UnidadMedida>().AsNoTracking().OrderBy(x => x.Clave).ToListAsync(ct),
            lista,
            lista is null ? [] : await db.Set<ReglaPrecio>().AsNoTracking().Where(r => r.ListaPreciosId == lista.Id).ToListAsync(ct),
            lista is null ? [] : await db.Set<ListaPreciosSucursal>().AsNoTracking().Where(s => s.ListaPreciosId == lista.Id).Select(s => s.SucursalId).ToListAsync(ct),
            [.. plantas.Select(s => Planta(s, empresas))],
            await db.Set<Impuesto>().Where(i => i.EmpresaId == null && i.ImpuestoSat == "002" && i.Tipo == TipoImpuesto.Traslado)
                .Select(i => i.Tasa).FirstOrDefaultAsync(ct));
    }

    static PlantaPortal Planta(Sucursal s, IReadOnlyDictionary<Guid, string> empresas) => new(s.Id, s.EmpresaId,
        empresas.GetValueOrDefault(s.EmpresaId, ""), s.Codigo, s.Nombre, s.Direccion, s.Telefono, s.ZonaHoraria, s.Lat, s.Lng, s.KmIncluidos, s.PrecioKm);

    // ---------------------------------------------------------------------------------------------
    // Cotizaciones
    // ---------------------------------------------------------------------------------------------

    /// <summary>Las del cliente que puede ver: sin borradores ni las que el ERP ocultó.</summary>
    IQueryable<Cotizacion> Cotizaciones() => db.Set<Cotizacion>()
        .Where(c => c.ClienteId == ClienteId && c.Estado != EstadoCotizacion.Borrador && !c.OcultaAlCliente);

    /// <summary>Mis cotizaciones</summary>
    /// <remarks>Con partidas y líneas, la más reciente primero. Estado: recibida (la pidió el cliente, en revisión) ·
    /// enviada (el asesor la mandó: se puede aceptar) · pedido (aceptada) · cancelada.</remarks>
    [HttpGet("cotizaciones")]
    public Task<Pagina<Cotizacion>> ListaCotizaciones([FromQuery] int pagina = 1, [FromQuery] int tamano = 50, CancellationToken ct = default) =>
        Listas.Paginar(Cotizaciones().AsNoTracking().Include(c => c.Partidas.OrderBy(p => p.Orden)).ThenInclude(p => p.Lineas).AsSplitQuery()
            .OrderByDescending(c => c.Fecha).ThenBy(c => c.Id), pagina, tamano, ct);

    /// <summary>Una cotización</summary>
    [HttpGet("cotizaciones/{id:guid}")]
    public async Task<ActionResult<Cotizacion>> Cotizacion(Guid id, CancellationToken ct) =>
        await Cotizaciones().AnyAsync(c => c.Id == id, ct) && await ventas.Cotizacion(id, ct) is { } c ? c : NotFound();

    /// <summary>Pedir una cotización</summary>
    /// <remarks>Queda "recibida" (origen portal) para que el asesor la revise; le llega una notificación. Cliente, vendedor,
    /// lista de precios y descuento los pone el back, y los precios siempre salen de la tarifa (precioM3, precioUnitario y
    /// km incluidos/precio por km que mande el cliente se ignoran). revisionDeId = modificar una suya; baseId = usar una
    /// suya como base. La entrega es obraId (una obra suya); el lugar (entrega*) se ignora.</remarks>
    [HttpPost("cotizaciones")]
    public async Task<ActionResult<Cotizacion>> PedirCotizacion(CotizacionRequest r, CancellationToken ct)
    {
        if (r.ObraId is Guid obra && !await db.Set<Obra>().AnyAsync(o => o.Id == obra && o.ClienteId == ClienteId, ct))
            return Problem("La obra no existe o no es tuya.", statusCode: 400);
        foreach (var otra in new[] { r.RevisionDeId, r.BaseId }.OfType<Guid>())
            if (!await Cotizaciones().AnyAsync(c => c.Id == otra, ct)) return NotFound();
        var cliente = await Cliente(ct);
        var c = await ventas.CrearCotizacion(r with
        {
            ClienteId = ClienteId,
            VendedorId = cliente.VendedorId,
            ListaPreciosId = cliente.ListaPreciosId,
            DescuentoPct = 0,
            EntregaDireccion = null, EntregaMunicipio = null, EntregaReferencias = null, EntregaLat = null, EntregaLng = null,
            Partidas = [.. r.Partidas.Select(p => p with
            {
                Id = null, PrecioM3 = null, TrasladoIncluidosKm = null, TrasladoPrecioKm = null,
                Lineas = p.Lineas?.Select(l => l with { Id = null, PrecioUnitario = null }).ToList(),
            })],
        }, ct, portal: true);
        return CreatedAtAction(nameof(Cotizacion), new { id = c.Id }, c);
    }

    /// <summary>Aceptar una cotización</summary>
    /// <remarks>Solo una enviada por el asesor y vigente (si no, 409). Genera los pedidos igual que confirmar en el ERP;
    /// sin obra ni lugar de entrega da 400.</remarks>
    [HttpPost("cotizaciones/{id:guid}/aceptar")]
    public async Task<ActionResult<List<PedidoPortal>>> Aceptar(Guid id, CancellationToken ct)
    {
        var c = await Cotizaciones().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return NotFound();
        if (c.Estado != EstadoCotizacion.Enviada)
            return Problem("Solo se acepta una cotización que te envió tu asesor.", statusCode: 409);
        if (c.VigenciaHasta < DateOnly.FromDateTime(DateTime.UtcNow))
            return Problem("La cotización ya venció: pide una nueva.", statusCode: 409);
        var ids = (await ventas.Confirmar(id, ct)).Select(p => p.Id).ToList();
        return await Pedidos(Pedidos().Where(p => ids.Contains(p.Id)), true, ct);
    }

    // ---------------------------------------------------------------------------------------------
    // Pedidos y remisiones
    // ---------------------------------------------------------------------------------------------

    IQueryable<Pedido> Pedidos() => db.Set<Pedido>().Where(p => p.ClienteId == ClienteId);

    /// <summary>Mis pedidos</summary>
    /// <remarks>Por fecha de entrega (la más lejana primero), con obra, planta, cobro y viajes. Filtros: estado, obraId.</remarks>
    [HttpGet("pedidos")]
    public async Task<Pagina<PedidoPortal>> ListaPedidos([FromQuery] EstadoPedido? estado, [FromQuery] Guid? obraId,
        [FromQuery] int pagina = 1, [FromQuery] int tamano = 50, CancellationToken ct = default)
    {
        var q = Pedidos();
        if (estado is { } e) q = q.Where(p => p.Estado == e);
        if (obraId is { } o) q = q.Where(p => p.ObraId == o);
        var pag = await Listas.Paginar(q.AsNoTracking().OrderByDescending(p => p.FechaHoraEntrega).ThenBy(p => p.Id), pagina, tamano, ct);
        return new(await Armar(pag.Items, false, ct), pag.Total);
    }

    /// <summary>Un pedido</summary>
    /// <remarks>Con sus líneas.</remarks>
    [HttpGet("pedidos/{id:guid}")]
    public async Task<ActionResult<PedidoPortal>> Pedido(Guid id, CancellationToken ct) =>
        (await Pedidos(Pedidos().Where(p => p.Id == id), true, ct)).FirstOrDefault() is { } p ? p : NotFound();

    /// <summary>Mis remisiones</summary>
    /// <remarks>Cada viaje de mis pedidos, el más reciente primero. Filtro: pedidoId.</remarks>
    [HttpGet("remisiones")]
    public async Task<Pagina<ViajePortal>> Remisiones([FromQuery] Guid? pedidoId, [FromQuery] int pagina = 1, [FromQuery] int tamano = 50,
        CancellationToken ct = default)
    {
        var q = db.Set<Remision>().AsNoTracking().Where(r => Pedidos().Any(p => p.Id == r.PedidoId));
        if (pedidoId is { } pid) q = q.Where(r => r.PedidoId == pid);
        var pag = await Listas.Paginar(q.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id), pagina, tamano, ct);
        return new(await Viajes(pag.Items, ct), pag.Total);
    }

    async Task<List<PedidoPortal>> Pedidos(IQueryable<Pedido> q, bool lineas, CancellationToken ct) =>
        await Armar(await (lineas ? q.Include(p => p.Lineas) : q).AsNoTracking().ToListAsync(ct), lineas, ct);

    async Task<List<PedidoPortal>> Armar(IReadOnlyList<Pedido> pedidos, bool lineas, CancellationToken ct)
    {
        var ids = pedidos.Select(p => p.Id).ToList();
        var obraIds = pedidos.Select(p => p.ObraId).OfType<Guid>().Distinct().ToList();
        var plantaIds = pedidos.Select(p => p.SucursalId).Distinct().ToList();
        var obras = await db.Set<Obra>().AsNoTracking().Where(o => obraIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, ct);
        var empresas = await db.Set<Empresa>().AsNoTracking().ToDictionaryAsync(e => e.Id, e => e.NombreComercial, ct);
        var plantas = await db.Set<Sucursal>().AsNoTracking().Where(s => plantaIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var viajes = (await Viajes(await db.Set<Remision>().AsNoTracking().Where(r => ids.Contains(r.PedidoId))
            .OrderBy(r => r.CreatedAt).ToListAsync(ct), ct)).ToLookup(v => v.PedidoId);
        return [.. pedidos.Select(p =>
        {
            var pagado = p.Cobro is EstadoCobro.Pagado or EstadoCobro.Finalizado ? p.Total : 0;
            return new PedidoPortal(p.Id, p.Folio, p.CotizacionId, p.Estado, p.EstatusPlanta, p.FechaHoraEntrega,
                p.ObraId is Guid o ? obras.GetValueOrDefault(o) : null,
                p.ObraId is null && p.EntregaDireccion is not null
                    ? new LugarPortal(p.EntregaDireccion, p.EntregaMunicipio, p.EntregaReferencias, p.EntregaLat, p.EntregaLng) : null,
                plantas.TryGetValue(p.SucursalId, out var s) ? Planta(s, empresas) : null,
                new CobroPortal(p.Cobro, p.Subtotal, p.Descuento, p.Iva, p.Total, pagado, p.Total - pagado),
                lineas ? p.Lineas : null, [.. viajes[p.Id]]);
        })];
    }

    async Task<List<ViajePortal>> Viajes(IReadOnlyList<Remision> remisiones, CancellationToken ct)
    {
        var pedidoIds = remisiones.Select(r => r.PedidoId).Distinct().ToList();
        var folios = await db.Set<Pedido>().AsNoTracking().Where(p => pedidoIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Folio, ct);
        var equipoIds = remisiones.Select(r => r.EquipoId).OfType<Guid>().Distinct().ToList();
        var camiones = await db.Set<Equipo>().AsNoTracking().Where(e => equipoIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.NumeroEconomico, ct);
        return [.. remisiones.Select(r => new ViajePortal(r.Id, r.Folio, r.PedidoId, folios.GetValueOrDefault(r.PedidoId, ""), r.Estado,
            r.VolumenM3, r.EquipoId is Guid eq ? camiones.GetValueOrDefault(eq) : null, r.OperadorNombre, r.SalidaEn, r.LlegadaEstimada,
            r.LlegadaEn, r.TerminadaEn, null, null))];
    }

    // ---------------------------------------------------------------------------------------------
    // Archivos (constancias, fotos de obra, mi foto)
    // ---------------------------------------------------------------------------------------------

    /// <summary>¿El registro es del cliente en sesión? Tipos: Cliente, ClienteDatoFiscal, Obra, Usuario (yo).</summary>
    async Task<bool> RegistroMio(string? tipo, Guid? id, CancellationToken ct) => tipo switch
    {
        nameof(Domain.Ventas.Cliente) => id == ClienteId,
        nameof(ClienteDatoFiscal) => await db.Set<ClienteDatoFiscal>().AnyAsync(x => x.Id == id && x.ClienteId == ClienteId, ct),
        nameof(Obra) => await db.Set<Obra>().AnyAsync(x => x.Id == id && x.ClienteId == ClienteId, ct),
        nameof(Usuario) => id == yo.Id,
        _ => false,
    };

    /// <summary>Archivos que el cliente puede ver: los de sus registros.</summary>
    IQueryable<Archivo> Visibles() => db.Set<Archivo>().Where(a =>
        a.RegistroTipo == nameof(Domain.Ventas.Cliente) && a.RegistroId == ClienteId
        || a.RegistroTipo == nameof(ClienteDatoFiscal) && db.Set<ClienteDatoFiscal>().Any(x => x.Id == a.RegistroId && x.ClienteId == ClienteId)
        || a.RegistroTipo == nameof(Obra) && db.Set<Obra>().Any(x => x.Id == a.RegistroId && x.ClienteId == ClienteId)
        || a.RegistroTipo == nameof(Usuario) && a.RegistroId == yo.Id);

    /// <summary>Subir archivo</summary>
    /// <remarks>multipart/form-data hasta 25 MB, siempre ligado a un registro mío: registroTipo = Cliente, ClienteDatoFiscal,
    /// Obra o Usuario (mi foto). categoria libre (constancia, opinion_cumplimiento…).</remarks>
    [HttpPost("archivos"), RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<Archivo>> SubirArchivo(IFormFile archivo, [FromForm] string? categoria, [FromForm] string registroTipo,
        [FromForm] Guid registroId, CancellationToken ct)
    {
        if (!await RegistroMio(registroTipo, registroId, ct)) return NotFound();
        var a = await ArchivosController.Guardar(db, yo, ArchivosController.CarpetaDe(cfg, env), archivo, categoria, registroTipo, registroId, ct);
        return CreatedAtAction(nameof(Descargar), new { id = a.Id }, a);
    }

    /// <summary>Archivos de un registro mío</summary>
    [HttpGet("archivos/registro/{tipo}/{id:guid}")]
    public async Task<ActionResult<List<Archivo>>> ArchivosDe(string tipo, Guid id, CancellationToken ct) =>
        await RegistroMio(tipo, id, ct)
            ? await Visibles().AsNoTracking().Where(a => a.RegistroTipo == tipo && a.RegistroId == id).OrderByDescending(a => a.CreatedAt).ToListAsync(ct)
            : NotFound();

    /// <summary>Descargar archivo</summary>
    [HttpGet("archivos/{id:guid}")]
    public async Task<IActionResult> Descargar(Guid id, CancellationToken ct) =>
        await Visibles().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct) is { } a
            ? PhysicalFile(Path.Combine(ArchivosController.CarpetaDe(cfg, env), a.Ruta), a.TipoMime, a.Nombre)
            : NotFound();

    /// <summary>Eliminar archivo</summary>
    /// <remarks>Borrado lógico.</remarks>
    [HttpDelete("archivos/{id:guid}")]
    public async Task<IActionResult> EliminarArchivo(Guid id, CancellationToken ct)
    {
        var a = await Visibles().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        db.Set<Archivo>().Remove(a);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
