using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using EPICO.Domain.Common;

namespace EPICO.Domain.Ventas;

// Clientes, productos, inventario, equipos, precios y programas (docs/esquema.dbml).

public class UnidadMedida : IEntidad
{
    public Guid Id { get; set; }
    /// <summary>M3, PZA, KG, DIA, KM…</summary>
    [MaxLength(10)] public string Clave { get; set; } = "";
    [MaxLength(40)] public string Nombre { get; set; } = "";
    [MaxLength(3)] public string? ClaveSat { get; set; }
}

public class Impuesto : BaseEntity
{
    /// <summary>Vacío = del sistema (IVA 16 %).</summary>
    public Guid? EmpresaId { get; set; }
    [MaxLength(60)] public string Nombre { get; set; } = "";
    public TipoImpuesto Tipo { get; set; }
    [MaxLength(3)] public string ImpuestoSat { get; set; } = "";
    [MaxLength(10)] public string TipoFactor { get; set; } = "Tasa";
    /// <summary>0.160000</summary>
    [Rastreado("Tasa")] public decimal Tasa { get; set; }
    // shortcut: sin FK hasta que exista CuentaContable (contabilidad).
    public Guid? CuentaContableId { get; set; }
}

public class Cliente : BaseEntity, IDeOrganizacion, IRestringible
{
    public Guid OrganizacionId { get; set; }
    public Guid? EmpresaRestringidaId { get; set; }
    [MaxLength(300), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(120), Rastreado("Giro")] public string? Giro { get; set; }
    [MaxLength(254), EmailAddress, Rastreado("Correo")] public string? Correo { get; set; }
    [MaxLength(20), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [MaxLength(200)] public string? SitioWeb { get; set; }
    public bool EsPublicoGeneral { get; set; }
    [Rastreado("Vendedor", TipoDatoCambio.Referencia)] public Guid? VendedorId { get; set; }
    [Rastreado("Lista de precios", TipoDatoCambio.Referencia)] public Guid? ListaPreciosId { get; set; }
    [Range(0, 365), Rastreado("Días de crédito")] public int DiasCredito { get; set; }
    [Range(0, 999_999_999_999), Rastreado("Límite de crédito", TipoDatoCambio.Dinero)] public decimal? LimiteCredito { get; set; }
    public string? Notas { get; set; }
}

public class ClienteContacto : BaseEntity, IDePadre
{
    public Guid ClienteId { get; set; }
    [MaxLength(120), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(120), Rastreado("Apellidos")] public string? Apellidos { get; set; }
    [MaxLength(120), Rastreado("Puesto")] public string? Puesto { get; set; }
    [MaxLength(254), EmailAddress, Rastreado("Correo")] public string? Correo { get; set; }
    [MaxLength(20), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [Rastreado("Principal")] public bool Principal { get; set; }
    /// <summary>Si tiene, entra al portal.</summary>
    public Guid? UsuarioId { get; set; }
    string? IDePadre.PadreTipo => nameof(Cliente);
    Guid? IDePadre.PadreId => ClienteId;
}

public class ClienteDatoFiscal : BaseEntity, IDePadre, IDeCliente
{
    public Guid ClienteId { get; set; }
    [MaxLength(100), Rastreado("Alias")] public string Alias { get; set; } = "";
    [MaxLength(300), Rastreado("Razón social")] public string RazonSocial { get; set; } = "";
    [MaxLength(13), RegularExpression(@"^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$"), Rastreado("RFC")] public string RFC { get; set; } = "";
    [MaxLength(3), Rastreado("Régimen fiscal")] public string RegimenFiscal { get; set; } = "";
    [MaxLength(4), Rastreado("Uso CFDI")] public string UsoCfdi { get; set; } = "";
    [MaxLength(5), RegularExpression(@"^\d{5}$"), Rastreado("Código postal")] public string CodigoPostal { get; set; } = "";
    [MaxLength(254), EmailAddress, Rastreado("Correo")] public string? Correo { get; set; }
    [Rastreado("Dirección fiscal")] public string? DireccionFiscal { get; set; }
    [Rastreado("Predeterminado")] public bool Predeterminado { get; set; }
    string? IDePadre.PadreTipo => nameof(Cliente);
    Guid? IDePadre.PadreId => ClienteId;
}

/// <summary>Obra de un cliente, o general (sin cliente: banco de material, patio…) de la organización.</summary>
public class Obra : BaseEntity, IDePadre, IDeCliente, IDeOrganizacion, IRestringible
{
    public Guid OrganizacionId { get; set; }
    [Rastreado("Solo para", TipoDatoCambio.Referencia)] public Guid? EmpresaRestringidaId { get; set; }
    /// <summary>null = obra general (el portal no la ve).</summary>
    [Rastreado("Cliente", TipoDatoCambio.Referencia)] public Guid? ClienteId { get; set; }
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [Rastreado("Dirección")] public string Direccion { get; set; } = "";
    [MaxLength(120), Rastreado("Municipio")] public string? Municipio { get; set; }
    public string? Referencias { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    [MaxLength(200), Rastreado("Responsable")] public string? ResponsableNombre { get; set; }
    public Guid? ResponsableFotoArchivoId { get; set; }
    /// <summary>[{ nombre, lada, numero }]</summary>
    public JsonDocument? Contactos { get; set; }
    // El portal solo trabaja con obras de su cliente: ahí ClienteId nunca es null.
    Guid IDeCliente.ClienteId { get => ClienteId ?? Guid.Empty; set => ClienteId = value; }
    string? IDePadre.PadreTipo => ClienteId is null ? null : nameof(Cliente);
    Guid? IDePadre.PadreId => ClienteId;
}

/// <summary>Diseño de concreto que el cliente guarda en el portal para volver a cotizarlo.</summary>
public class DisenoPortal : BaseEntity, IDeCliente
{
    public Guid ClienteId { get; set; }
    [Required, MaxLength(120)] public string Nombre { get; set; } = "";
    [MaxLength(40)] public string? SolucionId { get; set; }
    /// <summary>JSON libre del front (resistencia, revenimiento, aditivos…).</summary>
    public JsonDocument? Especificacion { get; set; }
    public bool Favorito { get; set; }
}

public class Prospecto : BaseEntity, IDeOrganizacion
{
    public Guid OrganizacionId { get; set; }
    public Guid? EmpresaId { get; set; }
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(300), Rastreado("Empresa")] public string? NombreEmpresa { get; set; }
    [MaxLength(254), EmailAddress, Rastreado("Correo")] public string? Correo { get; set; }
    [MaxLength(20), Rastreado("Teléfono")] public string? Telefono { get; set; }
    [MaxLength(60)] public string? Origen { get; set; }
    [Rastreado("Etapa", TipoDatoCambio.Opcion)] public EtapaProspecto Etapa { get; set; }
    [Rastreado("Vendedor", TipoDatoCambio.Referencia)] public Guid? VendedorId { get; set; }
    [Rastreado("Valor estimado", TipoDatoCambio.Dinero)] public decimal? ValorEstimado { get; set; }
    [Rastreado("Cliente", TipoDatoCambio.Referencia)] public Guid? ClienteId { get; set; }
    [Rastreado("Motivo de pérdida")] public string? MotivoPerdida { get; set; }
}

public class CategoriaProducto : BaseEntity
{
    /// <summary>Vacío = del sistema.</summary>
    public Guid? OrganizacionId { get; set; }
    /// <summary>concreto-fc, concreto-mr, servicio, maquinaria, general…</summary>
    [MaxLength(40)] public string Clave { get; set; } = "";
    [MaxLength(120)] public string Nombre { get; set; } = "";
    public TipoProducto Tipo { get; set; }
}

public class Producto : BaseEntity, IDeOrganizacion, IRestringible
{
    public Guid OrganizacionId { get; set; }
    public Guid? EmpresaRestringidaId { get; set; }
    [Rastreado("Categoría", TipoDatoCambio.Referencia)] public Guid CategoriaId { get; set; }
    public TipoProducto Tipo { get; set; }
    /// <summary>Lo arma el front: 200 - N28 - 14 - BP, SRV-…</summary>
    [MaxLength(40), Rastreado("Código")] public string Codigo { get; set; } = "";
    [MaxLength(300), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [Rastreado("Descripción")] public string Descripcion { get; set; } = "";
    [Rastreado("Unidad", TipoDatoCambio.Referencia)] public Guid UnidadId { get; set; }
    [Range(0, 999_999_999_999), Rastreado("Precio de lista", TipoDatoCambio.Dinero)] public decimal PrecioLista { get; set; }
    [MaxLength(3)] public string MonedaCodigo { get; set; } = "MXN";
    /// <summary>m³ mínimos que se cobran.</summary>
    [Range(0, 99_999_999), Rastreado("Mínimo de cobro")] public decimal? MinimoCobro { get; set; }
    [MaxLength(8)] public string? ClaveProdServSat { get; set; }
    public bool ControlaExistencias { get; set; }
    public decimal? MinimoExistencias { get; set; }
    /// <summary>200, MR45… (solo concreto).</summary>
    [MaxLength(6)] public string? ConcretoFc { get; set; }
    public short? ConcretoEdadDias { get; set; }
    public short? ConcretoRevenimientoCm { get; set; }
    [MaxLength(3)] public string? ConcretoSuministro { get; set; }
    /// <summary>Servicio de renta: qué equipo.</summary>
    public TipoEquipo? EquipoTipo { get; set; }
    /// <summary>Para qué sirve (solo concreto): claves de <see cref="Soluciones.Todas"/>. El cotizador ofrece las que tengan productos.</summary>
    [Rastreado("Soluciones", TipoDatoCambio.Texto)] public List<string> Soluciones { get; set; } = [];
    [Rastreado("Activo")] public bool Activo { get; set; } = true;
}

/// <summary>Catálogo fijo de soluciones del cotizador.</summary>
public static class Soluciones
{
    public static readonly string[] Todas = ["pavimento", "losa", "cimentacion", "columnas", "firmes", "relleno", "especial"];

    /// <summary>Etiquetas por resistencia para el tarifario: MRxx = pavimento; f'c por rangos.</summary>
    public static List<string> Sugeridas(string? concretoFc)
    {
        if (concretoFc is null) return [];
        if (concretoFc.StartsWith("MR", StringComparison.OrdinalIgnoreCase)) return ["pavimento"];
        if (!int.TryParse(concretoFc, out var fc)) return [];
        return [.. new (string Clave, int Min, int Max)[]
            {
                ("pavimento", 300, 350), ("losa", 200, 300), ("cimentacion", 150, 250), ("columnas", 250, 350),
                ("firmes", 100, 200), ("relleno", 100, 150), ("especial", 400, int.MaxValue),
            }.Where(r => fc >= r.Min && fc <= r.Max).Select(r => r.Clave)];
    }
}

public class Existencia : IEntidad
{
    public Guid Id { get; set; }
    public Guid ProductoId { get; set; }
    public Guid SucursalId { get; set; }
    public decimal Cantidad { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class MovimientoInventario : IEntidad
{
    public Guid Id { get; set; }
    public Guid ProductoId { get; set; }
    public Guid SucursalId { get; set; }
    public TipoMovimientoInventario Tipo { get; set; }
    /// <summary>Entrada y salida en positivo; ajuste con signo.</summary>
    public decimal Cantidad { get; set; }
    public string? Nota { get; set; }
    public DateTime Fecha { get; set; }
    public Guid? UsuarioId { get; set; }
    [MaxLength(40)] public string? RegistroTipo { get; set; }
    public Guid? RegistroId { get; set; }
}

public class Equipo : BaseEntity
{
    public Guid SucursalId { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoEquipo Tipo { get; set; }
    /// <summary>ECO-21, BP-01</summary>
    [MaxLength(20), Rastreado("Número económico")] public string NumeroEconomico { get; set; } = "";
    [MaxLength(200)] public string? Descripcion { get; set; }
    [MaxLength(15), Rastreado("Placas")] public string? Placas { get; set; }
    public decimal? CapacidadM3 { get; set; }
    [Rastreado("Activo")] public bool Activo { get; set; } = true;
}

public class ProductoEquipo : IEntidad
{
    public Guid Id { get; set; }
    public Guid ProductoId { get; set; }
    public Guid EquipoId { get; set; }
}

public class ListaPrecios : BaseEntity, IDeOrganizacion, IRestringible
{
    public Guid OrganizacionId { get; set; }
    public Guid? EmpresaRestringidaId { get; set; }
    [MaxLength(120), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    [MaxLength(3), Rastreado("Moneda")] public string MonedaCodigo { get; set; } = "MXN";
    [Rastreado("Activa")] public bool Activa { get; set; } = true;
}

/// <summary>En qué plantas aplica una lista; sin renglones = todas.</summary>
public class ListaPreciosSucursal : IEntidad
{
    public Guid Id { get; set; }
    public Guid ListaPreciosId { get; set; }
    public Guid SucursalId { get; set; }
}

public class ReglaPrecio : BaseEntity, IDePadre
{
    public Guid ListaPreciosId { get; set; }
    [Rastreado("Aplicar a", TipoDatoCambio.Opcion)] public AplicarRegla AplicarA { get; set; }
    [Rastreado("Producto", TipoDatoCambio.Referencia)] public Guid? ProductoId { get; set; }
    [Rastreado("Categoría", TipoDatoCambio.Referencia)] public Guid? CategoriaId { get; set; }
    [Rastreado("Tipo", TipoDatoCambio.Opcion)] public TipoReglaPrecio Tipo { get; set; }
    [Rastreado("Precio fijo", TipoDatoCambio.Dinero)] public decimal? PrecioFijo { get; set; }
    /// <summary>Negativo = aumento (fórmula).</summary>
    [Range(-1000, 100), Rastreado("Descuento %")] public decimal? DescuentoPct { get; set; }
    [Rastreado("Recargo", TipoDatoCambio.Dinero)] public decimal? Recargo { get; set; }
    [Range(0, 99_999_999), Rastreado("Cantidad mínima")] public decimal CantidadMinima { get; set; }
    [Rastreado("Inicio")] public DateOnly? Inicio { get; set; }
    [Rastreado("Fin")] public DateOnly? Fin { get; set; }
    string? IDePadre.PadreTipo => nameof(ListaPrecios);
    Guid? IDePadre.PadreId => ListaPreciosId;
}

public class ProgramaDescuento : BaseEntity, IDeOrganizacion, IRestringible
{
    public Guid OrganizacionId { get; set; }
    public Guid? EmpresaRestringidaId { get; set; }
    [MaxLength(200), Rastreado("Nombre")] public string Nombre { get; set; } = "";
    public TipoPrograma Tipo { get; set; }
    [Rastreado("Activo")] public bool Activo { get; set; } = true;
    [Rastreado("Inicio")] public DateOnly? Inicio { get; set; }
    [Rastreado("Fin")] public DateOnly? Fin { get; set; }
    public Guid? ProductoId { get; set; }
    public Guid? CategoriaId { get; set; }
    [Rastreado("Compra mínima", TipoDatoCambio.Dinero)] public decimal CompraMinima { get; set; }
    [MaxLength(20), Rastreado("Código")] public string? Codigo { get; set; }
    public int? CantidadX { get; set; }
    public int? CantidadY { get; set; }
    [Rastreado("Recompensa", TipoDatoCambio.Opcion)] public TipoRecompensa Recompensa { get; set; }
    [Rastreado("Valor")] public decimal Valor { get; set; }
    public decimal? PesosPorPunto { get; set; }
    public int? PuntosCanje { get; set; }
    /// <summary>Sellos para la recompensa.</summary>
    public int? Meta { get; set; }
}

public class Cupon : BaseEntity
{
    public Guid ProgramaId { get; set; }
    [MaxLength(20)] public string Codigo { get; set; } = "";
    public Guid? ClienteId { get; set; }
    public Guid? GanadoEnPedidoId { get; set; }
    public Guid? UsadoEnPedidoId { get; set; }
    public DateTime? UsadoEn { get; set; }
}

public class SaldoLealtad : IEntidad
{
    public Guid Id { get; set; }
    public Guid ProgramaId { get; set; }
    public Guid ClienteId { get; set; }
    /// <summary>Puntos o sellos.</summary>
    public decimal Saldo { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
