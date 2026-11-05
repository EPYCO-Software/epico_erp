import { PartidaCotizacion } from './cotizacion';

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
  /** Cotización que originó el pedido (aceptada en el portal o confirmada en el ERP). */
  cotizacionId?: string;
  /** Partida de esa cotización que entrega este pedido (uno por partida). */
  partidaId?: string;
  /** Total con IVA, MXN. */
  importe: number;
  cobro: EstadoCobro;
  /** Folio de la factura, cuando ya existe. */
  facturaFolio?: string;
  /** Orden directa (sin cotización): su partida y descuento, para ver sus líneas y su PDF. */
  partida?: PartidaCotizacion;
  descuento?: number;
}

export interface PedidoVista extends Pedido {
  clienteNombre: string;
  obraNombre: string;
  plantaNombre: string;
  /** Zona IANA de la planta, para mostrar las horas con fechaZona. */
  zonaHoraria: string;
}

export const ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  programado: 'Programado',
  en_planta: 'En planta',
  en_ruta: 'En ruta',
  en_obra: 'En obra',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ESTADO_COBRO: Record<EstadoCobro, string> = {
  por_facturar: 'Por facturar',
  en_facturacion: 'En proceso de facturación',
  facturado: 'Facturado',
  pagado: 'Pagado',
};
