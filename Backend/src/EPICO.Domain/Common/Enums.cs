namespace EPICO.Domain.Common;

// Enums de Postgres del esquema (docs/esquema.dbml). Npgsql los guarda en snake_case: FechaHora → fecha_hora.

public enum TipoUsuario { Interno, Portal }

public enum TipoEvento { Creado, Cambio, Eliminado, Restaurado, Nota, Mensaje, Actividad, Sistema }

public enum TipoDatoCambio { Texto, Numero, Dinero, Fecha, FechaHora, Booleano, Opcion, Referencia }

public enum TipoActividad { Pendiente, Correo, Llamada, Reunion, Documento }

public enum EtapaProspecto { Nuevo, Contactado, Calificado, Propuesta, Ganado, Perdido }

public enum TipoProducto { Concreto, Servicio, General }

public enum TipoMovimientoInventario { Entrada, Salida, Ajuste }

public enum TipoEquipo
{
    Revolvedor, BombaPluma, BombaEstacionaria, Aplanadora, Vibrador, Allanadora, Otro,
    Volteo, Plataforma, Tractocamion, Pipa, Camioneta, Retroexcavadora, Cargador, Excavadora, Grua, Montacargas,
}

public enum EstadoEquipo { Disponible, Mantenimiento, FueraDeServicio }

public enum TipoDocumentoEquipo { Seguro, Verificacion, TarjetaCirculacion, PermisoSct, Tenencia, Otro, Calibracion }

public enum TipoMantenimiento { Preventivo, Correctivo }

public enum EstadoMantenimiento { Programado, EnProceso, Terminado, Cancelado }

/// <summary>Quién pidió cambiar la entrega.</summary>
public enum OrigenReagenda { Planta, Logistica, Ventas, Cliente }

public enum EstadoSolicitud { Pendiente, Aceptada, Rechazada }

public enum TipoTrayecto { Entrega, Traslado, Flete, Mantenimiento, Otro }

public enum FuentePosicion { Traccar, Demo, Manual }

public enum ResultadoInspeccion { Aprobada, ConObservaciones, Rechazada }

public enum AplicarRegla { Todos, Producto, Categoria }

public enum TipoReglaPrecio { Descuento, Formula, Fijo }

public enum TipoPrograma { Promocion, Codigo, CompraX, ProximaOrden, Lealtad, Cupones, Sellos }

public enum TipoRecompensa { Porcentaje, Monto, Traslado }

public enum EstadoCotizacion { Recibida, Borrador, Enviada, Pedido, Cancelada }

public enum OrigenCotizacion { Erp, Portal }

public enum EstadoPedido { Programado, EnPlanta, EnRuta, EnObra, Entregado, Cancelado }

public enum EstadoCobro { PorCobrar, PorFacturar, Facturado, Credito, Pagado, Finalizado }

public enum MetodoPago { SinMetodo, Transferencia, Efectivo, Tarjeta, Cheque }

public enum EstatusPlanta { NoEnviado, Enviado, Confirmado, Actualizacion, Rechazada }

/// <summary>Programado = camión asignado, aún no carga. El orden importa: un viaje solo avanza.</summary>
public enum EstadoViaje { Programado, Cargando, EnRuta, EnObra, Regresando, Terminado }

public enum TipoImpuesto { Traslado, Retencion }

/// <summary>Ninguna (puerto 25/1025), StartTls (587) o Ssl (465).</summary>
public enum SeguridadSmtp { Ninguna, StartTls, Ssl }

public enum EstadoCorreo { Pendiente, Enviado, Fallido }
