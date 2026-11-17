using System.ComponentModel.DataAnnotations;

namespace EPICO.Contracts.Auth;

/// <summary>EmpresaId vacío = la empresa predeterminada del usuario.</summary>
/// <summary>App = erp (por omisión) o portal: cada una solo deja entrar a sus usuarios.</summary>
public record LoginRequest([Required, EmailAddress] string Correo, [Required] string Password, Guid? EmpresaId,
    [RegularExpression("^(erp|portal)$")] string? App = null);

public record RefreshRequest([Required] string RefreshToken);

public record PasswordRequest([Required, MinLength(8)] string Password);

public record OlvidePasswordRequest([Required, EmailAddress, MaxLength(254)] string Correo);

/// <summary>Token = el del enlace que llegó por correo.</summary>
public record RestablecerPasswordRequest([Required, MaxLength(100)] string Token, [Required, MinLength(8)] string Password);

/// <summary>Compatible con Sesion del front ({ usuario: { nombre, correo }, empresaId, token }) más lo que necesita para refrescar.</summary>
public record SesionResponse(
    UsuarioSesion Usuario,
    Guid? EmpresaId,
    Guid? OrganizacionId,
    string Token,
    DateTime TokenExpira,
    string RefreshToken,
    IReadOnlyList<EmpresaSesion> Empresas,
    IReadOnlyList<string> Permisos,
    ClienteSesion? Cliente = null);

/// <summary>Solo en usuarios del portal: el cliente que representan.</summary>
public record ClienteSesion(Guid Id, string Nombre);

public record UsuarioSesion(Guid Id, string Nombre, string Correo);

/// <summary>Razón social con las plantas que el usuario puede ver.</summary>
public record EmpresaSesion(Guid Id, string Nombre, IReadOnlyList<PlantaSesion> Plantas);

/// <summary>KmIncluidos y PrecioKm: valores de traslado de la planta.</summary>
public record PlantaSesion(Guid Id, string Codigo, string Nombre, string ZonaHoraria, decimal? Lat, decimal? Lng,
    decimal KmIncluidos, decimal PrecioKm);

public record SesionDto(Guid Id, Guid UsuarioId, Guid? EmpresaId, DateTime CreadaEn, DateTime ExpiraEn, DateTime? RevocadaEn, string? Ip, string? Agente);

public record NotaRequest([Required] string Texto);

/// <summary>Datos que el propio usuario puede cambiar.</summary>
public record PerfilRequest(
    [Required, MaxLength(120)] string Nombre,
    [MaxLength(120)] string? Apellidos,
    [MaxLength(20)] string? Telefono,
    [MaxLength(120)] string? Puesto,
    Guid? FotoArchivoId);

public record CambioPasswordRequest([Required] string Actual, [Required, MinLength(8)] string Nueva);

/// <summary>Para elegir vendedor, autor o responsable: cualquier usuario autenticado lo puede leer.</summary>
public record UsuarioResumen(Guid Id, string Nombre, bool Activo);

public record FolioResponse(string Folio);

/// <summary>Una sesión (dispositivo) del propio usuario; Actual = la de este token.</summary>
public record MiSesion(Guid Id, DateTime CreadaEn, DateTime ExpiraEn, string? Ip, string? Agente, bool Actual);

/// <summary>Un permiso del catálogo: ventas.cotizaciones.enviar → módulo ventas, recurso cotizaciones, acción enviar.</summary>
public record PermisoInfo(string Clave, string Modulo, string ModuloNombre, string Recurso, string RecursoNombre, string Accion, string AccionNombre);

/// <summary>Todos los permisos del rol (reemplaza los que tenía). Acepta comodines: ventas.*, ventas.clientes.*.</summary>
public record PermisosRolRequest([Required] List<string> Permisos);

/// <summary>Rol con sus permisos y cuántos accesos lo usan. Sistema = rol global (solo root lo cambia).</summary>
public record RolResumen(Guid Id, string Nombre, string? Descripcion, Guid? OrganizacionId, bool Sistema, List<string> Permisos, int Usuarios);

/// <summary>SucursalId vacío = todas las plantas de la empresa.</summary>
public record AccesoRequest(Guid EmpresaId, Guid? SucursalId, bool Predeterminado);

/// <summary>Usuario interno con sus accesos. Sin Password no puede entrar hasta que se le asigne.</summary>
public record AltaUsuarioRequest(
    [Required, EmailAddress, MaxLength(254)] string Correo,
    [Required, MaxLength(120)] string Nombre,
    [MaxLength(120)] string? Apellidos,
    [MaxLength(20)] string? Telefono,
    [MaxLength(120)] string? Puesto,
    [MinLength(8)] string? Password,
    Guid? RolId,
    [Required] List<AccesoRequest> Accesos,
    List<string>? Agregados = null,
    List<string>? Quitados = null);

/// <summary>Ajustes del usuario sobre su rol. Reemplaza las dos listas.</summary>
public record PermisosUsuarioRequest([Required] List<string> Agregados, [Required] List<string> Quitados);

/// <summary>DelRol = permisos de su rol; Efectivos = (DelRol ∪ Agregados) menos lo que cubran los Quitados.</summary>
public record PermisosUsuario(List<string> Agregados, List<string> Quitados, List<string> DelRol, List<string> Efectivos);

public record AccesosRequest([Required] List<AccesoRequest> Accesos);
