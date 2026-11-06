import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from 'ui';
import { PLANTILLAS } from './lealtad';

/** Las 7 plantillas en tarjetas, como en Odoo: cada una lleva al alta con esa plantilla. */
@Component({
  selector: 'app-plantillas-programa',
  imports: [Icon, RouterLink],
  host: { class: 'block' },
  template: `
    <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Plantillas">
      @for (p of plantillas; track p.tipo) {
        <li>
          <a
            routerLink="/ventas/descuentos-y-lealtad/nuevo"
            [queryParams]="{ plantilla: p.tipo }"
            class="flex h-full gap-4 rounded-2xl border border-acero/70 bg-white/80 p-5 transition-colors hover:border-epico/60 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
          >
            <ui-icon [icono]="p.icono" [tamano]="34" [grosor]="1.4" class="shrink-0 text-epico-oscuro" />
            <span>
              <span class="block text-lg leading-tight font-bold">{{ p.nombre }}</span>
              <span class="mt-2 block text-sm text-texto-suave">{{ p.descripcion }}</span>
            </span>
          </a>
        </li>
      }
    </ul>
  `,
})
export class PlantillasPrograma {
  protected readonly plantillas = PLANTILLAS;
}
