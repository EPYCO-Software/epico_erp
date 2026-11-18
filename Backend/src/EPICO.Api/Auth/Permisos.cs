using System.Reflection;
using System.Runtime.CompilerServices;
using EPICO.Api.Controllers;
using EPICO.Contracts.Auth;
using Microsoft.AspNetCore.Mvc;

namespace EPICO.Api.Auth;

/// <summary>
/// Catálogo de permisos, sacado de los controladores ([Permiso] y el Recurso de cada CRUD): no hay lista a mano que mantener.
/// Un rol puede tener permisos exactos (ventas.cotizaciones.enviar), un módulo entero con comodín (ventas.*, ventas.clientes.*)
/// o "*" (root: todo y sin filtro por empresa).
/// </summary>
public static class Permisos
{
    public static readonly IReadOnlyList<string> Todos = Leer();

    /// <summary>¿El permiso otorgado cubre al pedido? ventas.* cubre ventas.clientes.ver; "*" cubre todo.</summary>
    public static bool Cubre(string otorgado, string pedido) =>
        otorgado == "*" || otorgado == pedido || otorgado.EndsWith(".*") && pedido.StartsWith(otorgado[..^1], StringComparison.Ordinal);

    /// <summary>
    /// Permisos efectivos: lo que cubren el rol y los agregados, menos lo que cubra algún quitado. Sin quitados se dejan
    /// los comodines como vienen ("*", ventas.*); con quitados se expanden contra el catálogo a la lista explícita.
    /// </summary>
    public static List<string> Efectivos(IEnumerable<string> delRol, IEnumerable<string> agregados, IReadOnlyCollection<string> quitados)
    {
        var concedidos = delRol.Concat(agregados).Distinct().ToList();
        return quitados.Count == 0 ? concedidos
            : [.. Todos.Where(p => concedidos.Any(c => Cubre(c, p)) && !quitados.Any(q => Cubre(q, p)))];
    }

    /// <summary>Existe en el catálogo, o es un comodín que cubre al menos uno, o es "*".</summary>
    public static bool Valido(string permiso) => Todos.Any(p => Cubre(permiso, p));

    /// <summary>El catálogo con nombres para la pantalla de roles, ordenado por módulo, recurso y acción
    /// (ver/crear/editar/eliminar primero). Empieza con "*" (todos, solo root).</summary>
    public static IEnumerable<PermisoInfo> Catalogo() =>
        Todos.Select(p => p.Split('.') is var s ? (Clave: p, Modulo: s[0], Recurso: string.Join('.', s[1..^1]), Accion: s[^1]) : default)
            .OrderBy(p => p.Modulo).ThenBy(p => p.Recurso)
            .ThenBy(p => Array.IndexOf(Crud, p.Accion) is var i and >= 0 ? i : Crud.Length).ThenBy(p => p.Accion)
            .Select(p => new PermisoInfo(p.Clave, p.Modulo, Nombre(p.Modulo), p.Recurso, Nombre(p.Recurso), p.Accion, Nombre(p.Accion)))
            .Prepend(new PermisoInfo("*", "*", "Todos", "*", "Todos", "*", "Todos los permisos (solo root)"));

    static readonly string[] Crud = ["ver", "crear", "editar", "eliminar"];

    // shortcut: nombres a mano; una clave sin nombre sale con su texto capitalizado. Agrégalo aquí al crear un módulo o acción.
    static readonly Dictionary<string, string> Nombres = new()
    {
        ["config"] = "Configuración", ["general"] = "General", ["ventas"] = "Ventas", ["crm"] = "CRM",
        ["inventario"] = "Inventario", ["flota"] = "Flota", ["operacion"] = "Operación", ["calidad"] = "Calidad",
        ["muestras"] = "Muestras", ["ensayes"] = "Ensayes", ["inspecciones"] = "Inspecciones", ["trayectos"] = "Trayectos",
        ["operadores"] = "Operadores", ["combustible"] = "Combustible", ["mantenimiento"] = "Mantenimiento",
        ["accesos"] = "Accesos", ["organizaciones"] = "Organizaciones", ["secuencias"] = "Folios", ["sesiones"] = "Sesiones",
        ["sucursales"] = "Plantas", ["actividades"] = "Actividades", ["archivos"] = "Archivos", ["historial"] = "Historial",
        ["prospectos"] = "Prospectos", ["obras"] = "Obras", ["equipos"] = "Equipos", ["existencias"] = "Existencias", ["movimientos"] = "Movimientos",
        ["remisiones"] = "Remisiones", ["listas_precios"] = "Listas de precios", ["programas"] = "Programas y cupones",
        ["ver"] = "Ver", ["crear"] = "Crear", ["editar"] = "Editar", ["eliminar"] = "Eliminar", ["enviar"] = "Enviar",
        ["cancelar"] = "Cancelar", ["confirmar"] = "Confirmar", ["cobrar"] = "Cambiar cobro", ["estado"] = "Cambiar estado",
        ["planta"] = "Flujo con planta", ["servidores_correo"] = "Servidores de correo",
    };

    static string Nombre(string clave) => Nombres.TryGetValue(clave, out var n) ? n : char.ToUpper(clave[0]) + clave[1..].Replace('_', ' ');

    /// <summary>El Recurso de un CrudController (es una constante en cada controlador; se lee sin construirlo).</summary>
    public static string? Recurso(Type t)
    {
        for (var b = t; b is not null; b = b.BaseType)
            if (b.IsGenericType && b.GetGenericTypeDefinition() == typeof(CrudController<>))
                return (string?)t.GetProperty("Recurso", BindingFlags.Instance | BindingFlags.NonPublic)!
                    .GetValue(RuntimeHelpers.GetUninitializedObject(t));
        return null;
    }

    static List<string> Leer()
    {
        var controladores = typeof(Permisos).Assembly.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);
        var todos = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var t in controladores)
        {
            if (Recurso(t) is { } recurso)
                foreach (var verbo in new[] { "GET", "POST", "PUT", "DELETE" })
                    todos.Add(PermisoAttribute.DeCrud(recurso, verbo));
            foreach (var m in t.GetMethods())
                foreach (var p in m.GetCustomAttributes<PermisoAttribute>())
                    todos.Add(p.Permiso);
        }
        return [.. todos];
    }
}
