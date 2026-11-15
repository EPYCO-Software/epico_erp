using System.ComponentModel.DataAnnotations;
using EPICO.Domain.Common;

namespace EPICO.Domain.Historial;

// Transversales: archivos, hilo de cada registro (Evento), seguidores y actividades. RegistroTipo + RegistroId
// apuntan a "cualquier registro" sin FK a propósito; RegistroTipo es el nombre de la clase (Empresa, Cotizacion…).

public class Archivo : BaseEntity
{
    public Guid? OrganizacionId { get; set; }
    [MaxLength(255)] public string Nombre { get; set; } = "";
    [MaxLength(100)] public string TipoMime { get; set; } = "";
    public long TamanoBytes { get; set; }
    /// <summary>Llave en el almacenamiento (ruta relativa en disco).</summary>
    public string Ruta { get; set; } = "";
    [MaxLength(64)] public string? Sha256 { get; set; }
    [MaxLength(60)] public string? Categoria { get; set; }
    [MaxLength(40)] public string? RegistroTipo { get; set; }
    public Guid? RegistroId { get; set; }
    public Guid? SubidoPorId { get; set; }
}

/// <summary>Hilo de cada registro (mail.message de Odoo). Solo se agrega: nunca se edita ni se borra.</summary>
public class Evento : IEntidad, IDeOrganizacion
{
    public Guid Id { get; set; }
    public Guid OrganizacionId { get; set; }
    [MaxLength(40)] public string RegistroTipo { get; set; } = "";
    public Guid RegistroId { get; set; }
    public DateTime Fecha { get; set; }
    public Guid? AutorId { get; set; }
    public TipoEvento Tipo { get; set; }
    public string Texto { get; set; } = "";
    /// <summary>JSON: renglones libres ["Salida de 32 saco", …].</summary>
    public string? Detalles { get; set; }
    public Guid? SesionId { get; set; }
    [MaxLength(40)] public string? RegistroPadreTipo { get; set; }
    public Guid? RegistroPadreId { get; set; }
    public List<EventoCambio> Cambios { get; set; } = [];
}

/// <summary>Un renglón por campo rastreado que cambió (mail.tracking.value). Solo se agrega.</summary>
public class EventoCambio : IEntidad
{
    public Guid Id { get; set; }
    public Guid EventoId { get; set; }
    [MaxLength(80)] public string Campo { get; set; } = "";
    [MaxLength(120)] public string Etiqueta { get; set; } = "";
    public TipoDatoCambio TipoDato { get; set; }
    public string? ValorAnterior { get; set; }
    public string? ValorNuevo { get; set; }
    /// <summary>JSON con el valor exacto.</summary>
    public string? ValorAnteriorCrudo { get; set; }
    public string? ValorNuevoCrudo { get; set; }
    public short Orden { get; set; }
}

public class Seguidor : IEntidad
{
    public Guid Id { get; set; }
    [MaxLength(40)] public string RegistroTipo { get; set; } = "";
    public Guid RegistroId { get; set; }
    public Guid UsuarioId { get; set; }
    public List<TipoEvento> Tipos { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class Actividad : BaseEntity, IDeOrganizacion
{
    public Guid OrganizacionId { get; set; }
    [MaxLength(40)] public string RegistroTipo { get; set; } = "";
    public Guid RegistroId { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoActividad Tipo { get; set; }
    [MaxLength(200), Rastreado("Resumen")] public string Resumen { get; set; } = "";
    [Rastreado("Fecha límite")] public DateOnly FechaLimite { get; set; }
    [Rastreado("Asignada a", TipoDatoCambio.Referencia)] public Guid AsignadaAId { get; set; }
    public string? Nota { get; set; }
    [Rastreado("Hecha")] public DateTime? HechaEn { get; set; }
    [Rastreado("Cancelada")] public DateTime? CanceladaEn { get; set; }
}
