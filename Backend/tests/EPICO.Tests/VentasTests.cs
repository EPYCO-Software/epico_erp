using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
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
                tmaMm = 20, cemento = "CPC 30R", exposicion = "normal", colocacion = "bombeable", aditivos = new[] { "fibra-sintetica" },
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
    public async Task Lugar_de_entrega_sin_obra_llega_al_pedido()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        System.Text.Json.Nodes.JsonObject Con(Guid? obraId, string? direccion, string? municipio)
        {
            var j = JsonSerializer.SerializeToNode(Cotizacion(esc, cliente, obra, prod))!.AsObject();
            (j["obraId"], j["entregaDireccion"], j["entregaMunicipio"]) = (obraId, direccion, municipio);
            if (direccion is not null) (j["entregaReferencias"], j["entregaLat"], j["entregaLng"]) = ("Portón verde", 21.0237m, -89.5794m);
            return j;
        }
        async Task Error(HttpResponseMessage r, string mensaje)
        {
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains(mensaje, await r.Content.ReadAsStringAsync());
        }

        await Error(await c.PostAsJsonAsync("/api/v1/cotizaciones", Con(obra, "Calle 1", "Mérida")), "no los dos");
        await Error(await c.PostAsJsonAsync("/api/v1/cotizaciones", Con(null, "Calle 1", " ")), "Falta la dirección o el municipio");

        // Sin ninguno se puede armar, pero no enviar.
        var vacia = await Crear(c, "/api/v1/cotizaciones", Con(null, null, null));
        await Error(await c.PostAsync($"/api/v1/cotizaciones/{vacia}/enviar", null), "no tiene obra ni lugar de entrega");

        var id = await Crear(c, "/api/v1/cotizaciones", Con(null, " Calle 60 #500 ", "Mérida"));
        var cot = await c.GetFromJsonAsync<JsonElement>($"/api/v1/cotizaciones/{id}");
        Assert.Equal("Calle 60 #500", cot.GetProperty("entregaDireccion").GetString());
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/v1/cotizaciones/{id}/enviar", null)).StatusCode);
        var pedidos = await (await c.PostAsync($"/api/v1/cotizaciones/{id}/confirmar", null)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.All(pedidos.EnumerateArray(), p =>
        {
            Assert.Equal(JsonValueKind.Null, p.GetProperty("obraId").ValueKind);
            Assert.Equal("Mérida", p.GetProperty("entregaMunicipio").GetString());
            Assert.Equal(21.0237m, p.GetProperty("entregaLat").GetDecimal());
        });

        // Orden directa: obra o lugar, obligatorio.
        object Directo(Guid? obraId, string? direccion) => new
        {
            sucursalId = esc, clienteId = cliente, obraId, fechaHoraEntrega = DateTime.UtcNow.AddDays(2), metodoPago = "transferencia",
            descuentoPct = 0, lineas = new[] { new { productoId = prod["CON-FC-250"], cantidad = 7 } },
            entregaDireccion = direccion, entregaMunicipio = direccion is null ? null : "Umán",
        };
        await Error(await c.PostAsJsonAsync("/api/v1/pedidos", Directo(null, null)), "El pedido no tiene obra ni lugar de entrega");
        await Error(await c.PostAsJsonAsync("/api/v1/pedidos", Directo(obra, "Km 18")), "no los dos");
        var directo = await Crear(c, "/api/v1/pedidos", Directo(null, "Km 18"));
        Assert.Equal("Km 18", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{directo}")).GetProperty("entregaDireccion").GetString());
    }

    [Fact]
    public void Soluciones_sugeridas_por_resistencia()
    {
        Assert.Equal(["pavimento"], Soluciones.Sugeridas("MR45"));
        Assert.Equal(["firmes", "relleno"], Soluciones.Sugeridas("100").Order());
        Assert.Equal(["cimentacion", "firmes", "losa"], Soluciones.Sugeridas("200").Order());
        Assert.Equal(["columnas", "losa", "pavimento"], Soluciones.Sugeridas("300").Order());
        Assert.Equal(["especial"], Soluciones.Sugeridas("400"));
        Assert.Empty(Soluciones.Sugeridas(null));
    }

    [Fact]
    public async Task Productos_con_soluciones_se_filtran_y_validan()
    {
        var (c, _, _, _, prod) = await Preparar();
        async Task<string[]> Codigos(string solucion) =>
            [.. (await c.GetFromJsonAsync<JsonElement>($"/api/v1/productos?take=500&solucion={solucion}")).EnumerateArray()
                .Select(p => p.GetProperty("codigo").GetString()!)];
        Assert.Contains("CON-MR-45", await Codigos("pavimento"));
        Assert.Contains("CON-FC-300", await Codigos("pavimento"));
        Assert.DoesNotContain("CON-FC-200", await Codigos("pavimento"));
        Assert.Equal(["CON-FC-400"], (await Codigos("especial")).Where(x => x.StartsWith("CON-")));

        var p = (await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/productos/{prod["CON-FC-250"]}"))!;
        async Task<HttpResponseMessage> Poner(Dictionary<string, JsonElement> x, string[] sol)
        {
            x["soluciones"] = JsonSerializer.SerializeToElement(sol);
            return await c.PutAsJsonAsync($"/api/v1/productos/{x["id"].GetGuid()}", x);
        }
        var r = await Poner(p, ["losa", "puente"]);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("Solución desconocida: puente", await r.Content.ReadAsStringAsync());
        r = await Poner(p, [" Losa ", "especial", "losa"]);
        Assert.Equal(["losa", "especial"], (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("soluciones").EnumerateArray().Select(x => x.GetString()));
        var hilo = await c.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Producto/{prod["CON-FC-250"]}");
        Assert.Contains(hilo.EnumerateArray().SelectMany(e => e.GetProperty("cambios").EnumerateArray()),
            x => x.GetProperty("etiqueta").GetString() == "Soluciones" && x.GetProperty("valorNuevo").GetString() == "losa, especial");
        Assert.Equal(HttpStatusCode.OK, (await Poner(p, [.. Soluciones.Sugeridas("250")])).StatusCode);

        var bomba = (await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/productos/{prod["SRV-BOMBA-ESTACIONARIA"]}"))!;
        r = await Poner(bomba, ["losa"]);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("Solo los concretos llevan soluciones", await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Pedido_especial_se_guarda_sin_precio_y_se_cotiza_antes_de_confirmar()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var j = JsonSerializer.SerializeToNode(Cotizacion(esc, cliente, obra, prod))!.AsObject();
        var partida = j["partidas"]![0]!.AsObject();
        partida["resistenciaKgCm2"] = 275; // no hay CON-FC-275

        var r = await c.PostAsJsonAsync("/api/v1/cotizaciones", j);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("No hay tarifa", await r.Content.ReadAsStringAsync());

        partida["especial"] = true;
        var id = await Crear(c, "/api/v1/cotizaciones", j);
        var cot = await c.GetFromJsonAsync<JsonElement>($"/api/v1/cotizaciones/{id}");
        var p0 = cot.GetProperty("partidas")[0];
        Assert.True(p0.GetProperty("especial").GetBoolean());
        Assert.Equal(JsonValueKind.Null, p0.GetProperty("precioM3").ValueKind);
        Assert.Equal(JsonValueKind.Null, p0.GetProperty("productoId").ValueKind);
        Assert.True(cot.GetProperty("total").GetDecimal() > 0); // las demás partidas y servicios sí cuentan

        r = await c.PostAsync($"/api/v1/cotizaciones/{id}/enviar", null);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("pedido especial sin precio", await r.Content.ReadAsStringAsync());

        // El vendedor la cotiza: sigue especial, ya se envía y al confirmar genera su pedido.
        partida["precioM3"] = 3500;
        r = await c.PutAsJsonAsync($"/api/v1/cotizaciones/{id}", j);
        Assert.True(r.StatusCode == HttpStatusCode.OK, await r.Content.ReadAsStringAsync());
        cot = await c.GetFromJsonAsync<JsonElement>($"/api/v1/cotizaciones/{id}");
        Assert.True(cot.GetProperty("partidas")[0].GetProperty("especial").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/v1/cotizaciones/{id}/enviar", null)).StatusCode);
        var pedidos = await (await c.PostAsync($"/api/v1/cotizaciones/{id}/confirmar", null)).Content.ReadFromJsonAsync<JsonElement>();
        var linea = pedidos[0].GetProperty("lineas")[0];
        Assert.StartsWith("Pedido especial", linea.GetProperty("descripcion").GetString());
        Assert.Equal(3500m, linea.GetProperty("precioUnitario").GetDecimal());
        await using var db = api.Db();
        Assert.Equal(VentasServicio.CodigoEspecial, (await db.Set<Producto>().SingleAsync(x => x.Id == linea.GetProperty("productoId").GetGuid())).Codigo);
    }

    [Fact]
    public async Task Aditivos_son_productos_y_la_cotizacion_solo_acepta_los_activos()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        Guid aditivo, unidad;
        await using (var db = api.Db())
        {
            aditivo = (await db.Set<CategoriaProducto>().SingleAsync(x => x.Clave == "aditivo")).Id;
            Assert.Equal(aditivo, (await db.Set<Producto>().SingleAsync(x => x.Codigo == "AJ-ADT-RETARDANTE")).CategoriaId);
            unidad = (await db.Set<UnidadMedida>().SingleAsync(x => x.Clave == "M3")).Id;
        }
        object Aditivo(string codigo) => new
        {
            categoriaId = aditivo, tipo = "concreto", codigo, nombre = "Superplastificante", unidadId = unidad, precioLista = 150,
        };
        var r = await c.PostAsJsonAsync("/api/v1/productos", Aditivo("ADT-SUPER"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("AJ-ADT-", await r.Content.ReadAsStringAsync());
        var clave = $"SUPER-{Guid.NewGuid():N}"[..14].ToUpperInvariant();
        await Crear(c, "/api/v1/productos", Aditivo($"AJ-ADT-{clave}"));

        // La cotización cobra el aditivo nuevo (clave en minúsculas, como la manda el front) y rechaza uno que no existe.
        var j = JsonSerializer.SerializeToNode(Cotizacion(esc, cliente, obra, prod))!.AsObject();
        j["partidas"]![0]!["aditivos"] = new System.Text.Json.Nodes.JsonArray("fibra-sintetica", clave.ToLowerInvariant());
        await Crear(c, "/api/v1/cotizaciones", j);
        j["partidas"]![0]!["aditivos"] = new System.Text.Json.Nodes.JsonArray("nada");
        r = await c.PostAsJsonAsync("/api/v1/cotizaciones", j);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("no está en tus productos", await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Cliente_en_uso_o_publico_general_no_se_borra()
    {
        var (c, _, cliente, _, _) = await Preparar(); // tiene una obra
        var r = await c.DeleteAsync($"/api/v1/clientes/{cliente}");
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Contains("lo usan cotizaciones, pedidos u obras", await r.Content.ReadAsStringAsync());
        var publico = await Crear(c, "/api/v1/clientes", new { nombre = $"Público {Guid.NewGuid():N}", esPublicoGeneral = true });
        Assert.Equal(HttpStatusCode.Conflict, (await c.DeleteAsync($"/api/v1/clientes/{publico}")).StatusCode);
        var libre = await Crear(c, "/api/v1/clientes", new { nombre = $"Libre {Guid.NewGuid():N}" });
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/clientes/{libre}")).StatusCode);
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
        Assert.Equal(id, porFacturar.GetProperty("items").EnumerateArray().Single().GetProperty("id").GetGuid());
        Assert.Equal(1, porFacturar.GetProperty("total").GetInt32());
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

        await api.CrearUsuario($"ventas{Guid.NewGuid():N}@prueba.mx", "Ventas.123", ["ventas.clientes.ver", "ventas.clientes.crear", "ventas.obras.ver", "ventas.obras.crear"],
            await api.Empresa("EPICO Concretos del Sureste"));
        await using var db = api.Db();
        var correo = (await db.Set<Usuario>().OrderByDescending(u => u.CreatedAt).FirstAsync()).Correo;
        var (c, _) = await api.Entrar(correo, "Ventas.123");

        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/clientes/{cliente}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/v1/obras/{obra}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Colada", direccion = "x" })).StatusCode);
    }

    [Fact]
    public async Task Obras_generales_se_filtran_cambian_de_cliente_y_no_se_borran_en_uso()
    {
        var (c, esc, cliente, obraCliente, prod) = await Preparar();
        var marca = Guid.NewGuid().ToString("N")[..10];
        var general = await Crear(c, "/api/v1/obras", new { nombre = $"Banco {marca}", direccion = "Km 12", municipio = "Umán" });

        async Task<Guid[]> Ids(string query) =>
            [.. (await c.GetFromJsonAsync<JsonElement>($"/api/v1/obras?take=500&{query}")).EnumerateArray().Select(o => o.GetProperty("id").GetGuid())];
        Assert.Equal([general], await Ids($"sinCliente=true&q={marca.ToUpper()}"));
        Assert.Empty(await Ids($"sinCliente=false&q={marca}"));
        Assert.Equal([obraCliente], await Ids($"clienteId={cliente}"));

        // Pasa a un cliente (sale en el hilo del cliente) y de vuelta a general; el cambio queda en su propio hilo.
        var o = (await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/obras/{general}"))!;
        o["clienteId"] = JsonSerializer.SerializeToElement(cliente);
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync($"/api/v1/obras/{general}", o)).StatusCode);
        var hiloCliente = await c.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Cliente/{cliente}");
        Assert.Contains(hiloCliente.EnumerateArray(), e => e.GetProperty("registroId").GetGuid() == general);
        o["clienteId"] = JsonSerializer.SerializeToElement<Guid?>(null);
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync($"/api/v1/obras/{general}", o)).StatusCode);
        var hilo = await c.GetFromJsonAsync<JsonElement>($"/api/v1/historial/Obra/{general}");
        Assert.Equal(2, hilo.EnumerateArray().SelectMany(e => e.GetProperty("cambios").EnumerateArray())
            .Count(x => x.GetProperty("etiqueta").GetString() == "Cliente"));
        o["clienteId"] = JsonSerializer.SerializeToElement(Guid.NewGuid());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PutAsJsonAsync($"/api/v1/obras/{general}", o)).StatusCode);

        // Una cotización puede usar la obra general; ya en uso no se borra. Sin uso, borrado lógico.
        await Crear(c, "/api/v1/cotizaciones", Cotizacion(esc, cliente, general, prod));
        var r = await c.DeleteAsync($"/api/v1/obras/{general}");
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Contains("La obra tiene cotizaciones o pedidos", await r.Content.ReadAsStringAsync());
        var libre = await Crear(c, "/api/v1/obras", new { nombre = "Patio", direccion = "x" });
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/v1/obras/{libre}")).StatusCode);
        await using var db = api.Db();
        Assert.True((await db.Set<Obra>().IgnoreQueryFilters().SingleAsync(x => x.Id == libre)).IsDeleted);
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
        Assert.Equal(31, await db.Set<Producto>().CountAsync(p => p.CreatedById == null)); // los del seed; otros tests crean productos
        Assert.Equal(0.16m, (await db.Set<Impuesto>().SingleAsync()).Tasa);
        Assert.Equal(12, await db.Set<Secuencia>().CountAsync(s => s.Tipo != "prueba"));
        Assert.Equal(10m, (await db.Set<Producto>().SingleAsync(p => p.Codigo == "SRV-BOMBA-ESTACIONARIA")).MinimoCobro);
    }

    [Fact]
    public async Task Listas_paginadas_con_partidas_fechas_y_varias_plantas()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        await using var db = api.Db();
        var xpj = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "XPJ")).Id;
        var cun = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "CUN")).Id;
        await Crear(c, "/api/v1/cotizaciones", Cotizacion(esc, cliente, obra, prod));
        await Crear(c, "/api/v1/cotizaciones", Cotizacion(esc, cliente, obra, prod));
        await Crear(c, "/api/v1/cotizaciones", Cotizacion(xpj, cliente, obra, prod));

        var ruta = $"/api/v1/cotizaciones?clienteId={cliente}&sucursalId={esc}&sucursalId={xpj}&sucursalId={cun}";
        var p1 = await c.GetFromJsonAsync<JsonElement>(ruta + "&incluir=partidas&pagina=1&tamano=2");
        Assert.Equal(3, p1.GetProperty("total").GetInt32());
        Assert.Equal(2, p1.GetProperty("items").GetArrayLength());
        var partidas = p1.GetProperty("items")[0].GetProperty("partidas");
        Assert.Equal(2, partidas.GetArrayLength());
        Assert.Equal(2, partidas[0].GetProperty("lineas").GetArrayLength());
        var p2 = await c.GetFromJsonAsync<JsonElement>(ruta + "&pagina=2&tamano=2");
        Assert.Single(p2.GetProperty("items").EnumerateArray());
        Assert.Empty(p2.GetProperty("items")[0].GetProperty("partidas").EnumerateArray()); // sin incluir, solo encabezado

        var manana = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(1).ToString("O"));
        Assert.Equal(0, (await c.GetFromJsonAsync<JsonElement>(ruta + $"&desde={manana}")).GetProperty("total").GetInt32());
        Assert.Equal(3, (await c.GetFromJsonAsync<JsonElement>(ruta + $"&hasta={manana}")).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync(ruta + "&incluir=todo")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync(ruta + "&tamano=501")).StatusCode);
    }

    [Fact]
    public async Task Traslado_sin_km_ni_precio_usa_los_de_la_planta_y_el_folio_siguiente_no_se_consume()
    {
        var (c, _, cliente, obra, _) = await Preparar();
        await using var db = api.Db();
        var xpj = (await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "XPJ")).Id;
        var r = await c.PutAsJsonAsync($"/api/v1/sucursales/{xpj}", await PlantaCon(c, xpj, kmIncluidos: 10, precioKm: 20));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var ruta = $"/api/v1/secuencias/siguiente?tipo=cotizacion&sucursalId={xpj}";
        var siguiente = (await c.GetFromJsonAsync<JsonElement>(ruta)).GetProperty("folio").GetString();
        Assert.Equal(siguiente, (await c.GetFromJsonAsync<JsonElement>(ruta)).GetProperty("folio").GetString());

        var cot = await (await c.PostAsJsonAsync("/api/v1/cotizaciones", new
        {
            sucursalId = xpj, clienteId = cliente, obraId = obra, descuentoPct = 0,
            partidas = new[] { new { nombre = "Firme", tipoResistencia = "fc", resistenciaKgCm2 = 200, edadDias = 28, revenimientoCm = 10,
                tmaMm = 20, cemento = "CPC 30R", exposicion = "normal", colocacion = "directa", volumenM3 = 2, precioM3 = 1000, trasladoDistanciaKm = 15 } },
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(siguiente, cot.GetProperty("folio").GetString());
        var partida = cot.GetProperty("partidas")[0];
        Assert.Equal(10, partida.GetProperty("trasladoIncluidosKm").GetDecimal());
        Assert.Equal(20, partida.GetProperty("trasladoPrecioKm").GetDecimal());
        Assert.Equal(2200m, cot.GetProperty("subtotal").GetDecimal()); // 2 m3 x (1000 + 5 km x $20)

        var (_, sesion) = await api.Entrar(Api.Root, Api.RootPassword);
        var planta = sesion.GetProperty("empresas").EnumerateArray().SelectMany(e => e.GetProperty("plantas").EnumerateArray())
            .Single(p => p.GetProperty("id").GetGuid() == xpj);
        Assert.Equal(10, planta.GetProperty("kmIncluidos").GetDecimal());
        Assert.Equal(20, planta.GetProperty("precioKm").GetDecimal());
        await c.PutAsJsonAsync($"/api/v1/sucursales/{xpj}", await PlantaCon(c, xpj, kmIncluidos: 20, precioKm: 12)); // la deja como estaba
    }

    [Fact]
    public async Task Notificaciones_avisan_al_vendedor_y_se_marcan_leidas()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        Empresa empresa;
        await using (var db = api.Db())
            empresa = await db.Set<Empresa>().SingleAsync(e => db.Set<Sucursal>().Any(s => s.Id == esc && s.EmpresaId == e.Id));
        var correo = $"vendedor{Guid.NewGuid():N}@prueba.mx";
        var vendedor = await api.CrearUsuario(correo, "Vendedor.123", ["ventas.cotizaciones.ver"], empresa);
        var (v, _) = await api.Entrar(correo, "Vendedor.123");
        async Task<JsonElement> Mias(string q = "") => await v.GetFromJsonAsync<JsonElement>($"/api/v1/me/notificaciones{q}");
        string[] Titulos(JsonElement n) => [.. n.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("titulo").GetString()!)];

        // Cotización del vendedor confirmada por otro (root) y pedidos que cambian.
        var cuerpo = new Dictionary<string, object?>(JsonSerializer.Deserialize<Dictionary<string, object?>>(
            JsonSerializer.Serialize(Cotizacion(esc, cliente, obra, prod)))!) { ["vendedorId"] = vendedor.Id };
        var id = await Crear(c, "/api/v1/cotizaciones", cuerpo);
        var pedidos = await (await c.PostAsync($"/api/v1/cotizaciones/{id}/confirmar", null)).Content.ReadFromJsonAsync<JsonElement>();
        var (p1, p2) = (pedidos[0].GetProperty("id").GetGuid(), pedidos[1].GetProperty("id").GetGuid());
        await c.PostAsJsonAsync($"/api/v1/pedidos/{p1}/planta", new { accion = "enviar" });
        await c.PostAsJsonAsync($"/api/v1/pedidos/{p1}/planta", new { accion = "rechazar", nota = "Sin unidades" });
        await c.PostAsJsonAsync($"/api/v1/pedidos/{p2}/estado", new { valor = "en_planta" });

        // Cotización del portal sin vendedor (a todos los de ventas de la empresa) y actividad vencida asignada.
        var folio = $"PRT-{Guid.NewGuid():N}"[..20];
        await using (var db = api.Db())
        {
            db.AddRange(
                new Cotizacion { EmpresaId = empresa.Id, SucursalId = esc, ClienteId = cliente, Folio = folio, Serie = folio,
                                 Estado = EstadoCotizacion.Recibida, Origen = OrigenCotizacion.Portal, Fecha = DateTime.UtcNow },
                new Actividad { OrganizacionId = empresa.OrganizacionId, RegistroTipo = "Cliente", RegistroId = cliente,
                                Resumen = "Llamar al cliente", FechaLimite = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1), AsignadaAId = vendedor.Id });
            await db.SaveChangesAsync();
        }

        var n = await Mias();
        await Mias(); // la vencida se avisa una sola vez
        n = await Mias();
        Assert.Equal(6, n.GetProperty("total").GetInt32());
        Assert.Equal(6, n.GetProperty("noLeidas").GetInt32());
        Assert.Equal( // la del portal y la asignación se guardaron juntas: mismo instante, orden indistinto
            ["Actividad vencida", "Cotización confirmada", "Cotización recibida del portal", "Te asignaron una actividad"],
            Titulos(n).Where(t => !t.StartsWith("Pedido ") && !t.StartsWith("La planta")).Order().ToArray());
        Assert.Equal("Actividad vencida", Titulos(n)[0]);
        Assert.Contains(Titulos(n), t => t.StartsWith("La planta rechazó el pedido"));
        Assert.Contains(Titulos(n), t => t.StartsWith("Pedido ") && t.EndsWith(": en planta"));
        Assert.Contains(n.GetProperty("items").EnumerateArray(), x => x.GetProperty("ruta").GetString() == $"/ventas/cotizaciones/{id}");

        // Root (quien hizo los cambios) no recibe avisos de lo suyo; nadie más marca las del vendedor.
        var primera = n.GetProperty("items")[0].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync($"/api/v1/me/notificaciones/{primera}/leida", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await v.PutAsync($"/api/v1/me/notificaciones/{primera}/leida", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await v.PutAsync($"/api/v1/me/notificaciones/{primera}/leida", null)).StatusCode);
        var noLeidas = await Mias("?soloNoLeidas=true&take=2");
        Assert.Equal(5, noLeidas.GetProperty("total").GetInt32());
        Assert.Equal(2, noLeidas.GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.NoContent, (await v.PutAsync("/api/v1/me/notificaciones/leidas", null)).StatusCode);
        Assert.Equal(0, (await Mias()).GetProperty("noLeidas").GetInt32());
    }

    static async Task<JsonElement> PlantaCon(HttpClient c, Guid id, decimal kmIncluidos, decimal precioKm)
    {
        var planta = (await c.GetFromJsonAsync<Dictionary<string, JsonElement>>($"/api/v1/sucursales/{id}"))!;
        planta["kmIncluidos"] = JsonSerializer.SerializeToElement(kmIncluidos);
        planta["precioKm"] = JsonSerializer.SerializeToElement(precioKm);
        return JsonSerializer.SerializeToElement(planta);
    }
}
