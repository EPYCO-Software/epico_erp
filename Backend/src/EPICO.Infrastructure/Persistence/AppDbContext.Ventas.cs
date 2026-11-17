using EPICO.Domain.Acceso;
using EPICO.Domain.Historial;
using EPICO.Domain.Ventas;
using Microsoft.EntityFrameworkCore;

namespace EPICO.Infrastructure.Persistence;

// Modelo de clientes, productos, precios y documentos de venta. Las tablas sin empresa ni organización propia
// (contactos, partidas, líneas…) se filtran por su padre: si no ves el padre, no ves sus renglones.
public partial class AppDbContext
{
    void ConfigurarVentas(ModelBuilder b)
    {
        b.Entity<UnidadMedida>().HasIndex(x => x.Clave).IsUnique();
        b.Entity<Impuesto>(e =>
        {
            e.Property(x => x.Tasa).HasPrecision(8, 6);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasQueryFilter("empresa", x => VeTodo || x.EmpresaId == null || EmpresasPermitidas.Contains(x.EmpresaId.Value));
        });

        b.Entity<Cliente>(e =>
        {
            e.HasIndex(x => new { x.OrganizacionId, x.Nombre });
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaRestringidaId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.VendedorId);
            e.HasOne<ListaPrecios>().WithMany().HasForeignKey(x => x.ListaPreciosId);
        });
        b.Entity<ClienteContacto>(e =>
        {
            e.HasIndex(x => x.UsuarioId).IsUnique();
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Cliente>().Any(p => p.Id == x.ClienteId));
        });
        b.Entity<ClienteDatoFiscal>(e =>
        {
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Cliente>().Any(p => p.Id == x.ClienteId));
        });
        b.Entity<DisenoPortal>(e =>
        {
            e.HasIndex(x => x.ClienteId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
        });
        b.Entity<Obra>(e =>
        {
            e.Property(x => x.Lat).HasPrecision(9, 6);
            e.Property(x => x.Lng).HasPrecision(9, 6);
            e.HasIndex(x => new { x.OrganizacionId, x.Nombre });
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaRestringidaId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.ResponsableFotoArchivoId);
            e.HasQueryFilter("padre", x => VeTodo || x.ClienteId == null || Set<Cliente>().Any(p => p.Id == x.ClienteId));
        });
        b.Entity<Prospecto>(e =>
        {
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.VendedorId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
        });

        b.Entity<CategoriaProducto>(e =>
        {
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasQueryFilter("organizacion", x => VeTodo || x.OrganizacionId == null || x.OrganizacionId == OrganizacionPermitida);
        });
        b.Entity<Producto>(e =>
        {
            e.HasIndex(x => new { x.OrganizacionId, x.Codigo }).IsUnique();
            e.Property(x => x.MonedaCodigo).IsFixedLength();
            e.Property(x => x.MinimoExistencias).HasPrecision(14, 3);
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaRestringidaId);
            e.HasOne<CategoriaProducto>().WithMany().HasForeignKey(x => x.CategoriaId);
            e.HasOne<UnidadMedida>().WithMany().HasForeignKey(x => x.UnidadId);
            e.HasOne<Moneda>().WithMany().HasForeignKey(x => x.MonedaCodigo);
        });
        b.Entity<Existencia>(e =>
        {
            e.HasIndex(x => new { x.ProductoId, x.SucursalId }).IsUnique();
            e.Property(x => x.Cantidad).HasPrecision(14, 3);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Sucursal>().Any(p => p.Id == x.SucursalId));
        });
        b.Entity<MovimientoInventario>(e =>
        {
            e.HasIndex(x => new { x.ProductoId, x.SucursalId, x.Fecha });
            e.Property(x => x.Cantidad).HasPrecision(14, 3);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Sucursal>().Any(p => p.Id == x.SucursalId));
        });
        b.Entity<Equipo>(e =>
        {
            e.HasIndex(x => new { x.SucursalId, x.NumeroEconomico }).IsUnique();
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Sucursal>().Any(p => p.Id == x.SucursalId));
        });
        b.Entity<ProductoEquipo>(e =>
        {
            e.HasIndex(x => new { x.ProductoId, x.EquipoId }).IsUnique();
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasOne<Equipo>().WithMany().HasForeignKey(x => x.EquipoId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Producto>().Any(p => p.Id == x.ProductoId));
        });

        b.Entity<ListaPrecios>(e =>
        {
            e.Property(x => x.MonedaCodigo).IsFixedLength();
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaRestringidaId);
            e.HasOne<Moneda>().WithMany().HasForeignKey(x => x.MonedaCodigo);
        });
        b.Entity<ListaPreciosSucursal>(e =>
        {
            e.HasIndex(x => new { x.ListaPreciosId, x.SucursalId }).IsUnique();
            e.HasOne<ListaPrecios>().WithMany().HasForeignKey(x => x.ListaPreciosId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasQueryFilter("padre", x => VeTodo || Set<ListaPrecios>().Any(p => p.Id == x.ListaPreciosId));
        });
        b.Entity<ReglaPrecio>(e =>
        {
            e.HasOne<ListaPrecios>().WithMany().HasForeignKey(x => x.ListaPreciosId);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasOne<CategoriaProducto>().WithMany().HasForeignKey(x => x.CategoriaId);
            e.HasQueryFilter("padre", x => VeTodo || Set<ListaPrecios>().Any(p => p.Id == x.ListaPreciosId));
        });
        b.Entity<ProgramaDescuento>(e =>
        {
            e.HasOne<Organizacion>().WithMany().HasForeignKey(x => x.OrganizacionId);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaRestringidaId);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasOne<CategoriaProducto>().WithMany().HasForeignKey(x => x.CategoriaId);
        });
        b.Entity<Cupon>(e =>
        {
            e.HasIndex(x => x.Codigo).IsUnique();
            e.HasOne<ProgramaDescuento>().WithMany().HasForeignKey(x => x.ProgramaId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasOne<Pedido>().WithMany().HasForeignKey(x => x.GanadoEnPedidoId);
            e.HasOne<Pedido>().WithMany().HasForeignKey(x => x.UsadoEnPedidoId);
            e.HasQueryFilter("padre", x => VeTodo || Set<ProgramaDescuento>().Any(p => p.Id == x.ProgramaId));
        });
        b.Entity<SaldoLealtad>(e =>
        {
            e.HasIndex(x => new { x.ProgramaId, x.ClienteId }).IsUnique();
            e.HasOne<ProgramaDescuento>().WithMany().HasForeignKey(x => x.ProgramaId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasQueryFilter("padre", x => VeTodo || Set<ProgramaDescuento>().Any(p => p.Id == x.ProgramaId));
        });

        b.Entity<Cotizacion>(e =>
        {
            e.HasQueryFilter("planta", x => VeTodo || !EmpresasPorPlanta.Contains(x.EmpresaId) || SucursalesPermitidas.Contains(x.SucursalId));
            e.HasIndex(x => new { x.EmpresaId, x.Folio }).IsUnique();
            e.HasIndex(x => new { x.ClienteId, x.Fecha });
            e.Property(x => x.MonedaCodigo).IsFixedLength();
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasOne<Obra>().WithMany().HasForeignKey(x => x.ObraId);
            e.Property(x => x.EntregaLat).HasPrecision(9, 6);
            e.Property(x => x.EntregaLng).HasPrecision(9, 6);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.VendedorId);
            e.HasOne<Cotizacion>().WithMany().HasForeignKey(x => x.BaseId);
            e.HasOne<Moneda>().WithMany().HasForeignKey(x => x.MonedaCodigo);
            e.HasOne<ListaPrecios>().WithMany().HasForeignKey(x => x.ListaPreciosId);
            e.HasMany(x => x.Partidas).WithOne().HasForeignKey(x => x.CotizacionId);
        });
        b.Entity<CotizacionPartida>(e =>
        {
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasMany(x => x.Lineas).WithOne().HasForeignKey(x => x.PartidaId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Cotizacion>().Any(p => p.Id == x.CotizacionId));
        });
        b.Entity<CotizacionLinea>(e =>
        {
            e.Property(x => x.Cantidad).HasPrecision(12, 3);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasQueryFilter("padre", x => VeTodo || Set<CotizacionPartida>().Any(p => p.Id == x.PartidaId));
        });
        b.Entity<Pedido>(e =>
        {
            e.HasQueryFilter("planta", x => VeTodo || !EmpresasPorPlanta.Contains(x.EmpresaId) || SucursalesPermitidas.Contains(x.SucursalId));
            e.HasIndex(x => new { x.EmpresaId, x.Folio }).IsUnique();
            e.HasIndex(x => new { x.SucursalId, x.FechaHoraEntrega });
            e.HasIndex(x => x.Cobro);
            e.HasOne<Empresa>().WithMany().HasForeignKey(x => x.EmpresaId);
            e.HasOne<Sucursal>().WithMany().HasForeignKey(x => x.SucursalId);
            e.HasOne<Cliente>().WithMany().HasForeignKey(x => x.ClienteId);
            e.HasOne<Obra>().WithMany().HasForeignKey(x => x.ObraId);
            e.Property(x => x.EntregaLat).HasPrecision(9, 6);
            e.Property(x => x.EntregaLng).HasPrecision(9, 6);
            e.HasOne<Cotizacion>().WithMany().HasForeignKey(x => x.CotizacionId);
            e.HasOne<CotizacionPartida>().WithMany().HasForeignKey(x => x.PartidaId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.VendedorId);
            e.HasMany(x => x.Lineas).WithOne().HasForeignKey(x => x.PedidoId);
        });
        b.Entity<PedidoLinea>(e =>
        {
            e.Property(x => x.Cantidad).HasPrecision(12, 3);
            e.HasOne<Producto>().WithMany().HasForeignKey(x => x.ProductoId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Pedido>().Any(p => p.Id == x.PedidoId));
        });
        b.Entity<Remision>(e =>
        {
            e.HasIndex(x => x.PedidoId);
            e.HasOne<Pedido>().WithMany().HasForeignKey(x => x.PedidoId);
            e.HasOne<Equipo>().WithMany().HasForeignKey(x => x.EquipoId);
            e.HasOne<Usuario>().WithMany().HasForeignKey(x => x.OperadorId);
            e.HasOne<Archivo>().WithMany().HasForeignKey(x => x.FirmaArchivoId);
            e.HasQueryFilter("padre", x => VeTodo || Set<Pedido>().Any(p => p.Id == x.PedidoId));
        });
    }
}
