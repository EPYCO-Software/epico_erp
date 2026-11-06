import { Service, inject, signal } from '@angular/core';
import { Boxes, CreditCard, Megaphone, Stamp, Ticket, TicketPercent, Tickets } from 'lucide';
import { CATEGORIAS_PRODUCTO, CategoriaProducto, ProductoTarifa, pesos } from 'ui';
import { HistorialService } from '../../core/historial';
import { VentasService, registro } from './datos';

/** Las 7 plantillas de Odoo (Descuentos y programas de lealtad). */
export type TipoPrograma = 'promocion' | 'codigo' | 'compra-x' | 'proxima-orden' | 'lealtad' | 'cupones' | 'sellos';

/** Qué recibe el cliente: % sobre lo que aplica, un monto, o el traslado (flete) gratis. */
export type TipoRecompensa = 'porcentaje' | 'monto' | 'traslado';
export const RECOMPENSAS: Record<TipoRecompensa, string> = { porcentaje: 'Descuento en %', monto: 'Descuento en $', traslado: 'Traslado gratis' };

export interface Cupon {
  codigo: string;
  usado: boolean;
}

/**
 * Un programa. Los campos que usa cada tipo:
 * - promocion: compraMinima → recompensa (automática).
 * - codigo: codigo + compraMinima → recompensa.
 * - compra-x: por cada cantidadX unidades de lo que aplica, cantidadY gratis (la más barata).
 * - proxima-orden: con compraMinima se gana un cupón (cupones) con la recompensa para la siguiente orden.
 * - lealtad: 1 punto por cada pesosPorPunto; con puntosCanje puntos se canjea la recompensa (monto).
 * - cupones: códigos únicos (cupones) que dan la recompensa una vez cada uno.
 * - sellos: 1 sello por unidad de lo que aplica; con meta sellos, la recompensa en esa orden.
 * Aplica a: productoId, o categoria, o todo (ambos vacíos).
 */
export interface Programa {
  id: string;
  nombre: string;
  tipo: TipoPrograma;
  activo: boolean;
  inicio: string;
  fin: string;
  productoId: string;
  categoria: CategoriaProducto | '';
  compraMinima: number;
  codigo: string;
  cantidadX: number;
  cantidadY: number;
  recompensa: TipoRecompensa;
  valor: number;
  pesosPorPunto: number;
  puntosCanje: number;
  meta: number;
  cupones: Cupon[];
}

export interface Plantilla {
  tipo: TipoPrograma;
  nombre: string;
  descripcion: string;
  icono: typeof Megaphone;
  base: Partial<Programa>;
}

/** Como las de Odoo, con ejemplos de concretera. */
export const PLANTILLAS: Plantilla[] = [
  {
    tipo: 'promocion',
    nombre: 'Programa promocional',
    descripcion: 'Promoción automática: traslado gratis en órdenes desde $50,000.',
    icono: Megaphone,
    base: { nombre: 'Traslado gratis desde $50,000', compraMinima: 50000, recompensa: 'traslado' },
  },
  {
    tipo: 'codigo',
    nombre: 'Código promocional',
    descripcion: 'Obtenga 10 % de descuento en algunos productos con un código.',
    icono: TicketPercent,
    base: { nombre: 'Código CONCRETO10', codigo: 'CONCRETO10', categoria: 'concreto-fc', recompensa: 'porcentaje', valor: 10 },
  },
  {
    tipo: 'compra-x',
    nombre: 'Comprar X y recibir Y',
    descripcion: 'Compre 2 productos y obtenga el tercero gratis.',
    icono: Boxes,
    base: { nombre: 'Compre 2 y el tercero gratis', cantidadX: 2, cantidadY: 1 },
  },
  {
    tipo: 'proxima-orden',
    nombre: 'Cupón de la próxima orden',
    descripcion: 'Enviar un cupón después de una orden de compra, válido para la compra siguiente.',
    icono: Ticket,
    base: { nombre: '5 % en su próxima orden', compraMinima: 30000, recompensa: 'porcentaje', valor: 5 },
  },
  {
    tipo: 'lealtad',
    nombre: 'Tarjeta de lealtad',
    descripcion: 'Gane puntos con cada compra y obtenga regalos.',
    icono: CreditCard,
    base: { nombre: 'Puntos EPICO', pesosPorPunto: 100, puntosCanje: 500, recompensa: 'monto', valor: 2500 },
  },
  {
    tipo: 'cupones',
    nombre: 'Cupón',
    descripcion: 'Genere y comparta cupones únicos con sus clientes.',
    icono: Tickets,
    base: { nombre: 'Cupones 10 %', recompensa: 'porcentaje', valor: 10 },
  },
  {
    tipo: 'sellos',
    nombre: 'Tarjeta de sellos',
    descripcion: 'Compre 10 productos para obtener 10 % de descuento en el 11°.',
    icono: Stamp,
    base: { nombre: '10 % al completar 10 sellos', meta: 10, recompensa: 'porcentaje', valor: 10 },
  },
];

export const plantilla = (tipo: TipoPrograma) => PLANTILLAS.find((p) => p.tipo === tipo)!;

const VACIO: Omit<Programa, 'id' | 'tipo'> = {
  nombre: '',
  activo: true,
  inicio: '',
  fin: '',
  productoId: '',
  categoria: '',
  compraMinima: 0,
  codigo: '',
  cantidadX: 0,
  cantidadY: 0,
  recompensa: 'porcentaje',
  valor: 0,
  pesosPorPunto: 0,
  puntosCanje: 0,
  meta: 0,
  cupones: [],
};

/** Un programa nuevo de esa plantilla, con sus valores de ejemplo. */
export const desdePlantilla = (tipo: TipoPrograma): Omit<Programa, 'id'> => ({ ...VACIO, ...plantilla(tipo).base, tipo });

// ---------- La lógica: qué da cada programa a una orden ----------

export interface LineaOrden {
  productoId: string;
  categoria: CategoriaProducto;
  cantidad: number;
  precio: number;
}

export interface ContextoOrden {
  /** Código que escribió el cliente (código promocional o cupón). */
  codigo: string;
  /** Puntos o sellos que ya tiene el cliente en este programa. */
  saldo: number;
  /** Cargo por traslado de la orden (para "traslado gratis"). */
  traslado: number;
  /** AAAA-MM-DD */
  fecha: string;
}

export interface Resultado {
  aplica: boolean;
  descuento: number;
  /** Por qué sí o por qué no, en una línea. */
  motivo: string;
  /** Lo que gana para después: puntos, sellos o un cupón. */
  gana: string;
}

const aplicaA = (p: Pick<Programa, 'productoId' | 'categoria'>, l: LineaOrden) =>
  p.productoId ? l.productoId === p.productoId : p.categoria ? l.categoria === p.categoria : true;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** El descuento de la recompensa: % sobre lo que aplica, monto (sin pasar del total) o el traslado. */
function recompensa(p: Programa, base: number, subtotal: number, ctx: ContextoOrden): number {
  if (p.recompensa === 'porcentaje') return redondear((base * p.valor) / 100);
  if (p.recompensa === 'monto') return Math.min(p.valor, subtotal);
  return ctx.traslado;
}

/** Qué da el programa a esta orden. Puro: no usa cupones ni suma puntos (eso lo hace quien registra la orden). */
export function evaluar(p: Programa, lineas: LineaOrden[], ctx: ContextoOrden): Resultado {
  const no = (motivo: string, gana = ''): Resultado => ({ aplica: false, descuento: 0, motivo, gana });
  if (!p.activo) return no('El programa está archivado.');
  if ((p.inicio && ctx.fecha < p.inicio) || (p.fin && ctx.fecha > p.fin)) return no('Fuera de su vigencia.');

  const subtotal = lineas.reduce((t, l) => t + l.cantidad * l.precio, 0);
  const suyas = lineas.filter((l) => aplicaA(p, l));
  const base = suyas.reduce((t, l) => t + l.cantidad * l.precio, 0);
  const unidades = suyas.reduce((t, l) => t + l.cantidad, 0);
  const si = (descuento: number, motivo: string, gana = ''): Resultado => ({ aplica: true, descuento: Math.min(redondear(descuento), subtotal), motivo, gana });
  const minimo = () => (subtotal < p.compraMinima ? `Faltan $${pesos(p.compraMinima - subtotal)} para la compra mínima.` : '');
  const cupon = () => p.cupones.find((c) => c.codigo === ctx.codigo.trim().toUpperCase());

  switch (p.tipo) {
    case 'promocion':
      return minimo() ? no(minimo()) : si(recompensa(p, base, subtotal, ctx), 'Se aplica sola.');
    case 'codigo':
      if (ctx.codigo.trim().toUpperCase() !== p.codigo) return no(`Se aplica con el código ${p.codigo}.`);
      return minimo() ? no(minimo()) : si(recompensa(p, base, subtotal, ctx), `Código ${p.codigo}.`);
    case 'compra-x': {
      const grupo = p.cantidadX + p.cantidadY;
      const gratis = Math.floor(unidades / grupo) * p.cantidadY;
      if (!gratis) return no(`Lleva ${unidades}: con ${grupo} recibe ${p.cantidadY} gratis.`);
      // Gratis las más baratas de lo que aplica
      const precios = suyas.flatMap((l) => Array<number>(Math.floor(l.cantidad)).fill(l.precio)).sort((a, b) => a - b);
      return si(precios.slice(0, gratis).reduce((t, x) => t + x, 0), `${gratis} gratis por llevar ${unidades}.`);
    }
    case 'proxima-orden': {
      const usado = cupon();
      const gana = minimo() ? '' : `Un cupón de ${textoRecompensa(p)} para su próxima orden.`;
      if (usado?.usado) return no('Ese cupón ya se usó.', gana);
      if (usado) return si(recompensa(p, base, subtotal, ctx), `Cupón ${usado.codigo}.`, gana);
      return no(minimo() || 'Esta orden gana un cupón; se usa en la siguiente.', gana);
    }
    case 'cupones': {
      const c = cupon();
      if (!c) return no('Se aplica con uno de sus cupones.');
      if (c.usado) return no('Ese cupón ya se usó.');
      return si(recompensa(p, base, subtotal, ctx), `Cupón ${c.codigo}.`);
    }
    case 'lealtad': {
      const puntos = p.pesosPorPunto ? Math.floor(subtotal / p.pesosPorPunto) : 0;
      const gana = `${puntos} puntos (quedaría con ${ctx.saldo + puntos}).`;
      if (ctx.saldo < p.puntosCanje) return no(`Tiene ${ctx.saldo} de ${p.puntosCanje} puntos para canjear.`, gana);
      return si(recompensa(p, base, subtotal, ctx), `Canjea ${p.puntosCanje} puntos.`, `${puntos} puntos (quedaría con ${ctx.saldo - p.puntosCanje + puntos}).`);
    }
    case 'sellos': {
      const gana = `${unidades} ${unidades === 1 ? 'sello' : 'sellos'}.`;
      if (ctx.saldo < p.meta) return no(`Tiene ${ctx.saldo} de ${p.meta} sellos.`, gana);
      return si(recompensa(p, base, subtotal, ctx), `Completó ${p.meta} sellos.`, gana);
    }
  }
}

// ---------- Textos ----------

export function textoRecompensa(p: Pick<Programa, 'recompensa' | 'valor'>): string {
  if (p.recompensa === 'porcentaje') return `${p.valor} % de descuento`;
  if (p.recompensa === 'monto') return `$${pesos(p.valor)} de descuento`;
  return 'traslado gratis';
}

export function textoAplicaA(p: Pick<Programa, 'productoId' | 'categoria'>, productos: ProductoTarifa[]): string {
  if (p.productoId) return productos.find((x) => x.id === p.productoId)?.nombre ?? p.productoId;
  return p.categoria ? CATEGORIAS_PRODUCTO[p.categoria] : 'todos los productos';
}

/** La regla en una línea, para la lista: "Con el código CONCRETO10: 10 % de descuento en Concreto f´c". */
export function textoPrograma(p: Programa, productos: ProductoTarifa[]): string {
  const en = textoAplicaA(p, productos);
  const desde = p.compraMinima ? ` desde $${pesos(p.compraMinima)}` : '';
  switch (p.tipo) {
    case 'promocion':
      return `Automático${desde}: ${textoRecompensa(p)}`;
    case 'codigo':
      return `Código ${p.codigo}${desde}: ${textoRecompensa(p)} en ${en}`;
    case 'compra-x':
      return `Compra ${p.cantidadX} de ${en} y recibe ${p.cantidadY} gratis`;
    case 'proxima-orden':
      return `Órdenes${desde} ganan un cupón: ${textoRecompensa(p)}`;
    case 'lealtad':
      return `1 punto por cada $${pesos(p.pesosPorPunto)}; ${p.puntosCanje} puntos = ${textoRecompensa(p)}`;
    case 'cupones':
      return `${p.cupones.length} cupones: ${textoRecompensa(p)} en ${en}`;
    case 'sellos':
      return `${p.meta} sellos de ${en}: ${textoRecompensa(p)}`;
  }
}

/** 8 letras y números sin los que se confunden (0/O, 1/I). */
export function nuevoCodigo(usados: string[]): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c: string;
  do c = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => letras[n % letras.length]).join('');
  while (usados.includes(c));
  return c;
}

// shortcut: programas de demostración en memoria (se pierden al recargar).
const DEMO: Programa[] = [
  { ...desdePlantilla('promocion'), id: 'pr-traslado' },
  { ...desdePlantilla('codigo'), id: 'pr-concreto10', fin: '2026-12-31' },
  { ...desdePlantilla('compra-x'), id: 'pr-fc250', nombre: 'f´c 250: 10 m³ y 1 m³ gratis', productoId: 'fc-250', cantidadX: 10, cantidadY: 1 },
  {
    ...desdePlantilla('cupones'),
    id: 'pr-cupones',
    nombre: 'Cupones Expo Construcción',
    cupones: [
      { codigo: 'EXPO7K2M', usado: false },
      { codigo: 'EXPO9QRT', usado: true },
    ],
  },
];

/**
 * Ventas → Productos → Descuentos y programas de lealtad: alta desde una plantilla, edición, cupones (generar y
 * marcar usados) y el historial de cada uno.
 * shortcut: aún no se aplican al cotizar; evaluar() es la lógica que usará la cotización, y entonces registrar la
 * orden sumará puntos y sellos por cliente y emitirá los cupones de la próxima orden.
 */
@Service()
export class ProgramasService {
  private readonly historial = inject(HistorialService);
  private readonly ventas = inject(VentasService);

  readonly programas = signal<Programa[]>(DEMO);

  programa(id: string): Programa | undefined {
    return this.programas().find((p) => p.id === id);
  }

  crear(datos: Omit<Programa, 'id'>): Programa {
    const p = { ...datos, id: 'pr-' + crypto.randomUUID().slice(0, 8), nombre: datos.nombre.trim() };
    this.programas.update((l) => [...l, p]);
    this.historial.registrar(registro.programa(p.id), {
      texto: 'Programa creado',
      detalles: [`${plantilla(p.tipo).nombre}: ${textoPrograma(p, this.ventas.productos())}`],
    });
    return p;
  }

  editar(id: string, datos: Omit<Programa, 'id' | 'tipo' | 'cupones'>): void {
    const antes = this.programa(id);
    if (!antes) return;
    const despues: Programa = { ...antes, ...datos, nombre: datos.nombre.trim() };
    const productos = this.ventas.productos();
    const cambios = [
      { campo: 'Nombre', antes: antes.nombre, despues: despues.nombre },
      { campo: 'Regla', antes: textoPrograma(antes, productos), despues: textoPrograma(despues, productos) },
      { campo: 'Estado', antes: antes.activo ? 'Activo' : 'Archivado', despues: despues.activo ? 'Activo' : 'Archivado' },
      { campo: 'Vigencia', antes: `${antes.inicio || '—'} a ${antes.fin || '—'}`, despues: `${despues.inicio || '—'} a ${despues.fin || '—'}` },
    ].filter((c) => c.antes !== c.despues);
    if (!cambios.length) return;
    this.reemplazar(despues);
    this.historial.registrar(registro.programa(id), { texto: 'Programa editado', cambios });
  }

  /** Genera n cupones únicos (en todos los programas) para compartir. */
  generarCupones(id: string, n: number): string[] {
    const p = this.programa(id);
    if (!p) return [];
    const usados = this.programas().flatMap((x) => x.cupones.map((c) => c.codigo));
    const nuevos: string[] = [];
    for (let i = 0; i < n; i++) nuevos.push(nuevoCodigo([...usados, ...nuevos]));
    this.reemplazar({ ...p, cupones: [...p.cupones, ...nuevos.map((codigo) => ({ codigo, usado: false }))] });
    this.historial.registrar(registro.programa(id), { texto: `${n} ${n === 1 ? 'cupón generado' : 'cupones generados'}`, detalles: [nuevos.join(', ')] });
    return nuevos;
  }

  alternarUsado(id: string, codigo: string): void {
    const p = this.programa(id);
    const c = p?.cupones.find((x) => x.codigo === codigo);
    if (!p || !c) return;
    this.reemplazar({ ...p, cupones: p.cupones.map((x) => (x.codigo === codigo ? { ...x, usado: !x.usado } : x)) });
    this.historial.registrar(registro.programa(id), { texto: `Cupón ${codigo} ${c.usado ? 'disponible otra vez' : 'marcado como usado'}` });
  }

  private reemplazar(p: Programa): void {
    this.programas.update((l) => l.map((x) => (x.id === p.id ? p : x)));
  }
}
