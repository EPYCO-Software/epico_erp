using System.Security.Cryptography;
using System.Text;
using EPICO.Application.Common;
using EPICO.Domain.Common;
using EPICO.Domain.Correo;
using EPICO.Infrastructure.Persistence;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace EPICO.Infrastructure.Correo;

/// <summary>Datos para conectarse a un SMTP: el global (Correo__*) o un ServidorCorreo ya descifrado.</summary>
public record CuentaSmtp(string Host, int Puerto, SeguridadSmtp Seguridad, string? Usuario, string? Password, string Remitente)
{
    /// <summary>La sección Correo de la configuración; null si no hay Host (los correos quedan como fallidos).</summary>
    public static CuentaSmtp? Global(IConfiguration c) => c["Correo:Host"] is { Length: > 0 } host
        ? new(host, c.GetValue("Correo:Puerto", 587), c.GetValue("Correo:Seguridad", SeguridadSmtp.StartTls),
              c["Correo:Usuario"], c["Correo:Password"], c["Correo:Remitente"] is { Length: > 0 } r ? r : c["Correo:Usuario"] ?? "")
        : null;

    public static CuentaSmtp De(ServidorCorreo s, Cifrado cifrado) =>
        new(s.Host, s.Puerto, s.Seguridad, s.Usuario, s.PasswordCifrada is { } p ? cifrado.Descifrar(p) : null, s.Remitente ?? s.Usuario ?? "");
}

/// <summary>AES-GCM con la llave de Cifrado__Llave (cualquier texto largo; se deriva con SHA-256).</summary>
public sealed class Cifrado(IConfiguration c)
{
    byte[] Llave => c["Cifrado:Llave"] is { Length: >= 32 } k ? SHA256.HashData(Encoding.UTF8.GetBytes(k))
        : throw new ReglaException("Falta Cifrado__Llave (32+ caracteres) en el servidor: no se pueden guardar contraseñas.", 500);

    public string Cifrar(string texto)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plano = Encoding.UTF8.GetBytes(texto);
        var salida = new byte[plano.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(Llave, 16);
        aes.Encrypt(nonce, plano, salida, tag);
        return Convert.ToBase64String([.. nonce, .. tag, .. salida]);
    }

    public string Descifrar(string cifrado)
    {
        var b = Convert.FromBase64String(cifrado);
        var plano = new byte[b.Length - 28];
        using var aes = new AesGcm(Llave, 16);
        aes.Decrypt(b.AsSpan(0, 12), b.AsSpan(28), b.AsSpan(12, 16), plano);
        return Encoding.UTF8.GetString(plano);
    }
}

public static class Smtp
{
    public static async Task EnviarAsync(CuentaSmtp cuenta, string para, string asunto, string html, CancellationToken ct)
    {
        var m = new MimeMessage { Subject = asunto, Body = new BodyBuilder { HtmlBody = html }.ToMessageBody() };
        m.From.Add(MailboxAddress.Parse(cuenta.Remitente));
        m.To.Add(MailboxAddress.Parse(para));
        using var smtp = await ConectarAsync(cuenta, ct);
        await smtp.SendAsync(new MailKit.SendRequest(m), ct);
        await smtp.DisconnectAsync(true, ct);
    }

    /// <summary>Conecta y se autentica, sin enviar nada (botón "Probar conexión").</summary>
    public static async Task ProbarAsync(CuentaSmtp cuenta, CancellationToken ct)
    {
        using var smtp = await ConectarAsync(cuenta, ct);
        await smtp.DisconnectAsync(true, ct);
    }

    static async Task<SmtpClient> ConectarAsync(CuentaSmtp c, CancellationToken ct)
    {
        var smtp = new SmtpClient { Timeout = 20_000 };
        try
        {
            await smtp.ConnectAsync(c.Host, c.Puerto, c.Seguridad switch
            {
                SeguridadSmtp.Ninguna => SecureSocketOptions.None,
                SeguridadSmtp.Ssl => SecureSocketOptions.SslOnConnect,
                _ => SecureSocketOptions.StartTls,
            }, ct);
            if (!string.IsNullOrEmpty(c.Usuario)) await smtp.AuthenticateAsync(c.Usuario, c.Password ?? "", ct);
            return smtp;
        }
        catch
        {
            smtp.Dispose();
            throw;
        }
    }
}

/// <summary>
/// Envía la bandeja de salida cada 10 s: servidor forzado, si no el activo de menor prioridad de la organización,
/// si no el global. Hasta 5 intentos con espera creciente (2, 4, 8, 16 min).
/// shortcut: una sola instancia de la API; con varias réplicas habría que bloquear los renglones (FOR UPDATE SKIP LOCKED).
/// </summary>
public sealed class EnvioCorreos(IServiceProvider sp, IConfiguration cfg, Cifrado cifrado, ILogger<EnvioCorreos> log) : BackgroundService
{
    const int MaxIntentos = 5;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        do
        {
            try { await EnviarPendientesAsync(ct); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Error al enviar la bandeja de salida"); }
        } while (await timer.WaitForNextTickAsync(ct));
    }

    public async Task EnviarPendientesAsync(CancellationToken ct)
    {
        await using var scope = sp.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); // sin usuario: ve todas las organizaciones
        var ahora = DateTime.UtcNow;
        var pendientes = await db.Set<CorreoSaliente>()
            .Where(c => c.Estado == EstadoCorreo.Pendiente && c.ProximoIntento <= ahora)
            .OrderBy(c => c.CreadoEn).Take(20).ToListAsync(ct);
        if (pendientes.Count == 0) return;

        var orgs = pendientes.Select(c => c.OrganizacionId).OfType<Guid>().ToHashSet();
        var forzados = pendientes.Select(c => c.ServidorId).OfType<Guid>().ToHashSet();
        var servidores = await db.Set<ServidorCorreo>()
            .Where(s => s.Activo && (orgs.Contains(s.OrganizacionId) || forzados.Contains(s.Id)))
            .OrderBy(s => s.Prioridad).ThenBy(s => s.Id).ToListAsync(ct);
        var global = CuentaSmtp.Global(cfg);

        foreach (var c in pendientes)
        {
            var servidor = c.ServidorId is Guid id ? servidores.FirstOrDefault(s => s.Id == id)
                : servidores.FirstOrDefault(s => s.OrganizacionId == c.OrganizacionId);
            try
            {
                var cuenta = servidor is not null ? CuentaSmtp.De(servidor, cifrado)
                    : global ?? throw new InvalidOperationException("No hay servidor de correo: configura Correo__Host o un servidor de la organización.");
                await Smtp.EnviarAsync(cuenta, c.Para, c.Asunto, c.Html, ct);
                (c.Estado, c.EnviadoEn, c.Error) = (EstadoCorreo.Enviado, DateTime.UtcNow, null);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                c.Intentos++;
                c.Error = e.Message;
                if (c.Intentos >= MaxIntentos || servidor is null && global is null) c.Estado = EstadoCorreo.Fallido;
                else c.ProximoIntento = DateTime.UtcNow.AddMinutes(Math.Pow(2, c.Intentos));
                log.LogWarning("No se envió el correo {Id} a {Para} (intento {Intentos}): {Error}", c.Id, c.Para, c.Intentos, e.Message);
            }
        }
        await db.SaveChangesAsync(ct);
    }
}
