import { Component, computed, input, linkedSignal, model, signal } from '@angular/core';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide';
import { Icon } from 'ui';
import { csv } from './reporte-datos';

export interface ColumnaReporte<T> {
  id: string;
  nombre: string;
  /** Para ordenar (y para el CSV si no hay texto). */
  valor: (f: T) => number | string;
  /** Lo que se ve; si no, el valor. */
  texto?: (f: T) => string;
  numero?: boolean;
  /** Clases extra de la celda (p. ej. verde/rojo de una variación). */
  clase?: (f: T) => string;
  /** El pie de la columna (totales). */
  pie?: string;
  /** Texto de ayuda del encabezado (title). */
  ayuda?: string;
  /** Para el CSV, si no sirve el valor (p. ej. una variación vacía). */
  csv?: (f: T) => string | number;
}

/** Las columnas y renglones como CSV: números sin formato (para sumar en Excel) y a 2 decimales; textos como se ven. */
export function csvDeTabla<T>(columnas: ColumnaReporte<T>[], filas: T[]): string {
  const celda = (c: ColumnaReporte<T>, f: T): string | number => {
    const v = c.csv ? c.csv(f) : c.valor(f);
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : '';
    return c.csv ? v : (c.texto?.(f) ?? v);
  };
  return csv(
    columnas.map((c) => c.nombre),
    filas.map((f) => columnas.map((c) => celda(c, f))),
  );
}

/**
 * La tabla de los reportes: columnas ordenables (clic en el encabezado; aria-sort), la primera columna es el nombre y
 * su botón selecciona el renglón (también clic en el renglón) para ver su detalle; pie con totales; "Mostrar más"
 * pasando de 25. Desplaza de lado si no cabe.
 */
@Component({
  selector: 'app-tabla-reporte',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <div class="overflow-x-auto" tabindex="0" role="region" [attr.aria-label]="titulo()">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <caption class="sr-only">{{ titulo() }}. El nombre de un renglón muestra su detalle; los encabezados ordenan.</caption>
        <thead class="border-b border-acero/80">
          <tr>
            @for (c of columnas(); track c.id) {
              <th
                scope="col"
                class="py-1"
                [class.text-right]="c.numero"
                [attr.title]="c.ayuda ?? null"
                [attr.aria-sort]="orden().columna === c.id ? (orden().asc ? 'ascending' : 'descending') : null"
              >
                <button
                  type="button"
                  class="inline-flex h-8 items-center gap-1 rounded px-2 font-semibold hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
                  (click)="ordenarPor(c)"
                >
                  {{ c.nombre }}
                  <ui-icon [icono]="orden().columna === c.id ? (orden().asc ? iconos.arriba : iconos.abajo) : iconos.ordenar" [tamano]="14" class="text-texto-suave" />
                </button>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (f of visibles(); track clave()(f)) {
            <tr
              class="cursor-pointer border-b border-acero/40 transition-colors hover:bg-carbon/3"
              [class]="clave()(f) === seleccion() ? 'bg-epico/6' : ''"
              (click)="seleccion.set(clave()(f))"
            >
              @for (c of columnas(); track c.id; let primera = $first) {
                @if (primera) {
                  <th scope="row" class="px-2 py-1.5 font-semibold">
                    <button
                      type="button"
                      class="rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                      [attr.aria-pressed]="clave()(f) === seleccion()"
                      (click)="$event.stopPropagation(); seleccion.set(clave()(f))"
                    >
                      {{ texto(c, f) }}
                    </button>
                  </th>
                } @else {
                  <td class="px-2 py-1.5" [class]="(c.numero ? 'text-right tabular-nums ' : '') + (c.clase?.(f) ?? '')">{{ texto(c, f) }}</td>
                }
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="columnas().length" class="px-2 py-10 text-center text-texto-suave">Sin datos con estos filtros.</td>
            </tr>
          }
        </tbody>
        @if (hayPie() && filas().length) {
          <tfoot class="border-t-2 border-acero-oscuro/60 font-bold">
            <tr>
              @for (c of columnas(); track c.id; let primera = $first) {
                @if (primera) {
                  <th scope="row" class="px-2 py-2">{{ c.pie ?? 'Total' }}</th>
                } @else {
                  <td class="px-2 py-2" [class.text-right]="c.numero" [class.tabular-nums]="c.numero">{{ c.pie ?? '' }}</td>
                }
              }
            </tr>
          </tfoot>
        }
      </table>
    </div>
    @if (visibles().length < filas().length) {
      <button
        type="button"
        class="mt-2 inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-epico-oscuro hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
        (click)="limite.set(limite() + 25)"
      >
        Mostrar más ({{ visibles().length }} de {{ filas().length }})
      </button>
    }
  `,
})
export class TablaReporte<T> {
  readonly columnas = input.required<ColumnaReporte<T>[]>();
  readonly filas = input.required<T[]>();
  readonly clave = input.required<(f: T) => string>();
  readonly titulo = input.required<string>();
  /** La columna con la que empieza ordenada (de mayor a menor). */
  readonly ordenInicial = input<string>('');
  readonly seleccion = model<string | null>(null);

  protected readonly iconos = { arriba: ArrowUp, abajo: ArrowDown, ordenar: ArrowUpDown };
  protected readonly orden = linkedSignal({ source: this.ordenInicial, computation: (c) => ({ columna: c, asc: false }) });
  protected readonly limite = signal(25);
  protected readonly hayPie = computed(() => this.columnas().some((c) => c.pie !== undefined));

  protected texto(c: ColumnaReporte<T>, f: T): string {
    return c.texto ? c.texto(f) : String(c.valor(f));
  }

  protected ordenarPor(c: ColumnaReporte<T>): void {
    const o = this.orden();
    // Los números empiezan de mayor a menor; los textos, de la A a la Z
    this.orden.set({ columna: c.id, asc: o.columna === c.id ? !o.asc : !c.numero });
  }

  private readonly ordenadas = computed(() => {
    const { columna, asc } = this.orden();
    const c = this.columnas().find((x) => x.id === columna);
    if (!c) return this.filas();
    return [...this.filas()].sort((a, b) => {
      const va = c.valor(a);
      const vb = c.valor(b);
      const dif = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true });
      return asc ? dif : -dif;
    });
  });
  protected readonly visibles = computed(() => this.ordenadas().slice(0, this.limite()));
}
