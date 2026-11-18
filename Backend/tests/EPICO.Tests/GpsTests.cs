using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Flota;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EPICO.Tests;

public class GpsTests(Api api) : IClassFixture<Api>
{
    [Fact]
    public void Sensores_se_normalizan()
    {
        var attrs = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>("""{"drumRpm":-8,"ignition":true,"fuel":"72.5","temp1":31,"io200":5}""")!;
        var n = Sensores.Normalizar(attrs)!;
        Assert.Equal((8m, "descarga", true, 72.5m, 31m), ((decimal)n["tamborRpm"]!, (string)n["tamborSentido"]!, (bool)n["motorEncendido"]!,
            (decimal)n["combustiblePct"]!, (decimal)n["temperaturaC"]!));
        Assert.Equal(5, (int)n["otros"]!["io200"]!);
        Assert.Equal("carga", (string)Sensores.Normalizar(JsonSerializer.Deserialize<Dictionary<string, JsonElement>>("""{"drumDirection":"load"}"""))!["tamborSentido"]!);
        Assert.Null(Sensores.Normalizar(null));
    }

    [Fact]
    public void Muestreo_conserva_extremos_y_resumen_mide_movimiento()
    {
        var xs = Enumerable.Range(0, 5000).ToList();
        var m = FlotaServicio.Muestrear(xs, 2000);
        Assert.Equal((2000, 0, 4999), (m.Count, m[0], m[^1]));

        var t = new DateTime(2026, 11, 18, 12, 0, 0, DateTimeKind.Utc);
        PosicionEquipo P(int min, decimal lat, decimal vel) => new() { Fecha = t.AddMinutes(min), Lat = lat, Lng = -89.6m, VelocidadKmh = vel };
        var r = FlotaServicio.Resumir([P(0, 21.00m, 0), P(10, 21.00m, 40), P(20, 21.10m, 60), P(30, 21.20m, 0)]);
        Assert.InRange(r.Km, 22.1m, 22.3m);   // 0.2° de latitud ≈ 22.2 km
        Assert.Equal((60m, 50m, 20, 10), (r.VelocidadMaxKmh!.Value, r.VelocidadPromKmh!.Value, r.EnMovimientoMin, r.DetenidoMin));
        // La deriva del GPS parado y los saltos imposibles (111 km en 1 min) no suman km.
        Assert.Equal(0, FlotaServicio.Resumir([P(0, 21.00m, 0), P(1, 21.001m, 0), P(2, 21.002m, 0)]).Km);
        Assert.Equal(0, FlotaServicio.Resumir([P(0, 21.00m, 50), P(1, 22.00m, 50)]).Km);
    }

    [Fact]
    public void Etapas_reales_en_curso_y_planeadas()
    {
        var t = new DateTime(2026, 11, 18, 15, 0, 0, DateTimeKind.Utc);
        // Sin empezar: todo planeado desde la salida programada (60 de transporte, 60 de servicio).
        var plan = FlotaServicio.Etapas(new Remision { Estado = EstadoViaje.Programado }, t, 60, 60, t.AddHours(-5));
        Assert.Equal([("carga", t.AddMinutes(-15), t, false), ("ida", t, t.AddMinutes(30), false), ("obra", t.AddMinutes(30), t.AddMinutes(90), false),
            ("regreso", t.AddMinutes(90), t.AddMinutes(120), false)], plan.Select(e => (e.Etapa, e.Inicio, e.Fin, e.Real)));
        // En ruta desde las 15:10 (cargó desde 14:50); ahora 15:20: la ida termina ahora y lo demás sigue de ahí.
        var r = new Remision { Estado = EstadoViaje.EnRuta, CargandoEn = t.AddMinutes(-10), SalidaEn = t.AddMinutes(10) };
        var curso = FlotaServicio.Etapas(r, t, 60, 60, t.AddMinutes(20));
        Assert.Equal([("carga", t.AddMinutes(-10), t.AddMinutes(10), true), ("ida", t.AddMinutes(10), t.AddMinutes(20), true),
            ("obra", t.AddMinutes(20), t.AddMinutes(80), false), ("regreso", t.AddMinutes(80), t.AddMinutes(110), false)],
            curso.Select(e => (e.Etapa, e.Inicio, e.Fin, e.Real)));
    }

    [Fact]
    public void Resultado_de_inspeccion_por_puntos_criticos()
    {
        Assert.Equal(ResultadoInspeccion.Aprobada, Checklist.Resultado([new("llantas", "Llantas", true), new("canalon", "Canalón", true)]));
        Assert.Equal(ResultadoInspeccion.ConObservaciones, Checklist.Resultado([new("llantas", "Llantas", true), new("canalon", "Canalón", false)]));
        Assert.Equal(ResultadoInspeccion.Rechazada, Checklist.Resultado([new("frenos", "Frenos", false), new("canalon", "Canalón", false)]));
        Assert.Contains(Checklist.De(TipoEquipo.BombaPluma), i => i.Clave == "estabilizadores" && i.Critico);
        Assert.Equal("maquinaria", Checklist.Categoria(TipoEquipo.Retroexcavadora));
    }

    [Fact]
    public async Task Inspeccion_rechazada_bloquea_hasta_el_mantenimiento_y_calibracion_vence()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        await using (var db = api.Db()) esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
        async Task<JsonElement> Post(string url, object body)
        {
            var x = await c.PostAsJsonAsync(url, body);
            Assert.True(x.IsSuccessStatusCode, await x.Content.ReadAsStringAsync());
            return await x.Content.ReadFromJsonAsync<JsonElement>();
        }
        var eco = $"N{Guid.NewGuid():N}"[..10];
        var olla = (await Post("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco })).GetProperty("id").GetGuid();
        JsonElement Fila(JsonElement tab) => tab.GetProperty("equipos").EnumerateArray().Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == olla);

        var checklist = await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/checklist?tipo=revolvedor");
        Assert.Contains(checklist.EnumerateArray(), i => i.GetProperty("clave").GetString() == "tambor_aspas" && i.GetProperty("critico").GetBoolean());

        var ayer = DateTime.UtcNow.AddDays(-1);
        var ins = await Post("/api/v1/inspecciones", new
        {
            equipoId = olla, fecha = ayer, inspectorNombre = "Ana", resultado = "aprobada",
            puntos = new[] { new { clave = "frenos", texto = "Frenos", ok = false, nota = "Balatas gastadas" }, new { clave = "canalon", texto = "Canalón", ok = true, nota = (string?)null } },
        });
        Assert.Equal("rechazada", ins.GetProperty("resultado").GetString());   // lo calcula la API
        Assert.Equal("Balatas gastadas", ins.GetProperty("puntos")[0].GetProperty("nota").GetString());
        var dia = Application.Ventas.VentasServicio.HoraLocal(ayer, esc.ZonaHoraria).ToString("dd/MM/yyyy");
        Assert.Equal($"Inspección rechazada el {dia}", Fila(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero")).GetProperty("motivo").GetString());

        // Una aprobada con la misma fecha, capturada después, la libera; otra rechazada vuelve a bloquear.
        await Post("/api/v1/inspecciones", new { equipoId = olla, fecha = ayer, inspectorNombre = "Ana", puntos = Array.Empty<object>() });
        Assert.True(Fila(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero")).GetProperty("disponible").GetBoolean());
        await Post("/api/v1/inspecciones", new
        {
            equipoId = olla, fecha = ayer, inspectorNombre = "Ana", puntos = new[] { new { clave = "frenos", texto = "Frenos", ok = false } },
        });
        Assert.Equal($"Inspección rechazada el {dia}", Fila(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero")).GetProperty("motivo").GetString());

        // Un mantenimiento terminado después la libera.
        var m = (await Post("/api/v1/mantenimientos", new { equipoId = olla, tipo = "correctivo", descripcion = "Balatas" })).GetProperty("id").GetGuid();
        await Post($"/api/v1/mantenimientos/{m}/estado", new { estado = "en_proceso" });
        await Post($"/api/v1/mantenimientos/{m}/estado", new { estado = "terminado" });
        Assert.True(Fila(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero")).GetProperty("disponible").GetBoolean());
        Assert.Equal(3, (await c.GetFromJsonAsync<JsonElement>($"/api/v1/inspecciones?equipoId={olla}&desde={ayer.AddHours(-1):O}")).GetArrayLength());

        // Calibración vencida: no disponible y en vencimientos.
        await Post("/api/v1/equipo-documentos", new { equipoId = olla, tipo = "calibracion", vence = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)) });
        Assert.StartsWith("Calibración vencida el", Fila(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero")).GetProperty("motivo").GetString());
        Assert.Contains((await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/vencimientos")).EnumerateArray(),
            v => v.GetProperty("titulo").GetString() == $"Calibración · {eco}");
    }

    [Fact]
    public async Task Remision_imprimible_con_acumulado_y_firma()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        Guid producto;
        await using (var db = api.Db())
        {
            esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
            producto = (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).Id;
        }
        async Task<JsonElement> Post(string url, object body)
        {
            var x = await c.PostAsJsonAsync(url, body);
            Assert.True(x.IsSuccessStatusCode, await x.Content.ReadAsStringAsync());
            return await x.Content.ReadFromJsonAsync<JsonElement>();
        }
        Guid Id(JsonElement x) => x.GetProperty("id").GetGuid();
        var eco = $"R{Guid.NewGuid():N}"[..10];
        var o1 = Id(await Post("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco, placas = "YUC-1" }));
        var o2 = Id(await Post("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = $"{eco}2" }));
        var cliente = Id(await Post("/api/v1/clientes", new { nombre = $"Cliente {eco}" }));
        var obra = Id(await Post("/api/v1/obras", new { clienteId = cliente, nombre = "Torre R", direccion = "Calle 9", municipio = "Escárcega" }));
        var pedido = Id(await Post("/api/v1/pedidos", new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = DateTime.UtcNow.AddDays(1), metodoPago = "transferencia",
            descuentoPct = 0, lineas = new[] { new { productoId = producto, cantidad = 14 } },
        }));
        await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null);
        var v1 = Id(await Post($"/api/v1/pedidos/{pedido}/viajes", new { equipoId = o1, volumenM3 = 8, operadorNombre = "Juan" }));
        var v2 = Id(await Post($"/api/v1/pedidos/{pedido}/viajes", new { equipoId = o2, volumenM3 = 6 }));
        await Post($"/api/v1/viajes/{v2}/estado", new { estado = "en_obra" });

        var rem = await c.GetFromJsonAsync<JsonElement>($"/api/v1/viajes/{v2}/remision");
        Assert.Equal((6m, 14m, 14m, "Torre R", "Calle 9"), (rem.GetProperty("m3").GetDecimal(), rem.GetProperty("m3Acumulado").GetDecimal(),
            rem.GetProperty("m3Pedido").GetDecimal(), rem.GetProperty("obra").GetProperty("nombre").GetString(), rem.GetProperty("obra").GetProperty("direccion").GetString()));
        Assert.Equal(8m, (await c.GetFromJsonAsync<JsonElement>($"/api/v1/viajes/{v1}/remision")).GetProperty("m3Acumulado").GetDecimal());
        Assert.Equal(("Planta Escárcega", 16), (rem.GetProperty("planta").GetProperty("nombre").GetString(), rem.GetProperty("sello").GetString()!.Length));
        Assert.NotEqual(JsonValueKind.Null, rem.GetProperty("horas").GetProperty("llegadaEn").ValueKind);

        // Firma: archivo subido a /archivos y quién recibe.
        var archivo = await c.PostAsync("/api/v1/archivos", new MultipartFormDataContent
        {
            { new ByteArrayContent([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), "archivo", "firma.png" },
            { new StringContent("Remision"), "registroTipo" }, { new StringContent(v2.ToString()), "registroId" },
        });
        Assert.True(archivo.IsSuccessStatusCode, await archivo.Content.ReadAsStringAsync());
        var archivoId = (await archivo.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var firmada = await Post($"/api/v1/viajes/{v2}/firma", new { archivoId, recibeNombre = "Residente Pérez" });
        Assert.Equal((archivoId, "Residente Pérez"), (firmada.GetProperty("firmaArchivoId").GetGuid(), firmada.GetProperty("recibeNombre").GetString()));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/v1/viajes/{v2}/firma", new { archivoId = Guid.NewGuid(), recibeNombre = "X" })).StatusCode);
    }

    [Fact]
    public async Task Muestras_ensayes_y_certificado()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        Guid producto;
        await using (var db = api.Db())
        {
            esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
            producto = (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).Id;
        }
        async Task<JsonElement> Post(string url, object body)
        {
            var x = await c.PostAsJsonAsync(url, body);
            Assert.True(x.IsSuccessStatusCode, await x.Content.ReadAsStringAsync());
            return await x.Content.ReadFromJsonAsync<JsonElement>();
        }
        Guid Id(JsonElement x) => x.GetProperty("id").GetGuid();
        var cliente = Id(await Post("/api/v1/clientes", new { nombre = $"Cliente lab {Guid.NewGuid():N}" }));
        var obra = Id(await Post("/api/v1/obras", new { clienteId = cliente, nombre = "Obra Lab", direccion = "Calle 3" }));
        async Task<Guid> Pedido() => Id(await Post("/api/v1/pedidos", new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = DateTime.UtcNow.AddDays(-30), metodoPago = "transferencia",
            descuentoPct = 0, lineas = new[] { new { productoId = producto, cantidad = 7 } },
        }));
        var pedido = await Pedido();
        Assert.Equal("pendiente", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}/certificado")).GetProperty("dictamen").GetString());

        var fecha = DateTime.UtcNow.AddDays(-30);
        var m = await Post("/api/v1/muestras", new { pedidoId = pedido, fechaMuestreo = fecha, revenimientoCm = 14 });
        Assert.StartsWith("MUE-ESC-", m.GetProperty("folio").GetString());
        Assert.Equal((250, 4), (m.GetProperty("resistenciaDisenoKgCm2").GetInt32(), m.GetProperty("cilindros").GetInt32()));
        var ensayes = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/ensayes?muestraId={Id(m)}&pendientes=true")).EnumerateArray().ToList();
        Assert.Equal([7, 14, 28], ensayes.Select(e => e.GetProperty("edadDias").GetInt32()).Order());
        var dia = DateOnly.FromDateTime(Application.Ventas.VentasServicio.HoraLocal(fecha, esc.ZonaHoraria));
        Assert.Equal(dia.AddDays(28), DateOnly.Parse(ensayes.Single(e => e.GetProperty("edadDias").GetInt32() == 28).GetProperty("fechaProgramada").GetString()!));

        async Task Capturar(JsonElement e, decimal kg)
        {
            var d = JsonSerializer.Deserialize<Dictionary<string, object?>>(e.GetRawText())!;
            (d["fechaEnsaye"], d["resistenciaKgCm2"]) = (e.GetProperty("fechaProgramada").GetString(), kg);
            var x = await c.PutAsJsonAsync($"/api/v1/ensayes/{Id(e)}", d);
            Assert.True(x.IsSuccessStatusCode, await x.Content.ReadAsStringAsync());
        }
        await Capturar(ensayes.Single(e => e.GetProperty("edadDias").GetInt32() == 7), 180);
        await Capturar(ensayes.Single(e => e.GetProperty("edadDias").GetInt32() == 28), 270);
        Assert.Single((await c.GetFromJsonAsync<JsonElement>($"/api/v1/ensayes?muestraId={Id(m)}&pendientes=true")).EnumerateArray());
        var cert = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}/certificado");
        Assert.Equal(("cumple", 250, 28, 270m, 1), (cert.GetProperty("dictamen").GetString(), cert.GetProperty("fc").GetInt32(), cert.GetProperty("edadDias").GetInt32(),
            cert.GetProperty("resumen28").GetProperty("promedio").GetDecimal(), cert.GetProperty("resumen28").GetProperty("n").GetInt32()));
        Assert.Equal(108m, cert.GetProperty("muestras")[0].GetProperty("ensayes").EnumerateArray()
            .Single(e => e.GetProperty("edadDias").GetInt32() == 28).GetProperty("porcentaje").GetDecimal());

        // Otro cilindro a 28 días por debajo de f'c − 35: no cumple.
        var m2 = await Post("/api/v1/muestras", new { pedidoId = pedido, fechaMuestreo = fecha });
        var e28 = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/ensayes?muestraId={Id(m2)}")).EnumerateArray().Single(e => e.GetProperty("edadDias").GetInt32() == 28);
        await Capturar(e28, 210);
        Assert.Equal("no_cumple", (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}/certificado")).GetProperty("dictamen").GetString());

        // El viaje debe ser del pedido.
        var otro = await Pedido();
        Guid viajeOtro;
        await using (var db = api.Db())
        {
            viajeOtro = db.Add(new Remision { PedidoId = otro, Folio = $"R-{Guid.NewGuid():N}"[..12], VolumenM3 = 7 }).Entity.Id;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/muestras", new { pedidoId = pedido, remisionId = viajeOtro })).StatusCode);
    }

    [Fact]
    public async Task Indicadores_de_ciclo_obra_y_prolongados()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        Guid producto;
        await using (var db = api.Db())
        {
            esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
            producto = (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).Id;
        }
        async Task<Guid> Id(HttpResponseMessage x) => (await x.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var eco = $"I{Guid.NewGuid():N}"[..10];
        var olla = await Id(await c.PostAsJsonAsync("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco }));
        var bomba = await Id(await c.PostAsJsonAsync("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "bomba_pluma", numeroEconomico = $"{eco}B" }));
        var op = await Id(await c.PostAsJsonAsync("/api/v1/operadores", new { nombre = $"Operador {eco}" }));
        var cliente = await Id(await c.PostAsJsonAsync("/api/v1/clientes", new { nombre = $"Cliente {eco}" }));
        var obra = await Id(await c.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Obra Ind", direccion = "Calle 1" }));
        var entrega = DateTime.UtcNow.AddDays(-2);
        var pedido = await Id(await c.PostAsJsonAsync("/api/v1/pedidos", new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = entrega, metodoPago = "transferencia", descuentoPct = 0,
            lineas = new[] { new { productoId = producto, cantidad = 14 } },
        }));
        // Dos ollas: ciclo 120 y 180 min; en obra 30 y 100 (prolongado). La bomba no suma m³.
        await using (var db = api.Db())
        {
            Remision V(Guid equipo, int n, int obraMin) => new()
            {
                PedidoId = pedido, Folio = $"R-{eco}-{n}", EquipoId = equipo, OperadorId = op, OperadorNombre = $"Operador {eco}", VolumenM3 = 7,
                Estado = EstadoViaje.Terminado, CargandoEn = entrega, SalidaEn = entrega.AddMinutes(15), LlegadaEn = entrega.AddMinutes(45),
                RegresandoEn = entrega.AddMinutes(45 + obraMin), TerminadaEn = entrega.AddMinutes(90 + obraMin),
            };
            db.AddRange(V(olla, 1, 30), V(olla, 2, 100), V(bomba, 3, 60));
            await db.SaveChangesAsync();
        }
        var ind = await c.GetFromJsonAsync<JsonElement>(
            $"/api/v1/flota/indicadores?desde={entrega.AddMinutes(-1):O}&hasta={entrega.AddMinutes(1):O}&sucursalId={esc.Id}");
        var tot = ind.GetProperty("totales");
        Assert.Equal((3, 14m, 3, 1), (tot.GetProperty("remisiones").GetInt32(), tot.GetProperty("m3").GetDecimal(), tot.GetProperty("viajesTerminados").GetInt32(),
            tot.GetProperty("prolongados").GetInt32()));
        Assert.Equal((153.3m, 63.3m), (tot.GetProperty("cicloPromMin").GetDecimal(), tot.GetProperty("tiempoObraPromMin").GetDecimal()));
        var unidad = ind.GetProperty("porUnidad").EnumerateArray().Single(x => x.GetProperty("equipoId").GetGuid() == olla);
        Assert.Equal((2, 14m, 155m, 65m), (unidad.GetProperty("viajes").GetInt32(), unidad.GetProperty("m3").GetDecimal(),
            unidad.GetProperty("cicloPromMin").GetDecimal(), unidad.GetProperty("tiempoObraPromMin").GetDecimal()));
        Assert.Equal((3, 14m), (ind.GetProperty("porConductor")[0].GetProperty("viajes").GetInt32(), ind.GetProperty("porConductor")[0].GetProperty("m3").GetDecimal()));
        Assert.Equal($"Cliente {eco}", ind.GetProperty("porCliente")[0].GetProperty("nombre").GetString());
        Assert.Single(ind.GetProperty("porDia").EnumerateArray());
        var pro = ind.GetProperty("prolongados").EnumerateArray().Single();
        Assert.Equal((100, $"R-{eco}-2", "Obra Ind"), (pro.GetProperty("minutos").GetInt32(), pro.GetProperty("folio").GetString(), pro.GetProperty("obraNombre").GetString()));
    }

    [Fact]
    public async Task Linea_de_tiempo_por_unidad_con_etapas()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        Guid producto;
        await using (var db = api.Db())
        {
            esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
            producto = (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).Id;
        }
        async Task<Guid> Id(HttpResponseMessage x) => (await x.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var eco = $"T{Guid.NewGuid():N}"[..10];
        var olla = await Id(await c.PostAsJsonAsync("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco }));
        var libre = await Id(await c.PostAsJsonAsync("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "volteo", numeroEconomico = $"{eco}L" }));
        var cliente = await Id(await c.PostAsJsonAsync("/api/v1/clientes", new { nombre = $"Cliente {eco}" }));
        var obra = await Id(await c.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Obra Linea", direccion = "Calle 1" }));
        var entrega = DateTime.UtcNow.AddMinutes(20);
        var pedido = await Id(await c.PostAsJsonAsync("/api/v1/pedidos", new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = entrega, metodoPago = "transferencia", descuentoPct = 0,
            lineas = new[] { new { productoId = producto, cantidad = 7 } },
        }));
        await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null);
        var viaje = await Id(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/viajes", new { equipoId = olla, volumenM3 = 7 }));
        await c.PostAsJsonAsync($"/api/v1/viajes/{viaje}/estado", new { estado = "en_ruta" });   // llena cargandoEn y salidaEn

        var dia = DateOnly.FromDateTime(Application.Ventas.VentasServicio.HoraLocal(entrega, esc.ZonaHoraria));
        var linea = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/linea-tiempo?fecha={dia:yyyy-MM-dd}&sucursalId={esc.Id}")).EnumerateArray().ToList();
        var fila = linea.Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == olla);
        var v = fila.GetProperty("viajes").EnumerateArray().Single();
        Assert.Equal(("Obra Linea", "en_ruta"), (v.GetProperty("obraNombre").GetString(), v.GetProperty("estado").GetString()));
        Assert.Equal([("carga", true), ("ida", true), ("obra", false), ("regreso", false)],
            v.GetProperty("etapas").EnumerateArray().Select(e => (e.GetProperty("etapa").GetString(), e.GetProperty("real").GetBoolean())));
        Assert.Empty(linea.Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == libre).GetProperty("viajes").EnumerateArray());
        await using (var db = api.Db())
        {
            var r = await db.Set<Remision>().SingleAsync(x => x.Id == viaje);
            Assert.NotNull(r.CargandoEn);
        }
    }

    [Fact]
    public async Task Posiciones_se_guardan_sin_duplicar_y_dan_mapa_y_recorrido()
    {
        var (c, _) = await api.Entrar(Api.Root, Api.RootPassword);
        Sucursal esc;
        await using (var db = api.Db()) esc = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "ESC");
        var eco = $"G{Guid.NewGuid():N}"[..10];
        var gpsId = $"imei{Guid.NewGuid():N}"[..20];
        var r = await c.PostAsJsonAsync("/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco, gpsId });
        var equipo = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        // Lo que llega de Traccar se guarda una vez por fecha.
        var ahora = DateTime.UtcNow;
        GpsLectura Lectura(DateTime f) => new(true, [new GpsDispositivo(gpsId, eco, "online",
            new Posicion(21.05m, -89.62m, f, 42, 90, 15, new System.Text.Json.Nodes.JsonObject { ["tamborSentido"] = "carga" }), null)]);
        async Task<int> Guardar(GpsLectura l)
        {
            await using var scope = api.Services.CreateAsyncScope();
            return await scope.ServiceProvider.GetRequiredService<FlotaServicio>().GuardarPosiciones(l, default);
        }
        Assert.Equal(1, await Guardar(Lectura(ahora.AddMinutes(-1))));
        Assert.Equal(0, await Guardar(Lectura(ahora.AddMinutes(-1))));
        var mapa = (await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/posiciones")).EnumerateArray().Single(x => x.GetProperty("equipoId").GetGuid() == equipo);
        Assert.Equal((21.05m, 42m, 90m, "carga"), (mapa.GetProperty("lat").GetDecimal(), mapa.GetProperty("velocidadKmh").GetDecimal(),
            mapa.GetProperty("rumbo").GetDecimal(), mapa.GetProperty("atributos").GetProperty("tamborSentido").GetString()));
        Assert.Equal(["Planta Escárcega"], mapa.GetProperty("plantaNombres").EnumerateArray().Select(x => x.GetString()));

        // Recorrido: 2 h de puntos cada 30 s (240), con un viaje en medio.
        var inicio = ahora.AddHours(-3);
        await using (var db = api.Db())
        {
            for (var i = 0; i < 240; i++)
                db.Add(new PosicionEquipo { EquipoId = equipo, Fecha = inicio.AddSeconds(30 * i), Lat = 21m + i * 0.0005m, Lng = -89.6m, VelocidadKmh = i % 2 == 0 ? 50 : 0, Fuente = FuentePosicion.Manual });
            await db.SaveChangesAsync();
        }
        var rec = await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{equipo}/recorrido?desde={inicio:O}&hasta={ahora:O}");
        Assert.Equal(241, rec.GetProperty("puntos").GetArrayLength());
        Assert.InRange(rec.GetProperty("resumen").GetProperty("km").GetDecimal(), 6.5m, 6.8m); // solo los tramos en movimiento (la mitad)
        Assert.Equal(50m, rec.GetProperty("resumen").GetProperty("velocidadMaxKmh").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync($"/api/v1/equipos/{equipo}/recorrido?desde={ahora.AddDays(-8):O}&hasta={ahora:O}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync($"/api/v1/equipos/{equipo}/recorrido")).StatusCode); // últimas 12 h

        // Recorrido de un viaje: su ventana de salida a término.
        async Task<Guid> Id(HttpResponseMessage x) => (await x.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var cliente = await Id(await c.PostAsJsonAsync("/api/v1/clientes", new { nombre = $"Cliente {eco}" }));
        var obra = await Id(await c.PostAsJsonAsync("/api/v1/obras", new { clienteId = cliente, nombre = "Obra", direccion = "Calle 1" }));
        Guid producto;
        await using (var db = api.Db()) producto = (await db.Set<Producto>().SingleAsync(x => x.Codigo == "CON-FC-250")).Id;
        var pedido = await Id(await c.PostAsJsonAsync("/api/v1/pedidos", new
        {
            sucursalId = esc.Id, clienteId = cliente, obraId = obra, fechaHoraEntrega = inicio.AddHours(1), metodoPago = "transferencia", descuentoPct = 0,
            lineas = new[] { new { productoId = producto, cantidad = 7 } },
        }));
        Guid viaje;
        await using (var db = api.Db())
        {
            viaje = db.Add(new Remision
            {
                PedidoId = pedido, Folio = $"REM-{eco}", EquipoId = equipo, VolumenM3 = 7, Estado = EstadoViaje.Terminado,
                SalidaEn = inicio.AddMinutes(30), TerminadaEn = inicio.AddMinutes(60),
            }).Entity.Id;
            await db.SaveChangesAsync();
        }
        var rv = await c.GetFromJsonAsync<JsonElement>($"/api/v1/viajes/{viaje}/recorrido");
        Assert.Equal(61, rv.GetProperty("puntos").GetArrayLength());
        Assert.Equal(viaje, rv.GetProperty("viajes")[0].GetProperty("id").GetGuid());
    }
}
