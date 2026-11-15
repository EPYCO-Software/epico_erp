using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Tests;

public class VentasTests(Api api) : IClassFixture<Api>
{
    static readonly string Año = DateTime.UtcNow.ToString("yy");

    async Task<(HttpClient C, Guid Esc, Guid Cliente, Guid Obra, Dictionary<string, Guid> Prod)> Preparar()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        await using var db = api.Db();
        var esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
        var prod = await db.Set<Producto>().ToDictionaryAsync(p => p.Codigo, p => p.Id);
        var cliente = await Crear(c, "/api/v1/clientes", new { nombre = $"Constructora {Guid.NewGuid():N}" });
        var obra = await Crear(c, "/api/v1/obras", new { clienteId = cliente, nombre = "Torre Norte", direccion = "Calle 1, Escárcega" });
        return (c, esc.Id, cliente, obra, prod);
    }

    static async Task<Guid> Crear(HttpClient c, string ruta, object cuerpo)
    {
        var r = await c.PostAsJsonAsync(ruta, cuerpo);
        Assert.True(r.StatusCode == HttpStatusCode.Created, $"{ruta}: {(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    static object Cotizacion(Guid sucursal, Guid cliente, Guid obra, Dictionary<string, Guid> prod) => new
    {
        sucursalId = sucursal,
        clienteId = cliente,
        obraId = obra,
        descuentoPct = 10,
        partidas = new object[]
        {
            new
            {
                nombre = "Losa de cimentación", tipoResistencia = "fc", resistenciaKgCm2 = 200, edadDias = 7, revenimientoCm = 14,
                tmaMm = 20, cemento = "CPC 30R", exposicion = "normal", colocacion = "bombeo", aditivos = new[] { "fibra-sintetica" },
                volumenM3 = 8, entrega = DateTime.UtcNow.AddDays(3),
                trasladoDistanciaKm = 34.56, trasladoIncluidosKm = 20, trasladoPrecioKm = 12,
                lineas = new object[]
                {
                    new { productoId = prod["SRV-BOMBA-ESTACIONARIA"], cantidad = 6 },   // se cobra el mínimo: 10 m³
                    new { productoId = prod["REN-VIBRADOR"], cantidad = 1, dias = 2 },
                },
            },
            new
            {
                nombre = "Pavimento", tipoResistencia = "mr", resistenciaKgCm2 = 45, edadDias = 28, revenimientoCm = 10,
                tmaMm = 40, cemento = "CPC 40", exposicion = "normal", colocacion = "directa", volumenM3 = 5, precioM3 = 4000,
                entrega = DateTime.UtcNow.AddDays(4),
            },
        },
    };

    [Fact]
    public void Calculo_igual_que_el_front()
    {
        Assert.Equal(14.6m, Calculo.KmExtra(34.56m, 20));
        Assert.Equal(0, Calculo.KmExtra(18, 20));
        Assert.Equal(175.2m, Calculo.TrasladoM3(new CotizacionPartida { TrasladoDistanciaKm = 34.56m, TrasladoIncluidosKm = 20, TrasladoPrecioKm = 12 }));
        Assert.Equal(0, Calculo.TrasladoM3(new CotizacionPartida { TrasladoDistanciaKm = 50, TrasladoIncluidosKm = 20, TrasladoPrecioKm = 0 }));
        Assert.Equal(0.01m, Calculo.R(0.005m)); // centavos hacia arriba, como Math.round
    }

    [Fact]
    public async Task Cotizacion_calcula_tarifa_minimos_traslado_descuento_e_iva()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var r = await c.PostAsJsonAsync("/api/v1/cotizaciones", Cotizacion(esc, cliente, obra, prod));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var cot = await r.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Matches($"^EPI-PRES-ESC-{Año}\\d{{3}}$", cot.GetProperty("folio").GetString());
        Assert.Equal("borrador", cot.GetProperty("estado").GetString());
        var p1 = cot.GetProperty("partidas")[0];
        Assert.Equal(4150m, p1.GetProperty("precioM3").GetDecimal());            // 3700 f´c 200 + 300 a 7 días + 150 fibra
        Assert.Equal(10m, p1.GetProperty("lineas")[0].GetProperty("cantidad").GetDecimal());
        Assert.Equal(1200m, p1.GetProperty("lineas")[1].GetProperty("importe").GetDecimal());
        // 33200 + 1401.60 traslado + 5000 bombeo + 1200 vibrador + 20000 pavimento
        Assert.Equal(60801.60m, cot.GetProperty("subtotal").GetDecimal());
        Assert.Equal(6080.16m, cot.GetProperty("descuento").GetDecimal());
        Assert.Equal(8755.43m, cot.GetProperty("iva").GetDecimal());
        Assert.Equal(63476.87m, cot.GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task Enviada_no_se_edita_se_revisa_y_al_confirmar_genera_un_pedido_por_partida()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var cuerpo = Cotizacion(esc, cliente, obra, prod);
        var id = await Crear(c, "/api/v1/cotizaciones", cuerpo);
        var folio = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/cotizaciones/{id}")).GetProperty("folio").GetString();

        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/v1/cotizaciones/{id}/enviar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PutAsJsonAsync($"/api/v1/cotizaciones/{id}", cuerpo)).StatusCode);

        var revision = await c.PostAsJsonAsync("/api/v1/cotizaciones", new Dictionary<string, object?>(
            JsonSerializer.Deserialize<Dictionary<string, object?>>(JsonSerializer.Serialize(cuerpo))!) { ["revisionDeId"] = id });
        var rev = await revision.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal($"{folio}-R1", rev.GetProperty("folio").GetString());
        Assert.Equal(folio, rev.GetProperty("serie").GetString());

        var r = await c.PostAsync($"/api/v1/cotizaciones/{id}/confirmar", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var pedidos = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, pedidos.GetArrayLength());
        var p1 = pedidos[0];
        Assert.Matches($"^PED-ESC-{Año}-\\d{{3}}$", p1.GetProperty("folio").GetString());
        Assert.Equal(4, p1.GetProperty("lineas").GetArrayLength());               // concreto, traslado, bombeo, vibrador
        Assert.Equal(40801.60m, p1.GetProperty("subtotal").GetDecimal());
        Assert.Equal(4080.16m, p1.GetProperty("descuento").GetDecimal());         // su parte del 10 %
        Assert.Equal("por_cobrar", p1.GetProperty("cobro").GetString());
        Assert.Equal("pedido", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/cotizaciones/{id}")).GetProperty("estado").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsync($"/api/v1/cotizaciones/{id}/confirmar", null)).StatusCode);
    }

    [Fact]
    public async Task Pedido_directo_planta_cobro_y_filtros()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var entrega = DateTime.UtcNow.AddDays(2);
        var id = await Crear(c, "/api/v1/pedidos", new
        {
            sucursalId = esc, clienteId = cliente, obraId = obra, fechaHoraEntrega = entrega, metodoPago = "transferencia", descuentoPct = 0,
            lineas = new[] { new { productoId = prod["CON-FC-250"], cantidad = 7 } },
        });
        var pedido = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{id}");
        Assert.Equal(27650m, pedido.GetProperty("subtotal").GetDecimal());
        Assert.Equal(32074m, pedido.GetProperty("total").GetDecimal());

        async Task<HttpResponseMessage> Planta(object cuerpo) => await c.PostAsJsonAsync($"/api/v1/pedidos/{id}/planta", cuerpo);
        Assert.Equal(HttpStatusCode.Conflict, (await Planta(new { accion = "confirmar" })).StatusCode);   // aún no se envía
        Assert.Equal(HttpStatusCode.OK, (await Planta(new { accion = "enviar" })).StatusCode);
        var nueva = entrega.AddHours(5);
        Assert.Equal(HttpStatusCode.OK, (await Planta(new { accion = "actualizacion", fecha = nueva, nota = "Sin camiones" })).StatusCode);
        var r = await Planta(new { accion = "aceptar_actualizacion" });
        var aceptado = await r.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("confirmado", aceptado.GetProperty("estatusPlanta").GetString());
        Assert.Equal(nueva, aceptado.GetProperty("fechaHoraEntrega").GetDateTime(), TimeSpan.FromSeconds(1));

        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/v1/pedidos/{id}/cobro", new { valor = "regalado" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"/api/v1/pedidos/{id}/cobro", new { valor = "por_facturar" })).StatusCode);

        var porFacturar = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos?cobro=por_facturar&clienteId={cliente}");
        Assert.Equal(id, porFacturar.EnumerateArray().Single().GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/pedidos?cobro=xyz")).StatusCode);

        var hilo = await c.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Pedido/{id}");
        Assert.Contains(hilo.EnumerateArray().SelectMany(e => e.GetProperty("cambios").EnumerateArray()),
            x => x.GetProperty("campo").GetString() == "Cobro" && x.GetProperty("valorNuevo").GetString() == "por_facturar");
    }

    [Fact]
    public async Task Cliente_restringido_a_otra_empresa_no_se_ve_ni_sus_obras()
    {
        var (root, _, _, _, _) = await Preparar();
        var caribe = await api.Empresa("EPICO Concretos del Caribe");
        var cliente = await Crear(root, "/api/v1/clientes", new { nombre = "Solo Caribe", empresaRestringidaId = caribe.Id });
        var obra = await Crear(root, "/api/v1/obras", new { clienteId = cliente, nombre = "Hotel", direccion = "Cancún" });

        await api.CrearUsuario($"ventas{Guid.NewGuid():N}@prueba.mx", "Ventas.123", ["ventas.clientes.ver", "ventas.clientes.crear"],
            await api.Empresa("EPICO Concretos del Sureste"));
        await using var db = api.Db();
        var correo = (await db.Set<Usuario>().OrderByDescending(u => u.CreatedAt).FirstAsync()).Correo;
        var (c, _) = await api.Entrar(correo, "Ventas.123");

        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/clientes/{cliente}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/obras/{obra}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Colada", direccion = "x" })).StatusCode);
    }

    [Fact]
    public async Task Movimientos_suman_la_existencia()
    {
        var (c, esc, _, _, prod) = await Preparar();
        var producto = prod["AJ-CEM-RS"];
        await c.PostAsJsonAsync("/api/v1/movimientos-inventario", new { productoId = producto, sucursalId = esc, tipo = "entrada", cantidad = 10 });
        await c.PostAsJsonAsync("/api/v1/movimientos-inventario", new { productoId = producto, sucursalId = esc, tipo = "salida", cantidad = 3 });
        var existencias = await c.GetFromJsonAsync<JsonElement>($"/api/v1/existencias?productoId={producto}&sucursalId={esc}");
        Assert.Equal(7m, existencias[0].GetProperty("cantidad").GetDecimal());
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/v1/existencias", new { productoId = producto, sucursalId = esc, cantidad = 99 })).StatusCode);
    }

    [Fact]
    public async Task Seed_trae_tarifario_iva_y_secuencias()
    {
        await using var db = api.Db();
        Assert.Equal(30, await db.Set<Producto>().CountAsync());
        Assert.Equal(0.16m, (await db.Set<Impuesto>().SingleAsync()).Tasa);
        Assert.Equal(12, await db.Set<Secuencia>().CountAsync(s => s.Tipo != "prueba"));
        Assert.Equal(10m, (await db.Set<Producto>().SingleAsync(p => p.Codigo == "SRV-BOMBA-ESTACIONARIA")).MinimoCobro);
    }
}
