using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Common;

public interface IAppDbContext
{
    DbSet<T> Set<T>() where T : class;
    Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<T> Entry<T>(T entidad) where T : class;
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Microsoft.EntityFrameworkCore.Infrastructure.DatabaseFacade Database { get; }

    /// <summary>
    /// Siguiente folio de la Secuencia (Prefijo + número) y la avanza con un UPDATE que bloquea el renglón.
    /// Para que no se salte un número, llámalo dentro de la misma transacción que guarda el documento.
    /// </summary>
    Task<string> SiguienteFolioAsync(Guid empresaId, Guid? sucursalId, string tipo, CancellationToken ct = default);
}

/// <summary>Quién hace la petición (sale del JWT). Todo vacío = el sistema (seed, migraciones, login).</summary>
public interface IUsuarioActual
{
    Guid? Id { get; }
    Guid? SesionId { get; }
    Guid? OrganizacionId { get; }
    IReadOnlyList<Guid> EmpresaIds { get; }
    /// <summary>Empresas en las que el usuario solo entra a algunas plantas (en las demás, a todas).</summary>
    IReadOnlyList<Guid> EmpresasPorPlanta { get; }
    /// <summary>Las plantas a las que entra dentro de <see cref="EmpresasPorPlanta"/>.</summary>
    IReadOnlyList<Guid> SucursalIds { get; }
    /// <summary>Permiso "*": ve todas las empresas y puede todo.</summary>
    bool EsRoot { get; }
    bool Tiene(string permiso);
}

/// <summary>Regla de negocio rota: la API la devuelve como ProblemDetails con ese status y el mensaje en detail.</summary>
public class ReglaException(string mensaje, int status = 400) : Exception(mensaje)
{
    public int Status { get; } = status;

    /// <summary>Clave snake_case (por_cobrar) → enum (PorCobrar). Rechaza números y claves que no existen.</summary>
    public static T Opcion<T>(string valor) where T : struct, Enum =>
        !valor.Any(char.IsDigit) && Enum.TryParse<T>(valor.Replace("_", ""), true, out var e) && Enum.IsDefined(e)
            ? e
            : throw new ReglaException($"Valor inválido: {valor}.");
}
