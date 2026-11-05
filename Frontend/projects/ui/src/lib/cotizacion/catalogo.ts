import {
  BrickWall,
  Droplets,
  Grid3x3,
  IconNode,
  Layers,
  Road,
  Shovel,
  SlidersHorizontal,
  Sparkles,
} from 'lucide';
import { EspecificacionConcreto, ServicioObra, TipoCemento } from '../models/cotizacion';
import { RESISTENCIAS } from './formato';

// Soluciones y opciones del cotizador: las mismas en el portal (pasos del catálogo) y en el ERP (nueva cotización).
// shortcut: catálogo fijo en el front. Cuando la concretera administre soluciones, opciones y servicios
// desde el ERP, cargarlo por HTTP con esta misma forma.

export interface Solucion {
  id: string;
  nombre: string;
  descripcion: string;
  icono: IconNode;
  sugerida: EspecificacionConcreto;
  servicios: ServicioObra[];
}

const base: EspecificacionConcreto = {
  tipoResistencia: 'fc',
  resistenciaKgCm2: 250,
  edadDias: 28,
  revenimientoCm: 10,
  tmaMm: 19,
  cemento: 'CPC 30R',
  exposicion: 'normal',
  colocacion: 'directa',
  aditivos: [],
};

export const SOLUCIONES: Solucion[] = [
  {
    id: 'pavimento', nombre: 'Pavimento', descripcion: 'Superficies de tránsito', icono: Road,
    sugerida: { ...base, resistenciaKgCm2: 300, colocacion: 'bombeo' }, servicios: ['bomba-estacionaria'],
  },
  {
    id: 'losa', nombre: 'Losa y estructura', descripcion: 'Elementos estructurales', icono: Layers,
    sugerida: { ...base, revenimientoCm: 12 }, servicios: [],
  },
  {
    id: 'cimentacion', nombre: 'Cimentación', descripcion: 'Zapatas y elementos de apoyo', icono: Shovel,
    sugerida: { ...base }, servicios: [],
  },
  {
    id: 'columnas', nombre: 'Columnas y muros', descripcion: 'Elementos verticales y muy armados', icono: BrickWall,
    sugerida: { ...base, resistenciaKgCm2: 300, revenimientoCm: 14, tmaMm: 13, colocacion: 'bombeo' }, servicios: ['bomba-estacionaria'],
  },
  {
    id: 'firmes', nombre: 'Firmes y banquetas', descripcion: 'Pisos, banquetas y guarniciones', icono: Grid3x3,
    sugerida: { ...base, resistenciaKgCm2: 150 }, servicios: [],
  },
  {
    id: 'relleno', nombre: 'Relleno fluido', descripcion: 'Zanjas y nivelaciones sin compactar', icono: Droplets,
    sugerida: { ...base, resistenciaKgCm2: 50, revenimientoCm: 20, tmaMm: 10 }, servicios: [],
  },
  {
    id: 'especial', nombre: 'Concreto especial', descripcion: 'Autocompactable, alta resistencia o con fibras', icono: Sparkles,
    sugerida: { ...base, resistenciaKgCm2: 350, revenimientoCm: 18, tmaMm: 13, colocacion: 'bombeo' }, servicios: ['bomba-estacionaria'],
  },
];

/** "Configurar desde cero": no aparece en la lista de soluciones. */
export const PERSONALIZADO: Solucion = {
  id: 'personalizado', nombre: 'Concreto personalizado', descripcion: 'Especificaciones a tu medida', icono: SlidersHorizontal,
  sugerida: { ...base }, servicios: [],
};

export function buscarSolucion(id: string | null): Solucion | null {
  if (!id) return null;
  return id === PERSONALIZADO.id ? PERSONALIZADO : (SOLUCIONES.find((s) => s.id === id) ?? null);
}

export const OPCIONES = {
  // Las del tarifario (formato.ts), las mismas que ofrece el ERP al agregar un producto.
  fc: RESISTENCIAS.fc,
  mr: RESISTENCIAS.mr,
  edades: [28, 14, 7, 3],
  revenimientos: [6, 8, 10, 12, 14, 16, 18, 20],
  tma: [10, 13, 19, 25, 38],
  cementos: ['CPC 30R', 'CPC 40', 'CPC 30R RS'] as TipoCemento[],
};

export const CEMENTO_LABEL: Record<TipoCemento, string> = {
  'CPC 30R': 'CPC 30R (uso general)',
  'CPC 40': 'CPC 40 (alta resistencia)',
  'CPC 30R RS': 'CPC 30R RS (resistente a sulfatos)',
};
