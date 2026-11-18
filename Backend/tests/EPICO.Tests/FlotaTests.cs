using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Ventas;
using EPICO.Infrastructure.Gps;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace EPICO.Tests;

public class FlotaTests(Api api) : IClassFixture<Api>
{
    async Task<(HttpClient C, Sucursal Esc, Guid Cliente, Guid Obra, Dictionary<string, Guid> Prod)> Preparar()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        await using var db = api.Db();
        var esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
        var prod = await db.Set<Producto>().ToDictionaryAsync(p => p.Codigo, p => p.Id);
        var cliente = await Crear(c, "/api/v1/clientes", new { nombre = $"Constructora {Guid.NewGuid():N}" });
        var obra = await Crear(c, "/api/v1/obras", new { clienteId = cliente, nombre = "Torre", direccion = "Calle 1, Escárcega" });
        return (c, esc, cliente, obra, prod);
    }

    static async Task<Guid> Crear(HttpClient c, string ruta, object cuerpo) =>
        (await Json(await c.PostAsJsonAsync(ruta, cuerpo), HttpStatusCode.Created)).GetProperty("id").GetGuid();

    static async Task<JsonElement> Json(HttpResponseMessage r, HttpStatusCode esperado)
    {
        var texto = await r.Content.ReadAsStringAsync();
        Assert.True(r.StatusCode == esperado, $"{(int)r.StatusCode} {texto}");
        return texto.Length == 0 ? default : JsonDocument.Parse(texto).RootElement;
    }

    static async Task Error(HttpResponseMessage r, HttpStatusCode status, string mensaje)
    {
        var texto = await r.Content.ReadAsStringAsync();
        Assert.True(r.StatusCode == status, $"{(int)r.StatusCode} {texto}");
        Assert.Contains(mensaje, texto);
    }

    static object Pedido(Sucursal esc, Guid cliente, Guid obra, Guid producto, decimal cantidad, DateTime entrega) => new
    {
        sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = entrega, metodoPago = "transferencia", descuentoPct = 0,
        lineas = new[] { new { productoId = producto, cantidad } },
    };

    [Fact]
    public async Task Pedido_minimo_se_valida_en_cotizacion_confirmacion_y_pedido()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        string nombre, vibrador;
        await using (var db = api.Db())
        {
            var p = await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250");
            var v = await db.Set<Producto>().SingleAsync(x => x.Codigo == "REN-VIBRADOR");
            (p.PedidoMinimo, v.PedidoMinimo, nombre, vibrador) = (5, 2, p.Nombre, v.Nombre);
            await db.SaveChangesAsync();
        }
        object Cot(decimal volumen, decimal vibradores) => new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, descuentoPct = 0,
            partidas = new[]
            {
                new
                {
                    nombre = "Losa", tipoResistencia = "fc", resistenciaKgCm2 = 250, edadDias = 28, revenimientoCm = 14, tmaMm = 20,
                    cemento = "CPC 30R", exposicion = "normal", colocacion = "directa", volumenM3 = volumen, entrega = DateTime.UtcNow.AddDays(3),
                    lineas = new[] { new { productoId = prod["REN-VIBRADOR"], cantidad = vibradores } },
                },
            },
        };
        await Error(await c.PostAsJsonAsync("/api/v1/cotizaciones", Cot(4, 2)), HttpStatusCode.BadRequest, $"El pedido mínimo de {nombre} es 5 M³.");
        await Error(await c.PostAsJsonAsync("/api/v1/cotizaciones", Cot(5, 1)), HttpStatusCode.BadRequest, $"El pedido mínimo de {vibrador} es 2 ");
        var cot = await Crear(c, "/api/v1/cotizaciones", Cot(5, 2));
        await Error(await c.PutAsJsonAsync($"/api/v1/cotizaciones/{cot}", Cot(3, 2)), HttpStatusCode.BadRequest, "El pedido mínimo de");
        await Error(await c.PostAsJsonAsync("/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 4, DateTime.UtcNow.AddDays(2))),
            HttpStatusCode.BadRequest, $"El pedido mínimo de {nombre} es 5 M³.");

        var producto = await c.GetFromJsonAsync<JsonElement>($"/api/v1/productos/{prod["CON-FC-250"]}");
        Assert.Equal(5, producto.GetProperty("pedidoMinimo").GetDecimal());

        // Si el mínimo sube después de cotizar, confirmar también lo revisa.
        await using (var db = api.Db())
        {
            (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).PedidoMinimo = 6;
            await db.SaveChangesAsync();
        }
        await Error(await c.PostAsync($"/api/v1/cotizaciones/{cot}/confirmar", null), HttpStatusCode.BadRequest, $"El pedido mínimo de {nombre} es 6 M³.");
        await using (var db = api.Db())
        {
            foreach (var p in await db.Set<Producto>().Where(x => x.PedidoMinimo != null).ToListAsync()) p.PedidoMinimo = null;
            await db.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Viajes_asignan_camiones_disponibles_y_mueven_la_orden()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var entrega = DateTime.UtcNow.Date.AddDays(5).AddHours(15);
        var eco = $"T{Guid.NewGuid():N}"[..10];
        var camion = await Crear(c, "/api/v1/equipos", new
        {
            sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco, operadorNombre = "Juan Habitual", marca = "Kenworth",
            capacidad = 8, unidadCapacidad = "m³",
        });
        var camion2 = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = $"{eco}B" });
        var taller = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "pipa", numeroEconomico = $"{eco}C", estado = "mantenimiento" });
        var pedido = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 14, entrega));
        var url = $"/api/v1/pedidos/{pedido}/viajes";
        object Viaje(Guid equipo, decimal m3, string? metodo = null) => new { equipoId = equipo, volumenM3 = m3, metodoPago = metodo };

        await Error(await c.PostAsJsonAsync(url, Viaje(camion, 8)), HttpStatusCode.Conflict, "Confirma la orden antes de asignarle camiones.");
        await Json(await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null), HttpStatusCode.OK);

        var v1 = await Json(await c.PostAsJsonAsync(url, Viaje(camion, 8)), HttpStatusCode.Created);
        Assert.Equal(("programado", "Juan Habitual", eco), (v1.GetProperty("estado").GetString(), v1.GetProperty("operadorNombre").GetString(),
            v1.GetProperty("numeroEconomico").GetString()));
        var folio = v1.GetProperty("folio").GetString()!;
        Assert.StartsWith("REM-ESC-", folio);
        await Error(await c.PostAsJsonAsync(url, Viaje(camion, 1)), HttpStatusCode.Conflict, "Ya va en esta orden");
        await Error(await c.PostAsJsonAsync(url, Viaje(taller, 1)), HttpStatusCode.Conflict, "En mantenimiento");
        await Error(await c.PostAsJsonAsync(url, Viaje(camion2, 7)), HttpStatusCode.BadRequest, "Quedan 6 m³ por asignar.");

        // Tablero: ocupado ahora y para una orden a ±4 h; libre para otro día.
        var folioPedido = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("folio").GetString();
        JsonElement Del(JsonElement tablero, Guid equipo) =>
            tablero.GetProperty("equipos").EnumerateArray().Single(e => e.GetProperty("equipo").GetProperty("id").GetGuid() == equipo);
        var ahora = await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero");
        Assert.False(ahora.GetProperty("gps").GetProperty("configurado").GetBoolean());
        var t1 = Del(ahora, camion);
        Assert.Equal((false, $"En viaje {folioPedido}"), (t1.GetProperty("disponible").GetBoolean(), t1.GetProperty("motivo").GetString()));
        Assert.Equal(folioPedido, t1.GetProperty("viaje").GetProperty("pedidoFolio").GetString());
        Assert.Equal(JsonValueKind.Null, t1.GetProperty("posicion").ValueKind);
        Assert.Equal("Planta Escárcega", t1.GetProperty("plantaNombre").GetString());
        Assert.True(Del(ahora, camion2).GetProperty("disponible").GetBoolean());

        // Ventana del viaje: sale 30 min antes (60 de transporte) y regresa a los 120 (+60 de servicio).
        var cerca = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddHours(1)));
        var lejos = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddDays(1)));
        string Hora(DateTime utc) => VentasServicio.HoraLocal(utc, esc.ZonaHoraria).ToString("HH:mm");
        Assert.Equal($"Ocupado con {folioPedido} de {Hora(entrega.AddMinutes(-30))} a {Hora(entrega.AddMinutes(90))}",
            Del(await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={cerca}"), camion).GetProperty("motivo").GetString());
        Assert.True(Del(await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={lejos}"), camion).GetProperty("disponible").GetBoolean());
        Assert.Equal("Ya va en esta orden",
            Del(await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={pedido}"), camion).GetProperty("motivo").GetString());

        // El segundo viaje cambia el método de pago; uno programado se quita y se vuelve a asignar.
        var v2 = await Json(await c.PostAsJsonAsync(url, Viaje(camion2, 6, "efectivo")), HttpStatusCode.Created);
        var p = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}");
        Assert.Equal("efectivo", p.GetProperty("metodoPago").GetString());
        Assert.Equal(14, p.GetProperty("m3Asignados").GetDecimal());
        Assert.Equal([eco, $"{eco}B"], p.GetProperty("unidades").EnumerateArray().Select(x => x.GetString()));
        var enLista = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos?clienteId={cliente}")).GetProperty("items").EnumerateArray()
            .Single(x => x.GetProperty("id").GetGuid() == pedido);
        Assert.Equal(14, enLista.GetProperty("m3Asignados").GetDecimal());
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"{url}/{v2.GetProperty("id").GetGuid()}")).StatusCode);
        v2 = await Json(await c.PostAsJsonAsync(url, Viaje(camion2, 6)), HttpStatusCode.Created);
        Assert.Equal(2, (await c.GetFromJsonAsync<JsonElement>(url)).GetArrayLength());

        // Avanzar: solo hacia adelante; la orden sigue al viaje más avanzado y se entrega al terminar todo.
        async Task<JsonElement> Avanzar(JsonElement v, string estado, HttpStatusCode esperado = HttpStatusCode.OK) =>
            await Json(await c.PostAsJsonAsync($"/api/v1/viajes/{v.GetProperty("id").GetGuid()}/estado", new { estado }), esperado);
        async Task<string?> EstadoPedido() => (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("estado").GetString();
        await Avanzar(v1, "cargando");
        Assert.Equal("en_planta", await EstadoPedido());
        await Avanzar(v1, "programado", HttpStatusCode.Conflict);
        await Error(await c.DeleteAsync($"{url}/{v1.GetProperty("id").GetGuid()}"), HttpStatusCode.Conflict, "Solo se quita un viaje programado");
        await Avanzar(v2, "en_ruta");
        Assert.Equal("en_ruta", await EstadoPedido());
        var fin = await Avanzar(v1, "terminado");
        Assert.All(new[] { "salidaEn", "llegadaEn", "terminadaEn" }, x => Assert.NotEqual(JsonValueKind.Null, fin.GetProperty(x).ValueKind));
        Assert.Equal("en_ruta", await EstadoPedido());
        await Avanzar(v2, "terminado");
        Assert.Equal("entregado", await EstadoPedido());
        Assert.True(Del(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero"), camion).GetProperty("disponible").GetBoolean());
        await Error(await c.PostAsJsonAsync(url, Viaje(camion, 1)), HttpStatusCode.Conflict, "La orden ya se entregó.");

        // Permisos: con solo ver pedidos se ve el tablero y los viajes, pero no se asigna.
        Empresa empresa;
        await using (var db = api.Db()) empresa = await db.Set<Empresa>().SingleAsync(e => e.Id == esc.EmpresaId);
        var correo = $"ver{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correo, "Clave.Ver.1", ["ventas.pedidos.ver"], empresa);
        var (ver, _) = await api.Entrar(correo, "Clave.Ver.1");
        Assert.Equal(HttpStatusCode.OK, (await ver.GetAsync("/api/v1/flota/tablero")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ver.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ver.PostAsJsonAsync($"/api/v1/pedidos/{lejos}/viajes", Viaje(camion, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ver.GetAsync("/api/v1/flota/gps")).StatusCode);
    }

    [Fact]
    public async Task Bomba_acompana_la_orden_y_solo_las_ollas_cuentan_m3()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var eco = $"B{Guid.NewGuid():N}"[..10];
        var bomba = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "bomba_pluma", numeroEconomico = eco });
        var olla1 = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = $"{eco}1" });
        var olla2 = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = $"{eco}2" });
        var pedido = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 14, DateTime.UtcNow.Date.AddDays(9).AddHours(15)));
        await Json(await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null), HttpStatusCode.OK);
        var url = $"/api/v1/pedidos/{pedido}/viajes";
        async Task<JsonElement> Asignar(Guid equipo, decimal m3, HttpStatusCode esperado = HttpStatusCode.Created) =>
            await Json(await c.PostAsJsonAsync(url, new { equipoId = equipo, volumenM3 = m3 }), esperado);

        var vb = await Asignar(bomba, 14);       // la bomba lleva el volumen de toda la orden y no descuenta
        var v1 = await Asignar(olla1, 8);
        await Error(await c.PostAsJsonAsync(url, new { equipoId = olla2, volumenM3 = 7 }), HttpStatusCode.BadRequest, "Quedan 6 m³ por asignar.");
        var v2 = await Asignar(olla2, 6);
        var p = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}");
        Assert.Equal(14, p.GetProperty("m3Asignados").GetDecimal());
        Assert.Equal([eco, $"{eco}1", $"{eco}2"], p.GetProperty("unidades").EnumerateArray().Select(x => x.GetString()));

        async Task Terminar(JsonElement v) =>
            await Json(await c.PostAsJsonAsync($"/api/v1/viajes/{v.GetProperty("id").GetGuid()}/estado", new { estado = "terminado" }), HttpStatusCode.OK);
        async Task<string?> Estado() => (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("estado").GetString();
        await Terminar(v1);
        await Terminar(v2);
        Assert.Equal("programado", await Estado());   // la bomba sigue sin terminar
        await Terminar(vb);
        Assert.Equal("entregado", await Estado());
    }

    [Fact]
    public async Task Logistica_operadores_documentos_despacho_combustible_y_mantenimiento()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var entrega = DateTime.UtcNow.Date.AddDays(6).AddHours(17);
        var dia = DateOnly.FromDateTime(VentasServicio.HoraLocal(entrega, esc.ZonaHoraria));
        var hoy = DateOnly.FromDateTime(VentasServicio.HoraLocal(DateTime.UtcNow, esc.ZonaHoraria));
        string F(DateOnly d) => d.ToString("dd/MM/yyyy");
        var eco = $"L{Guid.NewGuid():N}"[..10];

        // Operadores: el habitual va al viaje; uno con la licencia vencida para ese día no se asigna.
        var juan = await Crear(c, "/api/v1/operadores", new { sucursalId = esc.Id, nombre = "Juan Habitual", licenciaTipo = "E", licenciaVence = hoy.AddYears(1) });
        var vencido = await Crear(c, "/api/v1/operadores", new { nombre = "Pepe Vencido", licenciaVence = dia.AddDays(-1) });
        var olla = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco, operadorId = juan });
        var olla2 = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = $"{eco}2" });
        var retro = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "retroexcavadora", numeroEconomico = $"{eco}R" });
        var pedido = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 15, entrega));
        var porConfirmar = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddHours(1)));
        await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddDays(1)));
        await Json(await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null), HttpStatusCode.OK);
        var url = $"/api/v1/pedidos/{pedido}/viajes";

        await Error(await c.PostAsJsonAsync(url, new { equipoId = olla2, volumenM3 = 7, operadorId = vencido }), HttpStatusCode.Conflict,
            $"La licencia de Pepe Vencido venció el {F(dia.AddDays(-1))}.");
        var v = await Json(await c.PostAsJsonAsync(url, new { equipoId = olla, volumenM3 = 8 }), HttpStatusCode.Created);
        Assert.Equal("Juan Habitual", v.GetProperty("operadorNombre").GetString());
        await using (var db = api.Db()) Assert.Equal(juan, (await db.Set<Remision>().SingleAsync(r => r.Id == v.GetProperty("id").GetGuid())).OperadorId);

        // Documentos: vencido antes de la entrega = no disponible para esa orden; hoy todavía sí.
        JsonElement Del(JsonElement t, Guid e) => t.GetProperty("equipos").EnumerateArray().Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == e);
        await Crear(c, "/api/v1/equipo-documentos", new { equipoId = olla2, tipo = "verificacion", numero = "V-1", vence = dia.AddDays(-1) });
        await Crear(c, "/api/v1/equipo-documentos", new { equipoId = olla2, tipo = "seguro", vence = dia.AddDays(-2) });
        await Crear(c, "/api/v1/equipo-documentos", new { equipoId = olla2, tipo = "tarjeta_circulacion" });   // no vence
        Assert.True(Del(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero"), olla2).GetProperty("disponible").GetBoolean());
        var t = await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={pedido}");
        Assert.Equal($"Seguro vencido el {F(dia.AddDays(-2))}", Del(t, olla2).GetProperty("motivo").GetString());
        Assert.Equal("Juan Habitual", Del(t, olla).GetProperty("operador").GetProperty("nombre").GetString());
        await Error(await c.PostAsJsonAsync(url, new { equipoId = olla2, volumenM3 = 7 }), HttpStatusCode.Conflict, "Seguro vencido el");
        Assert.Equal(3, (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipo-documentos?equipoId={olla2}")).GetArrayLength());

        // Despacho del día: confirmadas y por confirmar, sin la del día siguiente.
        var despacho = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/despacho?fecha={dia:yyyy-MM-dd}&sucursalId={esc.Id}"))
            .EnumerateArray().Where(x => x.GetProperty("pedido").GetProperty("clienteId").GetGuid() == cliente).ToList();
        Assert.Equal([pedido, porConfirmar], despacho.Select(x => x.GetProperty("pedido").GetProperty("id").GetGuid()));
        var d0 = despacho[0].GetProperty("pedido");
        Assert.Equal((15m, 8m, "Torre", "Planta Escárcega"), (d0.GetProperty("volumenM3").GetDecimal(), d0.GetProperty("m3Asignados").GetDecimal(),
            d0.GetProperty("obraNombre").GetString(), d0.GetProperty("plantaNombre").GetString()));
        Assert.False(string.IsNullOrEmpty(d0.GetProperty("producto").GetString()));
        Assert.Single(despacho[0].GetProperty("viajes").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, despacho[1].GetProperty("pedido").GetProperty("confirmadaEn").ValueKind);

        // Ficha de la unidad.
        var ficha = await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{olla}/viajes");
        Assert.Equal((1, 8m), (ficha.GetProperty("total").GetInt32(), ficha.GetProperty("resumen").GetProperty("m3").GetDecimal()));
        Assert.Equal(pedido, ficha.GetProperty("items")[0].GetProperty("pedidoId").GetGuid());
        Assert.Equal(JsonValueKind.Null, (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{retro}/viajes")).GetProperty("resumen").GetProperty("m3").ValueKind);

        // Combustible: la planta sale del equipo; el odómetro no baja y queda en el equipo.
        var carga = await Json(await c.PostAsJsonAsync("/api/v1/cargas-combustible",
            new { equipoId = olla, fecha = DateTime.UtcNow.AddDays(-2), litros = 150, costoTotal = 3800, odometroKm = 12500, horometro = 900 }), HttpStatusCode.Created);
        Assert.Equal(esc.Id, carga.GetProperty("sucursalId").GetGuid());
        await Error(await c.PostAsJsonAsync("/api/v1/cargas-combustible",
            new { equipoId = olla, fecha = DateTime.UtcNow, litros = 100, costoTotal = 2500, odometroKm = 12000 }), HttpStatusCode.BadRequest,
            "El odómetro no puede ser menor al de la carga anterior (12,500 km).");
        await Json(await c.PostAsJsonAsync("/api/v1/cargas-combustible",
            new { equipoId = olla, fecha = DateTime.UtcNow, litros = 100, costoTotal = 2500, odometroKm = 12900 }), HttpStatusCode.Created);
        var equipo = await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{olla}");
        Assert.Equal((12900m, 900m), (equipo.GetProperty("ultimoOdometroKm").GetDecimal(), equipo.GetProperty("ultimoHorometro").GetDecimal()));
        Assert.Equal(2, (await c.GetFromJsonAsync<JsonElement>($"/api/v1/cargas-combustible?equipoId={olla}&desde={DateTime.UtcNow.AddDays(-3):O}")).GetArrayLength());

        // Carga con fecha atrasada: tampoco pasa a la siguiente (odómetro 12,900 hoy; horómetro 900 hace 2 días).
        object Carga(int dias, decimal? km, decimal? hr) => new { equipoId = olla, fecha = DateTime.UtcNow.AddDays(dias), litros = 90, costoTotal = 2000, odometroKm = km, horometro = hr };
        await Error(await c.PostAsJsonAsync("/api/v1/cargas-combustible", Carga(-1, 13000, null)), HttpStatusCode.BadRequest,
            "El odómetro no puede ser mayor al de la carga siguiente (12,900 km).");
        await Error(await c.PostAsJsonAsync("/api/v1/cargas-combustible", Carga(-3, null, 950)), HttpStatusCode.BadRequest,
            "El horómetro no puede ser mayor al de la carga siguiente (900 h).");
        var enMedio = await Json(await c.PostAsJsonAsync("/api/v1/cargas-combustible", Carga(-1, 12700, null)), HttpStatusCode.Created);
        // Al editar no cuenta la propia carga: bajar de 12,700 a 12,600 vale (la anterior es 12,500).
        var editada = JsonSerializer.Deserialize<Dictionary<string, object?>>(enMedio.GetRawText())!;
        editada["odometroKm"] = 12600;
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync($"/api/v1/cargas-combustible/{enMedio.GetProperty("id").GetGuid()}", editada)).StatusCode);
        editada["odometroKm"] = 12950;
        await Error(await c.PutAsJsonAsync($"/api/v1/cargas-combustible/{enMedio.GetProperty("id").GetGuid()}", editada), HttpStatusCode.BadRequest,
            "El odómetro no puede ser mayor al de la carga siguiente (12,900 km).");

        // Mantenimiento: nace programado; no entra a taller con un viaje pendiente; al terminar la unidad vuelve a disponible.
        var mOlla = await Crear(c, "/api/v1/mantenimientos", new { equipoId = olla, tipo = "preventivo", descripcion = "Servicio 10,000 km", estado = "terminado" });
        var mRetro = await Crear(c, "/api/v1/mantenimientos",
            new { equipoId = retro, tipo = "correctivo", descripcion = "Mangueras", programadoPara = hoy.AddDays(3) });
        async Task<HttpResponseMessage> Estado(Guid m, string e) => await c.PostAsJsonAsync($"/api/v1/mantenimientos/{m}/estado", new { estado = e });
        Assert.Equal("programado", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/mantenimientos/{mOlla}")).GetProperty("estado").GetString());
        var folio = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("folio").GetString();
        await Error(await Estado(mOlla, "en_proceso"), HttpStatusCode.Conflict, $"{eco} va en un viaje ({folio}): termínalo antes.");
        var proceso = await Json(await Estado(mRetro, "en_proceso"), HttpStatusCode.OK);
        Assert.NotEqual(JsonValueKind.Null, proceso.GetProperty("inicioEn").ValueKind);
        Assert.Equal("mantenimiento", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{retro}")).GetProperty("estado").GetString());
        await Json(await Estado(mRetro, "terminado"), HttpStatusCode.OK);
        Assert.Equal("disponible", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{retro}")).GetProperty("estado").GetString());
        await Error(await Estado(mRetro, "cancelado"), HttpStatusCode.Conflict, "Solo se cancela un mantenimiento programado.");

        // Vencimientos: el seguro vencido, la verificación, la licencia; el mantenimiento terminado ya no.
        var venc = (await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/vencimientos?dias=30")).EnumerateArray().ToList();
        Assert.Contains(venc, x => x.GetProperty("titulo").GetString() == $"Seguro · {eco}2" && x.GetProperty("tipo").GetString() == "documento");
        Assert.Contains(venc, x => x.GetProperty("titulo").GetString() == "Licencia · Pepe Vencido" && x.GetProperty("operadorId").GetGuid() == vencido);
        Assert.DoesNotContain(venc, x => x.GetProperty("registroId").GetGuid() == mRetro);
        Assert.Equal(venc.Select(x => x.GetProperty("vence").GetString()).Order(), venc.Select(x => x.GetProperty("vence").GetString()));
        var mProg = await Crear(c, "/api/v1/mantenimientos", new { equipoId = olla2, tipo = "preventivo", descripcion = "Servicio", programadoPara = hoy.AddDays(-1) });
        var vm = (await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/vencimientos")).EnumerateArray().Single(x => x.GetProperty("registroId").GetGuid() == mProg);
        Assert.Equal(("mantenimiento", $"Servicio · {eco}2", true), (vm.GetProperty("tipo").GetString(), vm.GetProperty("titulo").GetString(), vm.GetProperty("vencido").GetBoolean()));
    }

    sealed class Fabrica(HttpMessageHandler h) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(h, disposeHandler: false);
    }

    sealed class Traccar(HttpStatusCode status) : HttpMessageHandler
    {
        public int Llamadas;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Llamadas++;
            Assert.Equal("Bearer tok", r.Headers.Authorization?.ToString());
            var json = r.RequestUri!.AbsolutePath switch
            {
                "/api/devices" => """[{"id":1,"name":"ECO-21","uniqueId":"861","status":"online"},{"id":2,"name":"Sin señal","uniqueId":"862","status":"offline"}]""",
                "/api/positions" => """[{"id":9,"deviceId":1,"latitude":18.61,"longitude":-90.73,"speed":10,"fixTime":"2026-11-17T15:00:00.000+00:00"}]""",
                _ => "[]",
            };
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") });
        }
    }

    static TraccarGps Gps(Traccar h, string? url = "http://traccar.local/") => new(new Fabrica(h),
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Traccar:Url"] = url, ["Traccar:Token"] = "tok" }).Build(),
        NullLogger<TraccarGps>.Instance);

    [Fact]
    public async Task Traccar_une_dispositivos_y_posiciones_con_cache()
    {
        var h = new Traccar(HttpStatusCode.OK);
        var gps = Gps(h);
        var l = await gps.Leer(default);
        Assert.True(l.Configurado);
        var eco = l.Dispositivos.Single(d => d.UniqueId == "861");
        Assert.Equal(("ECO-21", "online", 18.61m, -90.73m, 18.5m), (eco.Nombre, eco.Estado, eco.UltimaPosicion!.Lat, eco.UltimaPosicion.Lng,
            eco.UltimaPosicion.VelocidadKmh!.Value));
        Assert.Equal(new DateTime(2026, 11, 17, 15, 0, 0, DateTimeKind.Utc), eco.UltimaPosicion.Fecha);
        Assert.Null(l.Dispositivos.Single(d => d.UniqueId == "862").UltimaPosicion);
        await gps.Leer(default);
        Assert.Equal(2, h.Llamadas); // la segunda lectura sale de la caché

        Assert.False((await Gps(h, url: null).Leer(default)).Configurado);
        var caido = await Gps(new Traccar(HttpStatusCode.InternalServerError)).Leer(default);
        Assert.Equal((true, 0), (caido.Configurado, caido.Dispositivos.Count));
    }
}
