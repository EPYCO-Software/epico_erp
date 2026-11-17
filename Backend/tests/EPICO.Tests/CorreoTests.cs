using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using EPICO.Domain.Common;
using EPICO.Domain.Correo;
using EPICO.Infrastructure.Correo;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace EPICO.Tests;

public class CorreoTests(Api api) : IClassFixture<Api>
{
    // Puerto 1 en localhost: conexión rechazada al instante.
    static object Servidor(string? password, string? remitente = "EPICO <ventas@demo.mx>") => new
    {
        nombre = "Ventas", host = "127.0.0.1", puerto = 1, seguridad = "ninguna", usuario = "ventas@demo.mx", password, remitente,
    };

    [Fact]
    public async Task Servidor_de_correo_guarda_la_contrasena_cifrada_y_nunca_la_devuelve()
    {
        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var r = await root.PostAsJsonAsync("/api/v1/servidores-correo", Servidor("secreta"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var json = await r.Content.ReadAsStringAsync();
        Assert.DoesNotContain("secreta", json);
        Assert.DoesNotContain("passwordCifrada", json);
        var x = JsonDocument.Parse(json).RootElement;
        Assert.True(x.GetProperty("tienePassword").GetBoolean());
        var id = x.GetProperty("id").GetGuid();

        await using (var db = api.Db())
        {
            var guardado = await db.Set<ServidorCorreo>().SingleAsync(s => s.Id == id);
            Assert.NotEqual("secreta", guardado.PasswordCifrada);
            Assert.Equal("secreta", api.Services.GetRequiredService<Cifrado>().Descifrar(guardado.PasswordCifrada!));
        }

        // Sin password se conserva; "" la borra.
        var editado = await (await root.PutAsJsonAsync($"/api/v1/servidores-correo/{id}", Servidor(null))).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(editado.GetProperty("tienePassword").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, (await root.PostAsJsonAsync("/api/v1/servidores-correo", Servidor("x", "no-es-correo"))).StatusCode);

        var probar = await root.PostAsync($"/api/v1/servidores-correo/{id}/probar", null);
        Assert.Equal(HttpStatusCode.BadRequest, probar.StatusCode);
        Assert.Contains("No se pudo conectar", await probar.Content.ReadAsStringAsync());

        editado = await (await root.PutAsJsonAsync($"/api/v1/servidores-correo/{id}", Servidor(""))).Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(editado.GetProperty("tienePassword").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await root.PostAsync("/api/v1/servidores-correo/global/probar", null)).StatusCode);
    }

    [Fact]
    public async Task Olvide_y_restablecer_password_con_enlace_de_un_solo_uso()
    {
        var correo = $"olvido{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Vieja.1", [], await api.Empresa("EPICO Concretos del Sureste"));
        var (_, sesion) = await api.Entrar(correo, "Clave.Vieja.1");
        var anon = api.CreateClient();

        Assert.Equal(HttpStatusCode.NoContent, (await anon.PostAsJsonAsync("/api/v1/auth/olvide", new { correo = "nadie@epico.mx" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await anon.PostAsJsonAsync("/api/v1/auth/olvide", new { correo = correo.ToUpperInvariant() })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await anon.PostAsJsonAsync("/api/v1/auth/olvide", new { correo })).StatusCode); // dentro del minuto: no manda otro

        await using var db = api.Db();
        Assert.False(await db.Set<CorreoSaliente>().AnyAsync(c => c.Para == "nadie@epico.mx"));
        var mail = await db.Set<CorreoSaliente>().SingleAsync(c => c.Para == correo);
        Assert.Null(mail.OrganizacionId);
        var token = Regex.Match(mail.Html, "restablecer\\?token=([A-Za-z0-9_-]+)").Groups[1].Value;
        Assert.Equal(43, token.Length);

        object Restablecer(string t) => new { token = t, password = "Clave.Nueva.1" };
        Assert.Equal(HttpStatusCode.BadRequest, (await anon.PostAsJsonAsync("/api/v1/auth/restablecer", Restablecer("otro"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await anon.PostAsJsonAsync("/api/v1/auth/restablecer", Restablecer(token))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anon.PostAsJsonAsync("/api/v1/auth/restablecer", Restablecer(token))).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/v1/auth/login", new { correo, password = "Clave.Vieja.1" })).StatusCode);
        await api.Entrar(correo, "Clave.Nueva.1");
        var refresh = await anon.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = sesion.GetProperty("refreshToken").GetString() });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode); // se cerraron las sesiones
        Assert.True(await db.Set<CorreoSaliente>().AnyAsync(c => c.Para == correo && c.Asunto == "Tu contraseña cambió"));
    }

    [Fact]
    public async Task La_bandeja_reintenta_si_el_servidor_falla_y_marca_fallido_sin_servidor()
    {
        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var servidor = (await (await root.PostAsJsonAsync("/api/v1/servidores-correo", Servidor("x"))).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Guid conServidor, sinServidor;
        await using (var db = api.Db())
        {
            var a = EPICO.Api.Controllers.Plantilla.Crear("a@epico.mx", "Prueba", "Hola");
            a.ServidorId = servidor;
            var b = EPICO.Api.Controllers.Plantilla.Crear("b@epico.mx", "Prueba", "Hola"); // sin organización ni servidor global (Testing)
            db.AddRange(a, b);
            await db.SaveChangesAsync();
            (conServidor, sinServidor) = (a.Id, b.Id);
        }

        await api.Services.GetServices<IHostedService>().OfType<EnvioCorreos>().Single().EnviarPendientesAsync(default);

        await using var d = api.Db();
        var reintento = await d.Set<CorreoSaliente>().SingleAsync(c => c.Id == conServidor);
        Assert.Equal(EstadoCorreo.Pendiente, reintento.Estado);
        Assert.True(reintento.Intentos >= 1);
        Assert.True(reintento.ProximoIntento > DateTime.UtcNow);
        Assert.NotNull(reintento.Error);
        var fallido = await d.Set<CorreoSaliente>().SingleAsync(c => c.Id == sinServidor);
        Assert.Equal(EstadoCorreo.Fallido, fallido.Estado);
        Assert.Contains("Correo__Host", fallido.Error);
    }
}
