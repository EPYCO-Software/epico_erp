import {
  BrickWall,
  Construction,
  Droplets,
  FlaskConical,
  Grid3x3,
  Fan,
  HardHat,
  IconNode,
  Layers,
  Moon,
  Road,
  Shovel,
  SlidersHorizontal,
  Sparkles,
  Tractor,
  Vibrate,
  Truck,
} from 'lucide';
import { Aditivo, EspecificacionConcreto, Exposicion, Maquinaria, ServicioObra, TipoCemento } from 'ui';

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
  fc: [100, 150, 200, 250, 300, 350, 400],
  mr: [36, 40, 42, 45, 48],
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

export const EXPOSICIONES: { id: Exposicion; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'humedad', label: 'Humedad' },
  { id: 'marina', label: 'Ambiente marino' },
];

export const ADITIVOS: { id: Aditivo; label: string }[] = [
  { id: 'acelerante', label: 'Acelerante' },
  { id: 'retardante', label: 'Retardante' },
  { id: 'impermeabilizante', label: 'Impermeabilizante integral' },
  { id: 'fibra-sintetica', label: 'Fibra sintética' },
  { id: 'fibra-metalica', label: 'Fibra metálica' },
];

export interface Servicio {
  id: ServicioObra;
  nombre: string;
  descripcion: string;
  icono: IconNode;
}

export const SERVICIOS: Servicio[] = [
  { id: 'bomba-estacionaria', nombre: 'Bombeo de concreto', descripcion: 'Bomba estacionaria con tubería hasta el punto de colado.', icono: Truck },
  { id: 'bomba-pluma', nombre: 'Bomba pluma', descripcion: 'Para colados en altura o con gran alcance horizontal.', icono: Construction },
  { id: 'muestreo-laboratorio', nombre: 'Muestreo y ensaye de cilindros', descripcion: 'Nuestro laboratorio muestrea en obra y entrega resultados a 7 y 28 días.', icono: FlaskConical },
  { id: 'colado-nocturno', nombre: 'Colado en horario nocturno', descripcion: 'Para vialidades con tránsito o días de calor extremo.', icono: Moon },
  { id: 'asesoria-tecnica', nombre: 'Asesoría técnica en obra', descripcion: 'Un técnico acompaña la colocación, el vibrado y el curado.', icono: HardHat },
  { id: 'renta-maquinaria', nombre: 'Renta de maquinaria', descripcion: 'Aplanadora, vibrador y allanadora para preparar y dar acabado.', icono: Tractor },
];

export const MAQUINARIA: { id: Maquinaria; nombre: string; descripcion: string; icono: IconNode }[] = [
  { id: 'aplanadora', nombre: 'Aplanadora', descripcion: 'Rodillo compactador para la base antes de colar.', icono: Tractor },
  { id: 'vibrador', nombre: 'Vibrador de concreto', descripcion: 'De inmersión, para consolidar y evitar huecos.', icono: Vibrate },
  { id: 'allanadora', nombre: 'Allanadora', descripcion: '"Helicóptero" para acabado pulido de firmes y pisos.', icono: Fan },
];
