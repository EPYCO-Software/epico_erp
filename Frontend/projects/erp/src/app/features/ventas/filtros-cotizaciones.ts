import { Component, model, signal } from '@angular/core';
import { ListFilter } from 'lucide';
import { EstadoCotizacion, Icon } from 'ui';
import { colocarBajo } from '../../layout/popover';
import { ESTADOS_COTIZACION } from './datos';

/**
 * Botón de filtros al final del buscador de cotizaciones (el desplegable del buscador de Odoo): "Mis cotizaciones" y
 * estados, que se suman. Mismo panel que el filtro de módulos: `popover` nativo con casillas, sigue abierto mientras
 * marcas. El alto lo da quien lo usa, con una clase en el host.
 */
@Component({
  selector: 'app-filtros-cotizaciones',
  imports: [Icon],
  host: { class: 'flex' },
  template: `
    <button
      #boton
      type="button"
      popovertarget="filtros-cotizaciones"
      aria-label="Filtrar cotizaciones"
      class="flex h-full items-center rounded-md px-1.5 text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico aria-expanded:bg-carbon/5 aria-expanded:text-carbon"
      [attr.aria-expanded]="abierto()"
    >
      <ui-icon [icono]="iconoFiltro" [tamano]="19" />
    </button>

    <div
      #panel
      id="filtros-cotizaciones"
      popover
      role="dialog"
      aria-label="Filtros de cotizaciones"
      class="glass-strong m-0 w-64 p-2 text-carbon inset-auto"
      (beforetoggle)="alCambiar($event, panel, boton)"
    >
      <fieldset>
        <legend class="px-3 pt-1 pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">Filtros</legend>
        <label class="{{ opcion }}">
          <input
            type="checkbox"
            class="casilla"
            autofocus
            [checked]="soloMias()"
            (change)="soloMias.set($any($event.target).checked)"
          />
          Mis cotizaciones
        </label>
      </fieldset>
      <hr class="mx-3 my-1 border-acero/50" />
      <fieldset>
        <legend class="px-3 pt-1 pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">Estado</legend>
        @for (e of opciones; track e.id) {
          <label class="{{ opcion }}">
            <input type="checkbox" class="casilla" [checked]="estados().includes(e.id)" (change)="alternar(e.id)" />
            {{ e.nombre }}
          </label>
        }
      </fieldset>
    </div>
  `,
})
export class FiltrosCotizaciones {
  readonly soloMias = model.required<boolean>();
  readonly estados = model.required<EstadoCotizacion[]>();

  protected readonly opciones = (Object.keys(ESTADOS_COTIZACION) as EstadoCotizacion[]).map((id) => ({
    id,
    nombre: ESTADOS_COTIZACION[id].nombre,
  }));
  protected readonly opcion =
    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 font-medium transition-colors hover:bg-carbon/5 has-checked:bg-epico/8';
  protected readonly iconoFiltro = ListFilter;
  protected readonly abierto = signal(false);

  protected alCambiar(e: Event, panel: HTMLElement, boton: HTMLElement): void {
    this.abierto.set((e as ToggleEvent).newState === 'open');
    if (this.abierto()) colocarBajo(panel, boton, 256); // w-64
  }

  protected alternar(id: EstadoCotizacion): void {
    this.estados.update((antes) => (antes.includes(id) ? antes.filter((e) => e !== id) : [...antes, id]));
  }
}
