using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text.Json.Serialization;
using EPICO.Domain.Common;

namespace EPICO.Domain.Acceso;

// Organización y acceso (docs/esquema.dbml). Sin propiedades de navegación: solo los Id, para que la API
// pueda devolver y recibir las entidades sin ciclos; las FK se configuran en AppDbContext.

public class Organizacion : BaseEntity
{
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(60), RegularExpression("^[a-z0-9-]+$")] public string Slug { get; set; } = "";
    public Guid? LogoArchivoId { get; set; }
    [Rastreado("Activa")] public bool Activa { get; set; } = true;
}

public class Empresa : BaseEntity, IDeOrganizacion
{
    public Guid OrganizacionId { get; set; }
    [MaxLength(300), Rastreado("Razón social")] public string RazonSocial { get; set; } = "";
    [MaxLength(300), Rastreado("Nombre comercial")] public string NombreComercial { get; set; } = "";
    [MaxLength(13), RegularExpression(@"^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$"), Rastreado("RFC")] public string? RFC { get; set; }
    [MaxLength(3), Rastreado("Régimen fiscal")] public string? RegimenFiscal { get; set; }
    [MaxLength(5), RegularExpression(@"^\d{5}$"), Rastreado("CP fiscal")] public string? CPFiscal { get; set; }
    [Rastreado("Domicilio fiscal")] public string? DomicilioFiscal { get; set; }
    [MaxLength(60), Rastreado("Zona horaria")] public string ZonaHoraria { get; set; } = "America/Mexico_City";
    [MaxLength(3), Rastreado("Moneda")] public string MonedaCodigo { get; set; } = "MXN";
    public Guid? LogoArchivoId { get; set; }
    // El CSD se carga por un endpoint aparte (facturación); no entra ni sale por el CRUD.
    [JsonIgnore] public Guid? CsdCerArchivoId { get; set; }
    [JsonIgnore] public Guid? CsdKeyArchivoId { get; set; }
    [JsonIgnore] public string? CsdPasswordCifrada { get; set; }
    [JsonIgnore] public DateOnly? CsdVence { get; set; }
}

public class Sucursal : BaseEntity, IDeEmpresa
{
    public Guid EmpresaId { get; set; }
    [MaxLength(10), Rastreado("Código")] public string Codigo { get; set; } = "";
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(60), Rastreado("Zona horaria")] public string ZonaHoraria { get; set; } = "";
    [Rastreado("Dirección")] public string? Direccion { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    [MaxLength(20), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [Rastreado("Activa")] public bool Activa { get; set; } = true;
}

public class Usuario : BaseEntity
{
    [MaxLength(254), EmailAddress, Rastreado("Correo")]
    public string Correo { get => _correo; set => _correo = value.Trim().ToLowerInvariant(); }
    string _correo = "";
    [JsonIgnore] public string PasswordHash { get; set; } = "";
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoUsuario Tipo { get; set; }
    [MaxLength(120), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(120), Rastreado("Apellidos")] public string? Apellidos { get; set; }
    [MaxLength(20), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [MaxLength(120), Rastreado("Puesto")] public string? Puesto { get; set; }
    public Guid? FotoArchivoId { get; set; }
    [Rastreado("Activo")] public bool Activo { get; set; } = true;
    [Editable(false)] public bool CorreoVerificado { get; set; }
    [Editable(false)] public int IntentosFallidos { get; set; }
    [Editable(false)] public DateTime? BloqueadoHasta { get; set; }
    [Editable(false)] public DateTime? UltimoAcceso { get; set; }
}

public class Rol : BaseEntity
{
    /// <summary>Vacío = rol del sistema (Administrador, Ventas…).</summary>
    public Guid? OrganizacionId { get; set; }
    [MaxLength(100), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
}

public class RolPermiso : IEntidad
{
    public Guid Id { get; set; }
    public Guid RolId { get; set; }
    /// <summary>ventas.cotizaciones.editar… "*" = todos.</summary>
    [MaxLength(100)] public string Permiso { get; set; } = "";
}

public class UsuarioAcceso : IEntidad, IDeEmpresa
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid EmpresaId { get; set; }
    /// <summary>Vacío = todas las plantas de la empresa.</summary>
    public Guid? SucursalId { get; set; }
    public Guid RolId { get; set; }
    public bool Predeterminado { get; set; }
}

public class Sesion : IEntidad
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid? EmpresaId { get; set; }
    public string RefreshTokenHash { get; set; } = "";
    public DateTime CreadaEn { get; set; }
    public DateTime ExpiraEn { get; set; }
    public DateTime? RevocadaEn { get; set; }
    public IPAddress? Ip { get; set; }
    public string? Agente { get; set; }
}

public class Secuencia : IEntidad, IDeEmpresa
{
    public Guid Id { get; set; }
    public Guid EmpresaId { get; set; }
    public Guid? SucursalId { get; set; }
    /// <summary>cotizacion, pedido, remision, factura…</summary>
    [MaxLength(30)] public string Tipo { get; set; } = "";
    /// <summary>EPI-PRES-ESC-</summary>
    [MaxLength(30)] public string Prefijo { get; set; } = "";
    public long Siguiente { get; set; } = 1;
}

public class Moneda
{
    [MaxLength(3)] public string Codigo { get; set; } = "";
    [MaxLength(60)] public string Nombre { get; set; } = "";
    public short Decimales { get; set; } = 2;
}
