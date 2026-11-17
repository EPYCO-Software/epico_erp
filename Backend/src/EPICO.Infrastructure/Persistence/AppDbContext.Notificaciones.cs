using System.Text.Json;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace EPICO.Infrastructure.Persistence;

// Campana del ERP: avisos que se generan al guardar cotizaciones, pedidos y actividades (en la misma transacción).
// Nunca se avisa a quien hizo el cambio.
public partial class AppDbContext
{
    async Task Notificar(DateTime ahora, CancellationToken ct)
    {
        var avisos = new List<Notificacion>();
        void Para(Guid? destino, string modulo, string titulo, string texto, string? ruta)
        {
            if (destino is Guid d && d != usuario.Id)
                avisos.Add(new Notificacion { UsuarioId = d, Modulo = modulo, Titulo = Corto(titulo, 200), Texto = Corto(texto, 500), Ruta = ruta, Fecha = ahora });
        }

        foreach (var e in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified).ToList())
        {
            if (e.Entity is BaseEntity { IsDeleted: true }) continue;
            var nuevo = e.State == EntityState.Added;
            switch (e.Entity)
            {
                case Cotizacion c when nuevo && c.Origen == OrigenCotizacion.Portal:
                {
                    var texto = $"{c.Folio} de {await NombreCliente(c.ClienteId, ct)}"
                                + (c.Partidas.Any(p => p.Especial) ? " (incluye pedido especial)" : "");
                    foreach (var d in c.VendedorId is Guid v ? [v] : await VendedoresDe(c.EmpresaId, ct))
                        Para(d, "ventas", "Cotización recibida del portal", texto, $"/ventas/cotizaciones/{c.Id}");
                    break;
                }
                case Cotizacion c when !nuevo && Cambio(e, nameof(Cotizacion.Estado)) && c.Estado == EstadoCotizacion.Pedido:
                    Para(c.VendedorId, "ventas",
                        await ActorEsPortal(ct) ? "El cliente aceptó una cotización" : "Cotización confirmada",
                        $"{c.Folio} de {await NombreCliente(c.ClienteId, ct)} pasó a pedido.", $"/ventas/cotizaciones/{c.Id}");
                    break;
                case Pedido p when !nuevo:
                {
                    var ruta = $"/ventas/ordenes/{Uri.EscapeDataString(p.Folio)}";
                    if (Cambio(e, nameof(Pedido.Estado)))
                        Para(p.VendedorId, "pedidos", $"Pedido {p.Folio}: {Etiqueta(p.Estado)}",
                            $"{await NombreCliente(p.ClienteId, ct)} · entrega {p.FechaHoraEntrega:dd/MM/yyyy HH:mm} UTC", ruta);
                    if (Cambio(e, nameof(Pedido.EstatusPlanta)))
                    {
                        var aviso = p.EstatusPlanta switch
                        {
                            EstatusPlanta.Rechazada => ("La planta rechazó el pedido", p.SolicitudPlantaNota),
                            EstatusPlanta.Actualizacion => ("La planta pide cambiar la entrega",
                                $"Propone {p.SolicitudPlantaFecha:dd/MM/yyyy HH:mm} UTC. {p.SolicitudPlantaNota}"),
                            EstatusPlanta.Confirmado => ("La planta confirmó el pedido", null),
                            _ => default((string, string?)?),
                        };
                        if (aviso is var (titulo, nota))
                            Para(p.VendedorId, "pedidos", $"{titulo} {p.Folio}", nota?.Trim() is { Length: > 0 } n ? n : p.Folio, ruta);
                    }
                    break;
                }
                case Actividad a when (nuevo || Cambio(e, nameof(Actividad.AsignadaAId))) && a is { HechaEn: null, CanceladaEn: null }:
                    Para(a.AsignadaAId, "crm", "Te asignaron una actividad", $"{a.Resumen} · vence {a.FechaLimite:dd/MM/yyyy}",
                        RutaDe(a.RegistroTipo, a.RegistroId));
                    break;
            }
        }
        AddRange(avisos);
    }

    /// <summary>Ruta del ERP de un registro con hilo (actividades, avisos); null si el ERP no tiene pantalla para él.
    /// El front manda el tipo como quiera ("cliente" o "Cliente"): se compara sin mayúsculas.</summary>
    public static string? RutaDe(string tipo, Guid id) => tipo.ToLowerInvariant() switch
    {
        "cliente" => $"/ventas/clientes/{id}",
        "cotizacion" => $"/ventas/cotizaciones/{id}",
        "obra" => $"/ventas/obras/{id}",
        _ => null,
    };

    static bool Cambio(EntityEntry e, string propiedad) =>
        !Equals(e.Property(propiedad).OriginalValue, e.Property(propiedad).CurrentValue);

    static string Etiqueta(Enum v) => JsonNamingPolicy.SnakeCaseLower.ConvertName(v.ToString()).Replace('_', ' ');

    static string Corto(string s, int max) => s.Length > max ? s[..(max - 1)] + "…" : s;

    bool? actorPortal;

    async Task<bool> ActorEsPortal(CancellationToken ct) => actorPortal ??= usuario.Id is Guid id &&
        await Set<Usuario>().IgnoreQueryFilters().AnyAsync(u => u.Id == id && u.Tipo == TipoUsuario.Portal, ct);

    async Task<string> NombreCliente(Guid? id, CancellationToken ct) =>
        id is null ? "cliente sin registrar"
        : await Set<Cliente>().IgnoreQueryFilters().Where(c => c.Id == id).Select(c => c.Nombre).FirstOrDefaultAsync(ct) ?? "cliente";

    /// <summary>Internos activos con acceso a la empresa y permiso efectivo de ver cotizaciones (rol + agregados − quitados).
    /// Root ("*") no cuenta: solo quien tiene ventas explícito.</summary>
    async Task<List<Guid>> VendedoresDe(Guid empresaId, CancellationToken ct)
    {
        const string pedido = "ventas.cotizaciones.ver";
        string[] cubren = ["ventas.*", "ventas.cotizaciones.*", pedido];
        var candidatos = await Set<Usuario>()
            .Where(u => u.Activo && u.Tipo == TipoUsuario.Interno
                        && Set<UsuarioAcceso>().IgnoreQueryFilters().Any(a => a.UsuarioId == u.Id && a.EmpresaId == empresaId))
            .Select(u => new
            {
                u.Id,
                Concede = Set<RolPermiso>().Any(p => p.RolId == u.RolId && cubren.Contains(p.Permiso))
                          || Set<UsuarioPermiso>().Any(p => p.UsuarioId == u.Id && !p.Quitado && cubren.Contains(p.Permiso)),
                Quita = Set<UsuarioPermiso>().Any(p => p.UsuarioId == u.Id && p.Quitado && (cubren.Contains(p.Permiso) || p.Permiso == "*")),
            }).ToListAsync(ct);
        return [.. candidatos.Where(c => c.Concede && !c.Quita).Select(c => c.Id)];
    }
}
