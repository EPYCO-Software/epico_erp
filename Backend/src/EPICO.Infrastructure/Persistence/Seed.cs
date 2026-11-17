using System.Text.Json;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EPICO.Infrastructure.Persistence;

/// <summary>
/// Datos mínimos para arrancar. Corre con --migrate después de las migraciones y se puede repetir:
/// busca cada registro por su llave natural y solo agrega lo que falta (no pisa lo que ya existe).
/// </summary>
public static class Seed
{
    public const string RolRoot = "Root", RolAdministrador = "Administrador", RolVentas = "Ventas";

    /// <summary>Contraseña del usuario inicial si no se configura Seed__RootPassword. Cámbiala al primer ingreso.</summary>
    public const string PasswordInicial = "EpicoERP1.";

    /// <summary>
    /// Roles del sistema. Sus permisos se ponen solo al crear el rol: lo que después cambies desde la pantalla de roles
    /// no se pisa al volver a correr el seed. "*" = root (todo y sin filtro por empresa); "modulo.*" = todo ese módulo.
    /// </summary>
    public static readonly (string Nombre, string Descripcion, string[] Permisos)[] Roles =
    [
        (RolRoot, "Acceso total, sin restricción de empresa", ["*"]),
        (RolAdministrador, "Administra la organización: configuración, usuarios y todos los módulos",
            ["config.*", "general.*", "ventas.*", "crm.*", "inventario.*", "flota.*", "operacion.*"]),
        (RolVentas, "Clientes, cotizaciones y pedidos; consulta catálogos y existencias",
            ["ventas.clientes.*", "ventas.obras.*", "ventas.cotizaciones.*", "ventas.pedidos.*", "crm.*", "general.*",
             "ventas.productos.ver", "ventas.listas_precios.ver", "ventas.programas.ver",
             "inventario.existencias.ver", "flota.equipos.ver", "operacion.remisiones.ver"]),
    ];

    static readonly (string Razon, string Zona, (string Codigo, string Nombre, decimal Lat, decimal Lng)[] Plantas)[] Empresas =
    [
        ("EPICO Concretos del Sureste", "America/Merida",
            [("ESC", "Planta Escárcega", 18.6101m, -90.7352m), ("XPJ", "Planta Xpujil", 18.5097m, -89.3946m)]),
        ("EPICO Concretos del Caribe", "America/Cancun",
            [("CZM", "Planta Cozumel", 20.4878m, -86.9422m), ("CUN", "Planta Cancún", 21.1619m, -86.8515m)]),
    ];

    // Corre en cada deploy (--migrate). Solo agrega lo que falta: "ya existe" cuenta también lo borrado (sin filtros), así
    // no resucita lo que alguien eliminó ni choca con los índices únicos (código de planta, de producto…).
    public static async Task EjecutarAsync(AppDbContext db, IConfiguration cfg, ILogger log, CancellationToken ct = default)
    {
        foreach (var (codigo, nombre) in new[] { ("MXN", "Peso mexicano"), ("USD", "Dólar estadounidense") })
            if (!await db.Set<Moneda>().AnyAsync(m => m.Codigo == codigo, ct))
                db.Add(new Moneda { Codigo = codigo, Nombre = nombre });

        var org = await db.Set<Organizacion>().FirstOrDefaultAsync(o => o.Slug == "epico", ct)
                  ?? db.Add(new Organizacion { Nombre = "Grupo EPICO", Slug = "epico" }).Entity;

        var empresas = new List<Empresa>();
        var año = DateTime.UtcNow.ToString("yy");
        foreach (var (razon, zona, plantas) in Empresas)
        {
            var emp = await db.Set<Empresa>().IgnoreQueryFilters().FirstOrDefaultAsync(e => e.OrganizacionId == org.Id && e.RazonSocial == razon, ct)
                      ?? db.Add(new Empresa { OrganizacionId = org.Id, RazonSocial = razon, NombreComercial = razon, ZonaHoraria = zona }).Entity;
            empresas.Add(emp);
            foreach (var (codigo, nombre, lat, lng) in plantas)
            {
                var suc = await db.Set<Sucursal>().IgnoreQueryFilters().FirstOrDefaultAsync(s => s.EmpresaId == emp.Id && s.Codigo == codigo, ct)
                          ?? db.Add(new Sucursal { EmpresaId = emp.Id, Codigo = codigo, Nombre = nombre, ZonaHoraria = zona, Lat = lat, Lng = lng }).Entity;
                // Folios: EPI-PRES-ESC-26001, PED-ESC-26-001, REM-ESC-26-001.
                // shortcut: el año queda en el prefijo; al cambiar de año hay que actualizar Prefijo y Siguiente.
                foreach (var (tipo, prefijo) in new[] { ("cotizacion", $"EPI-PRES-{codigo}-{año}"), ("pedido", $"PED-{codigo}-{año}-"), ("remision", $"REM-{codigo}-{año}-") })
                    if (!await db.Set<Secuencia>().AnyAsync(x => x.EmpresaId == emp.Id && x.SucursalId == suc.Id && x.Tipo == tipo, ct))
                        db.Add(new Secuencia { EmpresaId = emp.Id, SucursalId = suc.Id, Tipo = tipo, Prefijo = prefijo });
            }
        }
        await Catalogos(db, org, ct);

        // El rol de acceso total se llamaba "Administrador del sistema": se renombra para no duplicarlo.
        if (await db.Set<Rol>().IgnoreQueryFilters().FirstOrDefaultAsync(r => r.OrganizacionId == null && r.Nombre == "Administrador del sistema", ct) is { } viejo)
            (viejo.Nombre, viejo.Descripcion) = (RolRoot, Roles[0].Descripcion);
        var roles = new Dictionary<string, Rol>();
        foreach (var (nombre, descripcion, permisos) in Roles)
        {
            var rol = db.ChangeTracker.Entries<Rol>().Select(e => e.Entity).FirstOrDefault(r => r.OrganizacionId == null && r.Nombre == nombre)
                      ?? await db.Set<Rol>().IgnoreQueryFilters().FirstOrDefaultAsync(r => r.OrganizacionId == null && r.Nombre == nombre, ct);
            if (rol is null)
            {
                rol = db.Add(new Rol { Nombre = nombre, Descripcion = descripcion }).Entity;
                db.AddRange(permisos.Select(p => new RolPermiso { RolId = rol.Id, Permiso = p }));
            }
            roles[nombre] = rol;
        }
        var rolRoot = roles[RolRoot];
        if (!await db.Set<RolPermiso>().AnyAsync(p => p.RolId == rolRoot.Id && p.Permiso == "*", ct) &&
            !db.ChangeTracker.Entries<RolPermiso>().Any(e => e.Entity.RolId == rolRoot.Id && e.Entity.Permiso == "*"))
            db.Add(new RolPermiso { RolId = rolRoot.Id, Permiso = "*" });

        // Usuario inicial con rol Root en todas las empresas. La contraseña solo se pone al crearlo.
        var correo = cfg["Seed:RootCorreo"]?.Trim().ToLowerInvariant();
        var root = string.IsNullOrEmpty(correo) ? null : await db.Set<Usuario>().IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Correo == correo, ct);
        if (root is null && !string.IsNullOrEmpty(correo))
        {
            var password = cfg["Seed:RootPassword"] is { Length: > 0 } p ? p : PasswordInicial;
            root = new Usuario { Correo = correo, Nombre = "Administrador", Tipo = TipoUsuario.Interno, CorreoVerificado = true };
            root.PasswordHash = new PasswordHasher<Usuario>().HashPassword(root, password);
            db.Add(root);
            if (password == PasswordInicial)
                log.LogWarning("Seed: se creó {Correo} con la contraseña inicial; cámbiala al entrar", correo);
        }
        if (root is not null)
        {
            root.RolId ??= rolRoot.Id;
            foreach (var emp in empresas)
                if (!await db.Set<UsuarioAcceso>().AnyAsync(a => a.UsuarioId == root.Id && a.EmpresaId == emp.Id && a.SucursalId == null, ct))
                    db.Add(new UsuarioAcceso { UsuarioId = root.Id, EmpresaId = emp.Id, Predeterminado = emp == empresas[0] });
        }

        await db.SaveChangesAsync(ct);
    }

    record TarifarioSeed(decimal Iva, List<CategoriaSeed> Categorias, List<ProductoSeed> Productos);
    record CategoriaSeed(string Clave, string Nombre, string Tipo);
    record ProductoSeed(string Codigo, string Nombre, string Categoria, string Unidad, decimal Precio, decimal? Minimo,
        string Descripcion, string? ConcretoFc, string? EquipoTipo);

    static readonly (string Clave, string Nombre, string Sat)[] Unidades =
        [("M3", "M³", "MTQ"), ("PZA", "Pieza", "H87"), ("KG", "Kg", "KGM"), ("DIA", "Día", "DAY"), ("KM", "Km", "KMT"),
         ("SRV", "Servicio", "E48"), ("VIS", "Visita", "E48")];

    /// <summary>Unidades, IVA, categorías del sistema y el tarifario (tarifario.json, sacado del front).</summary>
    static async Task Catalogos(AppDbContext db, Organizacion org, CancellationToken ct)
    {
        await using var json = typeof(Seed).Assembly.GetManifestResourceStream("tarifario.json")!;
        var t = (await JsonSerializer.DeserializeAsync<TarifarioSeed>(json, JsonSerializerOptions.Web, ct))!;

        var unidades = new Dictionary<string, UnidadMedida>();
        foreach (var (clave, nombre, sat) in Unidades)
            unidades[clave] = await db.Set<UnidadMedida>().FirstOrDefaultAsync(u => u.Clave == clave, ct)
                              ?? db.Add(new UnidadMedida { Clave = clave, Nombre = nombre, ClaveSat = sat }).Entity;

        if (!await db.Set<Impuesto>().IgnoreQueryFilters().AnyAsync(i => i.EmpresaId == null && i.ImpuestoSat == "002", ct))
            db.Add(new Impuesto { Nombre = $"IVA {t.Iva * 100:0} %", Tipo = TipoImpuesto.Traslado, ImpuestoSat = "002", Tasa = t.Iva });

        var categorias = new Dictionary<string, CategoriaProducto>();
        foreach (var c in t.Categorias)
            categorias[c.Clave] = await db.Set<CategoriaProducto>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.OrganizacionId == null && x.Clave == c.Clave, ct)
                                  ?? db.Add(new CategoriaProducto { Clave = c.Clave, Nombre = c.Nombre, Tipo = Opcion<TipoProducto>(c.Tipo) }).Entity;

        foreach (var p in t.Productos)
            if (!await db.Set<Producto>().IgnoreQueryFilters().AnyAsync(x => x.OrganizacionId == org.Id && x.Codigo == p.Codigo, ct))
                db.Add(new Producto
                {
                    OrganizacionId = org.Id,
                    CategoriaId = categorias[p.Categoria].Id,
                    Tipo = categorias[p.Categoria].Tipo,
                    Codigo = p.Codigo,
                    Nombre = p.Nombre,
                    Descripcion = p.Descripcion,
                    UnidadId = unidades[p.Unidad].Id,
                    PrecioLista = p.Precio,
                    MinimoCobro = p.Minimo,
                    ConcretoFc = p.ConcretoFc,
                    ConcretoEdadDias = p.ConcretoFc is null ? null : (short)28,
                    EquipoTipo = p.EquipoTipo is null ? null : Opcion<TipoEquipo>(p.EquipoTipo),
                    Soluciones = categorias[p.Categoria].Tipo == TipoProducto.Concreto ? Soluciones.Sugeridas(p.ConcretoFc) : [],
                });

        // Aditivos de antes de la categoría "aditivo": se mueven si siguen en "ajuste" (precio y nombre no se tocan).
        foreach (var x in await db.Set<Producto>().Where(x => x.OrganizacionId == org.Id && x.Codigo.StartsWith(PrefijoAditivo)
                                                              && x.CategoriaId == categorias["ajuste"].Id).ToListAsync(ct))
            x.CategoriaId = categorias["aditivo"].Id;

        // Concretos sin soluciones (de antes de que existieran): se etiquetan por resistencia; las que alguien ya puso no se tocan.
        // shortcut: si alguien vacía a propósito las soluciones de un concreto, el siguiente seed las vuelve a poner.
        foreach (var x in await db.Set<Producto>().Where(x => x.OrganizacionId == org.Id && x.Tipo == TipoProducto.Concreto && x.Soluciones.Count == 0).ToListAsync(ct))
            x.Soluciones = Soluciones.Sugeridas(x.ConcretoFc);
    }

    public const string PrefijoAditivo = "AJ-ADT-";

    static T Opcion<T>(string clave) where T : struct, Enum => Enum.Parse<T>(clave.Replace("_", ""), ignoreCase: true);
}
