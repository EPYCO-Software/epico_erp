using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using EPICO.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace EPICO.Tests;

/// <summary>Base propia: la demo agrega una empresa que no debe mezclarse con los otros tests.</summary>
public class DemoTests(Api api) : IClassFixture<Api>
{
    [Fact]
    public async Task Seed_demo_cubre_cada_opcion_y_se_puede_repetir()
    {
        for (var i = 0; i < 2; i++)
        {
            await using var db = api.Db();
            await SeedDemo.EjecutarAsync(db, Api.Root, NullLogger.Instance);
        }
        await using var d = api.Db();
        var emp = await d.Set<Domain.Acceso.Empresa>().SingleAsync(e => e.RazonSocial == SeedDemo.Empresa);
        Assert.Equal(2, await d.Set<Domain.Acceso.Sucursal>().CountAsync(s => s.EmpresaId == emp.Id));

        async Task Todos<TEnum, TEntidad>(Func<IQueryable<TEntidad>, IQueryable<TEnum>> valores) where TEnum : struct, Enum where TEntidad : class =>
            Assert.Equal(Enum.GetValues<TEnum>().Order(), (await valores(d.Set<TEntidad>()).Distinct().ToListAsync()).Order());
        await Todos<EstadoCotizacion, Cotizacion>(q => q.Where(c => c.EmpresaId == emp.Id).Select(c => c.Estado));
        await Todos<OrigenCotizacion, Cotizacion>(q => q.Where(c => c.EmpresaId == emp.Id).Select(c => c.Origen));
        await Todos<EstadoPedido, Pedido>(q => q.Where(p => p.EmpresaId == emp.Id).Select(p => p.Estado));
        await Todos<EstadoCobro, Pedido>(q => q.Where(p => p.EmpresaId == emp.Id).Select(p => p.Cobro));
        await Todos<MetodoPago, Pedido>(q => q.Where(p => p.EmpresaId == emp.Id).Select(p => p.MetodoPago));
        await Todos<EstatusPlanta, Pedido>(q => q.Where(p => p.EmpresaId == emp.Id).Select(p => p.EstatusPlanta));
        await Todos<EstadoViaje, Remision>(q => q.Select(r => r.Estado));
        await Todos<EtapaProspecto, Prospecto>(q => q.Where(p => p.EmpresaId == emp.Id).Select(p => p.Etapa));
        await Todos<TipoActividad, Domain.Historial.Actividad>(q => q.Select(a => a.Tipo));
        await Todos<TipoReglaPrecio, ReglaPrecio>(q => q.Select(r => r.Tipo));
        await Todos<TipoPrograma, ProgramaDescuento>(q => q.Where(p => p.EmpresaRestringidaId == emp.Id).Select(p => p.Tipo));
        await Todos<TipoRecompensa, ProgramaDescuento>(q => q.Where(p => p.EmpresaRestringidaId == emp.Id).Select(p => p.Recompensa));
        await Todos<TipoEquipo, Equipo>(q => q.Select(e => e.Tipo));
        Assert.Contains(await d.Set<Cotizacion>().Where(c => c.EmpresaId == emp.Id).ToListAsync(), c => c.Descuento > 0);

        // La secuencia sigue después de los folios sembrados: la siguiente cotización no choca.
        var folio = await d.SiguienteFolioAsync(emp.Id, (await d.Set<Domain.Acceso.Sucursal>().SingleAsync(s => s.Codigo == "DMA")).Id, "cotizacion");
        Assert.False(await d.Set<Cotizacion>().AnyAsync(c => c.Folio == folio));

        async Task<HttpStatusCode> Login(string usuario, string? app = null) =>
            (await api.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { correo = $"{usuario}@{SeedDemo.Dominio}", password = SeedDemo.Password, app })).StatusCode;
        foreach (var u in new[] { "root", "admin", "ventas", "norte" }) Assert.Equal(HttpStatusCode.OK, await Login(u));
        Assert.Equal(HttpStatusCode.OK, await Login("cliente", "portal"));
        Assert.Equal(HttpStatusCode.Forbidden, await Login("cliente"));        // el usuario del portal no entra al ERP
        Assert.Equal(HttpStatusCode.Forbidden, await Login("ventas", "portal")); // ni uno interno al portal

        // norte solo entra a Planta Norte (DMA): no ve ni toca lo de Planta Sur (DMB).
        var (norte, _) = await api.Entrar($"norte@{SeedDemo.Dominio}", SeedDemo.Password);
        var dmb = (await d.Set<Domain.Acceso.Sucursal>().SingleAsync(s => s.Codigo == "DMB")).Id;
        var cotSur = await d.Set<Cotizacion>().FirstAsync(c => c.SucursalId == dmb);
        var pedSur = await d.Set<Pedido>().FirstAsync(p => p.SucursalId == dmb);
        var cots = await norte.GetFromJsonAsync<JsonElement>("/api/v1/cotizaciones?tamano=500");
        Assert.NotEmpty(cots.GetProperty("items").EnumerateArray());
        Assert.DoesNotContain(cots.GetProperty("items").EnumerateArray(), c => c.GetProperty("sucursalId").GetGuid() == dmb);
        var peds = await norte.GetFromJsonAsync<JsonElement>("/api/v1/pedidos?tamano=500");
        Assert.DoesNotContain(peds.GetProperty("items").EnumerateArray(), p => p.GetProperty("sucursalId").GetGuid() == dmb);
        Assert.Equal(HttpStatusCode.NotFound, (await norte.GetAsync($"/api/v1/cotizaciones/{cotSur.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await norte.GetAsync($"/api/v1/pedidos/{pedSur.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await norte.PostAsync($"/api/v1/cotizaciones/{cotSur.Id}/cancelar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, await Login("inactivo"));
        Assert.Equal(HttpStatusCode.Forbidden, await Login("bloqueado")); // bloqueado por un admin (10 años)

        var (admin, sesion) = await api.Entrar(Api.Root, Api.RootPassword);
        Assert.Contains(sesion.GetProperty("empresas").EnumerateArray(), e => e.GetProperty("id").GetGuid() == emp.Id);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/v1/cotizaciones?empresaId={emp.Id}")).StatusCode);
    }
}
