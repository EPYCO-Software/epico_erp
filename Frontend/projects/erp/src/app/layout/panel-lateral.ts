import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Columna de escritorio que se desplaza con todo y caja (utilidad columna-caja de ui/styles/glass.css): sin barra; al
 * bajar se van las esquinas de arriba de la caja y al final aparecen las de abajo, y donde queda cortada se desvanece
 * en la página. Va de orilla a orilla del <main>: -mt-2 y -mb-5 deshacen el relleno del shell y -mx-3, el de la
 * columna a los lados (deja ver la sombra de la caja). Adentro, una sola caja. Toda caja de las páginas con barra
 * (listas con vista previa y vistas completas) va en una.
 */
export const COLUMNA = 'lg:-mx-3 lg:-mt-2 lg:-mb-5 lg:columna-caja';

/**
 * Las cajas de toda lista con vista previa (cotizaciones, órdenes, clientes…), iguales en todas las secciones: en
 * escritorio, la tabla y la vista previa son columnas del alto disponible (COLUMNA), alineadas arriba y abajo, y cada
 * una se desplaza por su lado; en celular, una debajo de la otra con el scroll de la página.
 */
export const CAJAS_LISTA = {
  /** La tabla y la vista previa lado a lado. */
  contenedor: 'flex flex-col gap-4 lg:h-full lg:flex-row',
  /** La columna de la tabla. */
  columna: COLUMNA + ' lg:min-w-0 lg:flex-1',
  /** La caja de la tabla. */
  tabla: 'glass min-w-0 px-2 pb-2 sm:px-3',
  /**
   * La tabla, que se desplaza de lado si no cabe (sin barra en escritorio; tabindex="0" para el teclado). Hacia abajo
   * se desplaza la columna, con todo y títulos.
   */
  region:
    'overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico lg:sin-barra',
  /** Títulos de las columnas. */
  titulos: 'bg-white/95 shadow-[0_1px_0_var(--color-acero)]',
};

/**
 * Vista previa a la derecha de una lista; en celular, debajo. En escritorio es una columna del alto disponible
 * (COLUMNA). Esc la cierra. Su título lleva id="previa-titulo".
 * `liquido` (prueba en Cotizaciones): Liquid Glass en vez de glass (utilidades vidrio-liquido de ui/styles/glass.css),
 * con una luz en el filo que sigue al puntero.
 */
@Component({
  selector: 'aside[appPanelLateral]',
  host: {
    id: 'previa',
    'aria-labelledby': 'previa-titulo',
    '[class]': 'columna',
    '(keydown.escape)': 'cerrar.emit()',
  },
  template: `
    <div #caja [class]="liquido() ? 'vidrio-liquido' : 'glass'">
      @if (liquido()) {
        <!-- Lo que dobla el fondo en el borde: ondas suaves que desplazan lo de atrás, como el filo de una lente -->
        <svg class="absolute size-0" aria-hidden="true" focusable="false">
          <filter id="vidrio-liquido" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.007 0.011" numOctaves="2" seed="5" result="ruido" />
            <feGaussianBlur in="ruido" stdDeviation="2.5" result="ondas" />
            <feDisplacementMap in="SourceGraphic" in2="ondas" scale="64" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <!-- En este orden: el borde dobla la página nítida; el cuerpo esmerila el centro; el brillo va encima -->
        <span class="vidrio-liquido-borde" aria-hidden="true"></span>
        <span class="vidrio-liquido-cuerpo" aria-hidden="true"></span>
        <span class="vidrio-liquido-brillo" aria-hidden="true"></span>
      }
      <div class="p-4 sm:p-5"><ng-content /></div>
    </div>
  `,
})
export class PanelLateral {
  readonly cerrar = output();
  readonly liquido = input(false, { transform: booleanAttribute });
  // 29.5rem: los 28rem (w-md) de la caja más el relleno de la columna, que deja ver su sombra.
  protected readonly columna = COLUMNA + ' block lg:w-[29.5rem] lg:shrink-0';
  private readonly caja = viewChild.required<ElementRef<HTMLElement>>('caja');

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // La luz sigue al puntero, medida sobre la caja (se mueve dentro de la columna). Con un listener nativo:
    // moverlo no debe disparar la detección de cambios.
    const luz = (e: PointerEvent) => {
      const r = this.caja().nativeElement.getBoundingClientRect();
      el.style.setProperty('--luz-x', `${e.clientX - r.left}px`);
      el.style.setProperty('--luz-y', `${e.clientY - r.top}px`);
    };
    afterNextRender(() => {
      if (this.liquido() && !matchMedia('(prefers-reduced-motion: reduce)').matches) el.addEventListener('pointermove', luz);
    });
    inject(DestroyRef).onDestroy(() => el.removeEventListener('pointermove', luz));
  }
}

/** Fila de una lista con vista previa: clic o Enter la abre; la abierta lleva tinte y barra roja (aria-current). */
export const FILA_LISTA =
  'cursor-pointer border-b border-acero/50 hover:bg-carbon/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico aria-current:bg-[#FDF2F2] aria-current:[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-epico)]';

/**
 * Casillas de una lista (como en Odoo): marcar una, varias o todas. Se desmarcan solas cuando cambian las filas que se
 * ven (búsqueda, filtros, plantas), no cuando solo cambian sus datos. Llamar en un inicializador de campo.
 */
export function seleccionMultiple(filas: Signal<{ id: string }[]>) {
  const ids = computed(() => filas().map((f) => f.id).join('|'));
  const marcadas = linkedSignal({ source: ids, computation: (): string[] => [] });
  const todas = computed(() => filas().length > 0 && marcadas().length === filas().length);
  return {
    marcadas: marcadas.asReadonly(),
    todas,
    /** Alguna, no todas: la casilla de arriba va a medias. */
    algunas: computed(() => marcadas().length > 0 && !todas()),
    marcarTodas(si: boolean): void {
      marcadas.set(si ? filas().map((f) => f.id) : []);
    },
    alternar(id: string): void {
      marcadas.update((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]));
    },
  };
}

/**
 * Qué fila está abierta en la vista previa. Al abrir, el foco pasa al título del panel (el lector lo anuncia y, en
 * celular, queda a la vista); al cerrar, vuelve a su fila (id "fila-" + id). Llamar en un inicializador de campo.
 */
export function vistaPrevia() {
  const injector = inject(Injector);
  const abiertaId = signal<string | null>(null);
  return {
    abiertaId: abiertaId.asReadonly(),
    abrir(id: string): void {
      abiertaId.set(id);
      afterNextRender(() => document.getElementById('previa-titulo')?.focus(), { injector });
    },
    cerrar(): void {
      const fila = document.getElementById('fila-' + abiertaId());
      abiertaId.set(null);
      fila?.focus();
    },
  };
}
