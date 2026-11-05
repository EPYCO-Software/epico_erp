import { Construction, Fan, FlaskConical, HardHat, IconNode, Moon, Tractor, Truck, Vibrate } from 'lucide';
import {
  Aditivo,
  CotizacionGuardada,
  EspecificacionConcreto,
  Exposicion,
  Maquinaria,
  PartidaCotizacion,
  ServicioObra,
  Traslado,
} from '../models/cotizacion';
import { Obra } from '../models/obra';

/*
 * Formato y precios de una cotización, compartidos por el portal y el ERP para que los dos la muestren y la sumen
 * igual: etiquetas de la especificación, servicios y maquinaria, líneas con precio, totales con IVA y agrupación
 * por obra. ui-resumen-cotizacion los pinta.
 */

// shortcut: tarifario de REFERENCIA. Solo f'c 200 ($3,700/m³) y bombeo ($500/m³, mínimo 10 m³) salen de una
// cotización real (EPI-PRES-ESC-26085); el resto son valores de ejemplo. Reemplazar por la lista de precios
// que administre el ERP por planta. Los documentos indican que son precios sujetos a confirmación.
const PRECIO_FC: Record<number, number> = { 100: 3000, 150: 3350, 200: 3700, 250: 3950, 300: 4250, 350: 4600, 400: 5000 };
const PRECIO_MR: Record<number, number> = { 36: 3900, 40: 4100, 42: 4250, 45: 4450, 48: 4700 };
/** Resistencias que se pueden cotizar (las que tienen precio), de menor a mayor. */
export const RESISTENCIAS = { fc: Object.keys(PRECIO_FC).map(Number), mr: Object.keys(PRECIO_MR).map(Number) };
const AJUSTE_EDAD: Record<number, number> = { 28: 0, 14: 150, 7: 300, 3: 550 };
const AJUSTE_CEMENTO_RS = 250;
const AJUSTE_ADITIVO: Record<Aditivo, number> = {
  acelerante: 120,
  retardante: 100,
  impermeabilizante: 180,
  'fibra-sintetica': 150,
  'fibra-metalica': 600,
};
const MAQUINARIA_DIA: Record<Maquinaria, { nombre: string; precio: number }> = {
  aplanadora: { nombre: 'Renta de aplanadora', precio: 3500 },
  vibrador: { nombre: 'Renta de vibrador de concreto', precio: 600 },
  allanadora: { nombre: 'Renta de allanadora', precio: 1200 },
};

export const IVA = 0.16;

export interface Linea {
  concepto: string;
  unidad: string;
  precio: number;
  cantidad: number;
  importe: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;
const linea = (concepto: string, unidad: string, precio: number, cantidad: number): Linea => ({
  concepto,
  unidad,
  precio,
  cantidad,
  importe: redondear(precio * cantidad),
});

const ADITIVO_TEXTO: Record<Aditivo, string> = {
  acelerante: 'acelerante',
  retardante: 'retardante',
  impermeabilizante: 'impermeabilizante integral',
  'fibra-sintetica': 'fibra sintética',
  'fibra-metalica': 'fibra metálica',
};

/** Texto del concepto al estilo de la cotización impresa: "Concreto premezclado f´c: 200 kg/cm², Rev. 14 cm, Edad 28 días." */
export function conceptoConcreto(p: PartidaCotizacion): string {
  const e = p.especificacion;
  const partes = [
    `Concreto premezclado ${e.tipoResistencia === 'fc' ? 'f´c' : 'MR'}: ${e.resistenciaKgCm2} kg/cm²`,
    `Rev. ${e.revenimientoCm} cm`,
    `Edad ${e.edadDias} días`,
    `TMA ${e.tmaMm} mm`,
  ];
  if (e.cemento !== 'CPC 30R') partes.push(`cemento ${e.cemento}`);
  if (e.aditivos.length) partes.push(`con ${e.aditivos.map((a) => ADITIVO_TEXTO[a]).join(', ')}`);
  return partes.join(', ') + '.';
}

export function precioConcreto(p: PartidaCotizacion): number {
  const e = p.especificacion;
  const base = (e.tipoResistencia === 'fc' ? PRECIO_FC : PRECIO_MR)[e.resistenciaKgCm2] ?? 0;
  return (
    base +
    (AJUSTE_EDAD[e.edadDias] ?? 0) +
    (e.cemento === 'CPC 30R RS' ? AJUSTE_CEMENTO_RS : 0) +
    e.aditivos.reduce((t, a) => t + AJUSTE_ADITIVO[a], 0)
  );
}

/** Km que pasan de los incluidos, a un decimal (0 si está dentro del radio). */
export const kmExtra = (t: Traslado) => Math.max(0, Math.round((t.distanciaKm - t.incluidosKm) * 10) / 10);

/** Líneas de una partida: el concreto, el traslado si pasa del radio y, debajo, cada servicio con su unidad y mínimos. */
export function lineasPartida(p: PartidaCotizacion): Linea[] {
  const v = p.volumenM3;
  const r: Linea[] = [linea(conceptoConcreto(p), 'M³', p.precioM3 ?? precioConcreto(p), v)];
  const extra = p.traslado ? kmExtra(p.traslado) : 0;
  if (p.traslado && extra > 0 && p.traslado.precioKm > 0) {
    r.push(
      linea(
        `Traslado adicional: ${extra} km después de los ${p.traslado.incluidosKm} km incluidos ($${pesos(p.traslado.precioKm)} por km)`,
        'M³',
        redondear(extra * p.traslado.precioKm),
        v,
      ),
    );
  }
  const tiene = (s: ServicioObra) => p.servicios.includes(s);
  if (tiene('bomba-estacionaria')) r.push(linea('Servicio de Bombeo (10 m³ Mínimo)', 'M³', 500, Math.max(v, 10)));
  if (tiene('bomba-pluma')) r.push(linea('Servicio de Bomba Pluma (20 m³ Mínimo)', 'M³', 650, Math.max(v, 20)));
  if (tiene('colado-nocturno')) r.push(linea('Cargo por colado nocturno (18:00 a 07:00)', 'M³', 250, v));
  if (tiene('muestreo-laboratorio')) r.push(linea('Muestreo y ensaye de cilindros (7 y 28 días)', 'Servicio', 1800, 1));
  if (tiene('asesoria-tecnica')) r.push(linea('Asesoría técnica en obra', 'Visita', 2500, 1));
  for (const m of p.maquinaria) {
    const t = MAQUINARIA_DIA[m.tipo];
    r.push(linea(t.nombre, 'Día', t.precio, m.dias));
  }
  return r;
}

/** `descuentoPct` (0–100) se resta del subtotal antes del IVA; `descuento` es su importe. */
export function totales(lineas: Linea[], descuentoPct = 0): { subtotal: number; descuento: number; iva: number; neto: number } {
  const subtotal = redondear(lineas.reduce((t, l) => t + l.importe, 0));
  const descuento = redondear((subtotal * descuentoPct) / 100);
  const iva = redondear((subtotal - descuento) * IVA);
  return { subtotal, descuento, iva, neto: redondear(subtotal - descuento + iva) };
}

/** Totales de una cotización completa: las líneas de todas sus partidas y su descuento. */
export const totalesCotizacion = (c: Pick<CotizacionGuardada, 'partidas' | 'descuento'>) =>
  totales(c.partidas.flatMap(lineasPartida), c.descuento);

/**
 * Aceptar una cotización (portal) o confirmarla (ERP) genera un pedido por partida: cada una es una entrega con su
 * obra, fecha y volumen. Esto es lo que lleva cada pedido de su partida; el importe, con IVA y el descuento.
 */
export const pedidoDePartida = (p: PartidaCotizacion, descuento?: number) => ({
  partidaId: p.id,
  obraId: p.obraId,
  producto: `${p.nombre} · ${textoResistencia(p.especificacion)}`,
  volumenM3: p.volumenM3,
  fechaHoraEntrega: p.entrega,
  importe: totales(lineasPartida(p), descuento).neto,
});

/** $3,700.00 */
export const pesos = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface GrupoObra {
  obra: Obra;
  partidas: PartidaCotizacion[];
  volumen: number;
}

/** Partidas agrupadas por obra de entrega, en el orden en que se agregó la primera de cada una. */
export function agruparPorObra(partidas: PartidaCotizacion[], obras: Obra[]): GrupoObra[] {
  const grupos = new Map<string, GrupoObra>();
  for (const p of partidas) {
    const obra = obras.find((o) => o.id === p.obraId);
    if (!obra) continue;
    const g = grupos.get(obra.id) ?? { obra, partidas: [], volumen: 0 };
    g.partidas.push(p);
    g.volumen += p.volumenM3;
    grupos.set(obra.id, g);
  }
  return [...grupos.values()];
}

/**
 * 15/10/2026 08:00. Con offset (las entregas) se muestra la hora tal como se guardó, la de la obra, sin
 * convertirla a la zona del navegador; sin offset (UTC "Z") se muestra en hora local.
 */
export function fechaHoraCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*[+-]\d{2}:\d{2}$/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// shortcut: catálogo fijo en el front. Cuando la concretera administre servicios y maquinaria desde el ERP,
// cargarlo por HTTP con esta misma forma.
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

export function textoResistencia(e: Pick<EspecificacionConcreto, 'tipoResistencia' | 'resistenciaKgCm2'>): string {
  return `${e.tipoResistencia === 'fc' ? "f'c" : 'MR'} ${e.resistenciaKgCm2} kg/cm²`;
}

/** Etiquetas cortas para el resumen ("f'c 300 kg/cm²", "Rev. 10 cm", "Bombeo incluido"…). */
export function etiquetas(e: EspecificacionConcreto): string[] {
  const r = [textoResistencia(e)];
  if (e.edadDias !== 28) r.push(`Resistencia a ${e.edadDias} días`);
  r.push(`Rev. ${e.revenimientoCm} cm`, `TMA ${e.tmaMm} mm`);
  if (e.cemento !== 'CPC 30R') r.push(e.cemento);
  if (e.exposicion !== 'normal') r.push(EXPOSICIONES.find((x) => x.id === e.exposicion)!.label);
  for (const a of e.aditivos) r.push(ADITIVOS.find((x) => x.id === a)!.label);
  return r;
}

/** "Bombeo de concreto, Vibrador de concreto (2 días)": la renta de maquinaria se detalla por equipo. */
export function textoServicios(p: PartidaCotizacion): string {
  const sv = SERVICIOS.filter((s) => p.servicios.includes(s.id) && s.id !== 'renta-maquinaria').map((s) => s.nombre);
  const mq = p.maquinaria.map((m) => `${MAQUINARIA.find((x) => x.id === m.tipo)!.nombre} (${m.dias} ${m.dias === 1 ? 'día' : 'días'})`);
  return [...sv, ...mq].join(', ');
}
