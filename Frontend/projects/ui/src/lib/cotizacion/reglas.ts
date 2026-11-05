import { Colocacion, EspecificacionConcreto, ServicioObra } from '../models/cotizacion';

const BOMBAS: ServicioObra[] = ['bomba-estacionaria', 'bomba-pluma'];

export interface Aviso {
  texto: string;
  /** Cambio sugerido; la UI ofrece aplicarlo con un clic. */
  arreglo?: Partial<EspecificacionConcreto>;
  accion?: string;
}

/** Recomendaciones técnicas según la combinación elegida. No bloquean: el cliente decide. */
export function avisos(e: EspecificacionConcreto): Aviso[] {
  const r: Aviso[] = [];
  if (e.exposicion === 'marina' && e.cemento !== 'CPC 30R RS') {
    r.push({ texto: 'En ambiente marino se recomienda cemento resistente a sulfatos (RS).', arreglo: { cemento: 'CPC 30R RS' }, accion: 'Usar cemento RS' });
  }
  if (e.exposicion === 'marina' && !e.aditivos.includes('impermeabilizante')) {
    r.push({
      texto: 'En ambiente marino conviene agregar impermeabilizante integral.',
      arreglo: { aditivos: [...e.aditivos, 'impermeabilizante'] },
      accion: 'Agregar impermeabilizante',
    });
  }
  if (e.colocacion === 'bombeo' && e.tmaMm > 25) {
    r.push({ texto: 'Para bombeo se recomienda agregado de 25 mm o menor.', arreglo: { tmaMm: 19 }, accion: 'Usar TMA 19 mm' });
  }
  if (e.colocacion === 'bombeo' && e.revenimientoCm < 10) {
    r.push({ texto: 'Para bombeo se recomienda revenimiento de 10 cm o más.', arreglo: { revenimientoCm: 10 }, accion: 'Usar 10 cm' });
  }
  if (e.aditivos.includes('acelerante') && e.aditivos.includes('retardante')) {
    r.push({ texto: 'Acelerante y retardante tienen efectos opuestos; normalmente se usa solo uno.' });
  }
  return r;
}

/** Al cambiar la colocación: bombeo agrega una bomba si no hay; directa quita las bombas. */
export function serviciosParaColocacion(servicios: ServicioObra[], colocacion: Colocacion): ServicioObra[] {
  if (colocacion === 'directa') return servicios.filter((s) => !BOMBAS.includes(s));
  return servicios.some((s) => BOMBAS.includes(s)) ? servicios : [...servicios, 'bomba-estacionaria'];
}

/** Al marcar/desmarcar servicios: hay bombeo si y solo si hay alguna bomba. */
export function colocacionParaServicios(servicios: ServicioObra[]): Colocacion {
  return servicios.some((s) => BOMBAS.includes(s)) ? 'bombeo' : 'directa';
}
