using System.Security.Cryptography;
using EPICO.Api.Auth;
using EPICO.Application.Common;
using EPICO.Domain.Historial;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Api.Controllers;

/// <summary>
/// Archivos en disco, en la carpeta Archivos:Ruta (en Docker, móntala como volumen para no perderlos).
/// shortcut: disco local; si se necesitan varios servidores, cambiar a almacenamiento S3 compatible.
/// </summary>
[ApiController]
[Route("api/v1/archivos")]
public class ArchivosController(IAppDbContext db, IUsuarioActual yo, IConfiguration cfg, IWebHostEnvironment env) : ControllerBase
{
    string Carpeta => Path.GetFullPath(cfg["Archivos:Ruta"] ?? "archivos", env.ContentRootPath);

    IQueryable<Archivo> Visibles() => db.Set<Archivo>().Where(a => yo.EsRoot || a.OrganizacionId == yo.OrganizacionId);

    /// <summary>Subir archivo</summary>
    /// <remarks>multipart/form-data, hasta 25 MB.</remarks>
    [HttpPost, Permiso("general.archivos.crear")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<Archivo>> Subir(IFormFile archivo, [FromForm] string? categoria, [FromForm] string? registroTipo,
        [FromForm] Guid? registroId, CancellationToken ct)
    {
        var ruta = $"{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}";
        var destino = Path.Combine(Carpeta, ruta);
        Directory.CreateDirectory(Path.GetDirectoryName(destino)!);
        await using (var f = System.IO.File.Create(destino))
            await archivo.CopyToAsync(f, ct);
        await using var leer = System.IO.File.OpenRead(destino);

        var a = new Archivo
        {
            OrganizacionId = yo.OrganizacionId,
            Nombre = Path.GetFileName(archivo.FileName),
            TipoMime = string.IsNullOrEmpty(archivo.ContentType) ? "application/octet-stream" : archivo.ContentType,
            TamanoBytes = archivo.Length,
            Ruta = ruta,
            Sha256 = Convert.ToHexStringLower(await SHA256.HashDataAsync(leer, ct)),
            Categoria = categoria,
            RegistroTipo = registroTipo,
            RegistroId = registroId,
            SubidoPorId = yo.Id,
        };
        db.Set<Archivo>().Add(a);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Descargar), new { id = a.Id }, a);
    }

    /// <summary>Descargar archivo</summary>
    [HttpGet("{id:guid}"), Permiso("general.archivos.ver")]
    public async Task<IActionResult> Descargar(Guid id, CancellationToken ct) =>
        await Visibles().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct) is { } a
            ? PhysicalFile(Path.Combine(Carpeta, a.Ruta), a.TipoMime, a.Nombre)
            : NotFound();

    /// <summary>Archivos de un registro</summary>
    /// <remarks>tipo = nombre de la tabla (Cotizacion, Cliente…).</remarks>
    [HttpGet("registro/{tipo}/{id:guid}"), Permiso("general.archivos.ver")]
    public Task<List<Archivo>> DeRegistro(string tipo, Guid id, CancellationToken ct) =>
        Visibles().AsNoTracking().Where(a => a.RegistroTipo == tipo && a.RegistroId == id).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);

    /// <summary>Eliminar archivo</summary>
    /// <remarks>Borrado lógico: el archivo se queda en disco.</remarks>
    [HttpDelete("{id:guid}"), Permiso("general.archivos.eliminar")]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var a = await Visibles().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (a is null) return NotFound();
        db.Set<Archivo>().Remove(a);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
