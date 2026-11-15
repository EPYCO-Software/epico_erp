using EPICO.Application.Common;
using EPICO.Domain.Common;
using EPICO.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EPICO.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection s, IConfiguration c)
    {
        s.AddDbContext<AppDbContext>(o => o.UseNpgsql(c.GetConnectionString("Default"), Enums));
        s.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        return s;
    }

    /// <summary>Enums de Postgres (tipo_usuario, tipo_evento…): también los usan las pruebas.</summary>
    public static void Enums(Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure.NpgsqlDbContextOptionsBuilder o) => o
        .MapEnum<TipoUsuario>()
        .MapEnum<TipoEvento>()
        .MapEnum<TipoDatoCambio>()
        .MapEnum<TipoActividad>()
        .MapEnum<EtapaProspecto>()
        .MapEnum<TipoProducto>()
        .MapEnum<TipoMovimientoInventario>()
        .MapEnum<TipoEquipo>()
        .MapEnum<AplicarRegla>()
        .MapEnum<TipoReglaPrecio>()
        .MapEnum<TipoPrograma>()
        .MapEnum<TipoRecompensa>()
        .MapEnum<EstadoCotizacion>()
        .MapEnum<OrigenCotizacion>()
        .MapEnum<EstadoPedido>()
        .MapEnum<EstadoCobro>()
        .MapEnum<MetodoPago>()
        .MapEnum<EstatusPlanta>()
        .MapEnum<EstadoViaje>()
        .MapEnum<TipoImpuesto>();
}
