import { Aditivo, Maquinaria, Obra, PartidaCotizacion, ServicioObra, UbicacionGps } from 'ui';

// shortcut: tarifario de REFERENCIA. Solo f'c 200 ($3,700/m³) y bombeo ($500/m³, mínimo 10 m³) salen de una
// cotización real (EPI-PRES-ESC-26085); el resto son valores de ejemplo. Reemplazar por la lista de precios
// que administre el ERP por planta. Los documentos indican que son precios sujetos a confirmación.
const PRECIO_FC: Record<number, number> = { 100: 3000, 150: 3350, 200: 3700, 250: 3950, 300: 4250, 350: 4600, 400: 5000 };
const PRECIO_MR: Record<number, number> = { 36: 3900, 40: 4100, 42: 4250, 45: 4450, 48: 4700 };
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

/** Líneas de una partida: el concreto y, debajo, cada servicio con su unidad y mínimos. */
export function lineasPartida(p: PartidaCotizacion): Linea[] {
  const v = p.volumenM3;
  const r: Linea[] = [linea(conceptoConcreto(p), 'M³', precioConcreto(p), v)];
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

export function totales(lineas: Linea[]): { subtotal: number; iva: number; neto: number } {
  const subtotal = redondear(lineas.reduce((t, l) => t + l.importe, 0));
  const iva = redondear(subtotal * IVA);
  return { subtotal, iva, neto: redondear(subtotal + iva) };
}

/** $3,700.00 */
export const pesos = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Planta que atiende según el municipio de la obra (encabezado y clave del folio). */
export interface PlantaContacto {
  clave: string;
  nombre: string;
  telefonos: string;
  correos: string;
  /** Zona IANA de la planta (CLAUDE.md: la hora que se muestra es la de la planta). */
  zonaHoraria: string;
  /** shortcut: coordenadas aproximadas de la planta (salida de los camiones); reemplazar por las reales. */
  ubicacion?: UbicacionGps;
}

// Contacto tomado de la cotización real de Planta Escárcega; para las demás plantas solo el correo general.
const TELEFONOS = 'Cel. 987 8739361, Tel. 987 1170185';
const PLANTAS: (PlantaContacto & { coincide: RegExp })[] = [
  { clave: 'ESC', nombre: 'PLANTA ESCARCEGA', coincide: /esc[aá]rcega/i, zonaHoraria: 'America/Merida', ubicacion: { lat: 18.6101, lng: -90.7352 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com, ventas.escarcega@epiconconcretos.com' },
  { clave: 'CZM', nombre: 'PLANTA COZUMEL', coincide: /cozumel/i, zonaHoraria: 'America/Cancun', ubicacion: { lat: 20.4878, lng: -86.9422 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
  { clave: 'XPJ', nombre: 'PLANTA XPUJIL', coincide: /xpujil/i, zonaHoraria: 'America/Merida', telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
];
const GENERAL: PlantaContacto = { clave: 'GEN', nombre: 'EPICO CONCRETOS', zonaHoraria: 'America/Merida', telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' };

export function plantaPara(obra: Pick<Obra, 'municipio'> | null | undefined): PlantaContacto {
  const p = obra ? PLANTAS.find((x) => x.coincide.test(obra.municipio)) : undefined;
  return p ? { clave: p.clave, nombre: p.nombre, zonaHoraria: p.zonaHoraria, ubicacion: p.ubicacion, telefonos: p.telefonos, correos: p.correos } : GENERAL;
}

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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "30 de septiembre del 2026", como en la cotización impresa. */
export const fechaLarga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`;
