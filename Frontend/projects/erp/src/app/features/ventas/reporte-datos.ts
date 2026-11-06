import { CATEGORIAS_PRODUCTO, CategoriaProducto, PRODUCTOS, pesos } from 'ui';
import { RAZONES_SOCIALES } from '../../core/plantas';
import { CLIENTES, VENDEDORES } from './datos';

/**
 * Datos del Análisis de ventas (Reportes → Ventas): cada venta como líneas (concreto, bombeo…) con su fecha de entrega,
 * planta, cliente, producto, vendedor, m³ e importe sin IVA; los periodos rápidos; el filtro; y la agrupación de
 * tabla dinámica (filas × columnas de una medida) que usan la gráfica, la tabla y el CSV.
 */

export interface LineaVenta {
  folio: string;
  /** AAAA-MM-DD, la de entrega. */
  fecha: string;
  plantaId: string;
  clienteId: string;
  productoId: string;
  categoria: CategoriaProducto;
  vendedorId: string;
  cantidad: number;
  unidad: string;
  /** Solo las líneas de concreto llevan m³ (el bombeo no los suma). */
  m3: number;
  /** Sin IVA. */
  importe: number;
}

// ---------- Fechas (AAAA-MM-DD, en UTC para no moverse con la zona) ----------

const DIA = 86_400_000;
const ms = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const iso = (n: number) => new Date(n).toISOString().slice(0, 10);
export const sumarDias = (f: string, n: number) => iso(ms(f) + n * DIA);
export const diasEntre = (desde: string, hasta: string) => Math.round((ms(hasta) - ms(desde)) / DIA) + 1;
/** Hoy en la zona del navegador. */
export const hoy = () => new Date().toLocaleDateString('en-CA');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "6 nov 2026"; sin año si se pide. */
export function fechaCorta(f: string, conAnio = true): string {
  const texto = `${+f.slice(8, 10)} ${MESES[+f.slice(5, 7) - 1]}`;
  return conAnio ? `${texto} ${f.slice(0, 4)}` : texto;
}

// ---------- Periodos ----------

export type Periodo = 'este-mes' | 'mes-pasado' | 'ultimos-30' | 'este-trimestre' | 'este-anio' | 'anio-pasado' | 'ultimos-12' | 'personalizado';
export const PERIODOS: Record<Periodo, string> = {
  'este-mes': 'Este mes',
  'mes-pasado': 'Mes pasado',
  'ultimos-30': 'Últimos 30 días',
  'este-trimestre': 'Este trimestre',
  'este-anio': 'Este año',
  'anio-pasado': 'Año pasado',
  'ultimos-12': 'Últimos 12 meses',
  personalizado: 'Personalizado',
};

export interface Rango {
  desde: string;
  hasta: string;
}

/** Las fechas de un periodo rápido (hasta hoy, si está en curso). */
export function rangoDe(p: Exclude<Periodo, 'personalizado'>, h: string): Rango {
  const y = +h.slice(0, 4);
  const m = +h.slice(5, 7);
  const primero = (anio: number, mes: number) => iso(Date.UTC(anio, mes - 1, 1));
  switch (p) {
    case 'este-mes':
      return { desde: primero(y, m), hasta: h };
    case 'mes-pasado':
      return { desde: primero(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), hasta: sumarDias(primero(y, m), -1) };
    case 'ultimos-30':
      return { desde: sumarDias(h, -29), hasta: h };
    case 'este-trimestre':
      return { desde: primero(y, Math.floor((m - 1) / 3) * 3 + 1), hasta: h };
    case 'este-anio':
      return { desde: primero(y, 1), hasta: h };
    case 'anio-pasado':
      return { desde: primero(y - 1, 1), hasta: `${y - 1}-12-31` };
    case 'ultimos-12':
      return { desde: iso(Date.UTC(y, m - 12, 1)), hasta: h };
  }
}

/** El periodo anterior del mismo largo, para comparar. */
export function rangoAnterior(r: Rango): Rango {
  const hasta = sumarDias(r.desde, -1);
  return { desde: sumarDias(hasta, -(diasEntre(r.desde, r.hasta) - 1)), hasta };
}

/** Las mismas fechas un año antes (el 29 de febrero pasa al 28): compara sin el efecto de la temporada. */
export function rangoAnioAnterior(r: Rango): Rango {
  const menosUno = (f: string) => {
    const s = `${+f.slice(0, 4) - 1}${f.slice(4)}`;
    return s.endsWith('-02-29') ? s.replace('-02-29', '-02-28') : s;
  };
  return { desde: menosUno(r.desde), hasta: menosUno(r.hasta) };
}

export type Comparar = 'anterior' | 'anio';
export const COMPARAR: Record<Comparar, string> = { anterior: 'Periodo anterior', anio: 'Mismo periodo del año pasado' };

export const textoRango = (r: Rango) => `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;

// ---------- Filtro ----------

export interface Filtro extends Rango {
  /** Vacío = todas. */
  plantas: string[];
  /** '' todos, 'cat:…' una categoría o 'prod:…' un producto. */
  aplica: string;
  vendedor: string;
  cliente: string;
}

export function filtrar(lineas: LineaVenta[], f: Filtro): LineaVenta[] {
  const [clase, id] = f.aplica.split(':');
  return lineas.filter(
    (l) =>
      l.fecha >= f.desde &&
      l.fecha <= f.hasta &&
      (!f.plantas.length || f.plantas.includes(l.plantaId)) &&
      (!f.aplica || (clase === 'cat' ? l.categoria === id : l.productoId === id)) &&
      (!f.vendedor || l.vendedorId === f.vendedor) &&
      (!f.cliente || l.clienteId === f.cliente),
  );
}

// ---------- Medidas ----------

export type Medida = 'importe' | 'm3' | 'ordenes' | 'precio' | 'clientes';

/** Nombre, formato completo y si se puede sumar (apilar, participación, totales por suma). */
export const MEDIDAS: Record<Medida, { nombre: string; formato: (n: number) => string; corto: (n: number) => string; sumable: boolean }> = {
  importe: { nombre: 'Importe (sin IVA)', formato: (n) => `$${pesos(n)}`, corto: (n) => '$' + compacto(n), sumable: true },
  m3: { nombre: 'm³ vendidos', formato: (n) => `${miles(n, 1)} m³`, corto: (n) => compacto(n) + ' m³', sumable: true },
  ordenes: { nombre: 'Órdenes', formato: (n) => miles(n, 0), corto: (n) => compacto(n), sumable: false },
  precio: { nombre: 'Precio promedio por m³', formato: (n) => `$${pesos(n)}`, corto: (n) => '$' + compacto(n), sumable: false },
  clientes: { nombre: 'Clientes con compras', formato: (n) => miles(n, 0), corto: (n) => compacto(n), sumable: false },
};

const miles = (n: number, decimales: number) => n.toLocaleString('es-MX', { maximumFractionDigits: decimales });
/** 1,250 → "1,250"; 85,000 → "85 k"; 1,250,000 → "1.25 M". */
export function compacto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${miles(n / 1e6, 2)} M`;
  if (a >= 1e4) return `${miles(n / 1e3, 0)} k`;
  return miles(n, 0);
}

/** El valor de la medida para esas líneas. Órdenes cuenta folios distintos; el precio es importe de concreto / m³. */
export function medir(lineas: LineaVenta[], medida: Medida): number {
  switch (medida) {
    case 'importe':
      return Math.round(lineas.reduce((t, l) => t + l.importe, 0) * 100) / 100;
    case 'm3':
      return Math.round(lineas.reduce((t, l) => t + l.m3, 0) * 10) / 10;
    case 'ordenes':
      return new Set(lineas.map((l) => l.folio)).size;
    case 'clientes':
      return new Set(lineas.map((l) => l.clienteId)).size;
    case 'precio': {
      const concreto = lineas.filter((l) => l.m3 > 0);
      const m3 = concreto.reduce((t, l) => t + l.m3, 0);
      return m3 ? Math.round((concreto.reduce((t, l) => t + l.importe, 0) / m3) * 100) / 100 : 0;
    }
  }
}

// ---------- Dimensiones y agrupación ----------

export type Dimension = 'mes' | 'semana' | 'dia' | 'planta' | 'categoria' | 'producto' | 'cliente' | 'vendedor';
/** Las que separan series: entidades fijas, para que cada una conserve su color (máx. 8). */
export type DimensionSerie = 'planta' | 'categoria' | 'vendedor';

export const DIMENSIONES: Record<Dimension, string> = {
  mes: 'Mes',
  semana: 'Semana',
  dia: 'Día',
  planta: 'Planta',
  categoria: 'Categoría',
  producto: 'Producto',
  cliente: 'Cliente',
  vendedor: 'Vendedor',
};
export const DE_TIEMPO: Dimension[] = ['mes', 'semana', 'dia'];

/** Mes, semana o día según el largo del periodo. */
export const granularidad = (r: Rango): Dimension => {
  const d = diasEntre(r.desde, r.hasta);
  return d <= 31 ? 'dia' : d <= 120 ? 'semana' : 'mes';
};

const PLANTAS = RAZONES_SOCIALES.flatMap((r) => r.plantas);
/** Orden fijo de cada entidad que puede ser serie: de él sale su color. */
export const ORDEN_SERIE: Record<DimensionSerie, string[]> = {
  planta: PLANTAS.map((p) => p.id),
  // Las que se venden juntas (concreto f´c, MR y bombeo) en los colores 1-3, que se distinguen entre todos
  categoria: ['concreto-fc', 'concreto-mr', 'servicio', 'maquinaria', 'ajuste', 'concreto', 'general'],
  vendedor: Object.keys(VENDEDORES),
};

/** Paleta categórica validada (orden fijo; el color sigue a la entidad, no a su lugar). */
export const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const COLOR_OTROS = '#8b8a85';

export interface Nombres {
  producto: Record<string, string>;
  cliente: Record<string, string>;
}

export interface Grupo {
  id: string;
  nombre: string;
  color?: string;
}

export interface Tabla {
  filas: Grupo[];
  columnas: Grupo[];
  /** celdas[fila][columna] */
  celdas: number[][];
  totalFila: number[];
  totalColumna: number[];
  total: number;
}

const OTROS = '__otros';

/** Map.groupBy (ES2024), que el target ES2022 aún no trae. */
function agruparPor<T>(lista: T[], clave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = clave(x);
    const grupo = m.get(k);
    if (grupo) grupo.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/** La clave de la línea en esa dimensión (en las de tiempo, el inicio del mes, semana o día). */
function clave(l: LineaVenta, d: Dimension): string {
  switch (d) {
    case 'mes':
      return l.fecha.slice(0, 7);
    case 'semana':
      return sumarDias(l.fecha, -((new Date(ms(l.fecha)).getUTCDay() + 6) % 7));
    case 'dia':
      return l.fecha;
    case 'planta':
      return l.plantaId;
    case 'categoria':
      return l.categoria;
    case 'producto':
      return l.productoId;
    case 'cliente':
      return l.clienteId;
    case 'vendedor':
      return l.vendedorId;
  }
}

export function nombreDe(d: Dimension, id: string, n: Nombres): string {
  if (id === OTROS) return 'Otros';
  switch (d) {
    case 'mes':
      return `${MESES[+id.slice(5, 7) - 1]} ${id.slice(0, 4)}`;
    case 'semana':
      return `Sem. ${fechaCorta(id, false)}`;
    case 'dia':
      return fechaCorta(id, false);
    case 'planta':
      return PLANTAS.find((p) => p.id === id)?.nombre.replace('Planta ', '') ?? id;
    case 'categoria':
      return CATEGORIAS_PRODUCTO[id as CategoriaProducto] ?? id;
    case 'producto':
      return n.producto[id] ?? id;
    case 'cliente':
      return n.cliente[id] ?? CLIENTES_HISTORIAL[id] ?? id;
    case 'vendedor':
      return VENDEDORES[id] ?? id;
  }
}

/** Todas las claves de tiempo del rango, en orden (para que los meses sin ventas salgan en cero). */
function clavesDeTiempo(d: Dimension, r: Rango): string[] {
  const claves = new Set<string>();
  for (let f = r.desde; f <= r.hasta; f = sumarDias(f, 1)) {
    claves.add(clave({ fecha: f } as LineaVenta, d));
  }
  return [...claves];
}

export interface OpcionesTabla {
  filas: Dimension;
  columnas: DimensionSerie | null;
  medida: Medida;
  rango: Rango;
  nombres: Nombres;
  /** En las que no son de tiempo: de mayor a menor (o al revés) por su total, o por su clave (fc-100, fc-150…). */
  orden: 'desc' | 'asc' | 'clave';
  /** En las que no son de tiempo: las primeras N y el resto en "Otros". */
  maximo?: number;
}

/** La tabla dinámica: cada celda medida sobre sus propias líneas (así el precio promedio y las órdenes cuadran). */
export function agrupar(lineas: LineaVenta[], o: OpcionesTabla): Tabla {
  const tiempo = DE_TIEMPO.includes(o.filas);
  let filas: string[];
  if (tiempo) {
    filas = clavesDeTiempo(o.filas, o.rango);
  } else {
    const porFila = agruparPor(lineas, (l) => clave(l, o.filas));
    filas = [...porFila.keys()].sort((a, b) => {
      if (o.orden === 'clave') return a.localeCompare(b, 'es', { numeric: true });
      const dif = medir(porFila.get(b)!, o.medida) - medir(porFila.get(a)!, o.medida);
      return o.orden === 'desc' ? dif : -dif;
    });
    if (o.maximo && filas.length > o.maximo) filas = [...filas.slice(0, o.maximo - 1), OTROS];
  }
  const filaDe = (l: LineaVenta) => {
    const k = clave(l, o.filas);
    return !tiempo && filas.at(-1) === OTROS && !filas.includes(k) ? OTROS : k;
  };

  const presentes = o.columnas ? new Set(lineas.map((l) => clave(l, o.columnas!))) : null;
  const columnas: Grupo[] = o.columnas
    ? ORDEN_SERIE[o.columnas]
        .map((id, i) => ({ id, nombre: nombreDe(o.columnas!, id, o.nombres), color: COLORES[i] ?? COLOR_OTROS }))
        .filter((c) => presentes!.has(c.id))
    : [{ id: 'total', nombre: MEDIDAS[o.medida].nombre, color: COLORES[0] }];
  const columnaDe = (l: LineaVenta) => (o.columnas ? clave(l, o.columnas) : 'total');

  const cubetas = agruparPor(lineas, (l) => `${filaDe(l)}|${columnaDe(l)}`);
  const porFila = agruparPor(lineas, filaDe);
  const porColumna = agruparPor(lineas, columnaDe);
  return {
    filas: filas.map((id) => ({ id, nombre: nombreDe(o.filas, id, o.nombres) })),
    columnas,
    celdas: filas.map((f) => columnas.map((c) => medir(cubetas.get(`${f}|${c.id}`) ?? [], o.medida))),
    totalFila: filas.map((f) => medir(porFila.get(f) ?? [], o.medida)),
    totalColumna: columnas.map((c) => medir(porColumna.get(c.id) ?? [], o.medida)),
    total: medir(lineas, o.medida),
  };
}

/** La tabla como lo que pide la gráfica: etiquetas (filas) y una serie por columna. */
export function aSeries(t: Tabla): { etiquetas: string[]; series: { id: string; nombre: string; color: string; valores: number[] }[] } {
  return {
    etiquetas: t.filas.map((f) => f.nombre),
    series: t.columnas.map((c, j) => ({ id: c.id, nombre: c.nombre, color: c.color ?? COLORES[0], valores: t.celdas.map((fila) => fila[j]) })),
  };
}

/** El color fijo de una entidad (el mismo en todos los reportes). */
export const colorDe = (d: DimensionSerie, id: string) => COLORES[ORDEN_SERIE[d].indexOf(id)] ?? COLOR_OTROS;

// ---------- Resumen por entidad (las tablas de Vendedores, Productos y Clientes) ----------

export interface Resumen {
  id: string;
  nombre: string;
  importe: number;
  m3: number;
  /** En la unidad de la línea (m³ del concreto y del bombeo). */
  cantidad: number;
  ordenes: number;
  clientes: number;
  plantas: string[];
  /** Importe / órdenes. */
  ticket: number;
  /** Importe de concreto / m³. */
  precio: number;
  /** Lo que habría costado a precio de lista (del tarifario), para ver el descuento dado. */
  lista: number;
  /** AAAA-MM-DD de la primera y la última venta dentro de las líneas. */
  primera: string;
  ultima: string;
}

/** Un renglón por entidad de la dimensión (vendedor, producto, cliente…), de mayor a menor importe. */
export function resumir(lineas: LineaVenta[], d: Dimension, nombres: Nombres, precios: Record<string, number>): Resumen[] {
  return [...agruparPor(lineas, (l) => clave(l, d))]
    .map(([id, ls]) => {
      const importe = medir(ls, 'importe');
      const ordenes = medir(ls, 'ordenes');
      const fechas = ls.map((l) => l.fecha).sort();
      return {
        id,
        nombre: nombreDe(d, id, nombres),
        importe,
        m3: medir(ls, 'm3'),
        cantidad: Math.round(ls.reduce((t, l) => t + l.cantidad, 0) * 10) / 10,
        ordenes,
        clientes: medir(ls, 'clientes'),
        plantas: [...new Set(ls.map((l) => l.plantaId))],
        ticket: ordenes ? Math.round((importe / ordenes) * 100) / 100 : 0,
        precio: medir(ls, 'precio'),
        lista: Math.round(ls.reduce((t, l) => t + (precios[l.productoId] ?? 0) * l.cantidad, 0) * 100) / 100,
        primera: fechas[0],
        ultima: fechas.at(-1)!,
      };
    })
    .sort((a, b) => b.importe - a.importe);
}

/** Cambio en % contra la comparación; null si antes no hubo (no se puede dividir). */
export const variacion = (actual: number, antes: number): number | null => (antes ? ((actual - antes) / antes) * 100 : null);

/** "+12.3 %", "−4 %", "Nuevo" (antes no hubo) o "—" (ni antes ni ahora). */
export function textoVariacion(v: number | null, actual = 1): string {
  if (v === null) return actual ? 'Nuevo' : '—';
  const n = Math.abs(v).toLocaleString('es-MX', { maximumFractionDigits: 1 });
  return Math.abs(v) < 0.05 ? '0 %' : `${v > 0 ? '+' : '−'}${n} %`;
}

/** Verde si sube, rojo si baja (con el signo en el texto: no solo color). */
export const claseVariacion = (v: number | null) => (v === null || Math.abs(v) < 0.5 ? 'text-texto-suave' : v > 0 ? 'text-[#2E5E4A]' : 'text-[#8E332C]');

/** Precio obtenido contra lista: −3.2 % = se vendió 3.2 % abajo de lista. */
export const contraLista = (r: Pick<Resumen, 'importe' | 'lista'>) => (r.lista ? ((r.importe - r.lista) / r.lista) * 100 : null);

/** % de las órdenes con concreto que llevaron bombeo. */
export function conBombeo(lineas: LineaVenta[]): number {
  const concreto = new Set(lineas.filter((l) => l.m3 > 0).map((l) => l.folio));
  const bombeo = new Set(lineas.filter((l) => l.productoId.startsWith('servicio-bomba')).map((l) => l.folio));
  return concreto.size ? ([...concreto].filter((f) => bombeo.has(f)).length / concreto.size) * 100 : 0;
}

export const porcentaje = (n: number, decimales = 1) => `${n.toLocaleString('es-MX', { maximumFractionDigits: decimales })} %`;

// ---------- CSV (se abre en Excel o Google Sheets) ----------

export function csv(encabezados: string[], filas: (string | number)[][]): string {
  const celda = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replaceAll('"', '""')}"`);
  // BOM para que Excel lea los acentos
  return '﻿' + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
}

export function descargar(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Historial de ventas de demostración ----------

/**
 * shortcut: clientes que solo existen en el historial de demostración (para que el reporte de clientes tenga una
 * cartera realista: pocos grandes, muchos chicos, algunos nuevos y otros que dejaron de comprar). No tienen ficha.
 */
export const CLIENTES_HISTORIAL: Record<string, string> = {
  'h-ica': 'Ingenieros Constructores del Caribe',
  'h-mendez': 'Construcciones Méndez',
  'h-pavimentos': 'Pavimentos Peninsulares',
  'h-riviera': 'Desarrollos Riviera',
  'h-chan': 'Edificaciones Chan',
  'h-ayto-esc': 'Ayuntamiento de Escárcega',
  'h-tulum': 'Inmobiliaria Tulum Norte',
  'h-cancun-obras': 'Obras y Proyectos Cancún',
  'h-cimientos': 'Cimientos del Sureste',
  'h-ku': 'Arq. Ku y Asociados',
  'h-hotelera': 'Hotelera Costa Mujeres',
  'h-puentes': 'Puentes y Caminos de Campeche',
  'h-uc': 'Familia Uc (vivienda)',
  'h-dzib': 'Ferretería Dzib',
  'h-maya-tren': 'Consorcio Vía Maya',
  'h-xpujil': 'Constructora Xpujil',
  'h-cozumel-port': 'Terminal Cozumel',
  'h-pech': 'Ing. Pech Ramírez',
};

/** Generador con semilla: el mismo historial en cada carga y en las pruebas. */
function aleatorio(semilla: number): () => number {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const elegir = <T>(r: () => number, opciones: [T, number][]): T => {
  let x = r() * opciones.reduce((t, [, p]) => t + p, 0);
  for (const [v, p] of opciones) if ((x -= p) <= 0) return v;
  return opciones[0][0];
};

/**
 * shortcut: historial de ventas inventado (unos 3 años, ~6,500 líneas: alcanza para comparar "Año pasado" con el
 * anterior) para que el reporte tenga datos; con backend,
 * vendrá de las órdenes entregadas. Con semilla fija: siempre el mismo. Más ventas en temporada seca (feb-may),
 * menos en lluvias (sep-oct), crecimiento de ~12 % anual; Cancún y Escárcega las plantas grandes.
 */
export function historialDemo(hasta: string, dias = 1100): LineaVenta[] {
  const r = aleatorio(26);
  const precio = (id: string) => PRODUCTOS.find((p) => p.id === id)!.precio;
  const plantas: [string, number, number][] = [
    ['ESC', 1.5, 1],
    ['XPJ', 0.55, 1.04],
    ['CZM', 0.8, 1.18],
    ['CUN', 1.9, 1.08],
  ];
  const temporada = [0.9, 1.05, 1.15, 1.2, 1.15, 1, 0.9, 0.85, 0.72, 0.78, 0.95, 0.85];
  const productos: [string, number][] = [
    ['fc-200', 22],
    ['fc-250', 28],
    ['fc-300', 20],
    ['fc-150', 8],
    ['fc-350', 7],
    ['fc-100', 4],
    ['mr-42', 5],
    ['mr-45', 4],
    ['fc-400', 2],
  ];
  const vendedores = Object.keys(VENDEDORES);
  const pesoVendedor = [2, 30, 25, 25, 18];
  // Cartera tipo Pareto: el peso baja con el lugar; unos empiezan a medio periodo (nuevos) y otros dejan de comprar
  const cartera = [...CLIENTES.map((c) => c.id), ...Object.keys(CLIENTES_HISTORIAL)].map((id, i) => ({
    id,
    peso: 30 / (i + 1.5),
    desde: i % 6 === 5 ? 0.85 : i % 4 === 3 ? 0.4 : 0,
    hasta: i % 7 === 4 ? 0.88 : 1,
  }));
  const lineas: LineaVenta[] = [];
  let n = 1000;
  const inicio = sumarDias(hasta, -dias);
  for (let f = inicio; f <= hasta; f = sumarDias(f, 1)) {
    const semana = new Date(ms(f)).getUTCDay();
    const dia = semana === 0 ? 0.15 : semana === 6 ? 0.55 : 1;
    // 0 el primer día, 1 el último
    const avance = (diasEntre(inicio, f) - 1) / dias;
    const crecimiento = 1 + (0.12 * diasEntre(inicio, f)) / 365;
    const clientes = cartera.filter((c) => avance >= c.desde && avance <= c.hasta).map((c): [string, number] => [c.id, c.peso]);
    for (const [plantaId, base, factor] of plantas) {
      const esperado = base * dia * temporada[+f.slice(5, 7) - 1] * crecimiento;
      const ordenes = Math.floor(esperado + r());
      for (let i = 0; i < ordenes; i++) {
        const folio = `PED-${f.slice(2, 4)}-${String(n++).padStart(4, '0')}`;
        const productoId = elegir(r, productos);
        const m3 = Math.round((2 + r() ** 2 * 38) * 2) / 2;
        const pu = Math.round((precio(productoId) * factor * (1 - r() * 0.07)) / 10) * 10;
        const comun = { folio, fecha: f, plantaId, clienteId: elegir(r, clientes), vendedorId: elegir(r, vendedores.map((v, j): [string, number] => [v, pesoVendedor[j] ?? 10])) };
        lineas.push({ ...comun, productoId, categoria: productoId.startsWith('mr') ? 'concreto-mr' : 'concreto-fc', cantidad: m3, unidad: 'M³', m3, importe: m3 * pu });
        if (r() < 0.35) {
          const bomba = m3 >= 15 ? 'servicio-bomba-pluma' : 'servicio-bomba-estacionaria';
          lineas.push({ ...comun, productoId: bomba, categoria: 'servicio', cantidad: m3, unidad: 'M³', m3: 0, importe: Math.round(m3 * precio(bomba) * factor) });
        }
      }
    }
  }
  return lineas;
}
