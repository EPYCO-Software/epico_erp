import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService, CATEGORIAS_PRODUCTO, todos, CategoriaProducto, ProductoTarifa, pesos } from 'ui';
import { Cambio, HistorialService } from '../../core/historial';
import { plantasVigentes } from '../../core/plantas';
import { VentasService, mensajeDe, registro } from './datos';

export type Moneda = 'MXN' | 'USD';
export const MONEDAS: Record<Moneda, string> = { MXN: 'Peso mexicano', USD: 'Dólar estadounidense' };

export type TipoRegla = 'descuento' | 'formula' | 'fijo';
export const TIPOS_REGLA: Record<TipoRegla, string> = { descuento: 'Descuento', formula: 'Fórmula', fijo: 'Precio fijo' };

/**
 * Una línea de una lista de precios, como las reglas de Odoo: a qué aplica (un producto, todos, o una categoría), cómo
 * se calcula el precio (descuento % sobre el de lista; fórmula: de lista − % + recargo; o fijo), desde qué cantidad y
 * en qué periodo (fechas AAAA-MM-DD; vacías = sin límite).
 */
export interface ReglaPrecio {
  id: string;
  aplicarA: 'producto' | 'categoria';
  /** Vacío = todos los productos. */
  productoId: string;
  categoria: CategoriaProducto | '';
  tipo: TipoRegla;
  precioFijo: number;
  /** En %; en la fórmula puede ser negativo (aumento). */
  descuento: number;
  /** Fórmula: se suma (o resta) al precio, en la moneda de la lista. */
  recargo: number;
  cantidadMinima: number;
  inicio: string;
  fin: string;
}

/** Lista de precios: su moneda y en qué plantas aplica (vacío = todas). Lo común: una por planta. */
export interface ListaPrecios {
  id: string;
  nombre: string;
  moneda: Moneda;
  plantas: string[];
  reglas: ReglaPrecio[];
}

export type DatosLista = Pick<ListaPrecios, 'nombre' | 'moneda' | 'plantas'>;

export const REGLA_VACIA: Omit<ReglaPrecio, 'id'> = {
  aplicarA: 'producto',
  productoId: '',
  categoria: '',
  tipo: 'fijo',
  precioFijo: 0,
  descuento: 0,
  recargo: 0,
  cantidadMinima: 0,
  inicio: '',
  fin: '',
};

const regla = (id: string, r: Partial<ReglaPrecio>): ReglaPrecio => ({ ...REGLA_VACIA, id, ...r });

// shortcut: listas de demostración en memoria (se pierden al recargar); con backend, vendrán de él.
const LISTAS: ListaPrecios[] = [
  { id: 'lp-general', nombre: 'Venta al público', moneda: 'MXN', plantas: [], reglas: [] },
  {
    id: 'lp-cancun',
    nombre: 'Planta Cancún',
    moneda: 'MXN',
    plantas: ['CUN'],
    reglas: [
      regla('r-cun-1', { aplicarA: 'categoria', categoria: 'concreto-fc', tipo: 'formula', recargo: 350 }),
      regla('r-cun-2', { productoId: 'fc-300', tipo: 'fijo', precioFijo: 4700 }),
      regla('r-cun-3', { productoId: 'fc-250', tipo: 'descuento', descuento: 5, cantidadMinima: 50 }),
    ],
  },
  {
    id: 'lp-cozumel',
    nombre: 'Planta Cozumel (isla)',
    moneda: 'MXN',
    plantas: ['CZM'],
    reglas: [regla('r-czm-1', { aplicarA: 'categoria', categoria: 'concreto-fc', tipo: 'formula', recargo: 600 })],
  },
  {
    id: 'lp-usd',
    nombre: 'Proyectos en dólares',
    moneda: 'USD',
    plantas: ['CUN', 'CZM'],
    reglas: [regla('r-usd-1', { productoId: 'fc-250', tipo: 'fijo', precioFijo: 230, inicio: '2026-11-01', fin: '2026-12-31' })],
  },
];


/** "Todas las plantas" o "Cancún, Cozumel". */
export function textoPlantas(ids: string[]): string {
  if (!ids.length) return 'Todas las plantas';
  return ids.map((id) => plantasVigentes().find((p) => p.id === id)?.nombre.replace('Planta ', '') ?? id).join(', ');
}

/** "$4,700.00", "$230.00 USD". */
export const dinero = (n: number, moneda: Moneda) => `$${pesos(n)}${moneda === 'USD' ? ' USD' : ''}`;

/** La columna Precio: "$4,700.00", "5 % de descuento", "Precio de lista + $350.00". */
export function textoPrecio(r: ReglaPrecio, moneda: Moneda): string {
  if (r.tipo === 'fijo') return dinero(r.precioFijo, moneda);
  if (r.tipo === 'descuento') return `${r.descuento} % de descuento`;
  let texto = 'Precio de lista';
  if (r.descuento) texto += r.descuento > 0 ? ` − ${r.descuento} %` : ` + ${-r.descuento} %`;
  if (r.recargo) texto += ` ${r.recargo > 0 ? '+' : '−'} ${dinero(Math.abs(r.recargo), moneda)}`;
  return texto;
}

/** La columna Aplicar en: el producto, "Todos los productos" o "Categoría: Concreto f´c". */
export function textoAplicaEn(r: ReglaPrecio, productos: ProductoTarifa[]): string {
  if (r.aplicarA === 'categoria') return `Categoría: ${r.categoria ? CATEGORIAS_PRODUCTO[r.categoria] : '—'}`;
  if (!r.productoId) return 'Todos los productos';
  const p = productos.find((x) => x.id === r.productoId);
  return p ? `[${p.codigo}] ${p.nombre}` : r.productoId;
}

const fecha = (f: string) => f.split('-').reverse().join('/');
/** "Siempre", "Desde 01/11/2026", "Hasta 31/12/2026" o "01/11/2026 – 31/12/2026". */
export function textoVigencia(r: Pick<ReglaPrecio, 'inicio' | 'fin'>): string {
  if (r.inicio && r.fin) return `${fecha(r.inicio)} – ${fecha(r.fin)}`;
  if (r.inicio) return `Desde ${fecha(r.inicio)}`;
  if (r.fin) return `Hasta ${fecha(r.fin)}`;
  return 'Siempre';
}

/** Por nombre, moneda o planta, sin importar acentos ni mayúsculas. */
export function filtrarListas(listas: ListaPrecios[], texto: string): ListaPrecios[] {
  const n = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = n(texto.trim());
  return q ? listas.filter((l) => n(`${l.nombre} ${l.moneda} ${textoPlantas(l.plantas)}`).includes(q)) : listas;
}

// ---------- backend ----------

interface ApiLista {
  id: string;
  nombre: string;
  monedaCodigo: string;
  activa: boolean;
  empresaRestringidaId: string | null;
}
interface ApiRegla {
  id: string;
  listaPreciosId: string;
  aplicarA: 'todos' | 'producto' | 'categoria';
  productoId: string | null;
  categoriaId: string | null;
  tipo: TipoRegla;
  precioFijo: number | null;
  descuentoPct: number | null;
  recargo: number | null;
  cantidadMinima: number;
  inicio: string | null;
  fin: string | null;
}
interface ApiListaSucursal {
  id: string;
  listaPreciosId: string;
  sucursalId: string;
}

const aRegla = (r: ApiRegla, claveDe: Map<string, string>): ReglaPrecio => ({
  id: r.id,
  aplicarA: r.aplicarA === 'categoria' ? 'categoria' : 'producto',
  productoId: r.aplicarA === 'producto' ? (r.productoId ?? '') : '',
  categoria: ((r.categoriaId && claveDe.get(r.categoriaId)) || '') as CategoriaProducto | '',
  tipo: r.tipo,
  precioFijo: r.precioFijo ?? 0,
  descuento: r.descuentoPct ?? 0,
  recargo: r.recargo ?? 0,
  cantidadMinima: r.cantidadMinima ?? 0,
  inicio: r.inicio?.slice(0, 10) ?? '',
  fin: r.fin?.slice(0, 10) ?? '',
});

/**
 * Listas de precios (Ventas → Productos → Listas de precios): alta, edición de nombre, moneda y plantas, y sus reglas.
 * Con backend todo vive allá (/listas-precios, /reglas-precio y /lista-precios-sucursales) y el historial lo escribe
 * él; sin él (pruebas, demo), en memoria con listas de ejemplo y el historial local.
 * shortcut: aún no se aplican al cotizar (las cotizaciones usan el tarifario); falta elegir la lista según la planta.
 */
@Service()
export class ListasPreciosService {
  private readonly historial = inject(HistorialService);
  private readonly ventas = inject(VentasService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = inject(AUTH_API_URL, { optional: true });

  readonly listas = signal<ListaPrecios[]>(this.base ? [] : LISTAS);
  readonly errorCarga = signal('');
  /** clave de categoría → id del backend. */
  private categorias = new Map<string, string>();
  private ligas: ApiListaSucursal[] = [];

  constructor() {
    if (!this.base) return;
    const quien = computed(() => this.auth.sesion()?.usuario.id ?? '');
    effect(() => {
      if (quien()) untracked(() => void this.recargar());
    });
  }

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + ruta));
  }

  async recargar(): Promise<void> {
    try {
      const [listas, reglas, ligas, cats] = await Promise.all([
        this.get<ApiLista[]>('/listas-precios?take=500'),
        todos((r) => this.get<ApiRegla[]>(r), '/reglas-precio'),
        todos((r) => this.get<ApiListaSucursal[]>(r), '/lista-precios-sucursales'),
        this.get<{ id: string; clave: string }[]>('/categorias-producto?take=500'),
      ]);
      this.categorias = new Map(cats.map((c) => [c.clave, c.id]));
      const claveDe = new Map(cats.map((c) => [c.id, c.clave]));
      this.ligas = ligas;
      this.listas.set(
        listas
          .map((l) => ({
            id: l.id,
            nombre: l.nombre,
            moneda: (l.monedaCodigo === 'USD' ? 'USD' : 'MXN') as Moneda,
            plantas: ligas.filter((x) => x.listaPreciosId === l.id).map((x) => x.sucursalId),
            reglas: reglas.filter((r) => r.listaPreciosId === l.id).map((r) => aRegla(r, claveDe)),
          }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      this.errorCarga.set('');
    } catch (e) {
      this.errorCarga.set(mensajeDe(e));
    }
  }

  lista(id: string): ListaPrecios | undefined {
    return this.listas().find((l) => l.id === id);
  }

  async crear(d: DatosLista): Promise<ListaPrecios> {
    if (this.base) {
      const l = await firstValueFrom(
        this.http.post<ApiLista>(`${this.base}/listas-precios`, { nombre: d.nombre.trim(), monedaCodigo: d.moneda, activa: true, empresaRestringidaId: null }),
      );
      await this.ligarPlantas(l.id, d.plantas);
      await this.recargar();
      return this.lista(l.id)!;
    }
    const lista: ListaPrecios = { id: 'lp-' + crypto.randomUUID().slice(0, 8), nombre: d.nombre.trim(), moneda: d.moneda, plantas: d.plantas, reglas: [] };
    this.listas.update((l) => [...l, lista]);
    this.historial.registrar(registro.lista(lista.id), {
      texto: 'Lista de precios creada',
      detalles: [`${MONEDAS[lista.moneda]} (${lista.moneda}) · ${textoPlantas(lista.plantas)}`],
    });
    return lista;
  }

  async editar(id: string, d: DatosLista): Promise<void> {
    const antes = this.lista(id);
    if (!antes) return;
    if (this.base) {
      const actual = await this.get<ApiLista>(`/listas-precios/${id}`);
      await firstValueFrom(this.http.put(`${this.base}/listas-precios/${id}`, { ...actual, nombre: d.nombre.trim(), monedaCodigo: d.moneda }));
      await this.ligarPlantas(id, d.plantas);
      await this.recargar();
      return;
    }
    const despues = { ...antes, nombre: d.nombre.trim(), moneda: d.moneda, plantas: d.plantas };
    const cambios: Cambio[] = [];
    const campo = (nombre: string, a: string, b: string) => a !== b && cambios.push({ campo: nombre, antes: a, despues: b });
    campo('Nombre', antes.nombre, despues.nombre);
    campo('Moneda', antes.moneda, despues.moneda);
    campo('Plantas', textoPlantas(antes.plantas), textoPlantas(despues.plantas));
    if (!cambios.length) return;
    this.reemplazar(despues);
    this.historial.registrar(registro.lista(id), { texto: 'Lista editada', cambios });
  }

  /** Deja ligadas a la lista exactamente esas plantas (vacío = todas). */
  private async ligarPlantas(listaId: string, plantas: string[]): Promise<void> {
    const actuales = this.ligas.filter((x) => x.listaPreciosId === listaId);
    await Promise.all([
      ...actuales
        .filter((x) => !plantas.includes(x.sucursalId))
        .map((x) => firstValueFrom(this.http.delete(`${this.base}/lista-precios-sucursales/${x.id}`))),
      ...plantas
        .filter((p) => !actuales.some((x) => x.sucursalId === p))
        .map((sucursalId) => firstValueFrom(this.http.post(`${this.base}/lista-precios-sucursales`, { listaPreciosId: listaId, sucursalId }))),
    ]);
  }

  /** Agrega la regla, o la reemplaza si ya existe (mismo id). */
  async guardarRegla(listaId: string, r: ReglaPrecio): Promise<void> {
    const lista = this.lista(listaId);
    if (!lista) return;
    const existe = lista.reglas.some((x) => x.id === r.id);
    if (this.base) {
      const cuerpo = {
        listaPreciosId: listaId,
        aplicarA: r.aplicarA === 'categoria' ? 'categoria' : r.productoId ? 'producto' : 'todos',
        productoId: r.aplicarA === 'producto' && r.productoId ? r.productoId : null,
        categoriaId: r.aplicarA === 'categoria' ? (this.categorias.get(r.categoria) ?? null) : null,
        tipo: r.tipo,
        precioFijo: r.tipo === 'fijo' ? r.precioFijo : null,
        descuentoPct: r.tipo === 'fijo' ? null : r.descuento,
        recargo: r.tipo === 'formula' ? r.recargo : null,
        cantidadMinima: r.cantidadMinima,
        inicio: r.inicio || null,
        fin: r.fin || null,
      };
      await firstValueFrom(
        existe ? this.http.put(`${this.base}/reglas-precio/${r.id}`, { ...cuerpo, id: r.id }) : this.http.post(`${this.base}/reglas-precio`, cuerpo),
      );
      await this.recargar();
      return;
    }
    this.reemplazar({ ...lista, reglas: existe ? lista.reglas.map((x) => (x.id === r.id ? r : x)) : [...lista.reglas, r] });
    this.historial.registrar(registro.lista(listaId), { texto: existe ? 'Línea editada' : 'Línea agregada', detalles: [this.resumen(r, lista.moneda)] });
  }

  async quitarRegla(listaId: string, reglaId: string): Promise<void> {
    const lista = this.lista(listaId);
    const r = lista?.reglas.find((x) => x.id === reglaId);
    if (!lista || !r) return;
    if (this.base) {
      await firstValueFrom(this.http.delete(`${this.base}/reglas-precio/${reglaId}`));
      await this.recargar();
      return;
    }
    this.reemplazar({ ...lista, reglas: lista.reglas.filter((x) => x.id !== reglaId) });
    this.historial.registrar(registro.lista(listaId), { texto: 'Línea quitada', detalles: [this.resumen(r, lista.moneda)] });
  }

  private resumen(r: ReglaPrecio, moneda: Moneda): string {
    const minimo = r.cantidadMinima ? ` · desde ${r.cantidadMinima}` : '';
    return `${textoAplicaEn(r, this.ventas.productos())}: ${textoPrecio(r, moneda)}${minimo} · ${textoVigencia(r)}`;
  }

  private reemplazar(lista: ListaPrecios): void {
    this.listas.update((l) => l.map((x) => (x.id === lista.id ? lista : x)));
  }
}
