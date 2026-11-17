using System.Net;
using EPICO.Application.Common;
using EPICO.Domain.Correo;
using EPICO.Infrastructure.Correo;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace EPICO.Api.Controllers;

/// <summary>
/// Servidores de correo saliente de la organización (como en Odoo). La contraseña solo entra: se guarda cifrada
/// (Cifrado__Llave) y la API responde tienePassword en su lugar.
/// </summary>
[Route("api/v1/servidores-correo")]
public class ServidoresCorreoController(IAppDbContext db, IUsuarioActual yo, Cifrado cifrado, IConfiguration cfg)
    : CrudController<ServidorCorreo>(db, yo)
{
    protected override string Recurso => "config.servidores_correo";

    // Sin password (null) se conserva la guardada; "" la borra.
    protected override void Completar(ServidorCorreo x, ServidorCorreo? actual)
    {
        base.Completar(x, actual);
        if (x.Password is null) return;
        var cifrada = x.Password == "" ? null : cifrado.Cifrar(x.Password);
        if (actual is null) x.PasswordCifrada = cifrada;
        else actual.PasswordCifrada = cifrada;
        x.Password = null;
    }

    protected override Task AntesDeGuardar(ServidorCorreo x, bool nuevo, CancellationToken ct)
    {
        var remitente = x.Remitente is { Length: > 0 } r ? r : x.Usuario;
        if (string.IsNullOrWhiteSpace(remitente)) throw new ReglaException("Indica el remitente o el usuario SMTP.");
        if (!(MailboxAddress.TryParse(remitente, out var m) && m.Address.Contains('@')))
            throw new ReglaException("El remitente no es un correo válido (ej. EPICO <ventas@empresa.mx>).");
        return Task.CompletedTask;
    }

    /// <summary>Probar conexión</summary>
    /// <remarks>Se conecta y se autentica con los datos guardados, sin enviar nada. 204 si funcionó; 400 con el
    /// mensaje del servidor si no. Como todo POST de este recurso, pide config.servidores_correo.crear.</remarks>
    [HttpPost("{id:guid}/probar")]
    public async Task<IActionResult> Probar(Guid id, CancellationToken ct)
    {
        var s = await Consulta().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (s is null) return NotFound();
        if (!await PermitidoAsync(s, ct)) return SinAcceso();
        return await ProbarAsync(CuentaSmtp.De(s, cifrado), ct);
    }

    /// <summary>Probar el servidor global</summary>
    /// <remarks>Solo root. El de la configuración (Correo__*), que se usa para los correos del sistema y para las
    /// organizaciones sin servidor propio. 404 si no está configurado.</remarks>
    [HttpPost("global/probar")]
    public async Task<IActionResult> ProbarGlobal(CancellationToken ct)
    {
        if (!Yo.EsRoot) return Problem("Solo root.", statusCode: 403);
        return CuentaSmtp.Global(cfg) is { } cuenta ? await ProbarAsync(cuenta, ct)
            : Problem("No hay servidor global: configura Correo__Host.", statusCode: 404);
    }

    async Task<IActionResult> ProbarAsync(CuentaSmtp cuenta, CancellationToken ct)
    {
        try { await Smtp.ProbarAsync(cuenta, ct); }
        catch (Exception e) when (e is not (OperationCanceledException or ReglaException))
        {
            return Problem($"No se pudo conectar: {e.Message}", statusCode: 400);
        }
        return NoContent();
    }
}

/// <summary>Correos con el formato de la app. Los textos se escapan.</summary>
public static class Plantilla
{
    public static CorreoSaliente Crear(string para, string asunto, string texto, (string Texto, string Url)? boton = null,
        string? pie = null, Guid? organizacionId = null)
    {
        static string E(string s) => WebUtility.HtmlEncode(s);
        var html = $"<div style=\"font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937\">" +
                   $"<h2 style=\"color:#111827\">{E(asunto)}</h2><p>{E(texto)}</p>";
        if (boton is var (t, url))
            html += $"<p><a href=\"{E(url)}\" style=\"background:#f97316;color:#fff;padding:10px 18px;border-radius:6px;" +
                    $"text-decoration:none;display:inline-block\">{E(t)}</a></p>" +
                    $"<p style=\"font-size:12px;color:#6b7280\">Si el botón no funciona, copia este enlace:<br>{E(url)}</p>";
        if (pie is not null) html += $"<p style=\"font-size:12px;color:#6b7280\">{E(pie)}</p>";
        var ahora = DateTime.UtcNow;
        return new CorreoSaliente
        {
            OrganizacionId = organizacionId, Para = para, Asunto = asunto, Html = html + "</div>",
            CreadoEn = ahora, ProximoIntento = ahora,
        };
    }
}
