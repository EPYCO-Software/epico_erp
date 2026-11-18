using System.Security.Cryptography;
using System.Text;
using EPICO.Application.Common;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Flota;

public record EmpresaRemision(string RazonSocial, string NombreComercial, string? Rfc);
public record PlantaRemision(string Nombre, string? Direccion, string? Telefono);
public record ObraRemision(string? Nombre, string? Direccion, string? Municipio);
public record HorasRemision(DateTime? CargandoEn, DateTime? SalidaEn, DateTime? LlegadaEn, DateTime? RegresandoEn, DateTime? TerminadaEn);

/// <summary>
/// Datos para imprimir la remisión. M3Acumulado = m³ de ollas del pedido hasta este viaje (incluido). Sello = huella SHA-256
/// (16 hex) de folio, pedido, unidad, m³ y horas: si alguien altera la remisión impresa, no coincide con la de la API.
/// </summary>
public record RemisionImprimible(Guid Id, string Folio, DateTime Fecha, EmpresaRemision Empresa, PlantaRemision Planta, string PedidoFolio,
    Guid ClienteId, string ClienteNombre, ObraRemision Obra, string? Producto, decimal M3, decimal M3Acumulado, decimal M3Pedido,
    string? NumeroEconomico, string? Placas, string? Operador, EstadoViaje Estado, HorasRemision Horas, string Sello, Guid? FirmaArchivoId,
    string? RecibeNombre);

public partial class FlotaServicio
{
    public async Task<RemisionImprimible> Imprimible(Guid viajeId, CancellationToken ct)
    {
        var r = await db.Set<Remision>().AsNoTracking().FirstOrDefaultAsync(x => x.Id == viajeId, ct) ?? throw new ReglaException("El viaje no existe.", 404);
        var p = await db.Set<Pedido>().AsNoTracking().Include(x => x.Lineas).FirstAsync(x => x.Id == r.PedidoId, ct);
        var empresa = await db.Set<Empresa>().IgnoreQueryFilters().FirstAsync(e => e.Id == p.EmpresaId, ct);
        var planta = await db.Set<Sucursal>().IgnoreQueryFilters().FirstAsync(s => s.Id == p.SucursalId, ct);
        var cliente = await db.Set<Cliente>().IgnoreQueryFilters().Where(c => c.Id == p.ClienteId).Select(c => c.Nombre).FirstAsync(ct);
        var obra = p.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == o, ct) : null;
        var equipo = r.EquipoId is Guid e ? await db.Set<Equipo>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == e, ct) : null;
        var lineaIds = p.Lineas.Select(l => l.ProductoId).ToList();
        var concretos = await db.Set<Producto>().IgnoreQueryFilters()
            .Where(x => lineaIds.Contains(x.Id) && x.Tipo == TipoProducto.Concreto && !x.Codigo.StartsWith("AJ-")).ToDictionaryAsync(x => x.Id, x => x.Nombre, ct);
        var ollas = await (from v in db.Set<Remision>().AsNoTracking()
                           join q in db.Set<Equipo>().IgnoreQueryFilters() on v.EquipoId equals q.Id
                           where v.PedidoId == p.Id && q.Tipo == TipoEquipo.Revolvedor
                           select new { v.Id, v.CreatedAt, v.VolumenM3 }).ToListAsync(ct);
        var acumulado = ollas.Where(v => v.CreatedAt < r.CreatedAt || v.Id == r.Id).Sum(v => v.VolumenM3);
        var horas = new HorasRemision(r.CargandoEn, r.SalidaEn, r.LlegadaEn, r.RegresandoEn, r.TerminadaEn);
        var sello = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{r.Id}|{r.Folio}|{p.Folio}|{equipo?.NumeroEconomico}|{r.VolumenM3:0.###}|{r.SalidaEn:O}|{r.LlegadaEn:O}|{r.TerminadaEn:O}")))[..16];
        return new(r.Id, r.Folio, r.CargandoEn ?? r.SalidaEn ?? r.CreatedAt, new(empresa.RazonSocial, empresa.NombreComercial, empresa.RFC),
            new(planta.Nombre, planta.Direccion, planta.Telefono), p.Folio, p.ClienteId, cliente,
            new(obra?.Nombre, obra?.Direccion ?? p.EntregaDireccion, obra?.Municipio ?? p.EntregaMunicipio),
            p.Lineas.Where(l => concretos.ContainsKey(l.ProductoId)).Select(l => concretos[l.ProductoId]).FirstOrDefault(), r.VolumenM3,
            equipo?.Tipo == TipoEquipo.Revolvedor ? acumulado : ollas.Sum(v => v.VolumenM3), p.Lineas.Where(l => concretos.ContainsKey(l.ProductoId)).Sum(l => l.Cantidad),
            equipo?.NumeroEconomico, equipo?.Placas, r.OperadorNombre, r.Estado, horas, sello, r.FirmaArchivoId, r.RecibeNombre);
    }

    /// <summary>Firma de quien recibe en obra: el archivo (de /archivos) y su nombre.</summary>
    public async Task<RemisionImprimible> Firmar(Guid viajeId, Guid archivoId, string recibeNombre, CancellationToken ct)
    {
        var r = await db.Set<Remision>().FirstOrDefaultAsync(x => x.Id == viajeId, ct) ?? throw new ReglaException("El viaje no existe.", 404);
        if (!await db.Set<Archivo>().AnyAsync(a => a.Id == archivoId, ct)) throw new ReglaException("El archivo de la firma no existe.");
        if (string.IsNullOrWhiteSpace(recibeNombre)) throw new ReglaException("Indica quién recibe.");
        (r.FirmaArchivoId, r.RecibeNombre) = (archivoId, recibeNombre.Trim());
        await db.SaveChangesAsync(ct);
        return await Imprimible(viajeId, ct);
    }
}
