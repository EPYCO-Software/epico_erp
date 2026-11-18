using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EPICO.Application.Flota;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EPICO.Infrastructure.Gps;

/// <summary>
/// GPS de flota con Traccar: GET {Traccar:Url}/api/devices y /api/positions con Bearer {Traccar:Token}, en caché 15 s.
/// Sin Url o Token: no configurado (sin errores). Si Traccar falla: configurado, sin dispositivos, y se reintenta al vencer la caché.
/// </summary>
public sealed class TraccarGps(IHttpClientFactory http, IConfiguration cfg, ILogger<TraccarGps> log) : IGps
{
    public const string Cliente = "traccar";
    static readonly TimeSpan Vida = TimeSpan.FromSeconds(15);
    /// <summary>Traccar da la velocidad en nudos.</summary>
    const decimal KmhPorNudo = 1.852m;

    readonly SemaphoreSlim candado = new(1, 1);
    (DateTime En, GpsLectura Datos)? cache;

    record Dispositivo(int Id, string? Name, string UniqueId, string? Status);
    record PosicionTraccar(int DeviceId, double Latitude, double Longitude, double Speed, DateTime FixTime, double? Course = null,
        double? Altitude = null, Dictionary<string, JsonElement>? Attributes = null);

    public async Task<GpsLectura> Leer(CancellationToken ct)
    {
        var url = cfg["Traccar:Url"]?.TrimEnd('/');
        var token = cfg["Traccar:Token"];
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(token)) return GpsLectura.SinGps;
        if (cache is { } c && DateTime.UtcNow - c.En < Vida) return c.Datos;

        await candado.WaitAsync(ct);
        try
        {
            if (cache is { } c2 && DateTime.UtcNow - c2.En < Vida) return c2.Datos;
            GpsLectura datos;
            try
            {
                var cli = http.CreateClient(Cliente);
                cli.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
                var dispositivos = await cli.GetFromJsonAsync<List<Dispositivo>>($"{url}/api/devices", JsonSerializerOptions.Web, ct) ?? [];
                var posiciones = await cli.GetFromJsonAsync<List<PosicionTraccar>>($"{url}/api/positions", JsonSerializerOptions.Web, ct) ?? [];
                datos = Unir(dispositivos, posiciones);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested && ex is HttpRequestException or TaskCanceledException or JsonException or NotSupportedException)
            {
                log.LogWarning(ex, "Traccar no respondió en {Url}", url);
                datos = new(true, []);
            }
            cache = (DateTime.UtcNow, datos);
            return datos;
        }
        finally
        {
            candado.Release();
        }
    }

    static GpsLectura Unir(List<Dispositivo> dispositivos, List<PosicionTraccar> posiciones)
    {
        var ultima = posiciones.GroupBy(p => p.DeviceId).ToDictionary(g => g.Key, g => g.MaxBy(p => p.FixTime)!);
        return new(true, [.. dispositivos.Select(d => new GpsDispositivo(d.UniqueId, d.Name ?? d.UniqueId, d.Status,
            ultima.TryGetValue(d.Id, out var p)
                ? new Posicion((decimal)p.Latitude, (decimal)p.Longitude, DateTime.SpecifyKind(p.FixTime.ToUniversalTime(), DateTimeKind.Utc),
                    Math.Round((decimal)p.Speed * KmhPorNudo, 1), p.Course is double c ? Math.Round((decimal)c, 1) : null,
                    p.Altitude is double a ? Math.Round((decimal)a, 1) : null, Sensores.Normalizar(p.Attributes))
                : null,
            null))]);
    }
}
