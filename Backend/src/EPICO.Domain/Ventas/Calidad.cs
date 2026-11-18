using System.ComponentModel.DataAnnotations;
using EPICO.Domain.Common;

namespace EPICO.Domain.Ventas;

// Laboratorio mínimo: muestras de concreto de un pedido (o de un viaje) y sus ensayes de resistencia.

/// <summary>Muestra de concreto. Al crearla se programan sus ensayes a 7, 14 y 28 días.</summary>
public class MuestraLaboratorio : BaseEntity, IDePadre
{
    /// <summary>Vacío al crear = el siguiente de la secuencia "muestra" de la planta del pedido.</summary>
    [MaxLength(40), Required(AllowEmptyStrings = true)] public string Folio { get; set; } = "";
    public Guid PedidoId { get; set; }
    [Rastreado("Viaje", TipoDatoCambio.Referencia)] public Guid? RemisionId { get; set; }
    [Rastreado("Fecha de muestreo")] public DateTime FechaMuestreo { get; set; }
    [Range(0, 50), Rastreado("Revenimiento cm")] public decimal? RevenimientoCm { get; set; }
    [Range(-10, 80), Rastreado("Temperatura °C")] public decimal? TemperaturaC { get; set; }
    [Range(1, 50), Rastreado("Cilindros")] public int Cilindros { get; set; } = 4;
    /// <summary>f'c de diseño (kg/cm²); vacío al crear = el del concreto del pedido.</summary>
    [Range(0, 2000), Rastreado("f'c de diseño")] public int ResistenciaDisenoKgCm2 { get; set; }
    [MaxLength(200), Rastreado("Laboratorista")] public string? LaboratoristaNombre { get; set; }
    [Rastreado("Notas")] public string? Notas { get; set; }
    string? IDePadre.PadreTipo => nameof(Pedido);
    Guid? IDePadre.PadreId => PedidoId;
}

public class EnsayeLaboratorio : BaseEntity, IDePadre
{
    public Guid MuestraId { get; set; }
    [Range(1, 365), Rastreado("Edad (días)")] public int EdadDias { get; set; }
    [Rastreado("Fecha programada")] public DateOnly FechaProgramada { get; set; }
    [Rastreado("Fecha de ensaye")] public DateOnly? FechaEnsaye { get; set; }
    [Range(0, 2000), Rastreado("Resistencia kg/cm²")] public decimal? ResistenciaKgCm2 { get; set; }
    [MaxLength(200), Rastreado("Laboratorista")] public string? LaboratoristaNombre { get; set; }
    string? IDePadre.PadreTipo => nameof(MuestraLaboratorio);
    Guid? IDePadre.PadreId => MuestraId;
}
