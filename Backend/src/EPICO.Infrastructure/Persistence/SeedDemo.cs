using System.Text.Json;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EPICO.Infrastructure.Persistence;

/// <summary>
/// Datos de prueba (Seed:Demo=true o --migrate --demo): la empresa "Concretos Demo" con dos plantas, usuarios,
/// clientes, cotizaciones, pedidos, CRM, precios, programas y equipos; un registro de cada opción. Corre después
/// de <see cref="Seed"/>. Todo va en un solo SaveChanges: si la empresa demo ya existe no hace nada.
/// shortcut: no completa una demo vieja con registros nuevos; para regenerarla, borra la base o la empresa demo.
/// </summary>
public static class SeedDemo
{
    public const string Empresa = "Concretos Demo S.A. de C.V.", Dominio = "demo.epyco.cloud", Password = "Demo.Epico1";

    public static async Task EjecutarAsync(AppDbContext db, string? rootCorreo, ILogger log, CancellationToken ct = default)
    {
        var org = await db.Set<Organizacion>().FirstAsync(o => o.Slug == "epico", ct);
        if (await db.Set<Empresa>().AnyAsync(e => e.OrganizacionId == org.Id && e.RazonSocial == Empresa, ct))
        {
            log.LogInformation("Seed demo: la empresa demo ya existe; solo se completa la logística si falta");
            await LogisticaAsync(db, org, ct);
            await ReagendaAsync(db, org, ct);
            await TrayectosAsync(db, ct);
            await HistorialViajesAsync(db, ct);
            await LaboratorioAsync(db, ct);
            await PosicionesAsync(db, ct);
            return;
        }

        var ahora = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(ahora);
        var año = ahora.ToString("yy");

        // --- Empresa y plantas -----------------------------------------------------------------------------
        var emp = db.Add(new Empresa
        {
            OrganizacionId = org.Id, RazonSocial = Empresa, NombreComercial = "Concretos Demo", RFC = "CDE200101AB1",
            RegimenFiscal = "601", CPFiscal = "97000", ZonaHoraria = "America/Merida",
        }).Entity;
        var norte = db.Add(new Sucursal
        {
            EmpresaId = emp.Id, Codigo = "DMA", Nombre = "Planta Norte", ZonaHoraria = "America/Merida",
            Direccion = "Periférico Norte km 4.5, Mérida, Yuc.", Lat = 21.0450m, Lng = -89.6260m, Telefono = "9991234567",
            KmIncluidos = 20, PrecioKm = 12,
        }).Entity;
        var sur = db.Add(new Sucursal
        {
            EmpresaId = emp.Id, Codigo = "DMB", Nombre = "Planta Sur", ZonaHoraria = "America/Merida",
            Direccion = "Av. Gobernadores 410, San Francisco de Campeche, Camp.", Lat = 19.8301m, Lng = -90.5349m,
            Telefono = "9817654321", KmIncluidos = 15, PrecioKm = 15,
        }).Entity;
        // Folios usados abajo a mano; la secuencia sigue después de ellos.
        var folios = new Dictionary<(Sucursal, string), long>();
        string Folio(Sucursal s, string tipo, string prefijo)
        {
            var n = folios[(s, tipo)] = folios.GetValueOrDefault((s, tipo)) + 1;
            return Secuencia.Folio(prefijo, n);
        }
        string PrefijoCot(Sucursal s) => $"EPI-PRES-{s.Codigo}-{año}";
        string PrefijoPed(Sucursal s) => $"PED-{s.Codigo}-{año}-";
        string PrefijoRem(Sucursal s) => $"REM-{s.Codigo}-{año}-";

        // --- Usuarios --------------------------------------------------------------------------------------
        var roles = await db.Set<Rol>().Where(r => r.OrganizacionId == null).ToDictionaryAsync(r => r.Nombre, ct);
        var hasher = new PasswordHasher<Usuario>();
        Usuario NuevoUsuario(string usuario, string nombre, string? apellidos, string? puesto, TipoUsuario tipo = TipoUsuario.Interno)
        {
            var u = new Usuario
            {
                Correo = $"{usuario}@{Dominio}", Nombre = nombre, Apellidos = apellidos, Puesto = puesto, Tipo = tipo,
                CorreoVerificado = true, Telefono = "9990000000",
            };
            u.PasswordHash = hasher.HashPassword(u, Password);
            return db.Add(u).Entity;
        }
        void Acceso(Usuario u, string rol, Sucursal? planta = null)
        {
            u.RolId = roles[rol].Id;
            db.Add(new UsuarioAcceso { UsuarioId = u.Id, EmpresaId = emp.Id, SucursalId = planta?.Id, Predeterminado = true });
        }

        var uRoot = NuevoUsuario("root", "Rocío", "Demo Root", "Dirección");
        Acceso(uRoot, Seed.RolRoot);
        var uAdmin = NuevoUsuario("admin", "Alberto", "Demo Admin", "Administración");
        Acceso(uAdmin, Seed.RolAdministrador);
        var vendedor = NuevoUsuario("ventas", "Valeria", "Demo Ventas", "Ejecutiva de ventas");
        Acceso(vendedor, Seed.RolVentas);
        var uPlanta = NuevoUsuario("norte", "Néstor", "Solo Planta Norte", "Ventas planta norte");
        Acceso(uPlanta, Seed.RolVentas, norte);
        var uInactivo = NuevoUsuario("inactivo", "Iván", "Demo Inactivo", "Ex vendedor");
        uInactivo.Activo = false;
        Acceso(uInactivo, Seed.RolVentas);
        var uBloqueado = NuevoUsuario("bloqueado", "Beatriz", "Demo Bloqueada", "Ventas");
        uBloqueado.BloqueadoHasta = ahora.AddYears(10);
        Acceso(uBloqueado, Seed.RolVentas);
        var uPortal = NuevoUsuario("cliente", "Carlos", "Constructor", "Residente de obra", TipoUsuario.Portal);

        if (!string.IsNullOrEmpty(rootCorreo) && await db.Set<Usuario>().FirstOrDefaultAsync(u => u.Correo == rootCorreo, ct) is { } admin)
            db.Add(new UsuarioAcceso { UsuarioId = admin.Id, EmpresaId = emp.Id });

        // --- Catálogo --------------------------------------------------------------------------------------
        var codigos = new[] { "CON-FC-200", "CON-FC-250", "CON-MR-45", "SRV-BOMBA-PLUMA", "SRV-BOMBA-ESTACIONARIA",
                              "SRV-MUESTREO-LABORATORIO", "REN-VIBRADOR", "SRV-TRASLADO" };
        var prod = await db.Set<Producto>().Where(p => p.OrganizacionId == org.Id && codigos.Contains(p.Codigo)).ToDictionaryAsync(p => p.Codigo, ct);
        var categoriaFc = await db.Set<CategoriaProducto>().FirstAsync(c => c.OrganizacionId == null && c.Clave == "concreto-fc", ct);
        var iva = (await db.Set<Impuesto>().FirstAsync(i => i.EmpresaId == null && i.ImpuestoSat == "002", ct)).Tasa;

        // Pedido mínimo para QA: 3 m³ de CON-FC-200.
        prod["CON-FC-200"].PedidoMinimo = 3;

        // --- Equipos: uno de cada tipo, repartidos entre plantas; la retro en mantenimiento --------------------
        var equipos = new Dictionary<TipoEquipo, Equipo>();
        var tipos = Enum.GetValues<TipoEquipo>();
        for (var i = 0; i < tipos.Length; i++)
        {
            var planta = i % 2 == 0 ? norte : sur;
            var (marca, modelo, capacidad, unidad) = Ficha(tipos[i]);
            equipos[tipos[i]] = db.Add(new Equipo
            {
                SucursalId = planta.Id, Tipo = tipos[i], NumeroEconomico = $"{planta.Codigo}-{i + 1:D2}",
                Descripcion = $"{tipos[i]} demo", Placas = i < 3 || i >= 7 ? $"YUC-{100 + i}-A" : null,
                Marca = marca, Modelo = modelo, Anio = (short)(2016 + i % 8), Capacidad = capacidad, UnidadCapacidad = unidad,
                OperadorNombre = i < 3 || i >= 7 ? $"{Operadores[i % Operadores.Length]}" : null,
                Estado = tipos[i] == TipoEquipo.Retroexcavadora ? EstadoEquipo.Mantenimiento : EstadoEquipo.Disponible,
                Notas = tipos[i] == TipoEquipo.Retroexcavadora ? "Cambio de mangueras hidráulicas" : null,
            }).Entity;
        }
        var revolvedor2 = db.Add(new Equipo
        {
            SucursalId = sur.Id, Tipo = TipoEquipo.Revolvedor, NumeroEconomico = "DMB-90", Descripcion = "Revolvedor demo",
            Marca = "International", Modelo = "HV607", Anio = 2021, Capacidad = 8, UnidadCapacidad = "m³", OperadorNombre = "Raúl Canché",
        }).Entity;
        db.Add(new Equipo
        {
            SucursalId = norte.Id, Tipo = TipoEquipo.BombaPluma, NumeroEconomico = "DMB-91", Descripcion = "Bomba pluma 42 m demo",
            Marca = "Putzmeister", Modelo = "BSF 42-5.16H", Anio = 2020, Capacidad = 42, UnidadCapacidad = "m", OperadorNombre = "Jorge Pech",
        });

        // --- Lista de precios con los tres tipos de regla -----------------------------------------------------
        var lista = db.Add(new ListaPrecios { OrganizacionId = org.Id, EmpresaRestringidaId = emp.Id, Nombre = "Demo constructoras" }).Entity;
        db.Add(new ListaPreciosSucursal { ListaPreciosId = lista.Id, SucursalId = norte.Id });
        db.AddRange(
            new ReglaPrecio { ListaPreciosId = lista.Id, AplicarA = AplicarRegla.Todos, Tipo = TipoReglaPrecio.Descuento, DescuentoPct = 5 },
            new ReglaPrecio { ListaPreciosId = lista.Id, AplicarA = AplicarRegla.Categoria, CategoriaId = categoriaFc.Id, Tipo = TipoReglaPrecio.Formula,
                              DescuentoPct = -3, Recargo = 50, CantidadMinima = 10 },
            new ReglaPrecio { ListaPreciosId = lista.Id, AplicarA = AplicarRegla.Producto, ProductoId = prod["CON-FC-250"].Id, Tipo = TipoReglaPrecio.Fijo,
                              PrecioFijo = 3800, Inicio = hoy.AddDays(-30), Fin = hoy.AddDays(90) });

        // --- Clientes, contactos, datos fiscales y obras ------------------------------------------------------
        var credito = db.Add(new Cliente
        {
            OrganizacionId = org.Id, Nombre = "Constructora Peninsular Demo", Giro = "Construcción", Correo = $"compras@{Dominio}",
            Telefono = "9991112233", VendedorId = vendedor.Id, ListaPreciosId = lista.Id, DiasCredito = 30, LimiteCredito = 500_000,
            LimiteCotizaciones = 5, LimiteObras = 3, Notas = "Cliente de crédito (demo), con cuenta del portal y límites.",
        }).Entity;
        var contado = db.Add(new Cliente
        {
            OrganizacionId = org.Id, Nombre = "Juan Pérez Demo (contado)", Correo = $"juan.perez@{Dominio}", Telefono = "9814445566",
            VendedorId = uPlanta.Id, Notas = "Paga de contado (demo).",
        }).Entity;
        db.AddRange(
            new ClienteContacto { ClienteId = credito.Id, Nombre = "Carlos", Apellidos = "Constructor", Puesto = "Residente de obra",
                                  Correo = uPortal.Correo, Telefono = "9990000000", Principal = true, UsuarioId = uPortal.Id },
            new ClienteContacto { ClienteId = credito.Id, Nombre = "Laura", Apellidos = "Compras", Puesto = "Compras", Correo = $"laura@{Dominio}" },
            new ClienteContacto { ClienteId = contado.Id, Nombre = "Juan", Apellidos = "Pérez", Telefono = "9814445566", Principal = true },
            new ClienteDatoFiscal { ClienteId = credito.Id, Alias = "Principal", RazonSocial = "CONSTRUCTORA PENINSULAR DEMO", RFC = "CPD150101AB1",
                                    RegimenFiscal = "601", UsoCfdi = "G03", CodigoPostal = "97000", Predeterminado = true });
        JsonDocument Contactos(params (string Nombre, string Numero)[] c) =>
            JsonSerializer.SerializeToDocument(c.Select(x => new { nombre = x.Nombre, lada = "+52", numero = x.Numero }));
        var obraGps = db.Add(new Obra
        {
            OrganizacionId = org.Id, ClienteId = credito.Id, Nombre = "Torre Altabrisa", Direccion = "Calle 20 x 7, Altabrisa", Municipio = "Mérida",
            Referencias = "Acceso por la calle 7", Lat = 21.0237m, Lng = -89.5794m, ResponsableNombre = "Carlos Constructor",
            Contactos = Contactos(("Carlos Constructor", "9990000000"), ("Velador", "9993334455")),
        }).Entity;
        var obraLejos = db.Add(new Obra
        {
            OrganizacionId = org.Id, ClienteId = credito.Id, Nombre = "Bodega Umán", Direccion = "Carretera Mérida-Campeche km 18", Municipio = "Umán",
            ResponsableNombre = "Laura Compras", Contactos = Contactos(("Laura Compras", "9992223344")),
        }).Entity;
        var obraCasa = db.Add(new Obra
        {
            OrganizacionId = org.Id, ClienteId = contado.Id, Nombre = "Casa Pérez", Direccion = "Calle 59 #12, Centro", Municipio = "Campeche",
            Lat = 19.8450m, Lng = -90.5370m, ResponsableNombre = "Juan Pérez", Contactos = Contactos(("Juan Pérez", "9814445566")),
        }).Entity;

        // Obras generales (sin cliente), solo de la empresa demo.
        db.AddRange(
            new Obra { OrganizacionId = org.Id, EmpresaRestringidaId = emp.Id, Nombre = "Banco de material Norte",
                       Direccion = "Carretera Mérida-Progreso km 12", Municipio = "Mérida", Lat = 21.1250m, Lng = -89.6150m },
            new Obra { OrganizacionId = org.Id, EmpresaRestringidaId = emp.Id, Nombre = "Patio de maniobras",
                       Direccion = "Periférico Norte km 4.5, junto a Planta Norte", Municipio = "Mérida", Lat = 21.0460m, Lng = -89.6275m });

        // --- Cotizaciones: una por estado (concreto + bombeo + servicio), una con descuento y traslado -----
        Cotizacion Cotizar(EstadoCotizacion estado, OrigenCotizacion origen, Sucursal planta, Cliente cliente, Obra obra,
            string concreto, decimal m3, decimal descuentoPct = 0, decimal? distanciaKm = null)
        {
            var c = new Cotizacion
            {
                EmpresaId = emp.Id, SucursalId = planta.Id, ClienteId = cliente.Id, ObraId = obra.Id, VendedorId = cliente.VendedorId,
                ContactoNombre = obra.ResponsableNombre, Estado = estado, Origen = origen, Fecha = ahora.AddDays(-(int)estado * 3),
                VigenciaHasta = hoy.AddDays(15), ListaPreciosId = cliente.ListaPreciosId, Notas = $"Cotización demo ({estado}).",
            };
            c.Folio = c.Serie = Folio(planta, "cotizacion", PrefijoCot(planta));
            var p = new CotizacionPartida
            {
                Nombre = "Losa de entrepiso", ProductoId = prod[concreto].Id, TipoResistencia = concreto.Contains("MR") ? "mr" : "fc",
                ResistenciaKgCm2 = short.Parse(concreto[7..]), EdadDias = 28, RevenimientoCm = 14, TmaMm = 20, Cemento = "CPC 30R",
                Exposicion = "normal", Colocacion = "bombeable", Aditivos = estado == EstadoCotizacion.Enviada ? ["retardante"] : [],
                VolumenM3 = m3, PrecioM3 = prod[concreto].PrecioLista, Entrega = ahora.AddDays(7).Date.AddHours(14),
                TrasladoDistanciaKm = distanciaKm, TrasladoIncluidosKm = distanciaKm is null ? null : planta.KmIncluidos,
                TrasladoPrecioKm = distanciaKm is null ? null : planta.PrecioKm,
            };
            void Linea(string codigo, decimal cantidad, short? dias = null)
            {
                var x = prod[codigo];
                p.Lineas.Add(new CotizacionLinea
                {
                    ProductoId = x.Id, Concepto = x.Nombre, Cantidad = cantidad, Dias = dias, PrecioUnitario = x.PrecioLista,
                    Importe = Calculo.Importe(x.PrecioLista, cantidad * (dias ?? 1)),
                });
            }
            Linea(planta == norte ? "SRV-BOMBA-PLUMA" : "SRV-BOMBA-ESTACIONARIA", m3);
            Linea("SRV-MUESTREO-LABORATORIO", 1);
            if (estado == EstadoCotizacion.Borrador) Linea("REN-VIBRADOR", 1, 2);
            c.Partidas.Add(p);
            Calculo.Totalizar(c, descuentoPct, iva);
            return db.Add(c).Entity;
        }
        var cotRecibida = Cotizar(EstadoCotizacion.Recibida, OrigenCotizacion.Portal, norte, credito, obraGps, "CON-FC-250", 30);
        var cotBorrador = Cotizar(EstadoCotizacion.Borrador, OrigenCotizacion.Erp, sur, contado, obraCasa, "CON-FC-200", 8);
        var cotEnviada = Cotizar(EstadoCotizacion.Enviada, OrigenCotizacion.Erp, norte, credito, obraLejos, "CON-MR-45", 45, 5, 32);
        var cotPedido = Cotizar(EstadoCotizacion.Pedido, OrigenCotizacion.Portal, norte, credito, obraGps, "CON-FC-250", 21, 3);
        Cotizar(EstadoCotizacion.Cancelada, OrigenCotizacion.Erp, sur, contado, obraCasa, "CON-FC-200", 6);

        // --- Pedidos: uno por estado, cobros y métodos de pago repartidos ---------------------------------------
        // Cada estado de pedido y cada estatus de planta; los cobros se reparten en orden.
        (EstadoPedido, EstatusPlanta)[] casos =
        [
            (EstadoPedido.Programado, EstatusPlanta.Actualizacion), (EstadoPedido.Programado, EstatusPlanta.NoEnviado),
            (EstadoPedido.EnPlanta, EstatusPlanta.Enviado), (EstadoPedido.EnRuta, EstatusPlanta.Confirmado),
            (EstadoPedido.EnObra, EstatusPlanta.Confirmado), (EstadoPedido.Entregado, EstatusPlanta.Confirmado),
            (EstadoPedido.Cancelado, EstatusPlanta.Rechazada),
        ];
        var cobros = Enum.GetValues<EstadoCobro>();
        var metodos = Enum.GetValues<MetodoPago>();
        var pedidos = new Dictionary<EstadoPedido, Pedido>();
        for (var i = 0; i < casos.Length; i++)
        {
            var (estado, estatus) = casos[i];
            var solicitud = estatus == EstatusPlanta.Actualizacion;
            var (planta, cliente, obra) = i % 2 == 0 ? (norte, credito, obraGps) : (sur, contado, obraCasa);
            var aCredito = cobros[i % cobros.Length] == EstadoCobro.Credito;
            if (aCredito) (cliente, obra) = (credito, obraGps); // el crédito es de la constructora (límite 500,000, 30 días)
            var desdeCotizacion = i == 0;
            var m3 = 7m * (i + 1);
            var concreto = prod[i % 2 == 0 ? "CON-FC-250" : "CON-FC-200"];
            var bomba = prod[planta == norte ? "SRV-BOMBA-PLUMA" : "SRV-BOMBA-ESTACIONARIA"];
            var pedido = new Pedido
            {
                EmpresaId = emp.Id, SucursalId = planta.Id, ClienteId = cliente.Id, ObraId = obra.Id, VendedorId = cliente.VendedorId,
                CotizacionId = desdeCotizacion ? cotPedido.Id : null, PartidaId = desdeCotizacion ? cotPedido.Partidas[0].Id : null,
                Folio = Folio(planta, "pedido", PrefijoPed(planta)),
                // Programado mañana; los demás de hoy hacia atrás (entregado/cancelado ya pasaron).
                FechaHoraEntrega = ahora.Date.AddDays(estado == EstadoPedido.Programado ? 1 : estado >= EstadoPedido.Entregado ? -i : 0).AddHours(8 + i),
                ConfirmadaEn = estado != EstadoPedido.Programado ? ahora.AddDays(-1) : null,
                ConfirmadaPorId = estado != EstadoPedido.Programado ? vendedor.Id : null,
                Estado = estado, Cobro = cobros[i % cobros.Length], CreditoDesde = aCredito ? ahora.AddDays(-35) : null, MetodoPago = metodos[i % metodos.Length],
                EstatusPlanta = estatus,
                SolicitudPlantaFecha = solicitud ? ahora.Date.AddDays(2).AddHours(7) : null,
                SolicitudPlantaNota = solicitud ? "La planta pide moverlo un día por mantenimiento." : null,
            };
            pedido.Lineas.Add(new PedidoLinea
            {
                ProductoId = concreto.Id, Descripcion = $"{concreto.Nombre} · Rev. 14 cm · TMA 20 mm", Cantidad = m3,
                PrecioUnitario = concreto.PrecioLista, Importe = Calculo.Importe(concreto.PrecioLista, m3),
            });
            pedido.Lineas.Add(new PedidoLinea
            {
                ProductoId = bomba.Id, Descripcion = bomba.Nombre, Cantidad = m3, PrecioUnitario = bomba.PrecioLista,
                Importe = Calculo.Importe(bomba.PrecioLista, m3),
            });
            Calculo.Totalizar(pedido, estado == EstadoPedido.Entregado ? 500 : 0, iva);
            pedidos.TryAdd(estado, db.Add(pedido).Entity);
        }

        // --- Calendario de entregas: órdenes programadas en los próximos 8 días, alternando por confirmar y confirmadas ---
        for (var d = 2; d <= 9; d++)
        {
            var confirmada = d % 2 == 0;
            var (planta, cliente, obra) = d % 3 == 0 ? (sur, contado, obraCasa) : (norte, credito, obraGps);
            var concreto = prod[d % 2 == 0 ? "CON-FC-250" : "CON-FC-200"];
            var m3 = 5m + d;
            var orden = new Pedido
            {
                EmpresaId = emp.Id, SucursalId = planta.Id, ClienteId = cliente.Id, ObraId = obra.Id, VendedorId = cliente.VendedorId,
                Folio = Folio(planta, "pedido", PrefijoPed(planta)), FechaHoraEntrega = ahora.Date.AddDays(d).AddHours(13 + d % 4),
                Estado = EstadoPedido.Programado, EstatusPlanta = confirmada ? EstatusPlanta.Confirmado : EstatusPlanta.NoEnviado,
                ConfirmadaEn = confirmada ? ahora : null, ConfirmadaPorId = confirmada ? vendedor.Id : null,
            };
            orden.Lineas.Add(new PedidoLinea
            {
                ProductoId = concreto.Id, Descripcion = $"{concreto.Nombre} · Rev. 14 cm · TMA 20 mm", Cantidad = m3,
                PrecioUnitario = concreto.PrecioLista, Importe = Calculo.Importe(concreto.PrecioLista, m3),
            });
            Calculo.Totalizar(orden, 0, iva);
            db.Add(orden);
        }

        // --- Remisiones: el pedido en obra lleva un viaje en cada estado ----------------------------------------
        var enObra = pedidos[EstadoPedido.EnObra];
        var plantaEnObra = enObra.SucursalId == norte.Id ? norte : sur;
        var viajes = Enum.GetValues<EstadoViaje>();
        for (var i = 0; i < viajes.Length; i++)
        {
            var e = viajes[i];
            var salida = ahora.AddHours(-5 + i);
            db.Add(new Remision
            {
                PedidoId = enObra.Id, Folio = Folio(plantaEnObra, "remision", PrefijoRem(plantaEnObra)),
                EquipoId = (i % 2 == 0 ? equipos[TipoEquipo.Revolvedor] : revolvedor2).Id, OperadorNombre = $"Operador demo {i + 1}",
                VolumenM3 = 7, Estado = e,
                SalidaEn = e <= EstadoViaje.Cargando ? null : salida,
                LlegadaEstimada = salida.AddMinutes(45),
                LlegadaEn = e >= EstadoViaje.EnObra ? salida.AddMinutes(50) : null,
                TerminadaEn = e == EstadoViaje.Terminado ? salida.AddHours(2) : null,
            });
        }
        foreach (var s in new[] { norte, sur })
            foreach (var (tipo, prefijo) in new[] { ("cotizacion", PrefijoCot(s)), ("pedido", PrefijoPed(s)), ("remision", PrefijoRem(s)) })
                db.Add(new Secuencia { EmpresaId = emp.Id, SucursalId = s.Id, Tipo = tipo, Prefijo = prefijo, Siguiente = folios.GetValueOrDefault((s, tipo)) + 1 });

        // --- Programas: uno por tipo; las tres recompensas repartidas -------------------------------------------
        var recompensas = Enum.GetValues<TipoRecompensa>();
        var programas = new Dictionary<TipoPrograma, ProgramaDescuento>();
        foreach (var (tipo, i) in Enum.GetValues<TipoPrograma>().Select((t, i) => (t, i)))
        {
            var recompensa = recompensas[i % recompensas.Length];
            programas[tipo] = db.Add(new ProgramaDescuento
            {
                OrganizacionId = org.Id, EmpresaRestringidaId = emp.Id, Nombre = $"Demo {tipo}", Tipo = tipo,
                Inicio = hoy.AddDays(-15), Fin = hoy.AddDays(60), CompraMinima = tipo == TipoPrograma.Promocion ? 20_000 : 0,
                CategoriaId = tipo == TipoPrograma.Promocion ? categoriaFc.Id : null,
                ProductoId = tipo == TipoPrograma.CompraX ? prod["CON-FC-200"].Id : null,
                Codigo = tipo == TipoPrograma.Codigo ? "DEMO10" : null,
                CantidadX = tipo == TipoPrograma.CompraX ? 30 : null, CantidadY = tipo == TipoPrograma.CompraX ? 1 : null,
                Recompensa = recompensa,
                Valor = recompensa switch { TipoRecompensa.Porcentaje => 10, TipoRecompensa.Monto => 1_000, _ => 100 },
                PesosPorPunto = tipo == TipoPrograma.Lealtad ? 100 : null, PuntosCanje = tipo == TipoPrograma.Lealtad ? 500 : null,
                Meta = tipo == TipoPrograma.Sellos ? 10 : null,
            }).Entity;
        }
        var entregado = pedidos[EstadoPedido.Entregado];
        db.AddRange(
            new Cupon { ProgramaId = programas[TipoPrograma.Cupones].Id, Codigo = "DEMO-CUPON-1", ClienteId = credito.Id },
            new Cupon { ProgramaId = programas[TipoPrograma.ProximaOrden].Id, Codigo = "DEMO-PROX-1", ClienteId = contado.Id,
                        GanadoEnPedidoId = entregado.Id },
            new SaldoLealtad { ProgramaId = programas[TipoPrograma.Lealtad].Id, ClienteId = credito.Id, Saldo = 320, UpdatedAt = ahora },
            new SaldoLealtad { ProgramaId = programas[TipoPrograma.Sellos].Id, ClienteId = contado.Id, Saldo = 4, UpdatedAt = ahora });

        // --- CRM: un prospecto por etapa, actividades de cada tipo y notas ------------------------------------
        var prospectos = Enum.GetValues<EtapaProspecto>().Select((etapa, i) => db.Add(new Prospecto
        {
            OrganizacionId = org.Id, EmpresaId = emp.Id, Nombre = $"Prospecto demo {etapa}", NombreEmpresa = $"Obras {etapa} S.A.",
            Correo = $"prospecto{i + 1}@{Dominio}", Telefono = $"99955500{i:D2}", Origen = i % 2 == 0 ? "Portal" : "Llamada",
            Etapa = etapa, VendedorId = vendedor.Id, ValorEstimado = 50_000 * (i + 1),
            ClienteId = etapa == EtapaProspecto.Ganado ? credito.Id : null,
            MotivoPerdida = etapa == EtapaProspecto.Perdido ? "Eligió otro proveedor por precio." : null,
        }).Entity).ToList();

        // Tipo × momento: vencida, hoy, futura, hecha y cancelada (en ese orden por tipo).
        var actividades = Enum.GetValues<TipoActividad>();
        for (var i = 0; i < actividades.Length; i++)
        {
            var (tipoRegistro, registro) = (i % 3) switch
            {
                0 => (nameof(Prospecto), prospectos[i].Id),
                1 => (nameof(Cliente), credito.Id),
                _ => (nameof(Cotizacion), cotEnviada.Id),
            };
            db.Add(new Actividad
            {
                OrganizacionId = org.Id, RegistroTipo = tipoRegistro, RegistroId = registro, Tipo = actividades[i],
                Resumen = $"{actividades[i]} demo", FechaLimite = hoy.AddDays(i switch { 0 => -3, 1 => 0, _ => 2 + i }),
                AsignadaAId = vendedor.Id, Nota = "Actividad de ejemplo.",
                HechaEn = i == 3 ? ahora.AddDays(-1) : null, CanceladaEn = i == 4 ? ahora.AddHours(-2) : null,
            });
        }
        foreach (var (tipoRegistro, registro, texto) in new[]
                 {
                     (nameof(Cliente), credito.Id, "Pidió factura por obra a partir de este mes."),
                     (nameof(Cotizacion), cotEnviada.Id, "El cliente compara con otra concretera; ofrecer bombeo sin costo si cierra esta semana."),
                     (nameof(Pedido), enObra.Id, "Acceso estrecho: mandar revolvedores de 7 m³ como máximo."),
                 })
            db.Add(new Evento
            {
                OrganizacionId = org.Id, RegistroTipo = tipoRegistro, RegistroId = registro, Fecha = ahora.AddHours(-1),
                AutorId = vendedor.Id, Tipo = TipoEvento.Nota, Texto = texto,
            });

        await db.SaveChangesAsync(ct);
        await LogisticaAsync(db, org, ct);
        await ReagendaAsync(db, org, ct);
        await TrayectosAsync(db, ct);
        await HistorialViajesAsync(db, ct);
        await LaboratorioAsync(db, ct);
        await PosicionesAsync(db, ct);
        log.LogInformation("Seed demo: empresa {Empresa} creada; usuarios *@{Dominio} con contraseña {Password}", Empresa, Dominio, Password);
    }

    /// <summary>
    /// Operadores, documentos, cargas de diésel y mantenimientos de la flota demo. Se puede repetir: si las plantas demo ya
    /// tienen operadores no hace nada (así también llega a una demo creada antes).
    /// </summary>
    static async Task LogisticaAsync(AppDbContext db, Organizacion org, CancellationToken ct)
    {
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters()
            .Where(s => s.Codigo == "DMA" || s.Codigo == "DMB").Where(s => db.Set<Empresa>().Any(e => e.Id == s.EmpresaId && e.RazonSocial == Empresa))
            .ToDictionaryAsync(s => s.Codigo, ct);
        if (plantas.Count < 2) return;
        var ids = plantas.Values.Select(s => s.Id).ToList();
        if (await db.Set<Operador>().IgnoreQueryFilters().AnyAsync(o => o.SucursalId != null && ids.Contains(o.SucursalId.Value), ct)) return;
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && ids.Contains(e.SucursalId))
            .OrderBy(e => e.NumeroEconomico).ToListAsync(ct);
        Equipo? Uno(TipoEquipo t) => equipos.FirstOrDefault(e => e.Tipo == t);
        var ollas = equipos.Where(e => e.Tipo == TipoEquipo.Revolvedor).ToList();
        if (ollas.Count == 0) return;
        // En una demo vieja no hay volteo ni retro: se usan otras unidades que no sean ollas ni bombas.
        var otras = equipos.Where(e => e.Tipo is not (TipoEquipo.Revolvedor or TipoEquipo.BombaPluma or TipoEquipo.BombaEstacionaria)).ToList();
        var conVencido = Uno(TipoEquipo.Volteo) ?? otras.FirstOrDefault();
        var enTaller = Uno(TipoEquipo.Retroexcavadora) ?? otras.FirstOrDefault(e => e != conVencido);
        var conServicio = Uno(TipoEquipo.Cargador) ?? otras.FirstOrDefault(e => e != conVencido && e != enTaller) ?? ollas[^1];
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var ahora = DateTime.UtcNow;

        // --- Operadores: uno con la licencia vencida ------------------------------------------------------------
        Operador Op(string nombre, Sucursal s, string tipo, DateOnly vence) => db.Add(new Operador
        {
            OrganizacionId = org.Id, SucursalId = s.Id, Nombre = nombre, Telefono = "9991112233", LicenciaNumero = $"LF{Math.Abs(nombre.GetHashCode()) % 1_000_000:D6}",
            LicenciaTipo = tipo, LicenciaVence = vence,
        }).Entity;
        var ops = new[]
        {
            Op("Juan Pérez Canul", plantas["DMA"], "E", hoy.AddYears(2)),
            Op("Raúl Canché Poot", plantas["DMB"], "E", hoy.AddMonths(8)),
            Op("Jorge Pech Ku", plantas["DMA"], "C", hoy.AddDays(25)),
            Op("Martín Dzib Chan", plantas["DMB"], "E", hoy.AddDays(-20)),
        };
        for (var i = 0; i < ollas.Count; i++) (ollas[i].OperadorId, ollas[i].OperadorNombre) = (ops[i % 2].Id, ops[i % 2].Nombre);
        if (Uno(TipoEquipo.BombaPluma) is { } bomba) (bomba.OperadorId, bomba.OperadorNombre) = (ops[2].Id, ops[2].Nombre);

        // --- Documentos: vigentes, uno vencido (volteo) y uno que vence en 10 días ---------------------------------
        foreach (var e in equipos.Where(e => e.Placas is not null || e == conVencido))
        {
            db.Add(new DocumentoEquipo { EquipoId = e.Id, Tipo = TipoDocumentoEquipo.Seguro, Numero = $"POL-{e.NumeroEconomico}",
                Vence = e == conVencido ? hoy.AddDays(-5) : hoy.AddMonths(7) });
            db.Add(new DocumentoEquipo { EquipoId = e.Id, Tipo = TipoDocumentoEquipo.TarjetaCirculacion, Numero = $"TC-{e.NumeroEconomico}" });
        }
        db.Add(new DocumentoEquipo { EquipoId = ollas[0].Id, Tipo = TipoDocumentoEquipo.Verificacion, Numero = "VER-2026-01", Vence = hoy.AddDays(10) });

        // --- Diésel: 3 cargas de cada una de 2 ollas, odómetro creciente ------------------------------------------
        foreach (var (olla, k) in ollas.Take(2).Select((o, k) => (o, k)))
        {
            for (var j = 0; j < 3; j++)
                db.Add(new CargaCombustible
                {
                    EquipoId = olla.Id, SucursalId = olla.SucursalId, Fecha = ahora.AddDays(-12 + j * 5).AddHours(-k), Litros = 180 + j * 15 + k * 10,
                    CostoTotal = (180 + j * 15 + k * 10) * 25.40m, OdometroKm = 48_200 + k * 10_000 + j * 640, Horometro = 3_100 + k * 400 + j * 22,
                    OperadorId = ops[k].Id, Notas = j == 0 ? "Tanque lleno" : null,
                });
            olla.UltimoOdometroKm = 48_200 + k * 10_000 + 2 * 640;
            olla.UltimoHorometro = 3_100 + k * 400 + 2 * 22;
        }

        // --- Mantenimientos: uno programado y uno en proceso (esa unidad en mantenimiento) ----------------------
        db.Add(new Mantenimiento { EquipoId = conServicio.Id, Tipo = TipoMantenimiento.Preventivo, Descripcion = "Servicio 10,000 km",
            ProgramadoPara = hoy.AddDays(7), ProgramadoKm = 10_000, Taller = "Taller interno" });
        if (enTaller is { } retro)
        {
            db.Add(new Mantenimiento { EquipoId = retro.Id, Tipo = TipoMantenimiento.Correctivo, Descripcion = "Cambio de mangueras hidráulicas",
                Estado = EstadoMantenimiento.EnProceso, InicioEn = ahora.AddDays(-1), Costo = 8_500, Taller = "Hidráulicos del Sureste" });
            retro.Estado = EstadoEquipo.Mantenimiento;
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Tiempos de servicio (concretos 60 min, bombas 120, solo donde falten) y una solicitud de reagenda pendiente de la planta
    /// sobre una orden demo confirmada. Se puede repetir: si alguna orden demo ya tiene solicitud, no crea otra.
    /// </summary>
    static async Task ReagendaAsync(AppDbContext db, Organizacion org, CancellationToken ct)
    {
        foreach (var p in await db.Set<Producto>().Where(p => p.OrganizacionId == org.Id && p.TiempoServicioMin == null
                     && (p.Tipo == TipoProducto.Concreto && !p.Codigo.StartsWith("AJ-")
                         || p.EquipoTipo == TipoEquipo.BombaPluma || p.EquipoTipo == TipoEquipo.BombaEstacionaria)).ToListAsync(ct))
            p.TiempoServicioMin = p.Tipo == TipoProducto.Concreto ? 60 : 120;

        var demo = db.Set<Pedido>().IgnoreQueryFilters().Where(p => db.Set<Empresa>().Any(e => e.Id == p.EmpresaId && e.RazonSocial == Empresa));
        if (!await db.Set<SolicitudReagenda>().IgnoreQueryFilters().AnyAsync(s => demo.Any(p => p.Id == s.PedidoId), ct)
            // La primera orden futura programada, de preferencia ya confirmada (en una demo vieja puede no haber: se confirma).
            && await demo.Where(p => !p.IsDeleted && p.Estado == EstadoPedido.Programado && p.FechaHoraEntrega > DateTime.UtcNow)
                .OrderBy(p => p.ConfirmadaEn == null).ThenBy(p => p.FechaHoraEntrega).FirstOrDefaultAsync(ct) is { } pedido)
        {
            pedido.ConfirmadaEn ??= DateTime.UtcNow;
            const string nota = "Mantenimiento de la dosificadora: la planta propone el día siguiente a la misma hora.";
            (pedido.EstatusPlanta, pedido.SolicitudPlantaFecha, pedido.SolicitudPlantaNota) = (EstatusPlanta.Actualizacion, pedido.FechaHoraEntrega.AddDays(1), nota);
            db.Add(new SolicitudReagenda
            {
                PedidoId = pedido.Id, FechaPropuesta = pedido.FechaHoraEntrega.AddDays(1), Motivo = nota, Origen = OrigenReagenda.Planta,
                SolicitadoEn = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Plantas de cada unidad demo (DMB-90 opera también en Planta Norte), 5 trayectos manuales con odómetro de una olla y los
    /// trayectos de entrega de los viajes demo terminados. Se puede repetir: si las unidades demo ya tienen trayectos, solo
    /// completa las plantas.
    /// </summary>
    static async Task TrayectosAsync(AppDbContext db, CancellationToken ct)
    {
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters()
            .Where(s => (s.Codigo == "DMA" || s.Codigo == "DMB") && db.Set<Empresa>().Any(e => e.Id == s.EmpresaId && e.RazonSocial == Empresa))
            .ToDictionaryAsync(s => s.Codigo, ct);
        if (plantas.Count < 2) return;
        var ids = plantas.Values.Select(s => s.Id).ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && ids.Contains(e.SucursalId))
            .OrderBy(e => e.NumeroEconomico).ToListAsync(ct);
        foreach (var e in equipos.Where(e => !e.SucursalIds.Contains(e.SucursalId))) e.SucursalIds = [e.SucursalId, .. e.SucursalIds];
        if (equipos.FirstOrDefault(e => e.NumeroEconomico == "DMB-90") is { } dosPlantas && !dosPlantas.SucursalIds.Contains(plantas["DMA"].Id))
            dosPlantas.SucursalIds = [.. dosPlantas.SucursalIds, plantas["DMA"].Id];

        var eqIds = equipos.Select(e => e.Id).ToList();
        var olla = equipos.FirstOrDefault(e => e.Tipo == TipoEquipo.Revolvedor);
        if (olla is null || await db.Set<Trayecto>().IgnoreQueryFilters().AnyAsync(t => eqIds.Contains(t.EquipoId), ct))
        {
            await db.SaveChangesAsync(ct);
            return;
        }
        var ahora = DateTime.UtcNow;
        var odometro = (olla.UltimoOdometroKm ?? 50_000) + 20;
        (TipoTrayecto Tipo, string Origen, string Destino, decimal Km)[] manuales =
        [
            (TipoTrayecto.Traslado, "Planta Norte", "Planta Sur", 182), (TipoTrayecto.Flete, "Planta Sur", "Bodega Champotón", 64),
            (TipoTrayecto.Traslado, "Planta Sur", "Planta Norte", 181), (TipoTrayecto.Flete, "Planta Norte", "Proveedor de arena, Umán", 38),
            (TipoTrayecto.Traslado, "Planta Norte", "Taller Kenworth Mérida", 22),
        ];
        for (var i = 0; i < manuales.Length; i++)
        {
            var (tipo, origen, destino, km) = manuales[i];
            var inicio = ahora.AddDays(-10 + i * 2).AddHours(-3);
            db.Add(new Trayecto
            {
                EquipoId = olla.Id, SucursalId = olla.SucursalId, Tipo = tipo, Inicio = inicio, Fin = inicio.AddMinutes((double)km * 1.6),
                Origen = origen, Destino = destino, OdometroInicio = odometro, OdometroFin = odometro + km, Km = km, KmEstimado = false,
                OperadorId = olla.OperadorId, Notas = i == 1 ? "Flete de varilla" : null,
            });
            odometro += km + 15;
        }
        // Entrega de los viajes demo terminados, con km estimados (línea recta × 1.3, ida y vuelta).
        var terminados = await (from r in db.Set<Remision>().IgnoreQueryFilters()
                                join p in db.Set<Pedido>().IgnoreQueryFilters() on r.PedidoId equals p.Id
                                where !r.IsDeleted && r.Estado == EstadoViaje.Terminado && r.EquipoId != null && eqIds.Contains(r.EquipoId.Value)
                                select new { R = r, p.SucursalId, p.ObraId, p.EntregaDireccion }).ToListAsync(ct);
        foreach (var t in terminados)
        {
            var planta = plantas.Values.First(s => s.Id == t.SucursalId);
            var obra = t.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == o, ct) : null;
            decimal? km = obra is { Lat: decimal la, Lng: decimal lo } && planta is { Lat: decimal pla, Lng: decimal plo }
                ? Math.Round(Application.Flota.FlotaServicio.KmCarretera(Application.Flota.FlotaServicio.Km(pla, plo, la, lo), false) * 2, 1) : null;
            db.Add(new Trayecto
            {
                EquipoId = t.R.EquipoId!.Value, SucursalId = t.SucursalId, Tipo = TipoTrayecto.Entrega,
                Inicio = t.R.SalidaEn ?? t.R.SalidaProgramada ?? t.R.TerminadaEn ?? ahora, Fin = t.R.TerminadaEn,
                Origen = planta.Nombre, Destino = obra?.Nombre ?? t.EntregaDireccion, Km = km, KmEstimado = true,
                PedidoId = t.R.PedidoId, RemisionId = t.R.Id, OperadorId = t.R.OperadorId,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// GPS demo: recorrido sintético de cada viaje demo ya iniciado (un punto cada 30 s: carga en planta, ida, descarga en obra y
    /// regreso; los en curso llegan hasta ahora) y unas 6 unidades sin viaje estacionadas en su planta hace minutos. Se puede
    /// repetir: un viaje que ya tiene puntos demo no se vuelve a generar. También completa cargandoEn/regresandoEn de los viajes demo.
    /// </summary>
    static async Task PosicionesAsync(AppDbContext db, CancellationToken ct)
    {
        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters()
            .Where(s => db.Set<Empresa>().Any(e => e.Id == s.EmpresaId && e.RazonSocial == Empresa)).ToDictionaryAsync(s => s.Id, ct);
        if (plantas.Count == 0) return;
        var plantaIds = plantas.Keys.ToList();
        var equipos = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && plantaIds.Contains(e.SucursalId)).ToListAsync(ct);
        var eqIds = equipos.Select(e => e.Id).ToList();
        var viajes = await (from r in db.Set<Remision>().IgnoreQueryFilters()
                            join p in db.Set<Pedido>().IgnoreQueryFilters() on r.PedidoId equals p.Id
                            where !r.IsDeleted && r.EquipoId != null && eqIds.Contains(r.EquipoId.Value) && r.Estado != EstadoViaje.Programado
                                  && plantaIds.Contains(p.SucursalId)
                            select new { R = r, P = p }).ToListAsync(ct);
        var ahora = DateTime.UtcNow;
        var conDemo = await db.Set<PosicionEquipo>().IgnoreQueryFilters().Where(x => eqIds.Contains(x.EquipoId) && x.Fuente == FuentePosicion.Demo)
            .Select(x => new { x.EquipoId, x.Fecha }).ToListAsync(ct);
        foreach (var v in viajes)
        {
            var r = v.R;
            if (r.Estado != EstadoViaje.Terminado && !conDemo.Any(x => x.EquipoId == r.EquipoId && x.Fecha > ahora.AddHours(-3)))
            {
                // En curso: sus etapas se acomodan a los últimos minutos para que la unidad se vea avanzando ahora.
                var min = r.Estado switch { EstadoViaje.Cargando => 10, EstadoViaje.EnRuta => 45, EstadoViaje.EnObra => 100, _ => 130 };
                r.CargandoEn = ahora.AddMinutes(-min);
                r.SalidaEn = r.Estado >= EstadoViaje.EnRuta ? r.CargandoEn.Value.AddMinutes(15) : null;
                r.LlegadaEn = r.Estado >= EstadoViaje.EnObra ? r.SalidaEn!.Value.AddMinutes(50) : null;
                r.RegresandoEn = r.Estado >= EstadoViaje.Regresando ? r.LlegadaEn!.Value.AddMinutes(30) : null;
            }
            var planta = plantas[v.P.SucursalId];
            var obra = v.P.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == o, ct) : null;
            // Etapas: lo que falte se supone (15 min de carga, 50 de ida, 30 en obra, 40 de regreso).
            var salida = r.SalidaEn ?? (r.Estado == EstadoViaje.Cargando ? null : (r.CargandoEn ?? ahora.AddMinutes(-20)).AddMinutes(15));
            r.CargandoEn ??= (salida ?? ahora).AddMinutes(-15);
            if (r.Estado >= EstadoViaje.EnObra) r.LlegadaEn ??= salida!.Value.AddMinutes(50);
            if (r.Estado >= EstadoViaje.Regresando) r.RegresandoEn ??= r.LlegadaEn!.Value.AddMinutes(30);
            var fin = r.TerminadaEn ?? ahora;
            if (fin > ahora) fin = ahora;
            if (conDemo.Any(x => x.EquipoId == r.EquipoId && x.Fecha >= r.CargandoEn && x.Fecha <= fin)) continue;

            var (pLat, pLng) = (planta.Lat ?? 21m, planta.Lng ?? -89.6m);
            var (oLat, oLng) = obra is { Lat: decimal la, Lng: decimal lo } ? (la, lo) : (pLat + 0.06m, pLng + 0.05m);
            var rnd = new Random(r.Id.GetHashCode());
            var altitud = 20m;
            var llegada = r.LlegadaEn ?? (salida ?? ahora).AddMinutes(50);
            var regreso = r.RegresandoEn ?? DateTime.MaxValue;
            var finRegreso = r.TerminadaEn ?? r.RegresandoEn?.AddMinutes(40) ?? DateTime.MaxValue;
            for (var t = r.CargandoEn.Value; t <= fin; t = t.AddSeconds(30))
            {
                decimal lat, lng, vel, rpm; string sentido;
                if (salida is null || t < salida) (lat, lng, vel, rpm, sentido) = (pLat, pLng, 0, 12, "carga");
                else if (t < llegada) (lat, lng, vel, rpm, sentido) = Tramo(pLat, pLng, oLat, oLng, (decimal)((t - salida.Value) / (llegada - salida.Value)), 3, "carga");
                else if (t < regreso) (lat, lng, vel, rpm, sentido) = (oLat, oLng, 0, 10, "descarga");
                else (lat, lng, vel, rpm, sentido) = Tramo(oLat, oLng, pLat, pLng, Math.Min(1, (decimal)((t - regreso) / (finRegreso - regreso))), 0, "detenido");
                altitud = Math.Clamp(altitud + (decimal)(rnd.NextDouble() * 4 - 2), 10, 60);
                if (vel > 0) vel = Math.Round(35 + (decimal)rnd.NextDouble() * 25, 1);
                db.Add(Punto(r.EquipoId!.Value, t, lat + Ruido(rnd), lng + Ruido(rnd), vel, altitud, rpm, sentido, true));
            }
        }

        // Unidades sin viaje en curso: estacionadas en su planta.
        var enViaje = viajes.Where(v => v.R.Estado != EstadoViaje.Terminado).Select(v => v.R.EquipoId!.Value).ToHashSet();
        var recientes = conDemo.Where(x => x.Fecha > ahora.AddHours(-1)).Select(x => x.EquipoId).ToHashSet();
        var rnd2 = new Random(42);
        foreach (var e in equipos.Where(e => e.Activo && !enViaje.Contains(e.Id) && !recientes.Contains(e.Id)).OrderBy(e => e.NumeroEconomico).Take(6))
        {
            var p = plantas[e.SucursalId];
            db.Add(Punto(e.Id, ahora.AddMinutes(-rnd2.Next(2, 20)), (p.Lat ?? 21m) + Ruido(rnd2) * 3, (p.Lng ?? -89.6m) + Ruido(rnd2) * 3, 0, 15, 0,
                "detenido", false));
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Historia para indicadores: 10 órdenes entregadas en los últimos 28 días, cada una con 2 viajes de olla terminados con tiempos
    /// realistas (carga 12–18 min, ida 35–50, obra 25–45, regreso 35–50), operadores rotando y 2 viajes prolongados en obra
    /// (más de 90 min). Se puede repetir: si ya hay 15 viajes demo terminados con todas sus etapas en ese periodo, no agrega.
    /// </summary>
    static async Task HistorialViajesAsync(AppDbContext db, CancellationToken ct)
    {
        var emp = await db.Set<Empresa>().IgnoreQueryFilters().FirstOrDefaultAsync(e => e.RazonSocial == Empresa, ct);
        if (emp is null) return;
        var ahora = DateTime.UtcNow;
        var desde = ahora.AddDays(-30);
        var demo = db.Set<Pedido>().IgnoreQueryFilters().Where(p => p.EmpresaId == emp.Id && !p.IsDeleted);
        if (await db.Set<Remision>().IgnoreQueryFilters().CountAsync(r => demo.Any(p => p.Id == r.PedidoId) && !r.IsDeleted
                && r.Estado == EstadoViaje.Terminado && r.LlegadaEn != null && r.RegresandoEn != null && r.TerminadaEn >= desde, ct) >= 15) return;

        var plantas = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.EmpresaId == emp.Id).OrderBy(s => s.Codigo).ToListAsync(ct);
        var ollas = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && e.Tipo == TipoEquipo.Revolvedor && plantas.Select(s => s.Id).Contains(e.SucursalId))
            .OrderBy(e => e.NumeroEconomico).ToListAsync(ct);
        var destinos = await demo.Where(p => p.ObraId != null).Select(p => new { p.ClienteId, p.ObraId, p.VendedorId }).Distinct().ToListAsync(ct);
        var ops = await db.Set<Operador>().IgnoreQueryFilters().Where(o => o.SucursalId != null && plantas.Select(s => s.Id).Contains(o.SucursalId.Value))
            .OrderBy(o => o.Nombre).ToListAsync(ct);
        var concreto = await db.Set<Producto>().FirstOrDefaultAsync(p => p.OrganizacionId == emp.OrganizacionId && p.Codigo == "CON-FC-250", ct);
        if (ollas.Count == 0 || destinos.Count == 0 || concreto is null) return;
        var iva = await db.Set<Impuesto>().Where(i => i.EmpresaId == null && i.ImpuestoSat == "002").Select(i => i.Tasa).FirstAsync(ct);

        var rnd = new Random(2026);
        int Min(int a, int b) => rnd.Next(a, b + 1);
        for (var k = 0; k < 10; k++)
        {
            var planta = plantas[k % plantas.Count];
            var dst = destinos[k % destinos.Count];
            var entrega = ahora.Date.AddDays(-28 + k * 3).AddHours(15 + k % 3);
            if (entrega > ahora.AddHours(-6)) entrega = ahora.AddHours(-6 - k);
            var subtotal = Application.Ventas.Calculo.Importe(concreto.PrecioLista, 14);
            var pedido = db.Add(new Pedido
            {
                EmpresaId = emp.Id, SucursalId = planta.Id, ClienteId = dst.ClienteId, ObraId = dst.ObraId, VendedorId = dst.VendedorId,
                Folio = await db.SiguienteFolioAsync(emp.Id, planta.Id, "pedido", ct), FechaHoraEntrega = entrega, Estado = EstadoPedido.Entregado,
                Cobro = EstadoCobro.Pagado, MetodoPago = MetodoPago.Transferencia, EstatusPlanta = EstatusPlanta.Confirmado, ConfirmadaEn = entrega.AddDays(-1),
                Subtotal = subtotal, Iva = Application.Ventas.Calculo.R(subtotal * iva), Total = Application.Ventas.Calculo.R(subtotal * (1 + iva)),
                Lineas = [new PedidoLinea { ProductoId = concreto.Id, Descripcion = concreto.Nombre, Cantidad = 14, PrecioUnitario = concreto.PrecioLista, Importe = subtotal }],
            }).Entity;
            for (var j = 0; j < 2; j++)
            {
                var olla = ollas[(k + j) % ollas.Count];
                var op = ops.Count > 0 ? ops[(k + j) % ops.Count] : null;
                var carga = entrega.AddMinutes(-60 + j * 40);
                var salida = carga.AddMinutes(Min(12, 18));
                var llegada = salida.AddMinutes(Min(35, 50));
                var regresa = llegada.AddMinutes(k is 2 or 7 && j == 0 ? Min(100, 130) : Min(25, 45));   // 2 prolongados
                db.Add(new Remision
                {
                    PedidoId = pedido.Id, Folio = await db.SiguienteFolioAsync(emp.Id, planta.Id, "remision", ct), EquipoId = olla.Id, OperadorId = op?.Id,
                    OperadorNombre = op?.Nombre ?? olla.OperadorNombre, VolumenM3 = 7, Estado = EstadoViaje.Terminado,
                    CargandoEn = carga, SalidaEn = salida, LlegadaEstimada = entrega, LlegadaEn = llegada, RegresandoEn = regresa,
                    TerminadaEn = regresa.AddMinutes(Min(35, 50)), SalidaProgramada = salida, RegresoEstimado = salida.AddMinutes(150),
                });
            }
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Unos metros (±0.00003° ≈ ±3 m).</summary>
    /// <summary>
    /// Laboratorio: 2 órdenes de hace 40 y 36 días con su muestra y ensayes a 7, 14 y 28 días ya hechos (la de 36 días no cumple) y
    /// muestras de 3 órdenes recientes con el ensaye a 7 días hecho si ya tocaba y los demás pendientes. Se puede repetir: si alguna
    /// orden demo ya tiene muestras, no agrega.
    /// </summary>
    static async Task LaboratorioAsync(AppDbContext db, CancellationToken ct)
    {
        var emp = await db.Set<Empresa>().IgnoreQueryFilters().FirstOrDefaultAsync(e => e.RazonSocial == Empresa, ct);
        if (emp is null) return;
        var demo = db.Set<Pedido>().IgnoreQueryFilters().Where(p => p.EmpresaId == emp.Id && !p.IsDeleted);
        if (await db.Set<MuestraLaboratorio>().IgnoreQueryFilters().AnyAsync(m => demo.Any(p => p.Id == m.PedidoId), ct)) return;
        var ahora = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(ahora);
        var plantilla = await demo.Include(p => p.Lineas).Where(p => p.Estado == EstadoPedido.Entregado && p.ObraId != null)
            .OrderByDescending(p => p.FechaHoraEntrega).FirstOrDefaultAsync(ct);
        var olla = await db.Set<Equipo>().IgnoreQueryFilters().Where(e => !e.IsDeleted && e.Tipo == TipoEquipo.Revolvedor
            && db.Set<Sucursal>().Any(s => s.Id == e.SucursalId && s.EmpresaId == emp.Id)).OrderBy(e => e.NumeroEconomico).FirstOrDefaultAsync(ct);
        if (plantilla is null || olla is null) return;

        // Dos órdenes viejas (copia de una entregada) para tener resultados a 28 días.
        var viejas = new List<(Pedido P, Remision R)>();
        foreach (var dias in new[] { 40, 36 })
        {
            var entrega = ahora.Date.AddDays(-dias).AddHours(16);
            var p = db.Add(new Pedido
            {
                EmpresaId = emp.Id, SucursalId = plantilla.SucursalId, ClienteId = plantilla.ClienteId, ObraId = plantilla.ObraId, VendedorId = plantilla.VendedorId,
                Folio = await db.SiguienteFolioAsync(emp.Id, plantilla.SucursalId, "pedido", ct), FechaHoraEntrega = entrega, Estado = EstadoPedido.Entregado,
                Cobro = EstadoCobro.Pagado, MetodoPago = MetodoPago.Transferencia, EstatusPlanta = EstatusPlanta.Confirmado, ConfirmadaEn = entrega.AddDays(-1),
                Subtotal = plantilla.Subtotal, Iva = plantilla.Iva, Total = plantilla.Total,
                Lineas = [.. plantilla.Lineas.Select(l => new PedidoLinea { ProductoId = l.ProductoId, Descripcion = l.Descripcion, Cantidad = l.Cantidad,
                    PrecioUnitario = l.PrecioUnitario, Importe = l.Importe })],
            }).Entity;
            var r = db.Add(new Remision
            {
                PedidoId = p.Id, Folio = await db.SiguienteFolioAsync(emp.Id, plantilla.SucursalId, "remision", ct), EquipoId = olla.Id,
                OperadorNombre = olla.OperadorNombre, VolumenM3 = 7, Estado = EstadoViaje.Terminado, CargandoEn = entrega.AddMinutes(-60),
                SalidaEn = entrega.AddMinutes(-45), LlegadaEn = entrega, RegresandoEn = entrega.AddMinutes(35), TerminadaEn = entrega.AddMinutes(80),
            }).Entity;
            viejas.Add((p, r));
        }
        await db.SaveChangesAsync(ct);

        var recientes = await (from r in db.Set<Remision>().IgnoreQueryFilters()
                               join p in demo on r.PedidoId equals p.Id
                               where !r.IsDeleted && r.Estado == EstadoViaje.Terminado && p.FechaHoraEntrega > ahora.AddDays(-14)
                               orderby p.FechaHoraEntrega
                               select new { P = p, R = r }).ToListAsync(ct);
        var calidad = new Application.Calidad.CalidadServicio(db);
        var rnd = new Random(7);
        async Task Muestra(Pedido p, Remision r, Func<int, decimal> resistencia)
        {
            var m = new MuestraLaboratorio
            {
                PedidoId = p.Id, RemisionId = r.Id, FechaMuestreo = r.LlegadaEn ?? p.FechaHoraEntrega, RevenimientoCm = 12 + rnd.Next(0, 5),
                TemperaturaC = 28 + rnd.Next(0, 6), LaboratoristaNombre = "Lab. Demo",
            };
            await calidad.PrepararMuestra(m, ct);
            db.Add(m);
            foreach (var e in db.ChangeTracker.Entries<EnsayeLaboratorio>().Select(x => x.Entity).Where(e => e.MuestraId == m.Id && e.FechaProgramada <= hoy))
                (e.FechaEnsaye, e.ResistenciaKgCm2, e.LaboratoristaNombre) = (e.FechaProgramada, resistencia(e.EdadDias), "Lab. Demo");
            await db.SaveChangesAsync(ct);
        }
        // f'c 250: la de 40 días cumple; la de 36 días no (28 días: 205 < 250 − 35).
        await Muestra(viejas[0].P, viejas[0].R, edad => edad switch { 7 => 185, 14 => 228, _ => 268 });
        await Muestra(viejas[1].P, viejas[1].R, edad => edad switch { 7 => 150, 14 => 182, _ => 205 });
        foreach (var x in recientes.DistinctBy(x => x.P.Id).TakeLast(3))
            await Muestra(x.P, x.R, edad => 170 + rnd.Next(0, 25));
    }

    static decimal Ruido(Random r) => Math.Round((decimal)(r.NextDouble() - 0.5) * 0.00006m, 6);

    static (decimal, decimal, decimal, decimal, string) Tramo(decimal aLat, decimal aLng, decimal bLat, decimal bLng, decimal f, decimal rpm, string sentido) =>
        (aLat + (bLat - aLat) * f, aLng + (bLng - aLng) * f, 1, rpm, sentido);

    static PosicionEquipo Punto(Guid equipo, DateTime fecha, decimal lat, decimal lng, decimal vel, decimal altitud, decimal rpm, string sentido, bool motor) => new()
    {
        EquipoId = equipo, Fecha = fecha, Lat = Math.Round(lat, 6), Lng = Math.Round(lng, 6), VelocidadKmh = vel, AltitudM = Math.Round(altitud, 1),
        Fuente = FuentePosicion.Demo,
        Atributos = JsonSerializer.SerializeToDocument(new { tamborRpm = rpm, tamborSentido = sentido, motorEncendido = motor, combustiblePct = 60 }),
    };

    static readonly string[] Operadores = ["Luis May", "Pedro Chi", "Ana Uc", "Mario Dzul", "José Can", "Rosa Ek"];

    /// <summary>Marca, modelo y capacidad de ejemplo por tipo de equipo.</summary>
    static (string Marca, string Modelo, decimal? Capacidad, string? Unidad) Ficha(TipoEquipo t) => t switch
    {
        TipoEquipo.Revolvedor => ("Kenworth", "T370", 7, "m³"),
        TipoEquipo.BombaPluma => ("Schwing", "S 36 X", 36, "m"),
        TipoEquipo.BombaEstacionaria => ("Putzmeister", "BSA 1409", 60, "m³"),
        TipoEquipo.Volteo => ("International", "HV613", 14, "m³"),
        TipoEquipo.Plataforma => ("Freightliner", "M2 106", 12, "t"),
        TipoEquipo.Tractocamion => ("Kenworth", "T680", 30, "t"),
        TipoEquipo.Pipa => ("Isuzu", "FVR", 10_000, "L"),
        TipoEquipo.Camioneta => ("Nissan", "NP300", 1, "t"),
        TipoEquipo.Retroexcavadora => ("Caterpillar", "416F2", null, null),
        TipoEquipo.Cargador => ("Komatsu", "WA200", 2, "m³"),
        TipoEquipo.Excavadora => ("Caterpillar", "320", 1, "m³"),
        TipoEquipo.Grua => ("Grove", "RT530E", 27, "t"),
        TipoEquipo.Montacargas => ("Toyota", "8FGU25", 2.5m, "t"),
        _ => ("Genérico", "Demo", null, null),
    };
}
