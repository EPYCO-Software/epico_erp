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
            log.LogInformation("Seed demo: la empresa demo ya existe; no se cambia nada");
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

        // --- Equipos: uno de cada tipo, repartidos entre plantas --------------------------------------------
        var equipos = new Dictionary<TipoEquipo, Equipo>();
        var tipos = Enum.GetValues<TipoEquipo>();
        for (var i = 0; i < tipos.Length; i++)
        {
            var planta = i % 2 == 0 ? norte : sur;
            equipos[tipos[i]] = db.Add(new Equipo
            {
                SucursalId = planta.Id, Tipo = tipos[i], NumeroEconomico = $"{planta.Codigo}-{i + 1:D2}",
                Descripcion = $"{tipos[i]} demo", Placas = tipos[i] == TipoEquipo.Revolvedor ? "YUC-123-A" : null,
                CapacidadM3 = tipos[i] == TipoEquipo.Revolvedor ? 7 : null,
            }).Entity;
        }
        var revolvedor2 = db.Add(new Equipo
        {
            SucursalId = sur.Id, Tipo = TipoEquipo.Revolvedor, NumeroEconomico = "DMB-90", Descripcion = "Revolvedor demo", CapacidadM3 = 8,
        }).Entity;

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
            Notas = "Cliente de crédito (demo).",
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
        var pedidos = new Dictionary<EstadoPedido, Pedido>();
        for (var i = 0; i < casos.Length; i++)
        {
            var (estado, estatus) = casos[i];
            var solicitud = estatus == EstatusPlanta.Actualizacion;
            var (planta, cliente, obra) = i % 2 == 0 ? (norte, credito, obraGps) : (sur, contado, obraCasa);
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
                Estado = estado, Cobro = cobros[i % cobros.Length], MetodoPago = i % 2 == 0 ? MetodoPago.Transferencia : MetodoPago.SinMetodo,
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
                SalidaEn = e == EstadoViaje.Cargando ? null : salida,
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
        log.LogInformation("Seed demo: empresa {Empresa} creada; usuarios *@{Dominio} con contraseña {Password}", Empresa, Dominio, Password);
    }
}
