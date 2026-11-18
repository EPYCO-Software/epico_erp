using EPICO.Application.Flota;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EPICO.Infrastructure.Gps;

/// <summary>
/// Historial GPS: cada 30 s, si Traccar está configurado, guarda la posición nueva de cada dispositivo vinculado a una unidad
/// (sin duplicar por fecha). Flota:GuardarPosiciones=false lo apaga.
/// shortcut: guarda solo la última posición de cada lectura; si un equipo reporta más seguido que 30 s se pierden puntos intermedios
/// (para no perderlos, leer /api/reports/route por rango).
/// </summary>
public sealed class GuardarPosiciones(IServiceProvider sp, IGps gps, IConfiguration cfg, ILogger<GuardarPosiciones> log) : BackgroundService
{
    public static readonly TimeSpan Cada = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!cfg.GetValue("Flota:GuardarPosiciones", true)) return;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var lectura = await gps.Leer(ct);
                if (lectura.Configurado && lectura.Dispositivos.Count > 0)
                {
                    await using var scope = sp.CreateAsyncScope();
                    await scope.ServiceProvider.GetRequiredService<FlotaServicio>().GuardarPosiciones(lectura, ct);
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogWarning(ex, "No se guardaron las posiciones GPS");
            }
            try { await Task.Delay(Cada, ct); }
            catch (OperationCanceledException) { break; }
        }
    }
}
