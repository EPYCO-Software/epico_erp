using EPICO.Application.Common;
using EPICO.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EPICO.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection s, IConfiguration c)
    {
        s.AddDbContext<AppDbContext>(o =>
            o.UseNpgsql(c.GetConnectionString("Default")));
        s.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        return s;
    }
}