using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using EPICO.Application.Common;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace EPICO.Infrastructure.Persistence;

public partial class AppDbContext(DbContextOptions<AppDbContext> options, IUsuarioActual usuario)
    : DbContext(options), IAppDbContext
{
    // Los filtros globales leen esto en cada consulta (EF lo toma de la instancia del contexto).
    // Sin usuario (seed, migraciones, login) o con permiso "*" no se filtra por empresa ni organización.
    public bool VeTodo => usuario.Id is null || usuario.EsRoot;
    public Guid[] EmpresasPermitidas => [.. usuario.EmpresaIds];
    public Guid? OrganizacionPermitida => usuario.OrganizacionId;

    // Importes en numeric(14,2) salvo que la propiedad diga otra cosa (cantidades, coordenadas, tasas).
    protected override void ConfigureConventions(ModelConfigurationBuilder c) =>
        c.Properties<decimal>().HavePrecision(14, 2);

    protected override void OnModelCreating(ModelBuilder b)
    {
        ConfigurarVentas(b);
        b.Entity<Organizacion>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.LogoArchivoId);
        });
        b.Entity<Empresa>(e =>
        {
            e.HasIndex(x => new { x.OrganizacionId, x.RFC }).IsUnique();
            e.Property(x => x.MonedaCodigo).IsFixedLength();
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Moneda>().WithMany().HasForeignKey(x => x.MonedaCodigo);
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.LogoArchivoId);
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.CsdCerArchivoId);
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.CsdKeyArchivoId);
        });
        b.Entity<Sucursal>(e =>
        {
            e.HasIndex(x => new { x.EmpresaId, x.Codigo }).IsUnique();
            e.Property(x => x.Lat).HasPrecision(9, 6);
            e.Property(x => x.Lng).HasPrecision(9, 6);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
        });
        b.Entity<Usuario>(e =>
        {
            e.HasIndex(x => x.Correo).IsUnique();
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.FotoArchivoId);
        });
        b.Entity<Rol>().HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
        b.Entity<RolPermiso>(e =>
        {
            e.HasIndex(x => new { x.RolId, x.Permiso }).IsUnique();
            e.HasOne<Rol>().WithMany().HasForeignKey(x => x.RolId);
        });
        b.Entity<UsuarioAcceso>(e =>
        {
            e.HasIndex(x => new { x.UsuarioId, x.EmpresaId, x.SucursalId }).IsUnique().AreNullsDistinct(false);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasOne<Rol>().WithMany().HasForeignKey(x => x.RolId);
        });
        b.Entity<Sesion>(e =>
        {
            e.HasIndex(x => x.RefreshTokenHash).IsUnique();
            e.HasIndex(x => new { x.UsuarioId, x.CreadaEn });
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
        });
        b.Entity<Secuencia>(e =>
        {
            e.HasIndex(x => new { x.EmpresaId, x.SucursalId, x.Tipo }).IsUnique().AreNullsDistinct(false);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
        });
        b.Entity<Moneda>(e =>
        {
            e.HasKey(x => x.Codigo);
            e.Property(x => x.Codigo).IsFixedLength();
        });
        b.Entity<Archivo>(e =>
        {
            e.HasIndex(x => new { x.RegistroTipo, x.RegistroId });
            e.Property(x => x.Sha256).IsFixedLength();
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.SubidoPorId);
        });
        b.Entity<Evento>(e =>
        {
            e.HasIndex(x => new { x.RegistroTipo, x.RegistroId, x.Fecha });
            e.HasIndex(x => new { x.RegistroPadreTipo, x.RegistroPadreId, x.Fecha });
            e.HasIndex(x => new { x.AutorId, x.Fecha });
            e.Property(x => x.Detalles).HasColumnType("jsonb");
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.AutorId);
            e.HasOne<Sesion>().WithMany().HasForeignKey(x => x.SesionId);
            e.HasMany(x => x.Cambios).WithOne().HasForeignKey(x => x.EventoId);
        });
        b.Entity<EventoCambio>(e =>
        {
            e.HasIndex(x => x.Campo);
            e.Property(x => x.ValorAnteriorCrudo).HasColumnType("jsonb");
            e.Property(x => x.ValorNuevoCrudo).HasColumnType("jsonb");
        });
        b.Entity<Seguidor>(e =>
        {
            e.HasIndex(x => new { x.RegistroTipo, x.RegistroId, x.UsuarioId }).IsUnique();
            e.HasIndex(x => x.UsuarioId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId);
        });
        b.Entity<Actividad>(e =>
        {
            e.HasIndex(x => new { x.AsignadaAId, x.FechaLimite });
            e.HasIndex(x => new { x.RegistroTipo, x.RegistroId });
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.AsignadaAId);
        });

        foreach (var t in b.Model.GetEntityTypes().ToList())
        {
            t.SetTableName(t.ClrType.Name); // tablas en singular, como el esquema
            var clr = t.ClrType;
            if (typeof(BaseEntity).IsAssignableFrom(clr))
            {
                b.Entity(clr).HasOne(typeof(Usuario)).WithMany().HasForeignKey(nameof(BaseEntity.CreatedById));
                b.Entity(clr).HasOne(typeof(Usuario)).WithMany().HasForeignKey(nameof(BaseEntity.UpdatedById));
                Aplicar(nameof(FiltroBorrado), clr, b);
            }
            if (typeof(IDeEmpresa).IsAssignableFrom(clr)) Aplicar(nameof(FiltroEmpresa), clr, b);
            if (typeof(IDeOrganizacion).IsAssignableFrom(clr)) Aplicar(nameof(FiltroOrganizacion), clr, b);
            if (typeof(IRestringible).IsAssignableFrom(clr)) Aplicar(nameof(FiltroRestringida), clr, b);
        }
        b.Entity<Empresa>().HasQueryFilter("empresa", x => VeTodo || EmpresasPermitidas.Contains(x.Id));

        // Borrado lógico: nada se borra en cascada.
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;
    }

    void Aplicar(string metodo, Type t, ModelBuilder b) =>
        GetType().GetMethod(metodo, BindingFlags.NonPublic | BindingFlags.Instance)!
            .MakeGenericMethod(t).Invoke(this, [b]);

    void FiltroBorrado<T>(ModelBuilder b) where T : BaseEntity =>
        b.Entity<T>().HasQueryFilter("borrado", x => !x.IsDeleted);

    void FiltroEmpresa<T>(ModelBuilder b) where T : class, IDeEmpresa =>
        b.Entity<T>().HasQueryFilter("empresa", x => VeTodo || EmpresasPermitidas.Contains(x.EmpresaId));

    void FiltroOrganizacion<T>(ModelBuilder b) where T : class, IDeOrganizacion =>
        b.Entity<T>().HasQueryFilter("organizacion", x => VeTodo || x.OrganizacionId == OrganizacionPermitida);

    void FiltroRestringida<T>(ModelBuilder b) where T : class, IRestringible =>
        b.Entity<T>().HasQueryFilter("restringida", x =>
            VeTodo || x.EmpresaRestringidaId == null || EmpresasPermitidas.Contains(x.EmpresaRestringidaId.Value));

    // ---------------------------------------------------------------------------------------------
    // Guardado: columnas base, borrado lógico e historial (Evento/EventoCambio) en la misma transacción.
    // ---------------------------------------------------------------------------------------------

    public override int SaveChanges(bool acceptAllChangesOnSuccess) =>
        SaveChangesAsync(acceptAllChangesOnSuccess).GetAwaiter().GetResult();

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
    {
        ChangeTracker.DetectChanges();
        var ahora = DateTime.UtcNow;
        foreach (var e in ChangeTracker.Entries().ToList())
        {
            if (e.Entity is Evento or EventoCambio && e.State is EntityState.Modified or EntityState.Deleted)
                throw new InvalidOperationException("El historial solo se agrega: no se edita ni se borra.");
            if (e.Entity is not BaseEntity x) continue;

            if (e.State == EntityState.Deleted)
            {
                e.State = EntityState.Modified;
                x.IsDeleted = true;
            }
            if (e.State == EntityState.Added)
            {
                x.CreatedAt = ahora;
                x.CreatedById = usuario.Id;
            }
            else if (e.State == EntityState.Modified)
            {
                x.UpdatedAt = ahora;
                x.UpdatedById = usuario.Id;
            }
            else continue;

            await AnotarHistorial(e, x, ahora, ct);
        }
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
    }

    static readonly JsonSerializerOptions Json = new()
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
    };

    /// <summary>Solo los registros con algún campo [Rastreado] llevan hilo (como mail.thread en Odoo).</summary>
    async Task AnotarHistorial(EntityEntry e, BaseEntity x, DateTime ahora, CancellationToken ct)
    {
        var tipo = x.GetType();
        var rastreados = tipo.GetProperties()
            .Select(p => (p, a: p.GetCustomAttribute<RastreadoAttribute>()))
            .Where(r => r.a is not null)
            .ToList();
        if (rastreados.Count == 0) return;

        var org = x switch
        {
            Organizacion o => o.Id,
            IDeOrganizacion d => d.OrganizacionId,
            IDeEmpresa d => (await Set<Empresa>().IgnoreQueryFilters().FirstOrDefaultAsync(m => m.Id == d.EmpresaId, ct)
                             ?? Set<Empresa>().Local.FirstOrDefault(m => m.Id == d.EmpresaId))?.OrganizacionId,
            _ => usuario.OrganizacionId,
        };
        // shortcut: un registro sin organización deducible (p. ej. el usuario root creado por el seed) se queda
        // sin hilo; cuando Usuario tenga OrganizacionId, quitar este caso.
        if (org is not Guid orgId) return;

        var ev = new Evento
        {
            OrganizacionId = orgId,
            RegistroTipo = tipo.Name,
            RegistroId = x.Id,
            Fecha = ahora,
            AutorId = usuario.Id,
            SesionId = usuario.SesionId,
            RegistroPadreTipo = (x as IDePadre)?.PadreTipo,
            RegistroPadreId = (x as IDePadre)?.PadreId,
        };

        if (e.State == EntityState.Added)
        {
            ev.Tipo = TipoEvento.Creado;
            ev.Texto = $"{tipo.Name} creado";
            if (usuario.Id is Guid autor)
                Add(new Seguidor
                {
                    RegistroTipo = tipo.Name,
                    RegistroId = x.Id,
                    UsuarioId = autor,
                    Tipos = [.. Enum.GetValues<TipoEvento>()],
                    CreatedAt = ahora,
                });
        }
        else
        {
            var borrado = e.Property(nameof(BaseEntity.IsDeleted));
            (ev.Tipo, ev.Texto) = (bool)borrado.OriginalValue! == x.IsDeleted ? (TipoEvento.Cambio, "Cambios guardados")
                : x.IsDeleted ? (TipoEvento.Eliminado, "Eliminado")
                : (TipoEvento.Restaurado, "Restaurado");

            foreach (var (p, a) in rastreados)
            {
                var prop = e.Property(p.Name);
                if (Equals(prop.OriginalValue, prop.CurrentValue)) continue;
                var tipoDato = a!.Tipo ?? Deducir(p.PropertyType);
                ev.Cambios.Add(new EventoCambio
                {
                    Campo = p.Name,
                    Etiqueta = a.Etiqueta,
                    TipoDato = tipoDato,
                    ValorAnterior = Legible(prop.OriginalValue, tipoDato),
                    ValorNuevo = Legible(prop.CurrentValue, tipoDato),
                    ValorAnteriorCrudo = prop.OriginalValue is null ? null : JsonSerializer.Serialize(prop.OriginalValue, Json),
                    ValorNuevoCrudo = prop.CurrentValue is null ? null : JsonSerializer.Serialize(prop.CurrentValue, Json),
                    Orden = (short)ev.Cambios.Count,
                });
            }
            if (ev.Tipo == TipoEvento.Cambio && ev.Cambios.Count == 0) return; // no cambió nada rastreado
        }
        Add(ev);
    }

    static TipoDatoCambio Deducir(Type t)
    {
        t = Nullable.GetUnderlyingType(t) ?? t;
        return t == typeof(string) ? TipoDatoCambio.Texto
            : t == typeof(bool) ? TipoDatoCambio.Booleano
            : t == typeof(DateTime) ? TipoDatoCambio.FechaHora
            : t == typeof(DateOnly) ? TipoDatoCambio.Fecha
            : t == typeof(Guid) ? TipoDatoCambio.Referencia
            : t.IsEnum ? TipoDatoCambio.Opcion
            : TipoDatoCambio.Numero;
    }

    static readonly CultureInfo Mx = CultureInfo.GetCultureInfo("es-MX");

    // shortcut: las referencias muestran el Id y las opciones la clave; cuando el front pinte el hilo,
    // guardar el nombre del registro y la etiqueta de la opción.
    static string? Legible(object? v, TipoDatoCambio t) => v switch
    {
        null => null,
        bool s => s ? "Sí" : "No",
        decimal d when t == TipoDatoCambio.Dinero => d.ToString("C2", Mx),
        DateTime f => f.ToString("yyyy-MM-dd HH:mm 'UTC'", Mx),
        DateOnly f => f.ToString("yyyy-MM-dd", Mx),
        Enum o => JsonNamingPolicy.SnakeCaseLower.ConvertName(o.ToString()),
        IFormattable n => n.ToString(null, Mx),
        _ => v.ToString(),
    };

    // ---------------------------------------------------------------------------------------------
    // Folios
    // ---------------------------------------------------------------------------------------------

    public async Task<string> SiguienteFolioAsync(Guid empresaId, Guid? sucursalId, string tipo, CancellationToken ct = default)
    {
        // El UPDATE bloquea el renglón hasta que termine la transacción (igual que SELECT … FOR UPDATE).
        var filas = await Database.SqlQuery<Folio>($"""
            UPDATE "Secuencia" SET "Siguiente" = "Siguiente" + 1
            WHERE "EmpresaId" = {empresaId} AND "SucursalId" IS NOT DISTINCT FROM {sucursalId} AND "Tipo" = {tipo}
            RETURNING "Prefijo", "Siguiente" - 1 AS "Numero"
            """).ToListAsync(ct);
        return filas is [var f]
            ? f.Prefijo + f.Numero.ToString("D3")
            : throw new InvalidOperationException($"No hay secuencia '{tipo}' para esa empresa y planta.");
    }

    sealed class Folio
    {
        public string Prefijo { get; set; } = "";
        public long Numero { get; set; }
    }
}
