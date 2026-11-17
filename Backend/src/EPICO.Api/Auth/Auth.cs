using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EPICO.Application.Common;
using EPICO.Domain.Acceso;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace EPICO.Api.Auth;

/// <summary>Usuario de la petición, leído de los claims del JWT (sub, sid, org, emp[], empp[], suc[], perm[]).</summary>
public class UsuarioActual(IHttpContextAccessor http) : IUsuarioActual
{
    ClaimsPrincipal? U => http.HttpContext?.User;
    Guid? Leer(string claim) => Guid.TryParse(U?.FindFirstValue(claim), out var g) ? g : null;

    public Guid? Id => Leer(Tokens.Usuario);
    public Guid? SesionId => Leer(Tokens.Sesion);
    public Guid? OrganizacionId => Leer(Tokens.Organizacion);
    public IReadOnlyList<Guid> EmpresaIds => Guids(Tokens.Empresa);
    public IReadOnlyList<Guid> EmpresasPorPlanta => Guids(Tokens.EmpresaPorPlanta);
    public IReadOnlyList<Guid> SucursalIds => Guids(Tokens.Sucursal);
    List<Guid> Guids(string claim) => U?.FindAll(claim).Select(c => Guid.Parse(c.Value)).ToList() ?? [];
    public bool EsRoot => U?.HasClaim(Tokens.Permiso, "*") == true;
    public bool Tiene(string permiso) => U?.FindAll(Tokens.Permiso).Any(c => Permisos.Cubre(c.Value, permiso)) == true;
}

public class Tokens(IConfiguration cfg)
{
    public const string Usuario = "sub", Sesion = "sid", Organizacion = "org", Empresa = "emp", Permiso = "perm", Cliente = "cli",
        EmpresaPorPlanta = "empp", Sucursal = "suc";
    public const string Emisor = "epico";
    public static readonly TimeSpan DuracionAcceso = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan DuracionSesion = TimeSpan.FromDays(14);

    public static SymmetricSecurityKey Llave(IConfiguration cfg) =>
        cfg["Jwt:Key"] is { Length: >= 32 } k
            ? new(Encoding.UTF8.GetBytes(k))
            : throw new InvalidOperationException("Falta Jwt:Key (variable Jwt__Key) de al menos 32 caracteres.");

    public (string Token, DateTime Expira) Acceso(
        Usuario u, Guid sesionId, Guid? organizacionId, IEnumerable<Guid> empresas, IEnumerable<string> permisos, Guid? clienteId = null,
        ILookup<Guid, Guid>? plantasPorEmpresa = null)
    {
        var expira = DateTime.UtcNow.Add(DuracionAcceso);
        var claims = new List<Claim>
        {
            new(Usuario, u.Id.ToString()),
            new(Sesion, sesionId.ToString()),
            new("email", u.Correo),
            new("name", u.Nombre),
        };
        if (organizacionId is Guid org) claims.Add(new(Organizacion, org.ToString()));
        if (clienteId is Guid cli) claims.Add(new(Cliente, cli.ToString())); // usuario del portal
        claims.AddRange(empresas.Select(e => new Claim(Empresa, e.ToString())));
        claims.AddRange(permisos.Select(p => new Claim(Permiso, p)));
        // Solo las empresas donde se limitó a ciertas plantas: en las demás entra a todas (también a las que se creen después).
        foreach (var g in plantasPorEmpresa ?? Enumerable.Empty<Guid>().ToLookup(x => x))
        {
            claims.Add(new(EmpresaPorPlanta, g.Key.ToString()));
            claims.AddRange(g.Select(s => new Claim(Sucursal, s.ToString())));
        }

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = Emisor,
            Audience = Emisor,
            Expires = expira,
            SigningCredentials = new SigningCredentials(Llave(cfg), SecurityAlgorithms.HmacSha256),
        });
        return (token, expira);
    }

    public static string NuevoRefresh() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    /// <summary>En la base solo se guarda el hash del refresh token.</summary>
    public static string Hash(string refresh) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refresh)));
}

/// <summary>Exige un permiso de RolPermiso (p. ej. ventas.cotizaciones.editar). "*" los cumple todos.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class PermisoAttribute(string permiso) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext c)
    {
        if (!c.HttpContext.RequestServices.GetRequiredService<IUsuarioActual>().Tiene(permiso))
            c.Result = SinPermiso(permiso);
    }

    public string Permiso => permiso;

    /// <summary>Permiso de un CRUD según el verbo: {recurso}.ver / .crear / .editar / .eliminar.</summary>
    public static string DeCrud(string recurso, string metodo) =>
        $"{recurso}.{metodo.ToUpperInvariant() switch { "GET" => "ver", "POST" => "crear", "PUT" => "editar", _ => "eliminar" }}";

    public static ObjectResult SinPermiso(string permiso) =>
        new(new ProblemDetails { Status = 403, Title = "Sin permiso", Detail = $"Falta el permiso {permiso}." }) { StatusCode = 403 };
}
