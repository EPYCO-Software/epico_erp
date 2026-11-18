using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using EPICO.Domain.Common;

namespace EPICO.Domain.Ventas;

// Flota: operadores, documentos, combustible y mantenimiento de los equipos (Equipo en Catalogos.cs).

/// <summary>Operador de la flota. SucursalId vacío = de cualquier planta de la organización.</summary>
public class Operador : BaseEntity, IDeOrganizacion
{
    public Guid OrganizacionId { get; set; }
    [Rastreado("Planta", TipoDatoCambio.Referencia)] public Guid? SucursalId { get; set; }
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(30), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [MaxLength(40), Rastreado("Número de licencia")] public string? LicenciaNumero { get; set; }
    /// <summary>A–F (licencia federal) u otro texto corto.</summary>
    [MaxLength(5), Rastreado("Tipo de licencia")] public string? LicenciaTipo { get; set; }
    [Rastreado("Vence la licencia")] public DateOnly? LicenciaVence { get; set; }
    [Rastreado("Activo")] public bool Activo { get; set; } = true;
    [Rastreado("Notas")] public string? Notas { get; set; }
}

public class DocumentoEquipo : BaseEntity, IDePadre
{
    public Guid EquipoId { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoDocumentoEquipo Tipo { get; set; }
    [MaxLength(60), Rastreado("Número")] public string? Numero { get; set; }
    /// <summary>Último día vigente; vacío = no vence.</summary>
    [Rastreado("Vence")] public DateOnly? Vence { get; set; }
    [Rastreado("Archivo", TipoDatoCambio.Referencia)] public Guid? ArchivoId { get; set; }
    [Rastreado("Notas")] public string? Notas { get; set; }
    string? IDePadre.PadreTipo => nameof(Equipo);
    Guid? IDePadre.PadreId => EquipoId;
}

public class CargaCombustible : BaseEntity
{
    public Guid EquipoId { get; set; }
    /// <summary>Vacío al crear = la planta del equipo.</summary>
    public Guid SucursalId { get; set; }
    public DateTime Fecha { get; set; }
    [Range(0.001, 99_999)] public decimal Litros { get; set; }
    [Range(0, 999_999_999)] public decimal CostoTotal { get; set; }
    [Range(0, 99_999_999)] public decimal? OdometroKm { get; set; }
    [Range(0, 9_999_999)] public decimal? Horometro { get; set; }
    public Guid? OperadorId { get; set; }
    public string? Notas { get; set; }
}

public class Mantenimiento : BaseEntity, IDePadre
{
    public Guid EquipoId { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoMantenimiento Tipo { get; set; }
    [MaxLength(300), Rastreado("Descripción")] public string Descripcion { get; set; } = "";
    [Rastreado("Programado para")] public DateOnly? ProgramadoPara { get; set; }
    [Range(0, 99_999_999), Rastreado("Programado a los km")] public decimal? ProgramadoKm { get; set; }
    /// <summary>Nace programado; cambia con POST /mantenimientos/{id}/estado.</summary>
    [Editable(false), Rastreado("Estado", TipoDatoCambio.Opcion)] public EstadoMantenimiento Estado { get; set; }
    [Rastreado("Inicio")] public DateTime? InicioEn { get; set; }
    [Rastreado("Fin")] public DateTime? FinEn { get; set; }
    [Range(0, 999_999_999), Rastreado("Costo", TipoDatoCambio.Dinero)] public decimal? Costo { get; set; }
    [MaxLength(120), Rastreado("Taller")] public string? Taller { get; set; }
    [Rastreado("Notas")] public string? Notas { get; set; }
    string? IDePadre.PadreTipo => nameof(Equipo);
    Guid? IDePadre.PadreId => EquipoId;
}

/// <summary>Recorrido de una unidad. Si trae los dos odómetros, Km = fin − inicio; KmEstimado = calculado (viajes terminados).</summary>
public class Trayecto : BaseEntity, IDePadre
{
    public Guid EquipoId { get; set; }
    [Rastreado("Planta", TipoDatoCambio.Referencia)] public Guid? SucursalId { get; set; }
    [Rastreado("Inicio")] public DateTime Inicio { get; set; }
    [Rastreado("Fin")] public DateTime? Fin { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoTrayecto Tipo { get; set; }
    [MaxLength(200), Rastreado("Origen")] public string? Origen { get; set; }
    [MaxLength(200), Rastreado("Destino")] public string? Destino { get; set; }
    [Range(0, 99_999_999), Rastreado("Odómetro inicial")] public decimal? OdometroInicio { get; set; }
    [Range(0, 99_999_999), Rastreado("Odómetro final")] public decimal? OdometroFin { get; set; }
    [Range(0, 99_999), Rastreado("Km")] public decimal? Km { get; set; }
    [Rastreado("Km estimados")] public bool KmEstimado { get; set; }
    [Rastreado("Pedido", TipoDatoCambio.Referencia)] public Guid? PedidoId { get; set; }
    [Rastreado("Viaje", TipoDatoCambio.Referencia)] public Guid? RemisionId { get; set; }
    [Rastreado("Operador", TipoDatoCambio.Referencia)] public Guid? OperadorId { get; set; }
    [Rastreado("Notas")] public string? Notas { get; set; }
    string? IDePadre.PadreTipo => nameof(Equipo);
    Guid? IDePadre.PadreId => EquipoId;
}

/// <summary>
/// Punto GPS guardado de una unidad (historial para recorridos). Sin auditoría: es mucho volumen. Atributos (jsonb) = sensores
/// normalizados (tamborRpm, tamborSentido carga|descarga|detenido, motorEncendido, combustiblePct, temperaturaC) y el resto en "otros".
/// </summary>
public class PosicionEquipo : IEntidad
{
    public Guid Id { get; set; }
    public Guid EquipoId { get; set; }
    public DateTime Fecha { get; set; }
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
    public decimal? VelocidadKmh { get; set; }
    /// <summary>Grados (0 = norte).</summary>
    public decimal? Rumbo { get; set; }
    public decimal? AltitudM { get; set; }
    public JsonDocument? Atributos { get; set; }
    public FuentePosicion Fuente { get; set; }
}

/// <summary>Un punto del checklist de inspección (las claves salen de GET /flota/checklist).</summary>
public record PuntoInspeccion(string Clave, string Texto, bool Ok, string? Nota = null);

/// <summary>
/// Inspección de una unidad. El resultado lo calcula la API: algún punto crítico no ok → rechazada; otro no ok → con observaciones;
/// si no, aprobada. Una rechazada (posterior al último mantenimiento terminado) deja la unidad no disponible.
/// </summary>
public class InspeccionEquipo : BaseEntity, IDePadre
{
    public Guid EquipoId { get; set; }
    [Rastreado("Fecha")] public DateTime Fecha { get; set; }
    [Rastreado("Operador", TipoDatoCambio.Referencia)] public Guid? OperadorId { get; set; }
    [MaxLength(200), Rastreado("Inspector")] public string InspectorNombre { get; set; } = "";
    [Editable(false), Rastreado("Resultado", TipoDatoCambio.Opcion)] public ResultadoInspeccion Resultado { get; set; }
    public List<PuntoInspeccion> Puntos { get; set; } = [];
    [Range(0, 99_999_999), Rastreado("Odómetro")] public decimal? OdometroKm { get; set; }
    [Rastreado("Firma", TipoDatoCambio.Referencia)] public Guid? FirmaArchivoId { get; set; }
    public List<Guid> FotoArchivoIds { get; set; } = [];
    [Rastreado("Notas")] public string? Notas { get; set; }
    string? IDePadre.PadreTipo => nameof(Equipo);
    Guid? IDePadre.PadreId => EquipoId;
}
