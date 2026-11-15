using System.Text.Json;
using System.Text.Json.Serialization;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Infrastructure;
using EPICO.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
var migrar = args.Contains("--migrate", StringComparer.OrdinalIgnoreCase);

builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

var enumsSnake = new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower);
builder.Services.AddControllers(o => o.Filters.Add(new ProducesAttribute("application/json")))
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(enumsSnake));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(enumsSnake)); // el OpenAPI lee estas
builder.Services.AddOpenApi(o => Documentacion.Configurar(o)); // lambda: el generador de comentarios XML no intercepta un method group
builder.Services.AddHealthChecks();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUsuarioActual, UsuarioActual>();
builder.Services.AddSingleton<Tokens>();
builder.Services.AddScoped<EPICO.Application.Ventas.VentasServicio>();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false; // conserva sub, emp, perm tal cual
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = Tokens.Emisor,
        ValidAudience = Tokens.Emisor,
        IssuerSigningKey = Tokens.Llave(builder.Configuration),
        ClockSkew = TimeSpan.FromSeconds(30),
    };
});
builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:4200"];

builder.Services.AddCors(o => o.AddPolicy("front", p =>
    p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// El compose de producción corre --migrate como contenedor de un solo uso antes de levantar la API:
// aplica las migraciones y el seed (se puede repetir) y termina.
if (migrar)
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await Seed.EjecutarAsync(db, app.Configuration, app.Logger);
    return;
}

Tokens.Llave(app.Configuration); // sin Jwt:Key la API no arranca (mejor que fallar en el primer login)

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();   // UI de documentación en /scalar
}

// Reglas de negocio (ReglaException) y errores de la base que son culpa del cliente: duplicado → 409,
// referencia inexistente → 400.
app.UseExceptionHandler(e => e.Run(async ctx =>
{
    var error = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var pg = (error as DbUpdateException)?.InnerException as PostgresException;
    var (status, detalle) = error is ReglaException r ? (r.Status, r.Message) : pg?.SqlState switch
    {
        PostgresErrorCodes.UniqueViolation => (409, "Ya existe un registro con esos datos."),
        PostgresErrorCodes.ForeignKeyViolation => (400, "Hace referencia a un registro que no existe."),
        _ => (500, "Error inesperado."),
    };
    await Results.Problem(detalle, statusCode: status).ExecuteAsync(ctx);
}));

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseCors("front");
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllers().RequireAuthorization(); // todo exige token salvo [AllowAnonymous] (login, refresh, logout)
app.Run();

public partial class Program; // para las pruebas de integración
