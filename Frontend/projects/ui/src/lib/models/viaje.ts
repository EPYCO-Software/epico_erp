import { UbicacionGps } from './obra';

/** Etapa de un camión (olla) dentro de la entrega de un pedido. */
export type EstadoViaje = 'cargando' | 'en_ruta' | 'en_obra' | 'regresando';

export interface PosicionGps extends UbicacionGps {
  /** Cuándo la reportó la unidad, ISO 8601 con offset. */
  fecha: string;
}

/** Un viaje de un camión para un pedido (un pedido puede requerir varios). */
export interface ViajeCamion {
  id: string;
  pedidoId: string;
  /** Número económico, p. ej. "ECO-21". */
  unidad: string;
  operador: string;
  volumenM3: number;
  estado: EstadoViaje;
  /** ISO 8601 con offset. */
  salida?: string;
  llegadaEstimada?: string;
  /** Última posición reportada. Ausente si la unidad no tiene GPS: entonces solo hay horarios estimados. */
  posicion?: PosicionGps;
}
