using System.Globalization;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Application.Flota;
using EPICO.Application.Ventas;
using EPICO.Contracts.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Correo;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

/// <summary>Quitados = números económicos de los viajes programados que se quitaron por no estar disponibles a la nueva hora.</summary>
public record ReagendaResultado(Pedido Pedido, List<string> NotificadoA, List<string> Quitados);

/// <summary>
/// Reagendar la entrega de un pedido (con aviso obligatorio al cliente), solicitudes de reagenda (una pendiente por pedido) y
/// tiempos del pedido. Reagendar recalcula las ventanas de los viajes programados y quita los que ya no caben.
/// </summary>
[ApiController]
public class ReagendaController(IAppDbContext db, VentasServicio ventas, FlotaServicio flota, IUsuarioActual yo, IConfiguration cfg) : ControllerBase
{
    public const string PermisoReagendar = "ventas.pedidos.reagendar", PermisoSolicitar = "operacion.reagenda.solicitar";

    static DateTime Utc(DateTime d) => d.Kind switch
    {
        DateTimeKind.Local => d.ToUniversalTime(),
        DateTimeKind.Unspecified => DateTime.SpecifyKind(d, DateTimeKind.Utc),
        _ => d,
    };

    /// <summary>Tiempos del pedido</summary>
    /// <remarks>transporteMin = ida y vuelta en minutos; null = volver al calculado con la distancia. Recalcula las ventanas de sus
    /// viajes programados. Pide operacion.remisiones.editar o ventas.pedidos.editar.</remarks>
    [HttpPut("api/v1/pedidos/{id:guid}/tiempos")]
    public async Task<ActionResult<Pedido>> Tiempos(Guid id, TiemposRequest r, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "operacion.remisiones.editar", "ventas.pedidos.editar") is { } no ? no
        : await flota.CambiarTiempos(id, r.TransporteMin, ct);

    /// <summary>Reagendar la entrega</summary>
    /// <remarks>Cambia la fecha y hora (UTC) y avisa al cliente: correo al contacto principal (o al correo del cliente) y a
    /// <c>correo</c> si viene, y notificación en el portal a sus usuarios. 400 "El cliente no tiene correo: indica a quién avisar."
    /// sin a quién avisar; 409 "La orden ya va en camino: no se puede reagendar." si algún viaje ya no está programado. Si la planta
    /// ya tenía el pedido (enviado, confirmado o actualización) vuelve a enviado. Una solicitud pendiente del pedido se cierra.</remarks>
    [HttpPost("api/v1/pedidos/{id:guid}/reagendar"), Permiso(PermisoReagendar)]
    public Task<ReagendaResultado> Reagendar(Guid id, ReagendarRequest r, CancellationToken ct) =>
        Aplicar(id, r.FechaHoraEntrega, r.Motivo, r.Correo, null, ct);

    async Task<ReagendaResultado> Aplicar(Guid pedidoId, DateTime fecha, string motivo, string? correo, SolicitudReagenda? solicitud, CancellationToken ct)
    {
        motivo = motivo.Trim();
        if (motivo.Length == 0) throw new ReglaException("Indica el motivo.");
        var p = await ventas.Pedido(pedidoId, ct, editar: true) ?? throw new ReglaException("El pedido no existe.", 404);
        if (p.Estado is EstadoPedido.Cancelado or EstadoPedido.Entregado)
            throw new ReglaException(p.Estado == EstadoPedido.Cancelado ? "La orden está cancelada." : "La orden ya se entregó.", 409);
        if (await db.Set<Remision>().AnyAsync(v => v.PedidoId == p.Id && v.Estado != EstadoViaje.Programado, ct))
            throw new ReglaException("La orden ya va en camino: no se puede reagendar.", 409);

        var cliente = await db.Set<Cliente>().IgnoreQueryFilters().FirstAsync(c => c.Id == p.ClienteId, ct);
        var principal = await db.Set<ClienteContacto>().IgnoreQueryFilters()
            .Where(k => k.ClienteId == cliente.Id && !k.IsDeleted && k.Principal && k.Correo != null && k.Correo != "")
            .Select(k => k.Correo).FirstOrDefaultAsync(ct);
        List<string> para = [.. new[] { string.IsNullOrWhiteSpace(principal) ? cliente.Correo : principal, correo }
            .Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c!.Trim().ToLowerInvariant()).Distinct()];
        if (para.Count == 0) throw new ReglaException("El cliente no tiene correo: indica a quién avisar.");

        var planta = await db.Set<Sucursal>().IgnoreQueryFilters().FirstAsync(s => s.Id == p.SucursalId, ct);
        string Local(DateTime utc) => VentasServicio.HoraLocal(utc, planta.ZonaHoraria).ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);
        var antes = p.FechaHoraEntrega;
        p.FechaHoraEntrega = Utc(fecha);
        // Aceptar la fecha que propuso la planta la deja confirmada; cualquier otro cambio se le vuelve a enviar.
        if (solicitud is { Origen: OrigenReagenda.Planta } && p.FechaHoraEntrega == solicitud.FechaPropuesta && p.EstatusPlanta == EstatusPlanta.Actualizacion)
            p.EstatusPlanta = EstatusPlanta.Confirmado;
        else if (p.EstatusPlanta is EstatusPlanta.Confirmado or EstatusPlanta.Enviado or EstatusPlanta.Actualizacion)
            p.EstatusPlanta = EstatusPlanta.Enviado;
        (p.SolicitudPlantaFecha, p.SolicitudPlantaNota) = (null, null);
        var quitados = await flota.Reprogramar(p, quitarOcupados: true, ct);

        var pendiente = solicitud ?? await db.Set<SolicitudReagenda>().FirstOrDefaultAsync(s => s.PedidoId == p.Id && s.Estado == EstadoSolicitud.Pendiente, ct);
        if (pendiente is not null)
            ventas.ResolverSolicitud(pendiente, solicitud is null ? EstadoSolicitud.Rechazada : EstadoSolicitud.Aceptada,
                solicitud is null ? $"Se reagendó directamente al {Local(p.FechaHoraEntrega)}." : null);

        var obra = p.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().Where(x => x.Id == o).Select(x => x.Nombre).FirstOrDefaultAsync(ct)
            : p.EntregaDireccion;
        var org = await db.Set<Empresa>().IgnoreQueryFilters().Where(e => e.Id == p.EmpresaId).Select(e => e.OrganizacionId).FirstAsync(ct);
        var texto = $"La entrega de tu pedido {p.Folio}{(obra is null ? "" : $" ({obra})")} cambió del {Local(antes)} al {Local(p.FechaHoraEntrega)}. Motivo: {motivo}";
        var url = cfg["Correo:UrlPortal"]?.TrimEnd('/');
        foreach (var d in para)
            db.Set<CorreoSaliente>().Add(Plantilla.Crear(d, $"Cambio de entrega de tu pedido {p.Folio}", texto,
                url is { Length: > 0 } ? ("Ver mi pedido", $"{url}/pedidos/{p.Id}") : null, null, org));
        var ahora = DateTime.UtcNow;
        var usuariosPortal = await (from k in db.Set<ClienteContacto>().IgnoreQueryFilters()
                                    join u in db.Set<Usuario>().IgnoreQueryFilters() on k.UsuarioId equals u.Id
                                    where k.ClienteId == cliente.Id && !k.IsDeleted && u.Tipo == TipoUsuario.Portal && u.Activo && !u.IsDeleted
                                    select u.Id).Distinct().ToListAsync(ct);
        db.Set<Notificacion>().AddRange(usuariosPortal.Select(u => new Notificacion
        {
            UsuarioId = u, Modulo = "pedidos", Titulo = $"Cambió la entrega de tu pedido {p.Folio}", Texto = texto.Length > 500 ? texto[..500] : texto,
            Ruta = $"/pedidos/{p.Id}", Fecha = ahora,
        }));
        db.Set<Evento>().Add(new Evento
        {
            OrganizacionId = org, RegistroTipo = nameof(Pedido), RegistroId = p.Id, Fecha = ahora, AutorId = yo.Id, SesionId = yo.SesionId,
            Tipo = TipoEvento.Sistema,
            Texto = $"Entrega reagendada: {Local(antes)} → {Local(p.FechaHoraEntrega)}. Motivo: {motivo}. Avisado a {string.Join(", ", para)}."
                    + (quitados.Count > 0 ? $" Se quitaron por no estar disponibles: {string.Join(", ", quitados)}." : ""),
        });
        await db.SaveChangesAsync(ct);
        await flota.Completar([p], ct);
        return new(p, para, quitados);
    }

    // ---------------------------------------------------------------------------------------------
    // Solicitudes
    // ---------------------------------------------------------------------------------------------

    /// <summary>Solicitar reagenda</summary>
    /// <remarks>Una pendiente por pedido (409 "Ya hay una solicitud pendiente para PED-…"). Origen: logistica si el usuario edita
    /// equipos de flota, si no ventas. Avisa a quien tenga ventas.pedidos.reagendar.</remarks>
    [HttpPost("api/v1/pedidos/{id:guid}/solicitudes-reagenda"), Permiso(PermisoSolicitar)]
    public async Task<ActionResult<SolicitudReagenda>> Solicitar(Guid id, SolicitudReagendaRequest r, CancellationToken ct)
    {
        var p = await db.Set<Pedido>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.Estado is EstadoPedido.Cancelado or EstadoPedido.Entregado) return Problem("La orden ya no se puede reagendar.", statusCode: 409);
        if (await db.Set<SolicitudReagenda>().AnyAsync(s => s.PedidoId == id && s.Estado == EstadoSolicitud.Pendiente, ct))
            return Problem($"Ya hay una solicitud pendiente para {p.Folio}.", statusCode: 409);
        var s = new SolicitudReagenda
        {
            PedidoId = id, FechaPropuesta = Utc(r.FechaPropuesta), Motivo = r.Motivo.Trim(),
            Origen = yo.Tiene("flota.equipos.editar") ? OrigenReagenda.Logistica : OrigenReagenda.Ventas,
            SolicitadoPorId = yo.Id, SolicitadoEn = DateTime.UtcNow,
        };
        db.Set<SolicitudReagenda>().Add(s);
        await db.SaveChangesAsync(ct);
        s.PedidoFolio = p.Folio;
        return Created($"/api/v1/pedidos/{id}/solicitudes-reagenda", s);
    }

    /// <summary>Solicitudes de un pedido</summary>
    /// <remarks>Todas, la más reciente primero. Pide ventas.pedidos.ver u operacion.remisiones.ver.</remarks>
    [HttpGet("api/v1/pedidos/{id:guid}/solicitudes-reagenda")]
    public async Task<ActionResult<List<SolicitudReagenda>>> DelPedido(Guid id, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "ventas.pedidos.ver", "operacion.remisiones.ver") is { } no ? no
        : await Lista(db.Set<SolicitudReagenda>().Where(s => s.PedidoId == id), ct);

    /// <summary>Solicitudes de reagenda</summary>
    /// <remarks>?estado=pendiente|aceptada|rechazada; la más reciente primero, con pedidoFolio. Pide ventas.pedidos.ver u
    /// operacion.remisiones.ver.</remarks>
    [HttpGet("api/v1/solicitudes-reagenda")]
    public async Task<ActionResult<List<SolicitudReagenda>>> Todas([FromQuery] EstadoSolicitud? estado, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "ventas.pedidos.ver", "operacion.remisiones.ver") is { } no ? no
        : await Lista(estado is { } e ? db.Set<SolicitudReagenda>().Where(s => s.Estado == e) : db.Set<SolicitudReagenda>(), ct);

    async Task<List<SolicitudReagenda>> Lista(IQueryable<SolicitudReagenda> q, CancellationToken ct)
    {
        var xs = await q.AsNoTracking().OrderByDescending(s => s.SolicitadoEn).Take(500).ToListAsync(ct);
        var ids = xs.Select(s => s.PedidoId).Distinct().ToList();
        var folios = await db.Set<Pedido>().IgnoreQueryFilters().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Folio, ct);
        foreach (var s in xs) s.PedidoFolio = folios.GetValueOrDefault(s.PedidoId);
        return xs;
    }

    async Task<SolicitudReagenda> Pendiente(Guid id, CancellationToken ct)
    {
        var s = await db.Set<SolicitudReagenda>().FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new ReglaException("La solicitud no existe.", 404);
        return s.Estado == EstadoSolicitud.Pendiente ? s : throw new ReglaException("La solicitud ya se resolvió.", 409);
    }

    /// <summary>Aceptar solicitud</summary>
    /// <remarks>Reagenda con las mismas reglas y aviso (fechaHoraEntrega vacía = la propuesta). Si la propuso la planta y se acepta
    /// su fecha, el pedido queda confirmado con planta.</remarks>
    [HttpPost("api/v1/solicitudes-reagenda/{id:guid}/aceptar"), Permiso(PermisoReagendar)]
    public async Task<ReagendaResultado> Aceptar(Guid id, AceptarReagendaRequest r, CancellationToken ct)
    {
        var s = await Pendiente(id, ct);
        return await Aplicar(s.PedidoId, r.FechaHoraEntrega ?? s.FechaPropuesta, s.Motivo, r.Correo, s, ct);
    }

    /// <summary>Rechazar solicitud</summary>
    [HttpPost("api/v1/solicitudes-reagenda/{id:guid}/rechazar"), Permiso(PermisoReagendar)]
    public async Task<SolicitudReagenda> Rechazar(Guid id, RechazarReagendaRequest r, CancellationToken ct)
    {
        var s = await Pendiente(id, ct);
        ventas.ResolverSolicitud(s, EstadoSolicitud.Rechazada, r.Nota.Trim());
        await db.SaveChangesAsync(ct);
        return s;
    }
}
