import { Component, inject, signal } from '@angular/core';
import { ListFilter } from 'lucide';
import { Icon } from 'ui';
import { FILTROS_MODULOS, FiltroModulos, ModulosService, modulosDelFiltro } from '../../core/modulos';
import { colocarBajo } from '../../layout/popover';

let instancias = 0;

/**
 * Botón de filtros al final del buscador de módulos. Los filtros se suman con casillas: Activados (por defecto) y
 * Favoritos se combinan; "Todos los módulos" quita los demás. El panel es un `popover` nativo, como el selector de
 * plantas: sigue abierto mientras marcas, cierra con Esc o al hacer clic fuera y devuelve el foco al botón.
 * El alto lo da quien lo usa, con una clase en el host.
 */
@Component({
  selector: 'app-filtro-modulos',
  imports: [Icon],
  host: { class: 'flex' },
  template: `
    <button
      #boton
      type="button"
      class="flex h-full items-center rounded-md px-1.5 text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico aria-expanded:bg-carbon/5 aria-expanded:text-carbon"
      [attr.aria-label]="'Filtrar módulos: ' + modulos.descripcion()"
      [attr.aria-expanded]="abierto()"
      [attr.popovertarget]="idPanel"
    >
      <ui-icon [icono]="iconoFiltro" [tamano]="19" />
    </button>

    <div
      #panel
      popover
      [id]="idPanel"
      role="dialog"
      aria-label="Filtros de módulos"
      class="glass-strong m-0 w-64 p-2 text-carbon inset-auto"
      (beforetoggle)="alCambiar($event, panel, boton)"
    >
      <fieldset>
        <legend class="px-3 pt-1 pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">Mostrar</legend>
        @for (f of filtros; track f.id) {
          @if (f.id === 'todos') {
            <hr class="mx-3 my-1 border-acero/50" />
          }
          <label
            class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-medium transition-colors hover:bg-carbon/5 has-checked:bg-epico/8"
          >
            <input
              #casilla
              type="checkbox"
              class="casilla"
              [checked]="modulos.filtros().includes(f.id)"
              [attr.autofocus]="$first ? '' : null"
              (change)="alternar(f.id, casilla)"
            />
            <span class="flex-1">{{ f.nombre }}</span>
            <span class="text-sm text-texto-suave">{{ conteo(f.id) }}</span>
          </label>
        }
      </fieldset>
    </div>
  `,
})
export class BotonFiltroModulos {
  protected readonly modulos = inject(ModulosService);
  protected readonly filtros = FILTROS_MODULOS;
  protected readonly iconoFiltro = ListFilter;
  protected readonly abierto = signal(false);
  /** Hay dos (encabezado y buscador de celular): cada panel con su id. */
  protected readonly idPanel = `filtro-modulos-${++instancias}`;

  protected conteo(filtro: FiltroModulos): number {
    return modulosDelFiltro([filtro], this.modulos.favoritos()).length;
  }

  protected alCambiar(e: Event, panel: HTMLElement, boton: HTMLElement): void {
    this.abierto.set((e as ToggleEvent).newState === 'open');
    if (this.abierto()) colocarBajo(panel, boton, 256); // w-64
  }

  protected alternar(id: FiltroModulos, casilla: HTMLInputElement): void {
    this.modulos.alternarFiltro(id);
    // "Todos" no se desmarca solo (siempre queda algo): la casilla vuelve a quedar marcada.
    casilla.checked = this.modulos.filtros().includes(id);
  }
}
