using System.Linq.Expressions;
using System.Reflection;
using EPICO.Application.Common;

namespace EPICO.Api.Controllers;

/// <summary>
/// Filtros por igualdad desde la query string sobre propiedades Guid, texto, booleanas o enums (en snake_case):
/// ?clienteId=…&amp;estado=por_cobrar. Una clave repetida es "cualquiera de" (?sucursalId=a&amp;sucursalId=b).
/// skip, take y las claves propias del endpoint se ignoran; una clave desconocida es 400.
/// </summary>
public static class FiltroQuery
{
    static readonly HashSet<string> Reservadas = new(StringComparer.OrdinalIgnoreCase) { "skip", "take" };

    public static IQueryable<T> Aplicar<T>(IQueryable<T> q, IQueryCollection query, params string[] propias)
    {
        foreach (var (clave, valores) in query)
        {
            if (Reservadas.Contains(clave) || propias.Contains(clave, StringComparer.OrdinalIgnoreCase)) continue;
            var p = typeof(T).GetProperty(clave, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance)
                    ?? throw new ReglaException($"Filtro inválido: {clave}.");
            var tipo = Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType;
            var x = Expression.Parameter(typeof(T), "x");
            Expression? cuerpo = null;
            foreach (var texto in valores.Select(v => v ?? ""))
            {
                object valor = tipo == typeof(Guid) && Guid.TryParse(texto, out var g) ? g
                    : tipo == typeof(string) ? texto
                    : tipo == typeof(bool) && bool.TryParse(texto, out var b) ? b
                    : tipo is { IsEnum: true } && !texto.Any(char.IsDigit) && Enum.TryParse(tipo, texto.Replace("_", ""), true, out var e) ? e!
                    : throw new ReglaException($"Filtro inválido: {clave}={texto}.");
                // El valor va en una caja para que EF lo mande como parámetro y no como constante en el SQL.
                var parametro = Expression.Convert(Expression.Property(Expression.Constant(new Caja(valor)), nameof(Caja.Valor)), p.PropertyType);
                var igual = Expression.Equal(Expression.Property(x, p), parametro);
                cuerpo = cuerpo is null ? igual : Expression.OrElse(cuerpo, igual);
            }
            if (cuerpo is not null) q = q.Where(Expression.Lambda<Func<T, bool>>(cuerpo, x));
        }
        return q;
    }

    sealed record Caja(object Valor);
}
