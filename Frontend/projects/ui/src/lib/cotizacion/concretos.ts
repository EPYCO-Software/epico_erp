import { PERSONALIZADO, SOLUCIONES, Solucion } from './catalogo';
import { ConcretoDisponible, PRODUCTOS, ProductoTarifa, concretosServidor } from './formato';

export { concretosServidor };
export type { ConcretoDisponible };

/** Las claves de las 7 soluciones estándar (las que se etiquetan en Productos). */
export const CLAVES_SOLUCION = SOLUCIONES.map((s) => s.id);

/** De un producto del catálogo, su concreto (null si no es un concreto de tarifario fc-/mr-). */
export function concretoDe(p: Pick<ProductoTarifa, 'id' | 'precio' | 'pedidoMinimo'> & { soluciones?: string[] }): ConcretoDisponible | null {
  const m = /^(fc|mr)-(\d+)$/.exec(p.id);
  return m
    ? { id: p.id, tipo: m[1] as 'fc' | 'mr', kg: Number(m[2]), precio: p.precio, soluciones: p.soluciones ?? [], ...(p.pedidoMinimo ? { pedidoMinimo: p.pedidoMinimo } : {}) }
    : null;
}

/** Los concretos que se pueden ofrecer: los del backend o, sin él, los del tarifario. */
export function concretosDisponibles(): ConcretoDisponible[] {
  return concretosServidor() ?? PRODUCTOS.map(concretoDe).filter((c): c is ConcretoDisponible => !!c);
}

/**
 * Las soluciones que tienen al menos un concreto etiquetado (no se ofrece "Pavimento" si no hay concreto para
 * pavimento). Sin backend (tarifario fijo, sin etiquetas) se ofrecen todas. "Personalizado" siempre: sirve cualquiera.
 */
export function solucionesDisponibles(): Solucion[] {
  if (!concretosServidor()) return SOLUCIONES;
  const con = new Set(concretosDisponibles().flatMap((c) => c.soluciones));
  return SOLUCIONES.filter((s) => con.has(s.id));
}

/** Las resistencias que se ofrecen para una solución: las de sus concretos (personalizado o sin backend: todas). */
export function resistenciasDe(solucionId: string | null): { fc: number[]; mr: number[] } {
  const todos = concretosDisponibles();
  const suyos = !concretosServidor() || !solucionId || solucionId === PERSONALIZADO.id ? todos : todos.filter((c) => c.soluciones.includes(solucionId));
  const de = (t: 'fc' | 'mr') => [...new Set(suyos.filter((c) => c.tipo === t).map((c) => c.kg))].sort((a, b) => a - b);
  return { fc: de('fc'), mr: de('mr') };
}


/**
 * La especificación sugerida de la solución, con una resistencia que sí exista para ella: la sugerida si está entre sus
 * concretos; si no, la más cercana del mismo tipo o, si no hay de ese tipo, la primera que tenga.
 */
export function sugeridaDisponible(s: Solucion): Solucion['sugerida'] {
  const r = resistenciasDe(s.id);
  const { tipoResistencia: tipo, resistenciaKgCm2: kg } = s.sugerida;
  if (r[tipo].includes(kg)) return structuredClone(s.sugerida);
  const mismas = r[tipo];
  if (mismas.length) {
    const cercana = mismas.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a));
    return { ...structuredClone(s.sugerida), resistenciaKgCm2: cercana };
  }
  const otro = tipo === 'fc' ? 'mr' : 'fc';
  return r[otro].length ? { ...structuredClone(s.sugerida), tipoResistencia: otro, resistenciaKgCm2: r[otro][0] } : structuredClone(s.sugerida);
}

/** El concreto de la lista con ese tipo y resistencia, si existe (si no, la configuración es un pedido especial). */
export function concretoExistente(tipo: 'fc' | 'mr', kg: number): ConcretoDisponible | null {
  return concretosDisponibles().find((c) => c.tipo === tipo && c.kg === kg) ?? null;
}
