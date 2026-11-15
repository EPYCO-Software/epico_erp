using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using EPICO.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace EPICO.Api.Auth;

/// <summary>Completa el OpenAPI (/openapi/v1.json): datos generales, token Bearer y el permiso de cada endpoint.</summary>
public static class Documentacion
{
    public static void Configurar(OpenApiOptions o)
    {
        o.AddDocumentTransformer((doc, _, _) =>
        {
            doc.Info = new OpenApiInfo
            {
                Title = "EPICO API",
                Version = "v1",
                Description = """
                    API del ERP de EPICO. Esquema: `docs/esquema.dbml`.

                    - Entra con `POST /api/v1/auth/login` y manda `Authorization: Bearer <token>`. El token dura 15 min;
                      renuévalo con `POST /api/v1/auth/refresh` (el refresh token cambia cada vez).
                    - Cada endpoint pide un permiso de `RolPermiso` (se indica en su descripción); `*` los cumple todos.
                    - Solo se ven los registros de las empresas y la organización del usuario.
                    - Errores en ProblemDetails: 400 validación, 401 sin token, 403 sin permiso o empresa ajena, 404,
                      409 duplicado o regla de negocio, 429 usuario bloqueado.
                    - Enums en snake_case como en el dbml (`por_cobrar`, `fecha_hora`…).
                    """,
            };
            doc.Components ??= new OpenApiComponents();
            doc.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
            doc.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "El `token` que devuelve /api/v1/auth/login",
            };
            return Task.CompletedTask;
        });

        o.AddOperationTransformer((op, ctx, _) =>
        {
            if (ctx.Description.ActionDescriptor is not ControllerActionDescriptor a) return Task.CompletedTask;
            // El generador de comentarios XML deja las entidades escapadas (&amp;).
            op.Summary = WebUtility.HtmlDecode(op.Summary) ?? a.ActionName; // sin <summary> (o con T genérico) = nombre del método
            op.Description = WebUtility.HtmlDecode(op.Description);
            if (a.ControllerTypeInfo.GetCustomAttribute<AllowAnonymousAttribute>() is not null ||
                a.MethodInfo.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
                return Task.CompletedTask;

            op.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", ctx.Document)] = [] }];
            op.Responses ??= new OpenApiResponses();
            op.Responses.TryAdd("401", new OpenApiResponse { Description = "Sin token o token vencido" });

            var permisos = a.MethodInfo.GetCustomAttributes<PermisoAttribute>().Select(p => p.Permiso).ToList();
            if (Recurso(a.ControllerTypeInfo) is { } recurso)
                permisos.Add(PermisoAttribute.DeCrud(recurso, ctx.Description.HttpMethod ?? "GET"));
            if (permisos.Count == 0) return Task.CompletedTask;

            var texto = string.Join(", ", permisos.Select(p => $"`{p}`"));
            op.Description = $"**Permiso:** {texto}" + (op.Description is { Length: > 0 } d ? $"\n\n{d}" : "");
            op.Responses.TryAdd("403", new OpenApiResponse { Description = $"Falta {texto} o el registro es de otra empresa" });
            return Task.CompletedTask;
        });
    }

    /// <summary>El Recurso de un CrudController (es una constante en cada controlador; se lee sin construirlo).</summary>
    static string? Recurso(Type t)
    {
        for (var b = t; b is not null; b = b.BaseType)
            if (b.IsGenericType && b.GetGenericTypeDefinition() == typeof(CrudController<>))
                return (string?)t.GetProperty("Recurso", BindingFlags.Instance | BindingFlags.NonPublic)!
                    .GetValue(RuntimeHelpers.GetUninitializedObject(t));
        return null;
    }
}
