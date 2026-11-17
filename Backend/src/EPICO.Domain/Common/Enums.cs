namespace EPICO.Domain.Common;

// Enums de Postgres del esquema (docs/esquema.dbml). Npgsql los guarda en snake_case: FechaHora → fecha_hora.

public enum TipoUsuario { Interno, Portal }

public enum TipoEvento { Creado, Cambio, Eliminado, Restaurado, Nota, Mensaje, Actividad, Sistema }

public enum TipoDatoCambio { Texto, Numero, Dinero, Fecha, FechaHora, Booleano, Opcion, Referencia }

public enum TipoActividad { Pendiente, Correo, Llamada, Reunion, Documento }

public enum EtapaProspecto { Nuevo, Contactado, Calificado, Propuesta, Ganado, Perdido }

public enum TipoProducto { Concreto, Servicio, General }

public enum TipoMovimientoInventario { Entrada, Salida, Ajuste }

public enum TipoEquipo { Revolvedor, BombaPluma, BombaEstacionaria, Aplanadora, Vibrador, Allanadora, Otro }

public enum AplicarRegla { Todos, Producto, Categoria }

public enum TipoReglaPrecio { Descuento, Formula, Fijo }

public enum TipoPrograma { Promocion, Codigo, CompraX, ProximaOrden, Lealtad, Cupones, Sellos }

public enum TipoRecompensa { Porcentaje, Monto, Traslado }

public enum EstadoCotizacion { Recibida, Borrador, Enviada, Pedido, Cancelada }

public enum OrigenCotizacion { Erp, Portal }

public enum EstadoPedido { Programado, EnPlanta, EnRuta, EnObra, Entregado, Cancelado }

public enum EstadoCobro { PorCobrar, PorFacturar, Facturado, Credito, Pagado, Finalizado }

public enum MetodoPago { SinMetodo, Transferencia }

public enum EstatusPlanta { NoEnviado, Enviado, Confirmado, Actualizacion, Rechazada }

public enum EstadoViaje { Cargando, EnRuta, EnObra, Regresando, Terminado }

public enum TipoImpuesto { Traslado, Retencion }

/// <summary>Ninguna (puerto 25/1025), StartTls (587) o Ssl (465).</summary>
public enum SeguridadSmtp { Ninguna, StartTls, Ssl }

public enum EstadoCorreo { Pendiente, Enviado, Fallido }
