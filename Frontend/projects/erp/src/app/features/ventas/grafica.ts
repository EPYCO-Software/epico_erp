import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface Serie {
  id: string;
  nombre: string;
  color: string;
  valores: number[];
}

export type TipoGrafica = 'barras' | 'lineas' | 'participacion';

const ALTO = 340;
const MARGEN = { arriba: 14, derecha: 16, abajo: 30 };
const GRUESO_MAX = 24;
const HUECO = 2;
const RADIO = 4;

/** 1, 2, 2.5 o 5 × 10ⁿ: el paso "redondo" más cercano. */
function pasoRedondo(bruto: number): number {
  if (bruto <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Barra con solo el extremo de datos redondeado (cuadrada contra la base). Vertical: de y0 (base) a y1 (tope). */
function barraV(x: number, y0: number, y1: number, w: number, redondear: boolean): string {
  const h = y0 - y1;
  if (h <= 0) return '';
  const r = redondear ? Math.min(RADIO, w / 2, h) : 0;
  return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
}
function barraH(x0: number, x1: number, y: number, h: number): string {
  const w = x1 - x0;
  if (w <= 0) return '';
  const r = Math.min(RADIO, h / 2, w);
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
}

/**
 * Gráfica SVG propia (sin librerías): barras (agrupadas o apiladas), líneas (con área si es una sola serie) o
 * participación (barras horizontales con su %). Marcas delgadas, rejilla discreta, leyenda con 2+ series, y capa de
 * lectura: pasar el puntero o las flechas del teclado muestran el detalle de cada punto (también para lector de
 * pantalla). La tabla dinámica es su vista en tabla.
 */
@Component({
  selector: 'app-grafica',
  host: { class: 'block' },
  template: `
    @if (series().length > 1) {
      <ul class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Leyenda">
        @for (s of series(); track s.id) {
          <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" [style.background]="s.color" aria-hidden="true"></span>{{ s.nombre }}</li>
        }
      </ul>
    }
    <div
      class="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-epico"
      tabindex="0"
      role="group"
      [attr.aria-label]="titulo() + '. Usa las flechas para recorrer los valores.'"
      (keydown)="tecla($event)"
      (focus)="activo() === null && activo.set(0)"
      (blur)="activo.set(null)"
    >
      <svg [attr.width]="ancho()" [attr.height]="alto()" class="block overflow-visible" aria-hidden="true" (pointerleave)="activo.set(null)">
        @if (tipo() === 'participacion') {
          @for (b of horizontales(); track $index) {
            <text [attr.x]="b.etiquetaX" [attr.y]="b.y + b.h / 2" dominant-baseline="central" text-anchor="end" class="fill-carbon text-[12px]">{{ b.etiqueta }}</text>
            <path [attr.d]="b.d" [attr.fill]="color()" [attr.opacity]="activo() === null || activo() === $index ? 1 : 0.55" />
            <text [attr.x]="b.valorX" [attr.y]="b.y + b.h / 2" dominant-baseline="central" class="fill-carbon text-[12px] tabular-nums">{{ b.valor }}</text>
            <rect [attr.x]="0" [attr.y]="b.y - 4" [attr.width]="ancho()" [attr.height]="b.h + 8" fill="transparent" (pointerenter)="activo.set($index)" />
          }
        } @else {
          @for (t of escala().ticks; track t.v) {
            <line [attr.x1]="izquierda()" [attr.x2]="ancho() - margen.derecha" [attr.y1]="t.y" [attr.y2]="t.y" [attr.stroke]="t.v === 0 ? '#b9b7b0' : '#e7e5e0'" stroke-width="1" />
            <text [attr.x]="izquierda() - 8" [attr.y]="t.y" dominant-baseline="central" text-anchor="end" class="fill-texto-suave text-[12px] tabular-nums">{{ t.texto }}</text>
          }
          @for (x of etiquetasX(); track x.i) {
            <text [attr.x]="x.x" [attr.y]="alto() - 8" text-anchor="middle" class="fill-texto-suave text-[12px]">{{ x.texto }}</text>
          }
          @if (activo() !== null) {
            @if (tipo() === 'barras') {
              <rect [attr.x]="centro(activo()!) - banda() / 2" [attr.y]="margen.arriba" [attr.width]="banda()" [attr.height]="altoPlot()" fill="#1a1a1c" opacity="0.04" />
            } @else {
              <line [attr.x1]="centro(activo()!)" [attr.x2]="centro(activo()!)" [attr.y1]="margen.arriba" [attr.y2]="margen.arriba + altoPlot()" stroke="#9a988f" stroke-width="1" />
            }
          }
          @if (tipo() === 'barras') {
            @for (b of barras(); track $index) {
              <path [attr.d]="b.d" [attr.fill]="b.color" />
            }
          } @else {
            @for (l of lineas(); track l.id) {
              @if (l.area) {
                <path [attr.d]="l.area" [attr.fill]="l.color" opacity="0.14" />
              }
              <path [attr.d]="l.d" fill="none" [attr.stroke]="l.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              @if (activo() !== null) {
                <circle [attr.cx]="centro(activo()!)" [attr.cy]="y(l.valores[activo()!])" r="4" [attr.fill]="l.color" stroke="#fff" stroke-width="2" />
              }
            }
          }
          @for (e of etiquetas(); track $index) {
            <rect [attr.x]="centro($index) - banda() / 2" [attr.y]="margen.arriba" [attr.width]="banda()" [attr.height]="altoPlot()" fill="transparent" (pointerenter)="activo.set($index)" />
          }
        }
      </svg>

      @if (detalle(); as d) {
        <div
          class="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-acero/70 bg-white px-3 py-2 text-sm shadow-lg"
          [style.left.px]="d.x"
          [style.top.px]="d.y"
          aria-hidden="true"
        >
          <p class="font-bold">{{ d.etiqueta }}</p>
          @for (f of d.filas; track f.nombre) {
            <p class="mt-0.5 flex items-center justify-between gap-4">
              <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm" [style.background]="f.color"></span>{{ f.nombre }}</span>
              <span class="font-semibold tabular-nums">{{ f.valor }}</span>
            </p>
          }
          @if (d.total) {
            <p class="mt-1 flex justify-between gap-4 border-t border-acero/60 pt-1"><span>Total</span><span class="font-bold tabular-nums">{{ d.total }}</span></p>
          }
        </div>
      }
      <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>
    </div>
  `,
})
export class Grafica {
  readonly etiquetas = input.required<string[]>();
  readonly series = input.required<Serie[]>();
  readonly tipo = input<TipoGrafica>('barras');
  readonly apilado = input(false);
  /** Formato completo (detalle) y corto (eje). */
  readonly formato = input.required<(n: number) => string>();
  readonly corto = input.required<(n: number) => string>();
  /** Si la medida se suma: total en el detalle y % en participación. */
  readonly sumable = input(true);
  readonly titulo = input('Gráfica');
  /** Alto de barras y líneas (las de participación crecen con sus renglones). */
  readonly altura = input(ALTO);

  protected readonly margen = MARGEN;
  protected readonly ancho = signal(800);
  protected readonly activo = signal<number | null>(null);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const observador = new ResizeObserver(([e]) => this.ancho.set(Math.max(280, Math.floor(e.contentRect.width))));
    afterNextRender(() => observador.observe(host));
    inject(DestroyRef).onDestroy(() => observador.disconnect());
  }

  // ---------- Vertical (barras y líneas) ----------

  /** Tope "redondo" y sus marcas (4-5). Apiladas: sobre la suma de cada punto. */
  protected readonly escala = computed(() => {
    const s = this.series();
    const n = this.etiquetas().length;
    const maximo = Math.max(
      0,
      ...(this.apilado() && this.tipo() === 'barras'
        ? Array.from({ length: n }, (_, i) => s.reduce((t, x) => t + (x.valores[i] ?? 0), 0))
        : s.flatMap((x) => x.valores)),
    );
    const paso = pasoRedondo((maximo || 1) / 4);
    const tope = Math.max(paso, Math.ceil(maximo / paso) * paso);
    const ticks = [];
    for (let v = 0; v <= tope + paso / 2; v += paso) ticks.push({ v, texto: this.corto()(v), y: 0 });
    return { tope, ticks: ticks.map((t) => ({ ...t, y: this.yCon(t.v, tope) })) };
  });
  protected readonly izquierda = computed(() => 16 + 7 * Math.max(...this.escala().ticks.map((t) => t.texto.length)));
  protected readonly altoPlot = computed(() => this.altura() - MARGEN.arriba - MARGEN.abajo);
  protected readonly banda = computed(() => (this.ancho() - this.izquierda() - MARGEN.derecha) / Math.max(1, this.etiquetas().length));

  private yCon(v: number, tope: number): number {
    return MARGEN.arriba + this.altoPlot() - (v / tope) * this.altoPlot();
  }
  protected y(v: number): number {
    return this.yCon(v, this.escala().tope);
  }
  protected centro(i: number): number {
    return this.izquierda() + this.banda() * (i + 0.5);
  }

  /** Solo las que caben (~64 px cada una). */
  protected readonly etiquetasX = computed(() => {
    const e = this.etiquetas();
    const cada = Math.ceil(e.length / Math.max(1, Math.floor((this.ancho() - this.izquierda()) / 64)));
    return e.map((texto, i) => ({ i, texto, x: this.centro(i) })).filter((x) => x.i % cada === 0);
  });

  protected readonly barras = computed(() => {
    const s = this.series();
    const banda = this.banda();
    const base = this.y(0);
    const out: { d: string; color: string }[] = [];
    this.etiquetas().forEach((_, i) => {
      const c = this.centro(i);
      if (this.apilado() || s.length === 1) {
        const w = Math.min(GRUESO_MAX, banda * 0.72);
        let acumulado = 0;
        // La de arriba con valor lleva el extremo redondeado
        let ultima = -1;
        s.forEach((x, k) => (x.valores[i] ?? 0) > 0 && (ultima = k));
        s.forEach((x, k) => {
          const v = x.valores[i] ?? 0;
          if (v <= 0) return;
          // Hueco de 2 px contra el segmento de abajo
          const y0 = this.y(acumulado) - (acumulado > 0 ? HUECO : 0);
          acumulado += v;
          out.push({ d: barraV(c - w / 2, y0, this.y(acumulado), w, k === ultima), color: x.color });
        });
      } else {
        const w = Math.max(2, Math.min(GRUESO_MAX, (banda * 0.72 - HUECO * (s.length - 1)) / s.length));
        const inicio = c - (w * s.length + HUECO * (s.length - 1)) / 2;
        s.forEach((x, k) => out.push({ d: barraV(inicio + k * (w + HUECO), base, this.y(x.valores[i] ?? 0), w, true), color: x.color }));
      }
    });
    return out;
  });

  protected readonly lineas = computed(() => {
    const s = this.series();
    return s.map((x) => {
      const puntos = x.valores.map((v, i) => `${this.centro(i)},${this.y(v)}`);
      const d = 'M' + puntos.join('L');
      const area = s.length === 1 && puntos.length ? `${d}L${this.centro(x.valores.length - 1)},${this.y(0)}L${this.centro(0)},${this.y(0)}Z` : '';
      return { id: x.id, color: x.color, valores: x.valores, d, area };
    });
  });

  // ---------- Participación (horizontal) ----------

  /** Una sola serie: la suma de todas. */
  private readonly totales = computed(() => this.etiquetas().map((_, i) => this.series().reduce((t, x) => t + (x.valores[i] ?? 0), 0)));
  protected readonly color = computed(() => (this.series().length === 1 ? this.series()[0].color : '#2a78d6'));
  protected readonly alto = computed(() => (this.tipo() === 'participacion' ? Math.max(1, this.etiquetas().length) * 34 + 8 : this.altura()));
  protected readonly horizontales = computed(() => {
    const valores = this.totales();
    const suma = valores.reduce((t, v) => t + v, 0);
    const maximo = Math.max(1, ...valores);
    const etiquetaW = Math.min(this.ancho() * 0.38, 12 + 7 * Math.max(0, ...this.etiquetas().map((e) => e.length)));
    const valorW = 150;
    const largo = Math.max(10, this.ancho() - etiquetaW - valorW - 16);
    return this.etiquetas().map((etiqueta, i) => {
      const x0 = etiquetaW + 10;
      const x1 = x0 + (valores[i] / maximo) * largo;
      const pct = this.sumable() && suma ? ` · ${((valores[i] / suma) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %` : '';
      return { etiqueta, etiquetaX: etiquetaW, y: 4 + i * 34, h: 22, d: barraH(x0, x1, 4 + i * 34, 22), valorX: x1 + 8, valor: this.formato()(valores[i]) + pct };
    });
  });

  // ---------- Lectura: puntero y teclado ----------

  protected readonly detalle = computed(() => {
    const i = this.activo();
    if (i === null || i >= this.etiquetas().length) return null;
    const s = this.series();
    const f = this.formato();
    const filas = s.map((x) => ({ nombre: x.nombre, color: x.color, valor: f(x.valores[i] ?? 0) }));
    const total = s.length > 1 && this.sumable() ? f(s.reduce((t, x) => t + (x.valores[i] ?? 0), 0)) : '';
    if (this.tipo() === 'participacion') {
      const b = this.horizontales()[i];
      return { etiqueta: this.etiquetas()[i], filas, total, x: Math.min(b.valorX, this.ancho() - 190), y: b.y + 30 };
    }
    const x = this.centro(i);
    // Del lado con más espacio
    return { etiqueta: this.etiquetas()[i], filas, total, x: x > this.ancho() / 2 ? x - 200 : x + 14, y: MARGEN.arriba + 4 };
  });

  protected readonly anuncio = computed(() => {
    const d = this.detalle();
    if (!d) return '';
    return `${d.etiqueta}: ${d.filas.map((f) => (this.series().length > 1 ? `${f.nombre} ${f.valor}` : f.valor)).join(', ')}${d.total ? `; total ${d.total}` : ''}`;
  });

  protected tecla(e: KeyboardEvent): void {
    const n = this.etiquetas().length;
    if (!n) return;
    const actual = this.activo() ?? -1;
    const siguiente: Record<string, number> = {
      ArrowRight: Math.min(n - 1, actual + 1),
      ArrowDown: Math.min(n - 1, actual + 1),
      ArrowLeft: Math.max(0, actual - 1),
      ArrowUp: Math.max(0, actual - 1),
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in siguiente)) return;
    e.preventDefault();
    this.activo.set(siguiente[e.key]);
  }
}
