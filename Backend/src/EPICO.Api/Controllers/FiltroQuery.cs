using System.Linq.Expressions;
using System.Reflection;
using EPICO.Application.Common;

namespace EPICO.Api.Controllers;

/// <summary>
/// Filtros por igualdad desde la query string sobre propiedades Guid, texto, booleanas o enums (en snake_case):
/// ?clienteId=…&amp;estado=por_cobrar. skip y take se ignoran; una clave desconocida es 400.
/// </summary>
public static class FiltroQuery
{
    static readonly HashSet<string> Reservadas = new(StringComparer.OrdinalIgnoreCase) { "skip", "take" };

    public static IQueryable<T> Aplicar<T>(IQueryable<T> q, IQueryCollection query)
    {
        foreach (var (clave, valores) in query)
        {
            if (Reservadas.Contains(clave)) continue;
            var p = typeof(T).GetProperty(clave, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);
            var tipo = p is null ? null : Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;
            var texto = valores.ToString();
            object valor = tipo == typeof(Guid) && Guid.TryParse(texto, out var g) ? g
                : tipo == typeof(string) ? texto
                : tipo == typeof(bool) && bool.TryParse(texto, out var b) ? b
                : tipo is { IsEnum: true } && !texto.Any(char.IsDigit) && Enum.TryParse(tipo, texto.Replace("_", ""), true, out var e) ? e!
                : throw new ReglaException($"Filtro inválido: {clave}={texto}.");

            // El valor va en una caja para que EF lo mande como parámetro y no como constante en el SQL.
            var x = Expression.Parameter(typeof(T), "x");
            var parametro = Expression.Convert(Expression.Property(Expression.Constant(new Caja(valor)), nameof(Caja.Valor)), p!.PropertyType);
            q = q.Where(Expression.Lambda<Func<T, bool>>(Expression.Equal(Expression.Property(x, p), parametro), x));
        }
        return q;
    }

    sealed record Caja(object Valor);
}
