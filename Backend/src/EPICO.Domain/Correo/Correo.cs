using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using EPICO.Domain.Common;

namespace EPICO.Domain.Correo;

/// <summary>
/// Servidor de correo saliente (SMTP) de una organización, como ir.mail_server de Odoo. Se usa el activo de menor
/// Prioridad; si la organización no tiene ninguno, el global de la configuración (Correo__*).
/// </summary>
public class ServidorCorreo : BaseEntity, IDeOrganizacion
{
    public Guid OrganizacionId { get; set; }
    [MaxLength(120), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(255), Rastreado("Servidor")] public string Host { get; set; } = "";
    [Range(1, 65535), Rastreado("Puerto")] public int Puerto { get; set; } = 587;
    [Rastreado("Seguridad", TipoDatoCambio.Opcion)] public SeguridadSmtp Seguridad { get; set; } = SeguridadSmtp.StartTls;
    [MaxLength(254), Rastreado("Usuario")] public string? Usuario { get; set; }
    /// <summary>Correo del remitente ("EPICO &lt;ventas@empresa.mx&gt;"); vacío = el usuario SMTP.</summary>
    [MaxLength(300), Rastreado("Remitente")] public string? Remitente { get; set; }
    /// <summary>Menor = se usa primero.</summary>
    [Rastreado("Prioridad")] public int Prioridad { get; set; } = 10;
    [Rastreado("Activo")] public bool Activo { get; set; } = true;

    /// <summary>Cifrada; nunca sale por la API.</summary>
    [JsonIgnore] public string? PasswordCifrada { get; set; }

    /// <summary>Solo de entrada: ausente o null = no se cambia; "" = se borra.</summary>
    [NotMapped, MaxLength(500), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Password { get; set; }

    [NotMapped] public bool TienePassword => PasswordCifrada is not null;
}

/// <summary>Bandeja de salida: la API solo encola y un proceso en segundo plano envía, con reintentos.</summary>
public class CorreoSaliente : IEntidad
{
    public Guid Id { get; set; }
    /// <summary>Vacío = correo del sistema (reset de contraseña…): sale por el servidor global.</summary>
    public Guid? OrganizacionId { get; set; }
    /// <summary>Forzar un servidor; vacío = el de la organización o el global.</summary>
    public Guid? ServidorId { get; set; }
    [MaxLength(254)] public string Para { get; set; } = "";
    [MaxLength(300)] public string Asunto { get; set; } = "";
    public string Html { get; set; } = "";
    public EstadoCorreo Estado { get; set; }
    public int Intentos { get; set; }
    public string? Error { get; set; }
    public DateTime CreadoEn { get; set; }
    public DateTime ProximoIntento { get; set; }
    public DateTime? EnviadoEn { get; set; }
}
