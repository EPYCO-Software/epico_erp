import { Component, computed, input, model, signal } from '@angular/core';
import { ListFilter, RotateCcw, Search, X } from 'lucide';
import { Icon } from './icon';

/** Una opción de un grupo de filtros; `n`, cuántas filas la tienen (opcional). */
export interface OpcionFiltro {
  id: string;
  nombre: string;
  n?: number;
}

/**
 * Un grupo del panel de filtros (uno por columna que lo amerite): casillas que se suman (ninguna = todas) o, con
 * `rango`, desde/hasta de una fecha o de un número (importe, m³…; `prefijo`/`sufijo` para la etiqueta: "$", " m³").
 */
export interface GrupoFiltro {
  id: string;
  titulo: string;
  opciones?: OpcionFiltro[];
  rango?: 'fecha' | 'numero';
  prefijo?: string;
  sufijo?: string;
}

/** Lo elegido por grupo: las opciones marcadas o, en un rango, [desde, hasta] ('' = sin límite; fechas yyyy-mm-dd). */
export type FiltrosElegidos = Record<string, string[]>;

/** ¿Pasa el filtro de casillas de ese grupo? Sin nada elegido, todo pasa. */
export const pasaFiltro = (f: FiltrosElegidos, grupo: string, valor: string) => !f[grupo]?.length || f[grupo].includes(valor);

/** ¿Está en el rango del grupo? Fechas: ISO (se compara el día, el de la planta si trae offset); números: tal cual. */
export function enRango(f: FiltrosElegidos, grupo: string, valor: string | number | null | undefined): boolean {
  const [desde = '', hasta = ''] = f[grupo] ?? [];
  if (!desde && !hasta) return true;
  if (valor == null || valor === '') return false;
  if (typeof valor === 'number') return (desde === '' || valor >= Number(desde)) && (hasta === '' || valor <= Number(hasta));
  const dia = valor.slice(0, 10);
  return (!desde || dia >= desde) && (!hasta || dia <= hasta);
}

/** Las opciones de una columna a partir de sus filas: cada valor distinto con cuántas lo tienen, en orden alfabético. */
export function opcionesDe<T>(filas: readonly T[], valor: (f: T) => string, nombre: (v: string) => string = (v) => v): OpcionFiltro[] {
  const n = new Map<string, number>();
  for (const f of filas) {
    const v = valor(f);
    if (v) n.set(v, (n.get(v) ?? 0) + 1);
  }
  return [...n].map(([id, c]) => ({ id, nombre: nombre(id), n: c })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const fechaCorta = (v: string) => v.split('-').reverse().join('/');

/**
 * Coloca un `popover` (capa superior, sin layout del padre) bajo su botón, alineado a su borde derecho y sin salirse
 * de la ventana. `anchoMax` es el ancho de la clase del panel en px: cerrado no se puede medir. Usar en `(beforetoggle)`.
 */
export function colocarBajo(panel: HTMLElement, boton: HTMLElement, anchoMax: number): void {
  const r = boton.getBoundingClientRect();
  const ancho = Math.min(anchoMax, innerWidth - 16);
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.right = `${Math.max(8, Math.min(innerWidth - r.right, innerWidth - ancho - 8))}px`;
}

/**
 * El buscador de las listas con sus filtros dentro, como el de Odoo: los filtros activos como etiquetas antes del texto
 * (cada una con su ×) y, al final, el botón de filtros: `popover` nativo con los grupos (casillas con conteo o un rango de fecha o número) y
 * "Quitar filtros". Ningún filtro va fuera de la barra.
 * Uso: `<ui-buscador idBuscar="buscar-x" etiqueta="Buscar …" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />`
 */
@Component({
  selector: 'ui-buscador',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <form role="search" (submit)="$event.preventDefault()">
      <div
        class="flex min-h-9 items-center gap-2 rounded-lg border border-acero-oscuro bg-white/65 pr-1 pl-3 transition-colors hover:border-carbon has-[input[type=search]:focus]:border-epico has-[input[type=search]:focus]:outline-3 has-[input[type=search]:focus]:outline-epico/25"
      >
        <ui-icon [icono]="iconos.buscar" [tamano]="17" class="shrink-0 text-texto-suave max-sm:hidden" />
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5">
          @for (c of etiquetas(); track c.grupo + ':' + c.valor) {
            <span class="inline-flex h-6.5 items-center gap-1 rounded-md bg-epico/10 pl-2 text-sm font-medium text-epico-oscuro">
              <ui-icon [icono]="iconos.filtro" [tamano]="14" class="max-sm:hidden" />
              {{ c.texto }}
              <button
                type="button"
                class="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-epico/15 focus-visible:outline-2 focus-visible:outline-epico"
                [attr.aria-label]="'Quitar filtro: ' + c.texto"
                (click)="quitar(c.grupo, c.valor); entrada.focus()"
              >
                <ui-icon [icono]="iconos.quitar" [tamano]="14" />
              </button>
            </span>
          }
          <label [for]="idBuscar()" class="sr-only">{{ etiqueta() }}</label>
          <input
            #entrada
            [id]="idBuscar()"
            type="search"
            autocomplete="off"
            placeholder="Buscar…"
            class="h-7 min-w-14 flex-1 bg-transparent text-[15px] text-carbon outline-none placeholder:text-texto-suave [&::-webkit-search-cancel-button]:appearance-none"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
            (keydown.escape)="texto.set('')"
          />
        </div>
        @if (enPanel().length) {
          <button
            #boton
            type="button"
            [attr.popovertarget]="idPanel()"
            [attr.aria-label]="etiquetas().length ? 'Filtros (' + etiquetas().length + ' activos)' : 'Filtros'"
            class="flex h-7 shrink-0 items-center rounded-md px-1.5 text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico aria-expanded:bg-carbon/5 aria-expanded:text-carbon"
            [attr.aria-expanded]="abierto()"
          >
            <ui-icon [icono]="iconos.filtro" [tamano]="19" />
          </button>

          <div
            #panel
            [id]="idPanel()"
            popover
            role="dialog"
            aria-label="Filtros"
            class="glass-strong m-0 max-h-[min(32rem,calc(100dvh-6rem))] w-80 overflow-y-auto p-2 text-carbon inset-auto"
            (beforetoggle)="alCambiar($event, panel, boton)"
          >
            @for (g of enPanel(); track g.id; let primero = $first) {
              @if (g.rango) {
                <fieldset class="px-3 pt-1 pb-3">
                  <legend class="pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">{{ g.titulo }}</legend>
                  <div class="grid grid-cols-2 gap-2">
                    @for (lado of [0, 1]; track lado) {
                      <div>
                        <label [for]="idPanel() + '-' + g.id + '-' + lado" class="text-xs text-texto-suave">{{ lado ? 'Hasta' : 'Desde' }}</label>
                        <input
                          [type]="g.rango === 'fecha' ? 'date' : 'number'"
                          [id]="idPanel() + '-' + g.id + '-' + lado"
                          min="0"
                          class="campo mt-0.5 h-9 px-2 text-sm tabular-nums"
                          [attr.autofocus]="primero && !lado ? '' : null"
                          [value]="filtros()[g.id]?.[lado] ?? ''"
                          (change)="ponerRango(g.id, lado, $any($event.target).value)"
                        />
                      </div>
                    }
                  </div>
                </fieldset>
              } @else {
                <fieldset class="pb-1">
                  <legend class="px-3 pt-1 pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">{{ g.titulo }}</legend>
                  @for (o of g.opciones ?? []; track o.id; let primera = $first) {
                    <label
                      class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-medium transition-colors hover:bg-carbon/5 has-checked:bg-epico/8"
                    >
                      <input
                        type="checkbox"
                        class="casilla"
                        [attr.autofocus]="primero && primera ? '' : null"
                        [checked]="(filtros()[g.id] ?? []).includes(o.id)"
                        (change)="alternar(g.id, o.id)"
                      />
                      <span class="flex-1">{{ o.nombre }}</span>
                      @if (o.n != null) {
                        <span class="text-sm text-texto-suave tabular-nums">{{ o.n }}</span>
                      }
                    </label>
                  }
                </fieldset>
              }
            }
            @if (etiquetas().length) {
              <button
                type="button"
                class="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg border-t border-acero/60 px-3 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
                (click)="filtros.set({})"
              >
                <ui-icon [icono]="iconos.limpiar" [tamano]="16" />
                Quitar filtros
              </button>
            }
          </div>
        }
      </div>
    </form>
  `,
})
export class Buscador {
  /** Id del campo de texto (el panel usa id + "-filtros"). */
  readonly idBuscar = input.required<string>();
  /** Nombre accesible del campo: "Buscar obras por nombre, dirección…". */
  readonly etiqueta = input.required<string>();
  readonly texto = model('');
  readonly grupos = input<GrupoFiltro[]>([]);
  readonly filtros = model<FiltrosElegidos>({});

  protected readonly iconos = { buscar: Search, filtro: ListFilter, quitar: X, limpiar: RotateCcw };
  protected readonly abierto = signal(false);
  protected readonly idPanel = computed(() => this.idBuscar() + '-filtros');
  /** En el panel, los rangos y los grupos con más de una opción (o con algo elegido): con una sola no hay qué filtrar. */
  protected readonly enPanel = computed(() =>
    this.grupos().filter((g) => g.rango || (g.opciones?.length ?? 0) > 1 || (this.filtros()[g.id]?.length ?? 0) > 0),
  );

  /** Lo elegido, en el orden de los grupos, como etiquetas del buscador (un rango es una sola etiqueta). */
  protected readonly etiquetas = computed(() =>
    this.grupos().flatMap((g) => {
      const elegidos = this.filtros()[g.id] ?? [];
      if (g.rango) {
        const [desde = '', hasta = ''] = elegidos;
        if (!desde && !hasta) return [];
        const v = (x: string) => (g.rango === 'fecha' ? fechaCorta(x) : `${g.prefijo ?? ''}${Number(x).toLocaleString('es-MX')}${g.sufijo ?? ''}`);
        const texto = desde && hasta ? `${v(desde)} – ${v(hasta)}` : desde ? `desde ${v(desde)}` : `hasta ${v(hasta)}`;
        return [{ grupo: g.id, valor: '', texto: `${g.titulo}: ${texto}` }];
      }
      return elegidos.map((valor) => ({ grupo: g.id, valor, texto: g.opciones?.find((o) => o.id === valor)?.nombre ?? valor }));
    }),
  );

  protected alCambiar(e: Event, panel: HTMLElement, boton: HTMLElement): void {
    this.abierto.set((e as ToggleEvent).newState === 'open');
    if (this.abierto()) colocarBajo(panel, boton, 320); // w-80
  }

  protected alternar(grupo: string, valor: string): void {
    this.filtros.update((f) => {
      const antes = f[grupo] ?? [];
      return { ...f, [grupo]: antes.includes(valor) ? antes.filter((v) => v !== valor) : [...antes, valor] };
    });
  }

  protected ponerRango(grupo: string, lado: number, valor: string): void {
    this.filtros.update((f) => {
      const r = [...(f[grupo] ?? ['', ''])];
      r[lado] = valor;
      return { ...f, [grupo]: r[0] || r[1] ? r : [] };
    });
  }

  /** Quita una opción o, si es un rango (valor ''), el rango completo. */
  protected quitar(grupo: string, valor: string): void {
    this.filtros.update((f) => ({ ...f, [grupo]: valor ? (f[grupo] ?? []).filter((v) => v !== valor) : [] }));
  }
}
