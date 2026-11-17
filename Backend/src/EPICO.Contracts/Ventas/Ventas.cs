using System.ComponentModel.DataAnnotations;

namespace EPICO.Contracts.Ventas;

// Lo que el front manda para crear o editar documentos de venta. La API responde con las entidades
// (Cotizacion con Partidas[].Lineas[], Pedido con Lineas[]) y calcula importes, descuento, IVA y total.

/// <summary>
/// Cotización completa. RevisionDeId = nueva revisión de una ya enviada ({Serie}-R1…);
/// BaseId = nueva basada en otra (folio nuevo, para comparar precios). Entrega: obraId o un lugar (entregaDireccion y
/// entregaMunicipio obligatorios; referencias y GPS opcionales), no los dos; puede faltar mientras se arma.
/// </summary>
public record CotizacionRequest(
    Guid SucursalId,
    Guid? ClienteId,
    Guid? ObraId,
    [MaxLength(200)] string? ContactoNombre,
    [MaxLength(20)] string? ContactoTelefono,
    Guid? VendedorId,
    DateOnly? VigenciaHasta,
    Guid? ListaPreciosId,
    [Range(0, 100)] decimal DescuentoPct,
    string? Notas,
    Guid? BaseId,
    Guid? RevisionDeId,
    [MinLength(1)] List<PartidaRequest> Partidas,
    [MaxLength(300)] string? EntregaDireccion = null,
    [MaxLength(120)] string? EntregaMunicipio = null,
    string? EntregaReferencias = null,
    [Range(-90, 90)] decimal? EntregaLat = null,
    [Range(-180, 180)] decimal? EntregaLng = null);

/// <summary>Id = partida existente que se edita; sin Id = nueva; las que no vengan se borran. PrecioM3 vacío = tarifa.
/// Especial = pedido especial: sin tarifa se guarda sin producto y con precioM3 null (por cotizar).</summary>
public record PartidaRequest(
    Guid? Id,
    [MaxLength(200)] string Nombre,
    [MaxLength(40)] string? SolucionId,
    Guid? ProductoId,
    [RegularExpression("^(fc|mr)$")] string TipoResistencia,
    short ResistenciaKgCm2,
    short EdadDias,
    short RevenimientoCm,
    short TmaMm,
    [MaxLength(20)] string Cemento,
    [RegularExpression("^(normal|humedad|marina)$")] string Exposicion,
    [RegularExpression("^(directa|bombeable)$")] string Colocacion,
    List<string>? Aditivos,
    [Range(0.01, 99_999_999)] decimal VolumenM3,
    [Range(0, 999_999_999_999)] decimal? PrecioM3,
    DateTime? Entrega,
    [Range(0, 999_999)] decimal? TrasladoDistanciaKm,
    [Range(0, 999_999)] decimal? TrasladoIncluidosKm,
    [Range(0, 99_999_999)] decimal? TrasladoPrecioKm,
    List<LineaRequest>? Lineas,
    bool Especial = false);

/// <summary>Servicio, maquinaria o producto. Concepto y precio vacíos = los del producto; los de m³ cobran su mínimo.</summary>
public record LineaRequest(
    Guid? Id,
    Guid ProductoId,
    [MaxLength(300)] string? Concepto,
    [Range(0.001, 999_999_999)] decimal Cantidad,
    [Range(1, 366)] short? Dias,
    [Range(0, 999_999_999_999)] decimal? PrecioUnitario);

/// <summary>Orden de venta directa (sin cotización) o edición de una programada. Entrega: obraId o lugar, no los dos (obligatorio).</summary>
public record PedidoRequest(
    Guid SucursalId,
    Guid ClienteId,
    Guid? ObraId,
    Guid? VendedorId,
    DateTime FechaHoraEntrega,
    [RegularExpression("^(sin_metodo|transferencia)$")] string MetodoPago,
    [Range(0, 100)] decimal DescuentoPct,
    [MinLength(1)] List<PedidoLineaRequest> Lineas,
    [MaxLength(300)] string? EntregaDireccion = null,
    [MaxLength(120)] string? EntregaMunicipio = null,
    string? EntregaReferencias = null,
    [Range(-90, 90)] decimal? EntregaLat = null,
    [Range(-180, 180)] decimal? EntregaLng = null);

public record PedidoLineaRequest(
    Guid ProductoId,
    [MaxLength(300)] string? Descripcion,
    [Range(0.001, 999_999_999)] decimal Cantidad,
    [Range(0, 999_999_999_999)] decimal? PrecioUnitario);

public record OcultarRequest(bool Oculta);

/// <summary>Valores en snake_case, como los enums del esquema.</summary>
public record ValorRequest([Required] string Valor);

/// <summary>
/// enviar (a planta) · confirmar · actualizacion (la planta pide otra Fecha, con Nota) · rechazar (con Nota) ·
/// aceptar_actualizacion (la entrega pasa a la fecha que pidió la planta).
/// </summary>
public record PlantaRequest(
    [RegularExpression("^(enviar|confirmar|actualizacion|rechazar|aceptar_actualizacion)$")] string Accion,
    DateTime? Fecha,
    string? Nota);
