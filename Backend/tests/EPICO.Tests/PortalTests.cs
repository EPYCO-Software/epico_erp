using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Api.Controllers;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Tests;

public class PortalTests(Api api) : IClassFixture<Api>
{
    static async Task<Guid> Id(HttpResponseMessage r)
    {
        Assert.True(r.StatusCode == HttpStatusCode.Created, $"{(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    /// <summary>Cliente con su obra y un usuario del portal ligado por un contacto.</summary>
    async Task<(Guid Cliente, Guid Obra, string Correo)> ClienteConPortal(HttpClient root)
    {
        var cliente = await Id(await root.PostAsJsonAsync("/api/v1/clientes", new { nombre = $"Constructora {Guid.NewGuid():N}" }));
        var obra = await Id(await root.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Torre", direccion = "Calle 1" }));
        var correo = $"portal{Guid.NewGuid():N}@cliente.mx";
        await using var db = api.Db();
        var u = new Usuario { Correo = correo, Nombre = "Cliente", Tipo = TipoUsuario.Portal };
        u.PasswordHash = AuthController.Hasher.HashPassword(u, "Portal.123");
        db.Add(u); // genera el Id
        db.Add(new ClienteContacto { ClienteId = cliente, Nombre = "Cliente", UsuarioId = u.Id });
        await db.SaveChangesAsync();
        return (cliente, obra, correo);
    }

    static object Partida(DateTime entrega, decimal? precio = null) => new
    {
        nombre = "Losa", tipoResistencia = "fc", resistenciaKgCm2 = 200, edadDias = 7, revenimientoCm = 14, tmaMm = 20,
        cemento = "CPC 30R", exposicion = "normal", colocacion = "directa", volumenM3 = 6, precioM3 = precio, entrega,
    };

    [Fact]
    public async Task Portal_pide_pedido_especial_sin_tarifa()
    {
        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var (cliente, obra, correo) = await ClienteConPortal(root);
        var (p, _) = await api.Entrar(correo, "Portal.123", "portal");
        Guid esc;
        await using (var db = api.Db())
        {
            esc = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC")).Id;
            // Con vendedor, el aviso le llega a él (sin vendedor iría a los de la empresa, que dependen de otros tests).
            var vendedor = await db.Set<Usuario>().Where(u => u.Correo == Api.Root).Select(u => u.Id).SingleAsync();
            await db.Set<Cliente>().Where(x => x.Id == cliente).ExecuteUpdateAsync(x => x.SetProperty(y => y.VendedorId, vendedor));
        }
        var entrega = DateTime.UtcNow.AddDays(5);
        object Pedir(bool especial) => new
        {
            sucursalId = esc, obraId = obra, partidas = new[] { new
            {
                nombre = "Muro", tipoResistencia = "mr", resistenciaKgCm2 = 50, edadDias = 28, revenimientoCm = 10, tmaMm = 20,
                cemento = "CPC 30R", exposicion = "normal", colocacion = "directa", volumenM3 = 6, entrega, especial,
            } },
        };

        Assert.Equal(HttpStatusCode.BadRequest, (await p.PostAsJsonAsync("/api/v1/portal/cotizaciones", Pedir(false))).StatusCode);
        var r = await p.PostAsJsonAsync("/api/v1/portal/cotizaciones", Pedir(true));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var cot = await r.Content.ReadFromJsonAsync<JsonElement>();
        var partida = cot.GetProperty("partidas")[0];
        Assert.True(partida.GetProperty("especial").GetBoolean());
        Assert.Equal(JsonValueKind.Null, partida.GetProperty("precioM3").ValueKind);
        Assert.Equal(0m, cot.GetProperty("total").GetDecimal());
        var folio = cot.GetProperty("folio").GetString()!;
        await using (var db = api.Db())
            Assert.EndsWith("(incluye pedido especial)", (await db.Set<Notificacion>().SingleAsync(n => n.Texto.StartsWith(folio))).Texto);
    }

    [Fact]
    public async Task Portal_solo_ve_lo_de_su_cliente_y_cotiza_con_tarifa()
    {
        var (root, _) = await api.Entrar(Api.Root, Api.RootPassword);
        var (cliente, obra, correo) = await ClienteConPortal(root);
        var (otro, obraOtro, _) = await ClienteConPortal(root);
        Guid esc;
        await using (var db = api.Db())
            esc = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC")).Id;

        // Sesión: trae su cliente, sin permisos, con empresas y plantas para cotizar.
        var (p, sesion) = await api.Entrar(correo, "Portal.123", "portal");
        Assert.Equal(cliente, sesion.GetProperty("cliente").GetProperty("id").GetGuid());
        Assert.Equal(0, sesion.GetProperty("permisos").GetArrayLength());
        Assert.Contains(sesion.GetProperty("empresas").EnumerateArray(), e => e.GetProperty("plantas").GetArrayLength() > 0);

        // Candado: el portal no entra al ERP y el ERP no entra al portal.
        Assert.Equal(HttpStatusCode.Forbidden, (await p.GetAsync("/api/v1/clientes")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await p.GetAsync("/api/v1/usuarios/resumen")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await root.GetAsync("/api/v1/portal/perfil")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await p.GetAsync("/api/v1/me")).StatusCode);
        var perfil = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/perfil");
        Assert.Equal(cliente, perfil.GetProperty("cliente").GetProperty("id").GetGuid());

        // Obras: solo las suyas; ni la del otro cliente (aunque mande su clienteId) ni las generales.
        var general = await Id(await root.PostAsJsonAsync("/api/v1/obras", new { nombre = "Patio general", direccion = "x" }));
        Assert.Equal(HttpStatusCode.NotFound, (await p.GetAsync($"/api/v1/portal/obras/{general}")).StatusCode);
        var obras = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/obras");
        Assert.Equal([obra], obras.EnumerateArray().Select(o => o.GetProperty("id").GetGuid()));
        Assert.Equal(HttpStatusCode.NotFound, (await p.GetAsync($"/api/v1/portal/obras/{obraOtro}")).StatusCode);
        var nueva = await Id(await p.PostAsJsonAsync("/api/v1/portal/obras", new { clienteId = otro, nombre = "Bodega", direccion = "Calle 2" }));
        await using (var db = api.Db())
            Assert.Equal(cliente, (await db.Set<Obra>().SingleAsync(o => o.Id == nueva)).ClienteId);

        // Datos fiscales: un solo predeterminado.
        object Fiscal(string rfc) => new { alias = rfc, razonSocial = "Constructora SA", rfc, regimenFiscal = "601", usoCfdi = "G03", codigoPostal = "24000", predeterminado = true };
        var f1 = await Id(await p.PostAsJsonAsync("/api/v1/portal/datos-fiscales", Fiscal("CON010101AB1")));
        await Id(await p.PostAsJsonAsync("/api/v1/portal/datos-fiscales", Fiscal("CON010101AB2")));
        var fiscales = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/datos-fiscales");
        Assert.Single(fiscales.EnumerateArray(), d => d.GetProperty("predeterminado").GetBoolean());

        // Archivos: a sus registros sí, a los del otro no.
        HttpContent Pdf(string tipo, Guid id) => new MultipartFormDataContent
        {
            { new ByteArrayContent("%PDF-1.4"u8.ToArray()), "archivo", "constancia.pdf" },
            { new StringContent(tipo), "registroTipo" }, { new StringContent(id.ToString()), "registroId" },
            { new StringContent("constancia"), "categoria" },
        };
        var archivo = await Id(await p.PostAsync("/api/v1/portal/archivos", Pdf("ClienteDatoFiscal", f1)));
        Assert.Equal(HttpStatusCode.NotFound, (await p.PostAsync("/api/v1/portal/archivos", Pdf("Obra", obraOtro))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await p.GetAsync($"/api/v1/portal/archivos/{archivo}")).StatusCode);
        Assert.Single((await p.GetFromJsonAsync<JsonElement>($"/api/v1/portal/archivos/registro/ClienteDatoFiscal/{f1}")).EnumerateArray());

        // Catálogo.
        var catalogo = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/catalogo");
        Assert.True(catalogo.GetProperty("productos").GetArrayLength() > 0);
        Assert.Contains(catalogo.GetProperty("plantas").EnumerateArray(), x => x.GetProperty("id").GetGuid() == esc);
        Assert.Equal(0.16m, catalogo.GetProperty("iva").GetDecimal());

        // Cotización: el precio que mande el cliente se ignora; entra recibida y de origen portal.
        var entrega = DateTime.UtcNow.AddDays(5);
        var r = await p.PostAsJsonAsync("/api/v1/portal/cotizaciones",
            new { sucursalId = esc, clienteId = otro, obraId = obra, descuentoPct = 50, partidas = new[] { Partida(entrega, 1) } });
        var cot = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal(("recibida", "portal", cliente), (cot.GetProperty("estado").GetString(), cot.GetProperty("origen").GetString(), cot.GetProperty("clienteId").GetGuid()));
        Assert.NotEqual(1m, cot.GetProperty("partidas")[0].GetProperty("precioM3").GetDecimal());
        Assert.Equal(0m, cot.GetProperty("descuento").GetDecimal());
        var id = cot.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Conflict, (await p.PostAsync($"/api/v1/portal/cotizaciones/{id}/aceptar", null)).StatusCode);

        // Una del otro cliente no se ve ni sirve de base; un borrador propio tampoco se ve.
        var deOtro = await Id(await root.PostAsJsonAsync("/api/v1/cotizaciones",
            new { sucursalId = esc, clienteId = otro, obraId = obraOtro, partidas = new[] { Partida(entrega) } }));
        var borrador = await Id(await root.PostAsJsonAsync("/api/v1/cotizaciones",
            new { sucursalId = esc, clienteId = cliente, obraId = obra, partidas = new[] { Partida(entrega) } }));
        Assert.Equal(HttpStatusCode.NotFound, (await p.GetAsync($"/api/v1/portal/cotizaciones/{deOtro}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await p.PostAsJsonAsync("/api/v1/portal/cotizaciones",
            new { sucursalId = esc, obraId = obra, baseId = deOtro, partidas = new[] { Partida(entrega) } })).StatusCode);
        var mias = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/cotizaciones");
        Assert.Equal([id], mias.GetProperty("items").EnumerateArray().Select(c => c.GetProperty("id").GetGuid()));
        Assert.Equal(1, mias.GetProperty("items")[0].GetProperty("partidas").GetArrayLength());

        // El asesor la envía y el cliente la acepta: pedidos con cobro pendiente y la obra queda bloqueada.
        Assert.Equal(HttpStatusCode.OK, (await root.PostAsync($"/api/v1/cotizaciones/{id}/enviar", null)).StatusCode);
        var aceptada = await p.PostAsync($"/api/v1/portal/cotizaciones/{id}/aceptar", null);
        Assert.Equal(HttpStatusCode.OK, aceptada.StatusCode);
        var pedido = (await aceptada.Content.ReadFromJsonAsync<JsonElement>())[0];
        Assert.Equal(obra, pedido.GetProperty("obra").GetProperty("id").GetGuid());
        Assert.Equal(pedido.GetProperty("cobro").GetProperty("total").GetDecimal(), pedido.GetProperty("cobro").GetProperty("pendiente").GetDecimal());
        Assert.Equal(HttpStatusCode.Conflict, (await p.PutAsJsonAsync($"/api/v1/portal/obras/{obra}", new { nombre = "Torre B", direccion = "Calle 1" })).StatusCode);

        var pedidos = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/pedidos");
        Assert.Equal(1, pedidos.GetProperty("total").GetInt32());
        var pid = pedidos.GetProperty("items")[0].GetProperty("id").GetGuid();
        await Id(await root.PostAsJsonAsync("/api/v1/remisiones", new { pedidoId = pid, volumenM3 = 6, estado = "en_ruta" }));
        var viajes = await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/remisiones");
        Assert.Equal("en_ruta", viajes.GetProperty("items").EnumerateArray().Single().GetProperty("estado").GetString());
        Assert.Equal(1, (await p.GetFromJsonAsync<JsonElement>($"/api/v1/portal/pedidos/{pid}")).GetProperty("remisiones").GetArrayLength());

        // Diseños guardados.
        var diseno = await Id(await p.PostAsJsonAsync("/api/v1/portal/disenos",
            new { nombre = "Losa 200", solucionId = "losa", especificacion = new { fc = 200 }, favorito = true }));
        Assert.Equal(HttpStatusCode.NoContent, (await p.DeleteAsync($"/api/v1/portal/disenos/{diseno}")).StatusCode);
        Assert.Equal(0, (await p.GetFromJsonAsync<JsonElement>("/api/v1/portal/disenos")).GetArrayLength());
    }

    [Fact]
    public async Task Portal_sin_cliente_no_entra()
    {
        var correo = $"suelto{Guid.NewGuid():N}@cliente.mx";
        await using (var db = api.Db())
        {
            var u = new Usuario { Correo = correo, Nombre = "Suelto", Tipo = TipoUsuario.Portal };
            u.PasswordHash = AuthController.Hasher.HashPassword(u, "Portal.123");
            db.Add(u);
            await db.SaveChangesAsync();
        }
        var r = await api.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { correo, password = "Portal.123", app = "portal" });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }
}
