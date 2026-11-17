using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Api.Auth;
using EPICO.Api.Controllers;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
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
    public const string Root = "admin@epyco.cloud", RootPassword = "Root.Prueba.123";

    readonly string _conexion =
        (Environment.GetEnvironmentVariable("EPICO_TEST_DB") ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres")
        + $";Database=epico_test_{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder b)
    {
        b.UseEnvironment("Testing");
        b.UseSetting("ConnectionStrings:Default", _conexion);
        b.UseSetting("Jwt:Key", new string('k', 48));
        b.UseSetting("Seed:RootPassword", RootPassword);
        b.UseSetting("Cifrado:Llave", new string('c', 40));
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

    public async Task<(HttpClient Cliente, JsonElement Sesion)> Entrar(string correo, string password, string? app = null)
    {
        var c = CreateClient();
        var r = await c.PostAsJsonAsync("/api/v1/auth/login", new { correo, password, app });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var sesion = await r.Content.ReadFromJsonAsync<JsonElement>();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sesion.GetProperty("token").GetString());
        return (c, sesion);
    }

    /// <summary>Usuario interno con un rol propio (esos permisos) y acceso a las empresas dadas.</summary>
    public async Task<Usuario> CrearUsuario(string correo, string password, string[] permisos, params Empresa[] empresas)
    {
        await using var db = Db();
        var rol = db.Add(new Rol { Nombre = $"Rol de {correo}", OrganizacionId = empresas[0].OrganizacionId }).Entity;
        var u = new Usuario { Correo = correo, Nombre = correo, Tipo = TipoUsuario.Interno, RolId = rol.Id };
        u.PasswordHash = AuthController.Hasher.HashPassword(u, password);
        db.Add(u);
        db.AddRange(permisos.Select(p => new RolPermiso { RolId = rol.Id, Permiso = p }));
        db.AddRange(empresas.Select(e => new UsuarioAcceso { UsuarioId = u.Id, EmpresaId = e.Id }));
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
    public async Task Seed_no_resucita_ni_choca_con_lo_borrado()
    {
        // Un producto y una planta del seed eliminados (borrado lógico): el seed del siguiente deploy no los recrea ni truena.
        await using (var db = api.Db())
        {
            await db.Set<Producto>().Where(p => p.Codigo == "AJ-ADT-ACELERANTE").ExecuteUpdateAsync(x => x.SetProperty(p => p.IsDeleted, true));
            await db.Set<Sucursal>().Where(s => s.Codigo == "XPJ").ExecuteUpdateAsync(x => x.SetProperty(s => s.IsDeleted, true));
        }
        try
        {
            await api.SeedAsync();
            await using var db = api.Db();
            Assert.Equal(1, await db.Set<Producto>().IgnoreQueryFilters().CountAsync(p => p.Codigo == "AJ-ADT-ACELERANTE"));
            Assert.False(await db.Set<Producto>().AnyAsync(p => p.Codigo == "AJ-ADT-ACELERANTE"));
            Assert.False(await db.Set<Sucursal>().AnyAsync(s => s.Codigo == "XPJ"));
        }
        finally
        {
            await using var db = api.Db(); // las demás pruebas usan esa planta y ese aditivo
            await db.Set<Producto>().IgnoreQueryFilters().Where(p => p.Codigo == "AJ-ADT-ACELERANTE").ExecuteUpdateAsync(x => x.SetProperty(p => p.IsDeleted, false));
            await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Codigo == "XPJ").ExecuteUpdateAsync(x => x.SetProperty(s => s.IsDeleted, false));
        }
    }

    [Fact]
    public async Task Root_entra_y_ve_todo()
    {
        var (c, sesion) = await api.Entrar("Admin@Epyco.Cloud ", Api.RootPassword);
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

        // No se puede dar acceso a una empresa a la que uno no entra (el rol ya no va en el acceso).
        var r = await c.PostAsJsonAsync("/api/v1/usuario-accesos", new
        {
            usuarioId = sesion.GetProperty("usuario").GetProperty("id").GetGuid(),
            empresaId = caribe.Id,
        });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
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
    public async Task Refresh_revalida_bloqueo_y_accesos()
    {
        var (sureste, caribe) = (await api.Empresa(Sureste), await api.Empresa(Caribe));
        var correo = $"refresh{Guid.NewGuid():N}@prueba.mx";
        var u = await api.CrearUsuario(correo, "Refresh.123", [], sureste, caribe);
        var anon = api.CreateClient();
        async Task<HttpResponseMessage> Refrescar(JsonElement s) =>
            await anon.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = s.GetProperty("refreshToken").GetString() });

        // Pierde la empresa de la sesión: pasa a la que le queda, con la lista recalculada.
        var (_, s1) = await api.Entrar(correo, "Refresh.123");
        var actual = s1.GetProperty("empresaId").GetGuid();
        await using (var db = api.Db())
            await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id && a.EmpresaId == actual).ExecuteDeleteAsync();
        var r = await Refrescar(s1);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var nueva = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(actual, nueva.GetProperty("empresaId").GetGuid());
        Assert.Equal(1, nueva.GetProperty("empresas").GetArrayLength());

        // Sin ningún acceso: 401.
        await using (var db = api.Db())
            await db.Set<UsuarioAcceso>().Where(a => a.UsuarioId == u.Id).ExecuteDeleteAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refrescar(nueva)).StatusCode);

        // Bloqueado: 401.
        await using (var db = api.Db())
        {
            db.Add(new UsuarioAcceso { UsuarioId = u.Id, EmpresaId = sureste.Id });
            await db.SaveChangesAsync();
        }
        var (_, s2) = await api.Entrar(correo, "Refresh.123");
        await using (var db = api.Db())
            await db.Set<Usuario>().Where(x => x.Id == u.Id).ExecuteUpdateAsync(x => x.SetProperty(y => y.BloqueadoHasta, DateTime.UtcNow.AddHours(1)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refrescar(s2)).StatusCode);
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

    [Fact]
    public async Task Me_perfil_password_preferencias_y_resumen_sin_permisos()
    {
        var sureste = await api.Empresa(Sureste);
        var correo = $"me{Guid.NewGuid():N}@epico.mx";
        var u = await api.CrearUsuario(correo, "Clave.Original.1", [], sureste);
        var (c, _) = await api.Entrar(correo, "Clave.Original.1");
        await api.Entrar(correo, "Clave.Original.1"); // otra sesión del mismo usuario

        var perfil = await (await c.PutAsJsonAsync("/api/v1/me", new { nombre = "Ana", apellidos = "Pech", telefono = "9811234567", puesto = "Ventas" }))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pech", perfil.GetProperty("apellidos").GetString());
        Assert.False(perfil.TryGetProperty("passwordHash", out _));

        var resumen = await c.GetFromJsonAsync<JsonElement>("/api/v1/usuarios/resumen");
        Assert.Contains(resumen.EnumerateArray(), x => x.GetProperty("id").GetGuid() == u.Id && x.GetProperty("nombre").GetString() == "Ana Pech");
        Assert.Contains(resumen.EnumerateArray(), x => x.GetProperty("nombre").GetString() == "Administrador");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/usuarios")).StatusCode);

        Assert.Equal("{}", (await c.GetFromJsonAsync<JsonElement>("/api/v1/me/preferencias")).GetRawText());
        await c.PutAsJsonAsync("/api/v1/me/preferencias", new { plantas = new[] { "ESC" }, principal = "ESC" });
        Assert.Equal("ESC", (await c.GetFromJsonAsync<JsonElement>("/api/v1/me/preferencias")).GetProperty("principal").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PutAsJsonAsync("/api/v1/me/preferencias", new[] { 1 })).StatusCode);

        var mala = await c.PutAsJsonAsync("/api/v1/me/password", new { actual = "otra", nueva = "Clave.Nueva.123" });
        Assert.Equal(HttpStatusCode.BadRequest, mala.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsJsonAsync("/api/v1/me/password", new { actual = "Clave.Original.1", nueva = "Clave.Nueva.123" })).StatusCode);
        await api.Entrar(correo, "Clave.Nueva.123");
        await using var db = api.Db();
        Assert.Equal(1, await db.Set<Sesion>().CountAsync(s => s.UsuarioId == u.Id && s.RevocadaEn != null)); // la otra sesión
    }

    [Fact]
    public async Task Mis_sesiones_sin_permisos_y_actividades_quedan_en_el_hilo()
    {
        var sureste = await api.Empresa(Sureste);
        var correo = $"ses{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Original.1", [], sureste);
        var (c, _) = await api.Entrar(correo, "Clave.Original.1");
        var (_, otra) = await api.Entrar(correo, "Clave.Original.1");

        var sesiones = await c.GetFromJsonAsync<JsonElement>("/api/v1/me/sesiones");
        Assert.Equal(2, sesiones.GetArrayLength());
        var ajena = sesiones.EnumerateArray().Single(x => !x.GetProperty("actual").GetBoolean()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/me/sesiones/{ajena}")).StatusCode);
        Assert.Single((await c.GetFromJsonAsync<JsonElement>("/api/v1/me/sesiones")).EnumerateArray());
        var refresh = await api.CreateClient().PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = otra.GetProperty("refreshToken").GetString() });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);

        var (root, sesionRoot) = await api.Entrar(Api.Root, Api.RootPassword);
        var rootId = sesionRoot.GetProperty("usuario").GetProperty("id").GetGuid();
        var r = await root.PostAsJsonAsync("/api/v1/actividades", new
        {
            registroTipo = "Empresa", registroId = sureste.Id, tipo = "reunion", resumen = "Visita a obra",
            fechaLimite = "2026-12-01", asignadaAId = rootId,
        });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var act = (await r.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>())!;
        act["hechaEn"] = JsonSerializer.SerializeToElement(DateTime.UtcNow);
        Assert.Equal(HttpStatusCode.OK, (await root.PutAsJsonAsync($"/api/v1/actividades/{act["id"].GetGuid()}", act)).StatusCode);

        var hilo = await root.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Empresa/{sureste.Id}");
        var textos = hilo.EnumerateArray().Where(e => e.GetProperty("tipo").GetString() == "actividad")
            .Select(e => e.GetProperty("texto").GetString()).ToList();
        Assert.Contains("Actividad programada: Reunión · Visita a obra", textos);
        Assert.Contains("Actividad realizada: Reunión · Visita a obra", textos);
        var detalles = hilo.EnumerateArray().First(e => e.GetProperty("texto").GetString()!.StartsWith("Actividad programada")).GetProperty("detalles").GetString();
        Assert.Contains("01/12/2026", detalles);
        Assert.Contains("Asignada a: Administrador", detalles);
    }

    [Fact]
    public async Task Seed_crea_root_administrador_y_ventas_con_permisos_validos()
    {
        await using var db = api.Db();
        var roles = await db.Set<Rol>().Where(r => r.OrganizacionId == null).ToListAsync();
        var permisos = await db.Set<RolPermiso>().ToListAsync();
        string[] De(string rol) => [.. permisos.Where(p => p.RolId == roles.Single(r => r.Nombre == rol).Id).Select(p => p.Permiso)];

        Assert.Equal(["*"], De(Seed.RolRoot));
        Assert.All(Seed.Roles.SelectMany(r => r.Permisos), p => Assert.True(Permisos.Valido(p), p));
        // El administrador cubre todo el catálogo: si aparece un módulo nuevo, hay que agregarlo a su rol.
        Assert.All(Permisos.Todos, p => Assert.Contains(De(Seed.RolAdministrador), a => Permisos.Cubre(a, p)));
        Assert.DoesNotContain(De(Seed.RolVentas), p => p.StartsWith("config."));

        var ventas = await api.Empresa(Sureste);
        var correo = $"vend{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Ventas.1", De(Seed.RolVentas), ventas);
        var (c, sesion) = await api.Entrar(correo, "Clave.Ventas.1");
        Assert.Contains("ventas.clientes.*", sesion.GetProperty("permisos").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/v1/clientes")).StatusCode);          // por comodín
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/v1/productos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/productos", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/v1/usuarios")).StatusCode);
    }

    [Fact]
    public async Task Catalogo_y_reemplazo_de_permisos_de_un_rol()
    {
        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var catalogo = (await root.GetFromJsonAsync<JsonElement>("/api/v1/permisos")).EnumerateArray().ToList();
        Assert.Equal("*", catalogo[0].GetProperty("clave").GetString());
        var enviar = catalogo.Single(p => p.GetProperty("clave").GetString() == "ventas.cotizaciones.enviar");
        Assert.Equal("Ventas", enviar.GetProperty("moduloNombre").GetString());
        Assert.Equal("cotizaciones", enviar.GetProperty("recurso").GetString());
        var cot = catalogo.Where(p => p.GetProperty("recurso").GetString() == "cotizaciones").Select(p => p.GetProperty("accion").GetString()).ToList();
        Assert.Equal(["ver", "crear", "editar"], cot[..3]);

        var org = (await api.Empresa(Sureste)).OrganizacionId;
        var rol = (await (await root.PostAsJsonAsync("/api/v1/roles", new { nombre = $"Cobranza {Guid.NewGuid():N}", organizacionId = org }))
            .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await root.PutAsJsonAsync($"/api/v1/roles/{rol}/permisos", new { permisos = new[] { "ventas.*", "no.existe" } })).StatusCode);
        var r = await root.PutAsJsonAsync($"/api/v1/roles/{rol}/permisos", new { permisos = new[] { "ventas.pedidos.*", "ventas.clientes.ver" } });
        Assert.Equal(["ventas.clientes.ver", "ventas.pedidos.*"], await r.Content.ReadFromJsonAsync<string[]>());
        r = await root.PutAsJsonAsync($"/api/v1/roles/{rol}/permisos", new { permisos = new[] { "ventas.pedidos.*" } });
        Assert.Equal(["ventas.pedidos.*"], await r.Content.ReadFromJsonAsync<string[]>());

        var resumen = await root.GetFromJsonAsync<JsonElement>("/api/v1/roles/resumen");
        var mio = resumen.EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == rol);
        Assert.False(mio.GetProperty("sistema").GetBoolean());
        Assert.Equal(0, mio.GetProperty("usuarios").GetInt32());
        var conRol = await api.CrearUsuario($"conrol{Guid.NewGuid():N}@epico.mx", "Clave.Rol.1", [], await api.Empresa(Sureste));
        await using (var db = api.Db())
            await db.Set<Usuario>().Where(u => u.Id == conRol.Id).ExecuteUpdateAsync(u => u.SetProperty(x => x.RolId, rol));
        Assert.Equal(HttpStatusCode.Conflict, (await root.DeleteAsync($"/api/v1/roles/{rol}")).StatusCode); // lo tiene un usuario
        Assert.True(resumen.EnumerateArray().Single(x => x.GetProperty("nombre").GetString() == Seed.RolRoot).GetProperty("usuarios").GetInt32() >= 1);

        // Quien administra roles pero solo tiene ventas.clientes.ver no puede repartir ventas.*.
        var correo = $"roles{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Roles.1", ["config.roles.ver", "config.roles.editar", "ventas.clientes.ver"], await api.Empresa(Sureste));
        var (c, _) = await api.Entrar(correo, "Clave.Roles.1");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PutAsJsonAsync($"/api/v1/roles/{rol}/permisos", new { permisos = new[] { "ventas.*" } })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PutAsJsonAsync($"/api/v1/roles/{rol}/permisos", new { permisos = new[] { "ventas.clientes.ver" } })).StatusCode); // quitaría ventas.pedidos.*
    }

    [Fact]
    public async Task Permisos_por_usuario_agregan_y_quitan_sobre_el_rol()
    {
        var sureste = await api.Empresa(Sureste);
        var adminCorreo = $"padm{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(adminCorreo, "Clave.Admin.1",
            ["config.usuarios.*", "config.accesos.*", "ventas.*", .. Seed.Roles.Single(x => x.Nombre == Seed.RolVentas).Permisos], sureste);
        var (c, _) = await api.Entrar(adminCorreo, "Clave.Admin.1");
        var correo = $"pusr{Guid.NewGuid():N}@epico.mx";
        var u = await api.CrearUsuario(correo, "Clave.Usr.1", ["ventas.*"], sureste);
        Task<HttpResponseMessage> Ajustar(Guid id, string[] agregados, string[] quitados) =>
            c.PutAsJsonAsync($"/api/v1/usuarios/{id}/permisos", new { agregados, quitados });

        var r = await Ajustar(u.Id, ["config.usuarios.ver"], ["ventas.listas_precios.*"]);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var p = await r.Content.ReadFromJsonAsync<JsonElement>();
        string[] Lista(JsonElement x, string campo) => [.. x.GetProperty(campo).EnumerateArray().Select(e => e.GetString()!)];
        Assert.Equal(["ventas.*"], Lista(p, "delRol"));
        var efectivos = Lista(p, "efectivos");
        Assert.Contains("config.usuarios.ver", efectivos);
        Assert.Contains("ventas.clientes.ver", efectivos);
        Assert.DoesNotContain("ventas.listas_precios.ver", efectivos);
        Assert.DoesNotContain("ventas.*", efectivos); // con quitados se expande

        // La sesión trae los efectivos y la API los respeta.
        var (usr, sesion) = await api.Entrar(correo, "Clave.Usr.1");
        Assert.Equal(efectivos.Order(), Lista(sesion, "permisos").Order());
        Assert.Equal(HttpStatusCode.Forbidden, (await usr.GetAsync("/api/v1/listas-precios")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await usr.GetAsync("/api/v1/clientes")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await usr.GetAsync($"/api/v1/usuarios/{u.Id}/permisos")).StatusCode);

        // Reglas: nada ajeno, nada inválido, nada repetido y nadie se cambia a sí mismo.
        Assert.Equal(HttpStatusCode.Forbidden, (await Ajustar(u.Id, ["config.roles.editar"], [])).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Ajustar(u.Id, ["*"], [])).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Ajustar(u.Id, ["nada.de.esto"], [])).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Ajustar(u.Id, ["ventas.clientes.ver"], ["ventas.clientes.ver"])).StatusCode);
        var yo = (await c.GetFromJsonAsync<JsonElement>("/api/v1/me")).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await Ajustar(yo, [], ["ventas.*"])).StatusCode);

        // Queda en el historial y se puede volver a lo del rol.
        await using (var db = api.Db())
            Assert.True(await db.Set<Evento>().AnyAsync(e => e.RegistroTipo == "Usuario" && e.RegistroId == u.Id && e.Texto == "Permisos cambiados"));
        p = await (await Ajustar(u.Id, [], [])).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(["ventas.*"], Lista(p, "efectivos"));

        // Alta ya ajustada.
        await using var d = api.Db();
        var rolVentas = (await d.Set<Rol>().SingleAsync(x => x.Nombre == Seed.RolVentas)).Id;
        var alta = await c.PostAsJsonAsync("/api/v1/usuarios/alta", new
        {
            correo = $"palta{Guid.NewGuid():N}@epico.mx", nombre = "Ana", rolId = rolVentas,
            accesos = new[] { new { empresaId = sureste.Id, sucursalId = (Guid?)null, predeterminado = true } },
            quitados = new[] { "ventas.pedidos.cancelar" },
        });
        Assert.Equal(HttpStatusCode.Created, alta.StatusCode);
        var nuevo = (await alta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var deAlta = await c.GetFromJsonAsync<JsonElement>($"/api/v1/usuarios/{nuevo}/permisos");
        Assert.Equal(["ventas.pedidos.cancelar"], Lista(deAlta, "quitados"));
        Assert.DoesNotContain("ventas.pedidos.cancelar", Lista(deAlta, "efectivos"));
    }

    [Fact]
    public async Task Alta_de_usuario_con_accesos_en_una_transaccion()
    {
        var sureste = await api.Empresa(Sureste);
        var caribe = await api.Empresa(Caribe);
        await using var db = api.Db();
        var rolVentas = (await db.Set<Rol>().SingleAsync(r => r.Nombre == Seed.RolVentas)).Id;
        var rolRoot = (await db.Set<Rol>().SingleAsync(r => r.Nombre == Seed.RolRoot)).Id;

        var adminCorreo = $"adm{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(adminCorreo, "Clave.Admin.1", Seed.Roles.Single(r => r.Nombre == Seed.RolAdministrador).Permisos, sureste);
        var (c, _) = await api.Entrar(adminCorreo, "Clave.Admin.1");

        var correo = $"Nuevo{Guid.NewGuid():N}@Epico.mx";
        object Alta(Guid rol, Guid empresa) => new
        {
            correo, nombre = "Luis", apellidos = "Can", password = "Clave.Nueva.1", rolId = rol,
            accesos = new[] { new { empresaId = empresa, sucursalId = (Guid?)null, predeterminado = true } },
        };
        // Rol con "*" o empresa ajena: 403 y no queda nada creado.
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/usuarios/alta", Alta(rolRoot, sureste.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/usuarios/alta", Alta(rolVentas, caribe.Id))).StatusCode);
        Assert.False(await db.Set<Usuario>().AnyAsync(u => u.Correo == correo.ToLowerInvariant()));

        var r = await c.PostAsJsonAsync("/api/v1/usuarios/alta", Alta(rolVentas, sureste.Id));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var id = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync("/api/v1/usuarios/alta", Alta(rolVentas, sureste.Id))).StatusCode);
        var (nuevo, sesion) = await api.Entrar(correo, "Clave.Nueva.1");
        Assert.Equal(HttpStatusCode.OK, (await nuevo.GetAsync("/api/v1/clientes")).StatusCode);

        var esc = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC")).Id;
        var accesos = await (await c.PutAsJsonAsync($"/api/v1/usuarios/{id}/accesos", new
        {
            accesos = new[] { new { empresaId = sureste.Id, sucursalId = (Guid?)esc, predeterminado = true } },
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(esc, accesos.EnumerateArray().Single().GetProperty("sucursalId").GetGuid());
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PutAsJsonAsync($"/api/v1/usuarios/{id}/accesos", new
        {
            accesos = new[] { new { empresaId = caribe.Id, sucursalId = (Guid?)null, predeterminado = true } },
        })).StatusCode);

        // El rol es del usuario: se cambia en PUT /usuarios/{id}, con las mismas reglas, y cuenta en /roles/resumen.
        var usuario = await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/usuarios/{id}");
        Assert.Equal(rolVentas, usuario!["rolId"].GetGuid());
        usuario["rolId"] = JsonSerializer.SerializeToElement(rolRoot);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PutAsJsonAsync($"/api/v1/usuarios/{id}", usuario)).StatusCode);
        var yo = await c.GetFromJsonAsync<Dictionary<string, JsonElement>>("/api/v1/me");
        yo!["rolId"] = JsonSerializer.SerializeToElement(rolVentas);
        var propio = await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/usuarios/{yo["id"].GetGuid()}");
        propio!["rolId"] = JsonSerializer.SerializeToElement(rolVentas);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PutAsJsonAsync($"/api/v1/usuarios/{yo["id"].GetGuid()}", propio)).StatusCode);
        var resumen = await c.GetFromJsonAsync<JsonElement>("/api/v1/roles/resumen");
        Assert.True(resumen.EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == rolVentas).GetProperty("usuarios").GetInt32() >= 1);
    }

    [Fact]
    public async Task Rol_creado_desde_la_ui_es_de_la_organizacion_y_no_se_vuelve_del_sistema()
    {
        var sureste = await api.Empresa(Sureste);
        var correo = $"rol{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Roles.1", ["config.roles.*"], sureste);
        var (c, sesion) = await api.Entrar(correo, "Clave.Roles.1");
        Assert.Equal(sureste.OrganizacionId, sesion.GetProperty("organizacionId").GetGuid());

        var r = await c.PostAsJsonAsync("/api/v1/roles", new { nombre = $"Consulta {Guid.NewGuid():N}" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var rol = (await r.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>())!;
        Assert.Equal(sureste.OrganizacionId, rol["organizacionId"].GetGuid());

        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var deRoot = await (await root.PostAsJsonAsync("/api/v1/roles", new { nombre = $"Root {Guid.NewGuid():N}" })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(sureste.OrganizacionId, deRoot.GetProperty("organizacionId").GetGuid());

        rol["organizacionId"] = JsonSerializer.SerializeToElement<Guid?>(null);
        var editado = await (await root.PutAsJsonAsync($"/api/v1/roles/{rol["id"].GetGuid()}", rol)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(sureste.OrganizacionId, editado.GetProperty("organizacionId").GetGuid());
    }
}
