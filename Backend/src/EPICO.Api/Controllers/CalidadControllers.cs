using System.Globalization;
using EPICO.Application.Calidad;
using EPICO.Application.Common;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Mvc;

namespace EPICO.Api.Controllers;

/// <summary>Muestras de concreto. Al crearla: folio de la planta (secuencia "muestra"), f'c del concreto del pedido y ensayes a 7, 14 y 28 días.</summary>
/// <remarks>Lista: ?pedidoId=…&amp;remisionId=…&amp;desde=…&amp;hasta=… (por fecha de muestreo, ISO 8601, hasta exclusivo).</remarks>
[Route("api/v1/muestras")]
public class MuestrasController(IAppDbContext db, IUsuarioActual yo, CalidadServicio calidad) : CrudController<MuestraLaboratorio>(db, yo)
{
    protected override string Recurso => "calidad.muestras";
    protected override Task<bool> PermitidoAsync(MuestraLaboratorio x, CancellationToken ct) => PadreVisible<Pedido>(x.PedidoId, ct);

    protected override IQueryable<MuestraLaboratorio> Filtrar(IQueryable<MuestraLaboratorio> q)
    {
        if (DateTimeOffset.TryParse(Request.Query["desde"], CultureInfo.InvariantCulture, out var d)) q = q.Where(m => m.FechaMuestreo >= d.UtcDateTime);
        if (DateTimeOffset.TryParse(Request.Query["hasta"], CultureInfo.InvariantCulture, out var h)) q = q.Where(m => m.FechaMuestreo < h.UtcDateTime);
        return FiltroQuery.Aplicar(q, Request.Query, "desde", "hasta");
    }

    protected override Task AntesDeGuardar(MuestraLaboratorio x, bool nuevo, CancellationToken ct) =>
        nuevo ? calidad.PrepararMuestra(x, ct) : Task.CompletedTask;
}

/// <summary>Ensayes de resistencia (se crean con la muestra; aquí se capturan fecha y resultado).</summary>
/// <remarks>Lista: ?muestraId=…&amp;pendientes=true (sin fecha de ensaye, por fecha programada).</remarks>
[Route("api/v1/ensayes")]
public class EnsayesController(IAppDbContext db, IUsuarioActual yo) : CrudController<EnsayeLaboratorio>(db, yo)
{
    protected override string Recurso => "calidad.ensayes";
    protected override Task<bool> PermitidoAsync(EnsayeLaboratorio x, CancellationToken ct) => PadreVisible<MuestraLaboratorio>(x.MuestraId, ct);

    protected override IQueryable<EnsayeLaboratorio> Filtrar(IQueryable<EnsayeLaboratorio> q)
    {
        if (Request.Query["pendientes"] == "true") q = q.Where(e => e.FechaEnsaye == null).OrderBy(e => e.FechaProgramada);
        return FiltroQuery.Aplicar(q, Request.Query, "pendientes");
    }
}

[ApiController]
public class CertificadoController(CalidadServicio calidad, IUsuarioActual yo) : ControllerBase
{
    /// <summary>Certificado de calidad del pedido</summary>
    /// <remarks>Muestras y ensayes (con % de f'c), resumen a la edad de diseño y dictamen: cumple si el promedio ≥ f'c y ninguno &lt; f'c − 35;
    /// sin ensayes a esa edad, pendiente. Pide calidad.muestras.ver o ventas.pedidos.ver.</remarks>
    [HttpGet("api/v1/pedidos/{id:guid}/certificado")]
    public async Task<ActionResult<Certificado>> Certificado(Guid id, CancellationToken ct) =>
        ViajesController.SinPermiso(yo, "calidad.muestras.ver", "ventas.pedidos.ver") is { } no ? no : await calidad.Certificado(id, ct);
}
