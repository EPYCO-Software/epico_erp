using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Flota;
using EPICO.Domain.Acceso;
using EPICO.Domain.Correo;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EPICO.Tests;

public class ReagendaTests(Api api) : IClassFixture<Api>
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

    static DateTime F(JsonElement x, string campo) => x.GetProperty(campo).GetDateTime().ToUniversalTime();

    [Fact]
    public void Transporte_se_calcula_con_la_distancia()
    {
        Assert.Equal(45, FlotaServicio.TransporteCalculado(15, porCarretera: true)); // 15 km × 2 / 40 km/h = 45 min
        Assert.Equal(60, FlotaServicio.TransporteCalculado(15));                     // línea recta × 1.3 = 58.5 → 60
        Assert.Equal(30, FlotaServicio.TransporteCalculado(1, porCarretera: true));  // mínimo 30
        Assert.Equal(60, FlotaServicio.TransporteCalculado(null));                   // sin distancia
        Assert.InRange(FlotaServicio.Km(18.6101m, -90.7352m, 18.5097m, -89.3946m), 140, 145); // Escárcega → Xpujil
    }

    [Fact]
    public async Task Tiempos_ventanas_reagenda_y_solicitudes()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        var entrega = DateTime.UtcNow.Date.AddDays(4).AddHours(16);
        var eco = $"V{Guid.NewGuid():N}"[..10];
        var olla = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco });
        var bomba = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "bomba_pluma", numeroEconomico = $"{eco}B" });
        var pedido = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 14, entrega));
        var url = $"/api/v1/pedidos/{pedido}/viajes";

        // Tiempos: sin distancia 60 de transporte; el concreto sin dato, 60 de servicio.
        var t = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("tiempos");
        Assert.Equal((60, true, 60, 120), (t.GetProperty("transporteMin").GetInt32(), t.GetProperty("transporteCalculado").GetBoolean(),
            t.GetProperty("servicioMin").GetInt32(), t.GetProperty("totalMin").GetInt32()));

        // Se asigna también en solicitud de confirmación a planta (enviado), sin confirmar.
        await Error(await c.PostAsJsonAsync(url, new { equipoId = olla, volumenM3 = 8 }), HttpStatusCode.Conflict, "Confirma la orden");
        await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/planta", new { accion = "enviar" }), HttpStatusCode.OK);
        var v1 = await Json(await c.PostAsJsonAsync(url, new { equipoId = olla, volumenM3 = 8 }), HttpStatusCode.Created);
        Assert.Equal((entrega.AddMinutes(-30), entrega.AddMinutes(90), 120), (F(v1, "salidaProgramada"), F(v1, "regresoEstimado"), v1.GetProperty("duracionMin").GetInt32()));
        // La bomba: 120 de servicio (sin producto de bombeo en la orden) y salida ajustada a mano.
        var vb = await Json(await c.PostAsJsonAsync(url, new { equipoId = bomba, volumenM3 = 14, salidaProgramada = entrega.AddHours(-2) }), HttpStatusCode.Created);
        Assert.Equal((entrega.AddHours(-2), entrega.AddHours(1), 180), (F(vb, "salidaProgramada"), F(vb, "regresoEstimado"), vb.GetProperty("duracionMin").GetInt32()));

        // Cambiar el transporte recalcula las ventanas de los viajes programados.
        var conTiempos = await Json(await c.PutAsJsonAsync($"/api/v1/pedidos/{pedido}/tiempos", new { transporteMin = 120 }), HttpStatusCode.OK);
        Assert.Equal((false, 180), (conTiempos.GetProperty("tiempos").GetProperty("transporteCalculado").GetBoolean(),
            conTiempos.GetProperty("tiempos").GetProperty("totalMin").GetInt32()));
        var viajes = (await c.GetFromJsonAsync<JsonElement>(url)).EnumerateArray().ToList();
        var o1 = viajes.Single(v => v.GetProperty("equipoId").GetGuid() == olla);
        Assert.Equal((entrega.AddMinutes(-60), entrega.AddMinutes(120)), (F(o1, "salidaProgramada"), F(o1, "regresoEstimado")));

        // Disponibilidad por ventanas: choca a +100 min, libre a +4 h (antes ±4 h lo bloqueaba).
        string Hora(DateTime utc) => Application.Ventas.VentasServicio.HoraLocal(utc, esc.ZonaHoraria).ToString("HH:mm");
        var folio = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("folio").GetString();
        var choca = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddMinutes(100)));
        var libre = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddHours(4)));
        JsonElement Del(JsonElement tab, Guid e) => tab.GetProperty("equipos").EnumerateArray().Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == e);
        Assert.Equal($"Ocupado con {folio} de {Hora(entrega.AddMinutes(-60))} a {Hora(entrega.AddMinutes(120))}",
            Del(await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={choca}"), olla).GetProperty("motivo").GetString());
        Assert.True(Del(await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={libre}"), olla).GetProperty("disponible").GetBoolean());
        var tab = Del(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/tablero"), olla).GetProperty("viaje");
        Assert.Equal(180, tab.GetProperty("duracionMin").GetInt32());
        await Json(await c.PostAsync($"/api/v1/pedidos/{libre}/confirmar", null), HttpStatusCode.OK);
        await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{libre}/viajes", new { equipoId = olla, volumenM3 = 7 }), HttpStatusCode.Created);

        // Reagendar: sin correo del cliente pide a quién avisar y no cambia nada.
        var nueva = entrega.AddHours(4);
        await Error(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/reagendar", new { fechaHoraEntrega = nueva, motivo = "Lluvia" }),
            HttpStatusCode.BadRequest, "El cliente no tiene correo: indica a quién avisar.");
        Assert.Equal(entrega, F(await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}"), "fechaHoraEntrega"));
        Assert.False((await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{pedido}")).GetProperty("clienteTieneCorreo").GetBoolean());
        var aviso = $"aviso{Guid.NewGuid():N}@cliente.mx";
        var res = await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/reagendar", new { fechaHoraEntrega = nueva, motivo = "Lluvia", correo = aviso }),
            HttpStatusCode.OK);
        Assert.Equal([aviso], res.GetProperty("notificadoA").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal([eco], res.GetProperty("quitados").EnumerateArray().Select(x => x.GetString())); // la olla ya va en la otra orden
        Assert.Equal((nueva, "enviado"), (F(res.GetProperty("pedido"), "fechaHoraEntrega"), res.GetProperty("pedido").GetProperty("estatusPlanta").GetString()));
        var queda = (await c.GetFromJsonAsync<JsonElement>(url)).EnumerateArray().Single();
        Assert.Equal(nueva.AddMinutes(-60), F(queda, "salidaProgramada"));
        await using (var db = api.Db())
        {
            var correo = await db.Set<CorreoSaliente>().SingleAsync(x => x.Para == aviso);
            Assert.Contains("Lluvia", correo.Html);
            Assert.Contains(await db.Set<Evento>().Where(e => e.RegistroId == pedido).ToListAsync(), e => e.Texto.StartsWith("Entrega reagendada:"));
        }

        // Solicitudes: una pendiente por pedido; avisa a quien reagenda; se rechaza o se acepta.
        Empresa empresa;
        await using (var db = api.Db()) empresa = await db.Set<Empresa>().SingleAsync(e => e.Id == esc.EmpresaId);
        var correoV = $"reag{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correoV, "Clave.Reag.1", ["ventas.pedidos.ver", "ventas.pedidos.reagendar"], empresa);
        var sol = await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{libre}/solicitudes-reagenda",
            new { fechaPropuesta = entrega.AddDays(1), motivo = "Sin operador" }), HttpStatusCode.Created);
        Assert.Equal(("logistica", "pendiente"), (sol.GetProperty("origen").GetString(), sol.GetProperty("estado").GetString()));
        var folioLibre = sol.GetProperty("pedidoFolio").GetString();
        await Error(await c.PostAsJsonAsync($"/api/v1/pedidos/{libre}/solicitudes-reagenda", new { fechaPropuesta = entrega, motivo = "Otra" }),
            HttpStatusCode.Conflict, $"Ya hay una solicitud pendiente para {folioLibre}.");
        await using (var db = api.Db())
            Assert.True(await db.Set<Notificacion>().AnyAsync(n => n.Titulo.StartsWith("Solicitud de reagenda")
                && db.Set<Usuario>().Any(u => u.Id == n.UsuarioId && u.Correo == correoV)));
        var conPendiente = await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{libre}");
        Assert.Equal(sol.GetProperty("id").GetGuid(), conPendiente.GetProperty("reagendaPendiente").GetProperty("id").GetGuid());
        Assert.Contains((await c.GetFromJsonAsync<JsonElement>("/api/v1/solicitudes-reagenda?estado=pendiente")).EnumerateArray(),
            x => x.GetProperty("pedidoFolio").GetString() == folioLibre);
        var rech = await Json(await c.PostAsJsonAsync($"/api/v1/solicitudes-reagenda/{sol.GetProperty("id").GetGuid()}/rechazar", new { nota = "No hay cupo" }),
            HttpStatusCode.OK);
        Assert.Equal("rechazada", rech.GetProperty("estado").GetString());
        var sol2 = await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{libre}/solicitudes-reagenda",
            new { fechaPropuesta = entrega.AddDays(1), motivo = "Sin operador" }), HttpStatusCode.Created);
        var acep = await Json(await c.PostAsJsonAsync($"/api/v1/solicitudes-reagenda/{sol2.GetProperty("id").GetGuid()}/aceptar", new { correo = aviso }),
            HttpStatusCode.OK);
        Assert.Equal(entrega.AddDays(1), F(acep.GetProperty("pedido"), "fechaHoraEntrega"));
        Assert.Equal(JsonValueKind.Null, acep.GetProperty("pedido").GetProperty("reagendaPendiente").ValueKind);
        Assert.Equal(["aceptada", "rechazada"], (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{libre}/solicitudes-reagenda"))
            .EnumerateArray().Select(x => x.GetProperty("estado").GetString()));

        // La propuesta de la planta entra a la misma cola; al aceptar su fecha queda confirmado con planta.
        var conPlanta = await Crear(c, "/api/v1/pedidos", Pedido(esc, cliente, obra, prod["CON-FC-250"], 7, entrega.AddDays(2)));
        await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{conPlanta}/planta", new { accion = "enviar" }), HttpStatusCode.OK);
        await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{conPlanta}/planta",
            new { accion = "actualizacion", fecha = entrega.AddDays(3), nota = "Mantenimiento" }), HttpStatusCode.OK);
        var dePlanta = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/pedidos/{conPlanta}/solicitudes-reagenda")).EnumerateArray().Single();
        Assert.Equal(("planta", "pendiente", "Mantenimiento"), (dePlanta.GetProperty("origen").GetString(), dePlanta.GetProperty("estado").GetString(),
            dePlanta.GetProperty("motivo").GetString()));
        var ok = await Json(await c.PostAsJsonAsync($"/api/v1/solicitudes-reagenda/{dePlanta.GetProperty("id").GetGuid()}/aceptar", new { correo = aviso }),
            HttpStatusCode.OK);
        Assert.Equal(("confirmado", JsonValueKind.Null), (ok.GetProperty("pedido").GetProperty("estatusPlanta").GetString(),
            ok.GetProperty("pedido").GetProperty("solicitudPlantaFecha").ValueKind));

        // Despacho trae tiempos, estatus de planta y reagenda pendiente.
        var dia = DateOnly.FromDateTime(Application.Ventas.VentasServicio.HoraLocal(nueva, esc.ZonaHoraria));
        var desp = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/despacho?fecha={dia:yyyy-MM-dd}&sucursalId={esc.Id}")).EnumerateArray()
            .Single(x => x.GetProperty("pedido").GetProperty("id").GetGuid() == pedido).GetProperty("pedido");
        Assert.Equal((180, "enviado"), (desp.GetProperty("tiempos").GetProperty("totalMin").GetInt32(), desp.GetProperty("estatusPlanta").GetString()));

        // Con un viaje en curso ya no se reagenda.
        await Json(await c.PostAsJsonAsync($"/api/v1/viajes/{queda.GetProperty("id").GetGuid()}/estado", new { estado = "cargando" }), HttpStatusCode.OK);
        await Error(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/reagendar", new { fechaHoraEntrega = entrega, motivo = "x", correo = aviso }),
            HttpStatusCode.Conflict, "La orden ya va en camino: no se puede reagendar.");
    }

    [Fact]
    public async Task Plantas_trayectos_resumen_y_avisos_de_combustible()
    {
        var (c, esc, cliente, obra, prod) = await Preparar();
        Sucursal xpj;
        await using (var db = api.Db()) xpj = await db.Set<Sucursal>().SingleAsync(s => s.Codigo == "XPJ");
        var eco = $"P{Guid.NewGuid():N}"[..10];
        var soloEsc = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, tipo = "revolvedor", numeroEconomico = eco });
        var dos = await Crear(c, "/api/v1/equipos", new { sucursalId = esc.Id, sucursalIds = new[] { xpj.Id }, tipo = "revolvedor", numeroEconomico = $"{eco}2" });
        Assert.Equal([esc.Id], (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{soloEsc}")).GetProperty("sucursalIds").EnumerateArray().Select(x => x.GetGuid()));
        Assert.Equal([esc.Id, xpj.Id], (await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{dos}")).GetProperty("sucursalIds").EnumerateArray().Select(x => x.GetGuid()));

        // Pedido en Xpujil: la de una sola planta no opera ahí.
        var entrega = DateTime.UtcNow.Date.AddDays(3).AddHours(15);
        var pedido = await Crear(c, "/api/v1/pedidos", Pedido(xpj, cliente, obra, prod["CON-FC-250"], 7, entrega));
        JsonElement Del(JsonElement tab, Guid e) => tab.GetProperty("equipos").EnumerateArray().Single(x => x.GetProperty("equipo").GetProperty("id").GetGuid() == e);
        var tab = await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/tablero?pedidoId={pedido}");
        Assert.Equal("No opera en Planta Xpujil", Del(tab, soloEsc).GetProperty("motivo").GetString());
        Assert.True(Del(tab, dos).GetProperty("disponible").GetBoolean());
        Assert.Equal(["Planta Escárcega", "Planta Xpujil"], Del(tab, dos).GetProperty("plantaNombres").EnumerateArray().Select(x => x.GetString()));

        // Quien solo entra a Xpujil ve la unidad que opera ahí, no la otra.
        var empresa = await api.Empresa("EPICO Concretos del Sureste");
        var correo = $"xpj{Guid.NewGuid():N}@epico.mx";
        var u = await api.CrearUsuario(correo, "Clave.Xpj.1", ["flota.equipos.ver"], empresa);
        await using (var db = api.Db())
        {
            (await db.Set<UsuarioAcceso>().SingleAsync(a => a.UsuarioId == u.Id)).SucursalId = xpj.Id;
            await db.SaveChangesAsync();
        }
        var (deXpj, _) = await api.Entrar(correo, "Clave.Xpj.1");
        Assert.Equal(HttpStatusCode.OK, (await deXpj.GetAsync($"/api/v1/equipos/{dos}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await deXpj.GetAsync($"/api/v1/equipos/{soloEsc}")).StatusCode);

        // Trayecto manual: km por odómetro.
        var manual = await Json(await c.PostAsJsonAsync("/api/v1/trayectos", new
        {
            equipoId = dos, tipo = "traslado", inicio = DateTime.UtcNow.AddHours(-2), fin = DateTime.UtcNow.AddHours(-1),
            origen = "Escárcega", destino = "Xpujil", odometroInicio = 1000, odometroFin = 1100, kmEstimado = true,
        }), HttpStatusCode.Created);
        Assert.Equal((100m, false), (manual.GetProperty("km").GetDecimal(), manual.GetProperty("kmEstimado").GetBoolean()));
        await Error(await c.PostAsJsonAsync("/api/v1/trayectos", new { equipoId = dos, tipo = "flete", inicio = DateTime.UtcNow, odometroInicio = 50, odometroFin = 40 }),
            HttpStatusCode.BadRequest, "El odómetro final no puede ser menor al inicial.");

        // Al terminar el viaje queda su trayecto de entrega (estimado), uno solo.
        await Json(await c.PostAsync($"/api/v1/pedidos/{pedido}/confirmar", null), HttpStatusCode.OK);
        var v = await Json(await c.PostAsJsonAsync($"/api/v1/pedidos/{pedido}/viajes", new { equipoId = dos, volumenM3 = 7 }), HttpStatusCode.Created);
        await Json(await c.PostAsJsonAsync($"/api/v1/viajes/{v.GetProperty("id").GetGuid()}/estado", new { estado = "terminado" }), HttpStatusCode.OK);
        var trayectos = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/trayectos?equipoId={dos}")).EnumerateArray().ToList();
        var deEntrega = trayectos.Single(t => t.GetProperty("tipo").GetString() == "entrega");
        Assert.Equal((v.GetProperty("id").GetGuid(), pedido, true), (deEntrega.GetProperty("remisionId").GetGuid(), deEntrega.GetProperty("pedidoId").GetGuid(),
            deEntrega.GetProperty("kmEstimado").GetBoolean()));
        Assert.Equal("Planta Xpujil", deEntrega.GetProperty("origen").GetString());

        // Resumen: 2 cargas → rendimiento (1300 − 1000) / 120 L = 2.5 km/L.
        object Carga(int dias, decimal km, decimal litros) => new { equipoId = dos, fecha = DateTime.UtcNow.AddDays(dias), litros, costoTotal = litros * 25, odometroKm = km };
        await Json(await c.PostAsJsonAsync("/api/v1/cargas-combustible", Carga(-5, 1000, 100)), HttpStatusCode.Created);
        await Json(await c.PostAsJsonAsync("/api/v1/cargas-combustible", Carga(-1, 1300, 120)), HttpStatusCode.Created);
        var res = await c.GetFromJsonAsync<JsonElement>($"/api/v1/equipos/{dos}/resumen?desde={DateTime.UtcNow.AddDays(-30):O}&hasta={entrega.AddDays(1):O}");
        Assert.Equal((2, 100m, 0m, 1, 7m, 220m, 5500m, 2.5m, 100m),
            (res.GetProperty("trayectos").GetInt32(), res.GetProperty("km").GetDecimal(), res.GetProperty("kmEstimados").GetDecimal(),
             res.GetProperty("viajes").GetInt32(), res.GetProperty("m3").GetDecimal(), res.GetProperty("litros").GetDecimal(),
             res.GetProperty("costoCombustible").GetDecimal(), res.GetProperty("rendimientoKmL").GetDecimal(), res.GetProperty("kmDesdeUltimaCarga").GetDecimal()));
        Assert.Equal(1300m, res.GetProperty("ultimaCarga").GetProperty("odometroKm").GetDecimal());

        // Avisos de combustible: por km (≥ 500 desde la última carga) aunque no hayan pasado 7 días.
        string Titulo(string e) => $"Registrar carga y odómetro · {e}";
        JsonElement Aviso(JsonElement lista, string e) => lista.EnumerateArray().Single(x => x.GetProperty("titulo").GetString() == Titulo(e));
        var venc = await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/vencimientos");
        Assert.Equal(("combustible", false), (Aviso(venc, $"{eco}2").GetProperty("tipo").GetString(), Aviso(venc, $"{eco}2").GetProperty("vencido").GetBoolean()));
        await Json(await c.PostAsJsonAsync("/api/v1/trayectos", new { equipoId = dos, tipo = "flete", inicio = DateTime.UtcNow.AddMinutes(-30), km = 450 }),
            HttpStatusCode.Created);
        Assert.True(Aviso(await c.GetFromJsonAsync<JsonElement>("/api/v1/flota/vencimientos"), $"{eco}2").GetProperty("vencido").GetBoolean());

        var correoF = $"diesel{Guid.NewGuid():N}@epico.mx";
        await api.CrearUsuario(correoF, "Clave.Diesel.1", ["flota.combustible.crear"], empresa);
        var job = api.Services.GetRequiredService<EPICO.Infrastructure.Gps.AvisosCombustible>();
        var hoy = DateOnly.FromDateTime(Application.Ventas.VentasServicio.HoraLocal(DateTime.UtcNow, "America/Mexico_City"));
        Assert.True(await job.Ejecutar(hoy, default) > 0);
        Assert.Equal(0, await job.Ejecutar(hoy, default)); // el mismo día no se repite
        var tituloDos = Titulo($"{eco}2");
        await using (var db = api.Db())
            Assert.Single(await db.Set<Notificacion>().Where(n => n.Titulo == tituloDos
                && db.Set<Usuario>().Any(x => x.Id == n.UsuarioId && x.Correo == correoF)).ToListAsync());

        // Despacho: ubicación del lugar de entrega y de la planta.
        var conLugar = await Crear(c, "/api/v1/pedidos", new
        {
            sucursalId = xpj.Id, clienteId = cliente, fechaHoraEntrega = entrega.AddHours(1), metodoPago = "transferencia", descuentoPct = 0,
            entregaDireccion = "Km 5 carretera", entregaMunicipio = "Calakmul", entregaLat = 18.52m, entregaLng = -89.40m,
            lineas = new[] { new { productoId = prod["CON-FC-250"], cantidad = 7 } },
        });
        var dia = DateOnly.FromDateTime(Application.Ventas.VentasServicio.HoraLocal(entrega, xpj.ZonaHoraria));
        var desp = (await c.GetFromJsonAsync<JsonElement>($"/api/v1/flota/despacho?fecha={dia:yyyy-MM-dd}&sucursalId={xpj.Id}")).EnumerateArray()
            .ToDictionary(x => x.GetProperty("pedido").GetProperty("id").GetGuid(), x => x.GetProperty("pedido"));
        Assert.Equal((18.52m, -89.40m), (desp[conLugar].GetProperty("ubicacion").GetProperty("lat").GetDecimal(),
            desp[conLugar].GetProperty("ubicacion").GetProperty("lng").GetDecimal()));
        Assert.Equal(JsonValueKind.Null, desp[pedido].GetProperty("ubicacion").ValueKind); // la obra no tiene coordenadas
        Assert.Equal(xpj.Lat, desp[pedido].GetProperty("plantaUbicacion").GetProperty("lat").GetDecimal());
    }
}
