export type EstadoPedido = 'programado' | 'en_planta' | 'en_ruta' | 'en_obra' | 'entregado' | 'cancelado';

/** Situación económica del pedido, independiente de la entrega (el pago puede ser por adelantado). */
export type EstadoCobro = 'por_facturar' | 'en_facturacion' | 'facturado' | 'pagado';

export interface Pedido {
  id: string;
  folio: string;
  clienteId: string;
  plantaId: string;
  obraId: string;
  producto: string;
  volumenM3: number;
  /** ISO 8601 con offset. */
  fechaHoraEntrega: string;
  estado: EstadoPedido;
  /** Cotización aceptada que originó el pedido (si vino del portal). */
  cotizacionId?: string;
  /** Total con IVA, MXN. */
  importe: number;
  cobro: EstadoCobro;
  /** Folio de la factura, cuando ya existe. */
  facturaFolio?: string;
}

export interface PedidoVista extends Pedido {
  clienteNombre: string;
  obraNombre: string;
  plantaNombre: string;
  /** Zona IANA de la planta, para mostrar las horas con fechaZona. */
  zonaHoraria: string;
}
