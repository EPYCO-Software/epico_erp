using EPICO.Application.Common;
using EPICO.Application.Ventas;
using EPICO.Domain.Acceso;
using EPICO.Domain.Common;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Application.Calidad;

public record PedidoCertificado(Guid Id, string Folio, DateTime FechaHoraEntrega);
public record ClienteCertificado(Guid Id, string Nombre);
public record ObraCertificado(string? Nombre, string? Direccion);
public record EnsayeCertificado(int EdadDias, DateOnly? FechaEnsaye, decimal? ResistenciaKgCm2, decimal? Porcentaje);
public record MuestraCertificado(string Folio, string? RemisionFolio, DateTime FechaMuestreo, decimal? RevenimientoCm, List<EnsayeCertificado> Ensayes);
public record Resumen28(decimal? Promedio, decimal? Minimo, int N);

/// <summary>Dictamen: cumple | no_cumple | pendiente (sin ensayes a la edad de diseño).</summary>
public record Certificado(PedidoCertificado Pedido, ClienteCertificado Cliente, ObraCertificado Obra, string? Producto, int Fc, int EdadDias,
    List<MuestraCertificado> Muestras, Resumen28 Resumen28, string Dictamen, DateTime EmitidoEn);

public class CalidadServicio(IAppDbContext db)
{
    public static readonly int[] EdadesEnsaye = [7, 14, 28];
    /// <summary>Criterio simplificado: ningún ensaye a la edad de diseño por debajo de f'c − 35.</summary>
    public const int ToleranciaKgCm2 = 35;

    /// <summary>f'c y edad de diseño del concreto del pedido (de su producto o de su partida); 0 si no hay.</summary>
    public async Task<(int Fc, int Edad, string? Producto)> Diseno(Pedido p, CancellationToken ct)
    {
        var ids = p.Lineas.Select(l => l.ProductoId).ToList();
        if (ids.Count == 0) ids = await db.Set<PedidoLinea>().IgnoreQueryFilters().Where(l => l.PedidoId == p.Id).Select(l => l.ProductoId).ToListAsync(ct);
        var concreto = await db.Set<Producto>().IgnoreQueryFilters()
            .Where(x => ids.Contains(x.Id) && x.Tipo == TipoProducto.Concreto && !x.Codigo.StartsWith("AJ-")).FirstOrDefaultAsync(ct);
        var partida = p.PartidaId is Guid pa ? await db.Set<CotizacionPartida>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == pa, ct) : null;
        var digitos = new string((concreto?.ConcretoFc ?? "").TakeWhile(char.IsDigit).ToArray());
        var fc = partida?.ResistenciaKgCm2 is short r and > 0 ? r : int.TryParse(digitos, out var n) ? n : 0;
        return (fc, partida?.EdadDias ?? concreto?.ConcretoEdadDias ?? 28, concreto?.Nombre ?? partida?.Nombre);
    }

    /// <summary>Muestras y ensayes del pedido con el dictamen a la edad de diseño: promedio ≥ f'c y ninguno &lt; f'c − 35.</summary>
    public async Task<Certificado> Certificado(Guid pedidoId, CancellationToken ct)
    {
        var p = await db.Set<Pedido>().AsNoTracking().Include(x => x.Lineas).FirstOrDefaultAsync(x => x.Id == pedidoId, ct)
                ?? throw new ReglaException("El pedido no existe.", 404);
        var (fc, edad, producto) = await Diseno(p, ct);
        var cliente = await db.Set<Cliente>().IgnoreQueryFilters().Where(c => c.Id == p.ClienteId).Select(c => c.Nombre).FirstAsync(ct);
        var obra = p.ObraId is Guid o ? await db.Set<Obra>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == o, ct) : null;
        var muestras = await db.Set<MuestraLaboratorio>().AsNoTracking().Where(m => m.PedidoId == p.Id).OrderBy(m => m.FechaMuestreo).ToListAsync(ct);
        var mIds = muestras.Select(m => m.Id).ToList();
        var ensayes = (await db.Set<EnsayeLaboratorio>().AsNoTracking().Where(e => mIds.Contains(e.MuestraId)).OrderBy(e => e.EdadDias).ToListAsync(ct))
            .ToLookup(e => e.MuestraId);
        var remIds = muestras.Select(m => m.RemisionId).OfType<Guid>().ToList();
        var remisiones = await db.Set<Remision>().IgnoreQueryFilters().Where(r => remIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Folio, ct);
        decimal? Pct(decimal? r) => r is decimal v && fc > 0 ? Math.Round(v / fc * 100, 1) : null;

        var aEdad = ensayes.SelectMany(g => g).Where(e => e.EdadDias == edad && e.ResistenciaKgCm2 is not null).Select(e => e.ResistenciaKgCm2!.Value).ToList();
        var resumen = new Resumen28(aEdad.Count > 0 ? Math.Round(aEdad.Average(), 1) : null, aEdad.Count > 0 ? aEdad.Min() : null, aEdad.Count);
        var dictamen = aEdad.Count == 0 || fc == 0 ? "pendiente"
            : resumen.Promedio >= fc && resumen.Minimo >= fc - ToleranciaKgCm2 ? "cumple" : "no_cumple";
        return new(new(p.Id, p.Folio, p.FechaHoraEntrega), new(p.ClienteId, cliente), new(obra?.Nombre, obra?.Direccion ?? p.EntregaDireccion),
            producto, fc, edad,
            [.. muestras.Select(m => new MuestraCertificado(m.Folio, m.RemisionId is Guid r ? remisiones.GetValueOrDefault(r) : null, m.FechaMuestreo,
                m.RevenimientoCm, [.. ensayes[m.Id].Select(e => new EnsayeCertificado(e.EdadDias, e.FechaEnsaye, e.ResistenciaKgCm2, Pct(e.ResistenciaKgCm2)))]))],
            resumen, dictamen, DateTime.UtcNow);
    }

    /// <summary>Completa la muestra al crearla (folio, f'c) y programa sus ensayes. Llamar dentro de la transacción del alta.</summary>
    public async Task PrepararMuestra(MuestraLaboratorio m, CancellationToken ct)
    {
        var p = await db.Set<Pedido>().Include(x => x.Lineas).FirstOrDefaultAsync(x => x.Id == m.PedidoId, ct) ?? throw new ReglaException("El pedido no existe.");
        if (m.Id == Guid.Empty) m.Id = Guid.CreateVersion7(); // los ensayes la necesitan antes de guardar
        if (m.RemisionId is Guid r && !await db.Set<Remision>().AnyAsync(x => x.Id == r && x.PedidoId == p.Id, ct))
            throw new ReglaException("El viaje no es de ese pedido.");
        if (m.FechaMuestreo == default) m.FechaMuestreo = DateTime.UtcNow;
        if (m.ResistenciaDisenoKgCm2 == 0) m.ResistenciaDisenoKgCm2 = (await Diseno(p, ct)).Fc;
        if (string.IsNullOrWhiteSpace(m.Folio))
        {
            if (!await db.Set<Secuencia>().AnyAsync(s => s.EmpresaId == p.EmpresaId && s.SucursalId == p.SucursalId && s.Tipo == "muestra", ct))
            {
                var codigo = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Id == p.SucursalId).Select(s => s.Codigo).FirstAsync(ct);
                db.Set<Secuencia>().Add(new Secuencia { EmpresaId = p.EmpresaId, SucursalId = p.SucursalId, Tipo = "muestra",
                    Prefijo = $"MUE-{codigo}-{DateTime.UtcNow:yy}-" });
                await db.SaveChangesAsync(ct);
            }
            m.Folio = await db.SiguienteFolioAsync(p.EmpresaId, p.SucursalId, "muestra", ct);
        }
        var zona = await db.Set<Sucursal>().IgnoreQueryFilters().Where(s => s.Id == p.SucursalId).Select(s => s.ZonaHoraria).FirstAsync(ct);
        var dia = DateOnly.FromDateTime(VentasServicio.HoraLocal(m.FechaMuestreo, zona));
        foreach (var edad in EdadesEnsaye)
            db.Set<EnsayeLaboratorio>().Add(new EnsayeLaboratorio { MuestraId = m.Id, EdadDias = edad, FechaProgramada = dia.AddDays(edad) });
    }
}
