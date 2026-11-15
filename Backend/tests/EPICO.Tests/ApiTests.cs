using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Api.Controllers;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace EPICO.Tests;

/// <summary>
/// API real contra una base Postgres de prueba que se crea y se borra en cada corrida.
/// Necesita Postgres en localhost:5432 (docker compose up -d database) o EPICO_TEST_DB con otra cadena.
/// </summary>
public sealed class Api : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string Root = "yumilrf@hotmail.com", RootPassword = "Root.Prueba.123";

    readonly string _conexion =
        (Environment.GetEnvironmentVariable("EPICO_TEST_DB") ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres")
        + $";Database=epico_test_{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder b)
    {
        b.UseEnvironment("Testing");
        b.UseSetting("ConnectionStrings:Default", _conexion);
        b.UseSetting("Jwt:Key", new string('k', 48));
        b.UseSetting("Seed:RootPassword", RootPassword);
    }

    public AppDbContext Db() => Services.CreateScope().ServiceProvider.GetRequiredService<AppDbContext>();

    public async Task SeedAsync()
    {
        await using var db = Db();
        await Seed.EjecutarAsync(db, Services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>(), NullLogger.Instance);
    }

    public async Task InitializeAsync()
    {
        await using var db = Db();
        await db.Database.MigrateAsync();
        await SeedAsync();
    }

    Task IAsyncLifetime.DisposeAsync() => Db().Database.EnsureDeletedAsync();

    public async Task<(HttpClient Cliente, JsonElement Sesion)> Entrar(string correo, string password)
    {
        var c = CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { correo, password });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var sesion = await r.Content.ReadFromJsonAsync<JsonElement>();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sesion.GetProperty("token").GetString());
        return (c, sesion);
    }

    /// <summary>Usuario interno con un rol propio (esos permisos) y acceso a las empresas dadas.</summary>
    public async Task<Usuario> CrearUsuario(string correo, string password, string[] permisos, params Empresa[] empresas)
    {
        await using var db = Db();
        var u = new Usuario { Correo = correo, Nombre = correo, Tipo = TipoUsuario.Interno };
        u.PasswordHash = AuthController.Hasher.HashPassword(u, password);
        var rol = new Rol { Nombre = $"Rol de {correo}", OrganizacionId = empresas[0].OrganizacionId };
        db.AddRange(u, rol);
        db.AddRange(permisos.Select(p => new RolPermiso { RolId = rol.Id, Permiso = p }));
        db.AddRange(empresas.Select(e => new UsuarioAcceso { UsuarioId = u.Id, EmpresaId = e.Id, RolId = rol.Id }));
        await db.SaveChangesAsync();
        return u;
    }

    public async Task<Empresa> Empresa(string razon)
    {
        await using var db = Db();
        return await db.Set<Empresa>().SingleAsync(e => e.RazonSocial == razon);
    }
}

public class ApiTests(Api api) : IClassFixture<Api>
{
    const string Sureste = "EPICO Concretos del Sureste", Caribe = "EPICO Concretos del Caribe";

    [Fact]
    public async Task Seed_se_puede_repetir_sin_duplicar()
    {
        await api.SeedAsync();
        await using var db = api.Db();
        Assert.Equal(2, await db.Set<Empresa>().CountAsync());
        var codigos = await db.Set<Sucursal>().Select(s => s.Codigo).ToListAsync(); // otras pruebas agregan plantas
        Assert.Equal(codigos.Distinct().Count(), codigos.Count);
        Assert.Superset(new HashSet<string> { "CUN", "CZM", "ESC", "XPJ" }, codigos.ToHashSet());
        Assert.Equal(1, await db.Set<Usuario>().CountAsync(u => u.Correo == Api.Root));
        Assert.Equal(2, await db.Set<UsuarioAcceso>().CountAsync(a => db.Set<Usuario>().Any(u => u.Id == a.UsuarioId && u.Correo == Api.Root)));
    }

    [Fact]
    public async Task Root_entra_y_ve_todo()
    {
        var (c, sesion) = await api.Entrar("YumilRF@Hotmail.com ", Api.RootPassword);
        Assert.Equal("*", sesion.GetProperty("permisos")[0].GetString());
        Assert.Equal(2, sesion.GetProperty("empresas").GetArrayLength());
        Assert.Equal(2, (await c.GetFromJsonAsync<JsonElement>("/api/v1/empresas")).GetArrayLength());
    }

    [Fact]
    public async Task OpenApi_documenta_permisos_token_y_enums()
    {
        using var dev = api.WithWebHostBuilder(b => b.UseEnvironment("Development")); // /openapi solo se publica en Development
        var doc = await dev.CreateClient().GetFromJsonAsync<JsonElement>("/openapi/v1.json");
        var lista = doc.GetProperty("paths").GetProperty("/api/v1/clientes").GetProperty("get");
        Assert.Equal("Lista", lista.GetProperty("summary").GetString());
        Assert.StartsWith("**Permiso:** `ventas.clientes.ver`", lista.GetProperty("description").GetString());
        Assert.True(lista.GetProperty("security")[0].TryGetProperty("Bearer", out _));
        Assert.False(doc.GetProperty("paths").GetProperty("/api/v1/auth/login").GetProperty("post").TryGetProperty("security", out _));
        var cobro = doc.GetProperty("components").GetProperty("schemas").GetProperty("EstadoCobro").GetProperty("enum");
        Assert.Equal("por_cobrar", cobro[0].GetString());
    }

    [Fact]
    public async Task Sin_token_401_y_credenciales_malas_401()
    {
        var c = api.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/v1/empresas")).StatusCode);
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { correo = Api.Root, password = "mala" });
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
    }

    [Fact]
    public async Task Permisos_y_filtro_por_empresa()
    {
        var sureste = await api.Empresa(Sureste);
        var caribe = await api.Empresa(Caribe);
        await api.CrearUsuario("plantas@prueba.mx", "Plantas.123",
            ["config.sucursales.ver", "config.sucursales.crear", "config.accesos.crear"], sureste);
        var (c, sesion) = await api.Entrar("plantas@prueba.mx", "Plantas.123");

        // Solo ve las plantas de su empresa.
        var plantas = await c.GetFromJsonAsync<JsonElement>("/api/v1/sucursales");
        Assert.Equal(["ESC", "XPJ"], plantas.EnumerateArray().Select(p => p.GetProperty("codigo").GetString()).Order());
        await using (var db = api.Db())
        {
            var cun = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "CUN");
            Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/sucursales/{cun.Id}")).StatusCode);
        }

        // Sin el permiso config.empresas.ver.
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/empresas")).StatusCode);

        // Crea plantas solo en su empresa.
        var planta = new { codigo = "NVA", nombre = "Nueva", zonaHoraria = "America/Merida" };
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/sucursales", new { planta.codigo, planta.nombre, planta.zonaHoraria, empresaId = caribe.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/v1/sucursales", new { planta.codigo, planta.nombre, planta.zonaHoraria, empresaId = sureste.Id })).StatusCode);

        // No se puede dar a sí mismo el rol de administrador.
        await using (var db = api.Db())
        {
            var admin = await db.Set<Rol>().SingleAsync(r => r.Nombre == Seed.RolAdministrador);
            var r = await c.PostAsJsonAsync("/api/v1/usuario-accesos", new
            {
                usuarioId = sesion.GetProperty("usuario").GetProperty("id").GetGuid(),
                empresaId = sureste.Id,
                sucursalId = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC")).Id,
                rolId = admin.Id,
            });
            Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        }
    }

    [Fact]
    public async Task Bloqueo_tras_cinco_intentos()
    {
        await api.CrearUsuario("bloqueo@prueba.mx", "Bloqueo.123", [], await api.Empresa(Sureste));
        var c = api.CreateClient();
        for (var i = 0; i < 5; i++)
            await c.PostAsJsonAsync("/api/v1/auth/login", new { correo = "bloqueo@prueba.mx", password = "mala" });
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { correo = "bloqueo@prueba.mx", password = "Bloqueo.123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
    }

    [Fact]
    public async Task Refresh_rota_el_token()
    {
        var (c, sesion) = await api.Entrar(Api.Root, Api.RootPassword);
        var viejo = sesion.GetProperty("refreshToken").GetString();
        var r = await c.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = viejo });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = viejo })).StatusCode);
    }

    [Fact]
    public async Task Historial_anota_cada_campo_rastreado_y_no_se_edita()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var planta = await c.GetFromJsonAsync<JsonElement>("/api/v1/sucursales?take=500")
            .ContinueWith(t => t.Result.EnumerateArray().Single(p => p.GetProperty("codigo").GetString() == "XPJ"));
        var id = planta.GetProperty("id").GetGuid();
        var cambio = JsonSerializer.Deserialize<Dictionary<string, object?>>(planta.GetRawText())!;
        cambio["nombre"] = "Planta Xpujil Norte";
        cambio["telefono"] = "9831234567";
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync($"/api/v1/sucursales/{id}", cambio)).StatusCode);

        var hilo = await c.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Sucursal/{id}");
        var ultimo = hilo[0];
        Assert.Equal("cambio", ultimo.GetProperty("tipo").GetString());
        var cambios = ultimo.GetProperty("cambios").EnumerateArray().ToDictionary(x => x.GetProperty("campo").GetString()!);
        Assert.Equal(["Nombre", "Telefono"], cambios.Keys.Order());
        Assert.Equal("Planta Xpujil", cambios["Nombre"].GetProperty("valorAnterior").GetString());
        Assert.Equal("Planta Xpujil Norte", cambios["Nombre"].GetProperty("valorNuevo").GetString());
        Assert.Equal("creado", hilo[hilo.GetArrayLength() - 1].GetProperty("tipo").GetString());

        await using var db = api.Db();
        var ev = await db.Set<Evento>().FirstAsync(e => e.RegistroId == id);
        ev.Texto = "manipulado";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Borrado_logico_conserva_el_registro()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var r = await c.PostAsJsonAsync("/api/v1/roles", new { nombre = "Temporal" });
        var id = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/roles/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/roles/{id}")).StatusCode);
        await using var db = api.Db();
        Assert.True((await db.Set<Rol>().IgnoreQueryFilters().SingleAsync(x => x.Id == id)).IsDeleted);
    }

    [Fact]
    public async Task Folios_concurrentes_no_se_repiten_ni_se_saltan()
    {
        var sureste = await api.Empresa(Sureste);
        await using (var db = api.Db())
        {
            db.Add(new Secuencia { EmpresaId = sureste.Id, Tipo = "prueba", Prefijo = "EPI-PRU-" });
            await db.SaveChangesAsync();
        }

        var folios = await Task.WhenAll(Enumerable.Range(0, 20).Select(async _ =>
        {
            await using var db = api.Db();
            await using var tx = await db.Database.BeginTransactionAsync();
            var folio = await db.SiguienteFolioAsync(sureste.Id, null, "prueba");
            await tx.CommitAsync();
            return folio;
        }));

        Assert.Equal(Enumerable.Range(1, 20).Select(n => $"EPI-PRU-{n:D3}"), folios.OrderBy(f => int.Parse(f[8..])));
    }
}
