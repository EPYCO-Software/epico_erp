import { PartidaCotizacion } from './cotizacion';

export type EstadoPedido = 'programado' | 'en_planta' | 'en_ruta' | 'en_obra' | 'entregado' | 'cancelado';

/**
 * Situación económica del pedido, independiente de la entrega (el pago puede ser por adelantado). Toda orden nueva nace
 * "por cobrar"; de ahí la concretera la pasa a las demás (ERP → Ventas → Por cobrar).
 */
export type EstadoCobro = 'por_cobrar' | 'por_facturar' | 'facturado' | 'credito' | 'pagado' | 'finalizado';

/** Cómo paga el cliente esa orden; se indica al crearla. */
export type MetodoPago = 'sin_metodo' | 'transferencia';

/**
 * El requerimiento a la planta: "enviado" espera su respuesta; "actualizacion" es que la planta pide cambiar la
 * entrega (fecha); "rechazada", un problema mayor (con su motivo).
 */
export type EstatusPlanta = 'no_enviado' | 'enviado' | 'confirmado' | 'actualizacion' | 'rechazada';

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
  /** ERP: sin dato, "sin método". */
  metodoPago?: MetodoPago;
  /** ERP: sin dato, "no enviado". */
  estatusPlanta?: EstatusPlanta;
  /** Lo que pidió la planta: la nueva fecha de entrega (actualización) o el motivo (rechazo). */
  solicitudPlanta?: { fecha?: string; nota: string };
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
  por_cobrar: 'Por cobrar',
  por_facturar: 'Por facturar',
  facturado: 'Facturado',
  credito: 'Crédito',
  pagado: 'Pagado',
  finalizado: 'Finalizado',
};

export const METODO_PAGO: Record<MetodoPago, string> = {
  sin_metodo: 'Sin método',
  transferencia: 'Transferencia',
};

export const ESTATUS_PLANTA: Record<EstatusPlanta, string> = {
  no_enviado: 'No enviado',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  actualizacion: 'Actualización',
  rechazada: 'Rechazada',
};
