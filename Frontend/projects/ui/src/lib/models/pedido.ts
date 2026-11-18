import { LugarDeEntrega } from './obra';
import { PartidaCotizacion } from './cotizacion';

export type EstadoPedido = 'programado' | 'en_planta' | 'en_ruta' | 'en_obra' | 'entregado' | 'cancelado';

/**
 * Situación económica del pedido, independiente de la entrega (el pago puede ser por adelantado). Toda orden nueva nace
 * "por cobrar"; de ahí la concretera la pasa a las demás (ERP → Ventas → Por cobrar).
 */
export type EstadoCobro = 'por_cobrar' | 'por_facturar' | 'facturado' | 'credito' | 'pagado' | 'finalizado';

/** Cómo paga el cliente esa orden; se indica al crearla. */
export type MetodoPago = 'sin_metodo' | 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque';

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
  /** Sin obra: el lugar de entrega (viene de su cotización o de la orden directa). */
  lugar?: LugarDeEntrega;
  producto: string;
  volumenM3: number;
  /** ISO 8601 con offset. */
  fechaHoraEntrega: string;
  estado: EstadoPedido;
  /**
   * ISO 8601: cuándo la confirmó Ventas (o planta al confirmar el requerimiento). Sin dato: "por confirmar". Una orden
   * nace por confirmar; quien la crea puede confirmarla al momento.
   */
  confirmadaEn?: string;
  confirmadaPorId?: string;
  /** Números económicos de las unidades asignadas (Logística) y los m³ que llevan entre todas. */
  unidades?: string[];
  m3Asignados?: number;
  /** Lo que ocupa cada viaje: transporte (ida y vuelta) + servicio; la suma bloquea la unidad. Minutos. */
  tiempos?: TiemposViaje;
  /** Solicitud de cambio de fecha esperando respuesta (de planta, logística, ventas o el cliente). */
  reagendaPendiente?: ReagendaPendiente;
  /** Si no, al reagendar hay que indicar a qué correo avisar. */
  clienteTieneCorreo?: boolean;
  /** Cotización que originó el pedido (aceptada en el portal o confirmada en el ERP). */
  cotizacionId?: string;
  /** Partida de esa cotización que entrega este pedido (uno por partida). */
  partidaId?: string;
  /** Total con IVA, MXN. */
  importe: number;
  cobro: EstadoCobro;
  /** ISO 8601: desde cuándo está a crédito (el cobro pasó a "credito"); vence a los días de crédito del cliente. */
  creditoDesde?: string;
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

export interface TiemposViaje {
  transporteMin: number;
  /** El transporte sale de la distancia (no lo escribió nadie). */
  transporteCalculado: boolean;
  servicioMin: number;
  totalMin: number;
}

export interface ReagendaPendiente {
  id: string;
  /** ISO UTC. */
  fechaPropuesta: string;
  motivo: string;
  origen: 'planta' | 'logistica' | 'ventas' | 'cliente';
}

/** "3 h", "2 h 30 min", "45 min". */
export function textoDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
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
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
};

export const ESTATUS_PLANTA: Record<EstatusPlanta, string> = {
  no_enviado: 'No enviado',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  actualizacion: 'Actualización',
  rechazada: 'Rechazada',
};
