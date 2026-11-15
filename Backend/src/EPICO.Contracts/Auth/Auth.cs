using System.ComponentModel.DataAnnotations;

namespace EPICO.Contracts.Auth;

/// <summary>EmpresaId vacío = la empresa predeterminada del usuario.</summary>
public record LoginRequest([Required, EmailAddress] string Correo, [Required] string Password, Guid? EmpresaId);

public record RefreshRequest([Required] string RefreshToken);

public record PasswordRequest([Required, MinLength(8)] string Password);

/// <summary>Compatible con Sesion del front ({ usuario: { nombre, correo }, empresaId, token }) más lo que necesita para refrescar.</summary>
public record SesionResponse(
    UsuarioSesion Usuario,
    Guid? EmpresaId,
    string Token,
    DateTime TokenExpira,
    string RefreshToken,
    IReadOnlyList<EmpresaSesion> Empresas,
    IReadOnlyList<string> Permisos);

public record UsuarioSesion(Guid Id, string Nombre, string Correo);

/// <summary>Razón social con las plantas que el usuario puede ver.</summary>
public record EmpresaSesion(Guid Id, string Nombre, IReadOnlyList<PlantaSesion> Plantas);

public record PlantaSesion(Guid Id, string Codigo, string Nombre, string ZonaHoraria, decimal? Lat, decimal? Lng);

public record SesionDto(Guid Id, Guid UsuarioId, Guid? EmpresaId, DateTime CreadaEn, DateTime ExpiraEn, DateTime? RevocadaEn, string? Ip, string? Agente);

public record NotaRequest([Required] string Texto);
