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
        s.AddSingleton<Correo.Cifrado>();
        s.AddHostedService<Correo.EnvioCorreos>();
        s.AddHttpClient(Gps.TraccarGps.Cliente, h => h.Timeout = TimeSpan.FromSeconds(8));
        s.AddSingleton<Application.Flota.IGps, Gps.TraccarGps>();
        s.AddSingleton<Gps.AvisosCombustible>();
        s.AddHostedService(sp => sp.GetRequiredService<Gps.AvisosCombustible>());
        s.AddSingleton<Gps.GuardarPosiciones>();
        s.AddHostedService(sp => sp.GetRequiredService<Gps.GuardarPosiciones>());
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
        .MapEnum<EstadoEquipo>()
        .MapEnum<TipoDocumentoEquipo>()
        .MapEnum<TipoMantenimiento>()
        .MapEnum<EstadoMantenimiento>()
        .MapEnum<OrigenReagenda>()
        .MapEnum<EstadoSolicitud>()
        .MapEnum<TipoTrayecto>()
        .MapEnum<FuentePosicion>()
        .MapEnum<ResultadoInspeccion>()
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
        .MapEnum<TipoImpuesto>()
        .MapEnum<SeguridadSmtp>()
        .MapEnum<EstadoCorreo>();
}
