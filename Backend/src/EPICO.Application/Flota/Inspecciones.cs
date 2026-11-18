using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

public record ItemChecklist(string Clave, string Texto, bool Critico);

/// <summary>Checklist fijo de inspección por categoría de unidad. Crítico = si falla, la unidad no sale.</summary>
public static class Checklist
{
    static ItemChecklist I(string clave, string texto, bool critico = false) => new(clave, texto, critico);

    static readonly ItemChecklist[] Comunes =
    [
        I("llantas", "Llantas: presión, desgaste y birlos", true), I("frenos", "Frenos de servicio y estacionamiento", true),
        I("luces", "Luces, direccionales y torreta", true), I("direccion", "Dirección y suspensión", true),
        I("fugas_aceite", "Sin fugas de aceite, diésel o refrigerante"), I("documentos", "Documentos a bordo (tarjeta, póliza, permiso)"),
        I("extintor", "Extintor cargado y vigente"), I("cinturon", "Cinturón de seguridad", true),
    ];

    public static readonly IReadOnlyDictionary<string, ItemChecklist[]> PorCategoria = new Dictionary<string, ItemChecklist[]>
    {
        ["olla"] =
        [
            .. Comunes, I("tambor_aspas", "Tambor y aspas: giro, desgaste y limpieza", true), I("canalon", "Canalón y extensiones"),
            I("agua_tanque", "Agua en el tanque y bomba de agua"), I("tolva", "Tolva de carga"),
        ],
        ["bomba"] =
        [
            .. Comunes, I("pluma_tuberia", "Pluma o tubería: secciones, abrazaderas y desgaste", true), I("mangueras", "Mangueras de concreto e hidráulicas", true),
            I("estabilizadores", "Estabilizadores y gatos", true), I("presion_hidraulica", "Presión del sistema hidráulico", true),
            I("control_remoto", "Control remoto y paro de emergencia", true), I("tolva", "Tolva y rejilla"),
        ],
        ["carga"] =
        [
            .. Comunes, I("caja_plataforma", "Caja, plataforma o tanque sin daños"), I("amarres", "Amarres, cadenas y lonas", true),
            I("quinta_rueda", "Quinta rueda y conexiones (tractocamión)"),
        ],
        ["maquinaria"] =
        [
            I("hidraulico", "Sistema hidráulico sin fugas", true), I("frenos", "Frenos", true), I("llantas_orugas", "Llantas u orugas"),
            I("luces", "Luces y alarma de reversa"), I("cinturon", "Cinturón y estructura antivuelco", true), I("implemento", "Cucharón, horquillas o pluma"),
            I("fugas_aceite", "Sin fugas de aceite o diésel"), I("extintor", "Extintor cargado y vigente"),
        ],
    };

    public static string Categoria(TipoEquipo t) => t switch
    {
        TipoEquipo.Revolvedor => "olla",
        TipoEquipo.BombaPluma or TipoEquipo.BombaEstacionaria => "bomba",
        TipoEquipo.Volteo or TipoEquipo.Plataforma or TipoEquipo.Tractocamion or TipoEquipo.Pipa or TipoEquipo.Camioneta => "carga",
        _ => "maquinaria",
    };

    public static ItemChecklist[] De(TipoEquipo t) => PorCategoria[Categoria(t)];

    static readonly HashSet<string> Criticos = [.. PorCategoria.Values.SelectMany(x => x).Where(x => x.Critico).Select(x => x.Clave)];

    /// <summary>Algún crítico no ok → rechazada; otro no ok → con observaciones; si no, aprobada.</summary>
    public static ResultadoInspeccion Resultado(IEnumerable<PuntoInspeccion> puntos)
    {
        var fallas = puntos.Where(p => !p.Ok).ToList();
        return fallas.Any(p => Criticos.Contains(p.Clave)) ? ResultadoInspeccion.Rechazada
            : fallas.Count > 0 ? ResultadoInspeccion.ConObservaciones : ResultadoInspeccion.Aprobada;
    }
}

public partial class FlotaServicio
{
    /// <summary>Por equipo, la fecha de su última inspección si es rechazada y posterior a su último mantenimiento terminado.</summary>
    async Task<Dictionary<Guid, DateTime>> Rechazadas(IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        var ultimas = await db.Set<InspeccionEquipo>().IgnoreQueryFilters().Where(i => ids.Contains(i.EquipoId) && !i.IsDeleted)
            // Misma fecha (se captura al minuto): gana la registrada después.
            .GroupBy(i => i.EquipoId).Select(g => g.OrderByDescending(i => i.Fecha).ThenByDescending(i => i.CreatedAt).ThenByDescending(i => i.Id).First())
            .ToListAsync(ct);
        var rechazadas = ultimas.Where(i => i.Resultado == ResultadoInspeccion.Rechazada).ToList();
        if (rechazadas.Count == 0) return [];
        var conRechazo = rechazadas.Select(i => i.EquipoId).ToList();
        var mant = await db.Set<Mantenimiento>().IgnoreQueryFilters()
            .Where(m => conRechazo.Contains(m.EquipoId) && !m.IsDeleted && m.Estado == EstadoMantenimiento.Terminado && m.FinEn != null)
            .GroupBy(m => m.EquipoId).Select(g => new { g.Key, Fin = g.Max(m => m.FinEn) }).ToDictionaryAsync(x => x.Key, x => x.Fin, ct);
        return rechazadas.Where(i => !(mant.GetValueOrDefault(i.EquipoId) >= i.Fecha)).ToDictionary(i => i.EquipoId, i => i.Fecha);
    }
}
