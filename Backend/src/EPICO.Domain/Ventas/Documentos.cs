using System.ComponentModel.DataAnnotations;
using EPICO.Domain.Common;

namespace EPICO.Domain.Ventas;

// Ventas y operación (docs/esquema.dbml). Importes sin IVA salvo Total; los calcula la API (Ventas/Calculo.cs).

public class Cotizacion : BaseEntity, IDeEmpresa, ILugarEntrega
{
    public Guid EmpresaId { get; set; }
    public Guid SucursalId { get; set; }
    /// <summary>Vacío = sin cliente (se capturan obra y contacto).</summary>
    [Rastreado("Cliente", TipoDatoCambio.Referencia)] public Guid? ClienteId { get; set; }
    [Rastreado("Obra", TipoDatoCambio.Referencia)] public Guid? ObraId { get; set; }
    [MaxLength(300), Rastreado("Dirección de entrega")] public string? EntregaDireccion { get; set; }
    [MaxLength(120), Rastreado("Municipio de entrega")] public string? EntregaMunicipio { get; set; }
    [Rastreado("Referencias de entrega")] public string? EntregaReferencias { get; set; }
    [Rastreado("Latitud de entrega")] public decimal? EntregaLat { get; set; }
    [Rastreado("Longitud de entrega")] public decimal? EntregaLng { get; set; }
    [MaxLength(200), Rastreado("Contacto")] public string? ContactoNombre { get; set; }
    [MaxLength(20), Rastreado("Teléfono del contacto")] public string? ContactoTelefono { get; set; }
    [Rastreado("Vendedor", TipoDatoCambio.Referencia)] public Guid? VendedorId { get; set; }
    [MaxLength(40)] public string Folio { get; set; } = "";
    /// <summary>Folio de la primera versión; las revisiones son {Serie}-R1, -R2…</summary>
    [MaxLength(40)] public string Serie { get; set; } = "";
    public int Revision { get; set; }
    /// <summary>Nueva basada en otra (comparar precios).</summary>
    public Guid? BaseId { get; set; }
    [Rastreado("Estado", TipoDatoCambio.Opcion)] public EstadoCotizacion Estado { get; set; }
    public OrigenCotizacion Origen { get; set; }
    [Rastreado("Oculta al cliente")] public bool OcultaAlCliente { get; set; }
    public DateTime Fecha { get; set; }
    [Rastreado("Vigencia")] public DateOnly? VigenciaHasta { get; set; }
    [MaxLength(3)] public string MonedaCodigo { get; set; } = "MXN";
    [Rastreado("Lista de precios", TipoDatoCambio.Referencia)] public Guid? ListaPreciosId { get; set; }
    [Rastreado("Descuento", TipoDatoCambio.Dinero)] public decimal Descuento { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Iva { get; set; }
    [Rastreado("Total", TipoDatoCambio.Dinero)] public decimal Total { get; set; }
    [Rastreado("Notas")] public string? Notas { get; set; }
    public List<CotizacionPartida> Partidas { get; set; } = [];
}

public class CotizacionPartida : BaseEntity, IDePadre
{
    public Guid CotizacionId { get; set; }
    public short Orden { get; set; }
    /// <summary>Losa de cimentación…</summary>
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(40)] public string? SolucionId { get; set; }
    /// <summary>El concreto del catálogo; vacío = se busca por resistencia (CON-FC-200, CON-MR-45).</summary>
    public Guid? ProductoId { get; set; }
    /// <summary>fc o mr</summary>
    [MaxLength(2), RegularExpression("^(fc|mr)$")] public string TipoResistencia { get; set; } = "fc";
    [Rastreado("Resistencia")] public short ResistenciaKgCm2 { get; set; }
    [Rastreado("Edad")] public short EdadDias { get; set; }
    [Rastreado("Revenimiento")] public short RevenimientoCm { get; set; }
    [Rastreado("TMA")] public short TmaMm { get; set; }
    [MaxLength(20), Rastreado("Cemento")] public string Cemento { get; set; } = "";
    [MaxLength(20), Rastreado("Exposición")] public string Exposicion { get; set; } = "";
    [MaxLength(20), Rastreado("Colocación")] public string Colocacion { get; set; } = "";
    public List<string> Aditivos { get; set; } = [];
    [Range(0.01, 99_999_999), Rastreado("Volumen m³")] public decimal VolumenM3 { get; set; }
    /// <summary>null = pedido especial aún sin cotizar (cuenta 0; no se puede enviar ni confirmar así).</summary>
    [Range(0, 999_999_999_999), Rastreado("Precio por m³", TipoDatoCambio.Dinero)] public decimal? PrecioM3 { get; set; }
    /// <summary>Configuración que no está en el catálogo: va sin producto y el vendedor le pone precio. Se queda true ya cotizada.</summary>
    [Rastreado("Pedido especial")] public bool Especial { get; set; }
    [Rastreado("Entrega")] public DateTime? Entrega { get; set; }
    [Range(0, 999_999)] public decimal? TrasladoDistanciaKm { get; set; }
    [Range(0, 999_999)] public decimal? TrasladoIncluidosKm { get; set; }
    [Range(0, 99_999_999)] public decimal? TrasladoPrecioKm { get; set; }
    public List<CotizacionLinea> Lineas { get; set; } = [];
    string? IDePadre.PadreTipo => nameof(Cotizacion);
    Guid? IDePadre.PadreId => CotizacionId;
}

/// <summary>Servicio, maquinaria o producto general de una partida. Importe = Cantidad × PrecioUnitario × (Dias ?? 1).</summary>
public class CotizacionLinea : IEntidad
{
    public Guid Id { get; set; }
    public Guid PartidaId { get; set; }
    public Guid ProductoId { get; set; }
    [MaxLength(300)] public string Concepto { get; set; } = "";
    [Range(0.001, 999_999_999)] public decimal Cantidad { get; set; }
    /// <summary>Renta de maquinaria.</summary>
    [Range(1, 366)] public short? Dias { get; set; }
    [Range(0, 999_999_999_999)] public decimal PrecioUnitario { get; set; }
    public decimal Importe { get; set; }
}

public class Pedido : BaseEntity, IDeEmpresa, ILugarEntrega
{
    public Guid EmpresaId { get; set; }
    public Guid SucursalId { get; set; }
    public Guid ClienteId { get; set; }
    [Rastreado("Obra", TipoDatoCambio.Referencia)] public Guid? ObraId { get; set; }
    [MaxLength(300), Rastreado("Dirección de entrega")] public string? EntregaDireccion { get; set; }
    [MaxLength(120), Rastreado("Municipio de entrega")] public string? EntregaMunicipio { get; set; }
    [Rastreado("Referencias de entrega")] public string? EntregaReferencias { get; set; }
    [Rastreado("Latitud de entrega")] public decimal? EntregaLat { get; set; }
    [Rastreado("Longitud de entrega")] public decimal? EntregaLng { get; set; }
    public Guid? CotizacionId { get; set; }
    /// <summary>Un pedido por partida.</summary>
    public Guid? PartidaId { get; set; }
    [Rastreado("Vendedor", TipoDatoCambio.Referencia)] public Guid? VendedorId { get; set; }
    [MaxLength(40)] public string Folio { get; set; } = "";
    [Rastreado("Entrega")] public DateTime FechaHoraEntrega { get; set; }
    [Rastreado("Estado", TipoDatoCambio.Opcion)] public EstadoPedido Estado { get; set; }
    [Rastreado("Cobro", TipoDatoCambio.Opcion)] public EstadoCobro Cobro { get; set; }
    [Rastreado("Método de pago", TipoDatoCambio.Opcion)] public MetodoPago MetodoPago { get; set; }
    [Rastreado("Estatus planta", TipoDatoCambio.Opcion)] public EstatusPlanta EstatusPlanta { get; set; }
    /// <summary>Nueva fecha que pidió la planta.</summary>
    [Rastreado("Fecha pedida por planta")] public DateTime? SolicitudPlantaFecha { get; set; }
    [Rastreado("Nota de planta")] public string? SolicitudPlantaNota { get; set; }
    [Rastreado("Descuento", TipoDatoCambio.Dinero)] public decimal Descuento { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Iva { get; set; }
    [Rastreado("Total", TipoDatoCambio.Dinero)] public decimal Total { get; set; }
    public List<PedidoLinea> Lineas { get; set; } = [];
}

public class PedidoLinea : IEntidad
{
    public Guid Id { get; set; }
    public Guid PedidoId { get; set; }
    public Guid ProductoId { get; set; }
    /// <summary>Especificación legible.</summary>
    [MaxLength(300)] public string Descripcion { get; set; } = "";
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Descuento { get; set; }
    public decimal Importe { get; set; }
}

/// <summary>Cada viaje de camión de un pedido.</summary>
public class Remision : BaseEntity, IDePadre
{
    public Guid PedidoId { get; set; }
    /// <summary>Vacío al crear = el siguiente de la secuencia "remision" de la planta.</summary>
    [MaxLength(40), Required(AllowEmptyStrings = true)] public string Folio { get; set; } = "";
    [Rastreado("Camión", TipoDatoCambio.Referencia)] public Guid? EquipoId { get; set; }
    public Guid? OperadorId { get; set; }
    [MaxLength(200), Rastreado("Operador")] public string? OperadorNombre { get; set; }
    [Range(0.01, 9999), Rastreado("Volumen m³")] public decimal VolumenM3 { get; set; }
    [Rastreado("Estado", TipoDatoCambio.Opcion)] public EstadoViaje Estado { get; set; }
    [Rastreado("Salida")] public DateTime? SalidaEn { get; set; }
    public DateTime? LlegadaEstimada { get; set; }
    [Rastreado("Llegada")] public DateTime? LlegadaEn { get; set; }
    [Rastreado("Terminada")] public DateTime? TerminadaEn { get; set; }
    public Guid? FirmaArchivoId { get; set; }
    string? IDePadre.PadreTipo => nameof(Pedido);
    Guid? IDePadre.PadreId => PedidoId;
}
