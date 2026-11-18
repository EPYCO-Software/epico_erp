using System.Globalization;
using EPICO.Application.Flota;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Historial;
using EPICO.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EPICO.Infrastructure.Gps;

/// <summary>
/// Una vez al día (07:00 hora de México) avisa en el ERP qué unidades deben registrar carga de diésel y odómetro (7 días o 500 km
/// desde la última carga) a quien tenga flota.combustible.crear en su empresa. Revisa cada 10 min: si la API arranca después de
/// las 07:00 corre ese día; la Clave de la notificación evita repetir el aviso de una unidad el mismo día. Flota:AvisosCombustible=false lo apaga.
/// </summary>
public sealed class AvisosCombustible(IServiceProvider sp, IConfiguration cfg, ILogger<AvisosCombustible> log) : BackgroundService
{
    public static readonly TimeOnly Hora = new(7, 0);
    const string Zona = "America/Mexico_City";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!cfg.GetValue("Flota:AvisosCombustible", true)) return;
        DateOnly? hecho = null;
        while (!ct.IsCancellationRequested)
        {
            var local = VentasServicio.HoraLocal(DateTime.UtcNow, Zona);
            var hoy = DateOnly.FromDateTime(local);
            if (TimeOnly.FromDateTime(local) >= Hora && hecho != hoy)
            {
                try
                {
                    log.LogInformation("Avisos de combustible: {N} enviados", await Ejecutar(hoy, ct));
                    hecho = hoy;
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    log.LogError(ex, "Avisos de combustible: falló; se reintenta en 10 min");
                }
            }
            try { await Task.Delay(TimeSpan.FromMinutes(10), ct); }
            catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>Crea los avisos de ese día que falten; devuelve cuántos.</summary>
    public async Task<int> Ejecutar(DateOnly hoy, CancellationToken ct)
    {
        await using var scope = sp.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); // sin usuario: ve todas las organizaciones
        var flota = scope.ServiceProvider.GetRequiredService<FlotaServicio>();
        var vencidas = (await flota.Combustible(hoy, ct)).Where(c => c.Vencido).ToList();
        if (vencidas.Count == 0) return 0;
        var plantaIds = vencidas.Select(c => c.Equipo.SucursalId).Distinct().ToList();
        var empresaDe = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => plantaIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.EmpresaId, ct);
        var ahora = DateTime.UtcNow;
        var n = 0;
        foreach (var grupo in vencidas.GroupBy(c => empresaDe[c.Equipo.SucursalId]))
        {
            var usuarios = await db.UsuariosConPermisoAsync(grupo.Key, "flota.combustible.crear", ct);
            foreach (var c in grupo)
            {
                var clave = $"combustible:{c.Equipo.Id:N}:{hoy:yyyyMMdd}";
                var ya = await db.Set<Notificacion>().Where(x => x.Clave == clave && usuarios.Contains(x.UsuarioId)).Select(x => x.UsuarioId).ToListAsync(ct);
                var texto = c.KmDesdeUltimaCarga >= FlotaServicio.KmEntreCargas
                    ? $"Lleva {c.KmDesdeUltimaCarga.ToString("#,0", CultureInfo.InvariantCulture)} km desde la última carga."
                    : $"Le tocaba registrar el {c.Vence:dd/MM/yyyy}.";
                foreach (var u in usuarios.Except(ya))
                {
                    db.Set<Notificacion>().Add(new Notificacion
                    {
                        UsuarioId = u, Modulo = "flota", Titulo = $"Registrar carga y odómetro · {c.Equipo.NumeroEconomico}", Texto = texto,
                        Ruta = $"/flota/unidades/{c.Equipo.Id}", Fecha = ahora, Clave = clave,
                    });
                    n++;
                }
            }
        }
        await db.SaveChangesAsync(ct);
        return n;
    }
}
