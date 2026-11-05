import { EstadoViaje, UbicacionGps, ViajeCamion, aIsoConOffset } from 'ui';

/** Calidad del seguimiento de un camión. */
export type Senal = 'en_vivo' | 'perdida' | 'sin_gps';

/** Una posición más vieja que esto ya no se considera "en vivo". */
export const MINUTOS_SENAL = 2;

export const ESTADO_VIAJE: Record<EstadoViaje, string> = {
  cargando: 'Cargando en planta',
  en_ruta: 'En camino',
  en_obra: 'Descargando en obra',
  regresando: 'Entregado',
};

const MIN = 60_000;

export const minutosDesde = (iso: string, ahora: Date) => Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / MIN));

export function senal(v: ViajeCamion, ahora: Date): Senal {
  if (!v.posicion) return 'sin_gps';
  return minutosDesde(v.posicion.fecha, ahora) < MINUTOS_SENAL ? 'en_vivo' : 'perdida';
}

/** Minutos que faltan para la llegada estimada; null si ya llegó o no hay estimado. */
export function minutosParaLlegar(v: ViajeCamion, ahora: Date): number | null {
  if (!v.llegadaEstimada || (v.estado !== 'cargando' && v.estado !== 'en_ruta')) return null;
  return Math.max(0, Math.ceil((new Date(v.llegadaEstimada).getTime() - ahora.getTime()) / MIN));
}

/** Hay algo que seguir mientras algún camión no haya terminado de descargar. */
export const entregaActiva = (viajes: ViajeCamion[]) => viajes.some((v) => v.estado !== 'regresando');

// ---- Simulación ----------------------------------------------------------------------------------------------
// shortcut: los viajes se simulan a partir de un horario (línea recta planta → obra). Al conectar el ERP,
// SeguimientoService recibe los ViajeCamion reales (GPS de la flota por WebSocket o consulta periódica) y esto
// se borra; las pantallas y senal()/minutosParaLlegar() no cambian.

export interface ProgramaViaje {
  id: string;
  pedidoId: string;
  unidad: string;
  operador: string;
  volumenM3: number;
  salida: Date;
  llegada: Date;
  origen: UbicacionGps;
  destino: UbicacionGps;
  /** false = la unidad no tiene GPS. */
  gps: boolean;
  /** La unidad deja de reportar a esta hora (zona sin cobertura). */
  senalHasta?: Date;
}

export const MINUTOS_DESCARGA = 25;

const mezclar = (a: UbicacionGps, b: UbicacionGps, t: number): UbicacionGps => {
  const k = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
};

/** Estado y posición del viaje en un instante dado. */
export function simularViaje(p: ProgramaViaje, ahora: Date): ViajeCamion {
  const lugar = (t: Date): { estado: EstadoViaje; pos: UbicacionGps } => {
    const ms = t.getTime();
    const ida = p.llegada.getTime() - p.salida.getTime();
    const finDescarga = p.llegada.getTime() + MINUTOS_DESCARGA * MIN;
    if (ms < p.salida.getTime()) return { estado: 'cargando', pos: p.origen };
    if (ms < p.llegada.getTime()) return { estado: 'en_ruta', pos: mezclar(p.origen, p.destino, (ms - p.salida.getTime()) / ida) };
    if (ms < finDescarga) return { estado: 'en_obra', pos: p.destino };
    return { estado: 'regresando', pos: mezclar(p.destino, p.origen, (ms - finDescarga) / ida) };
  };
  const { estado } = lugar(ahora);
  const reporte = p.senalHasta && p.senalHasta < ahora ? p.senalHasta : ahora;
  return {
    id: p.id,
    pedidoId: p.pedidoId,
    unidad: p.unidad,
    operador: p.operador,
    volumenM3: p.volumenM3,
    estado,
    salida: aIsoConOffset(p.salida),
    llegadaEstimada: aIsoConOffset(p.llegada),
    posicion: p.gps ? { ...lugar(reporte).pos, fecha: aIsoConOffset(reporte) } : undefined,
  };
}
