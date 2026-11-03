import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface EtapaPipeline {
  etiqueta: string;
  estado: 'hecha' | 'actual' | 'pendiente';
  /** Folio o dato breve bajo la etiqueta (p. ej. el folio del documento de esa etapa). */
  detalle?: string;
  /** Ruta interna al documento de esa etapa; sin ella la etapa no es enlace. */
  enlace?: string;
}

/**
 * Barra de etapas del flujo de un documento (cotización → pedido → entrega…), al estilo de la barra de estado de
 * Odoo. Cada etapa con documento es un enlace para ir y volver entre ellos.
 */
@Component({
  selector: 'ui-pipeline',
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <nav [attr.aria-label]="etiqueta()">
      <ol class="flex flex-wrap gap-1">
        @for (e of etapas(); track e.etiqueta; let i = $index) {
          <li class="flex items-center gap-1" [attr.aria-current]="e.estado === 'actual' ? 'step' : null">
            @if (i > 0) {
              <span aria-hidden="true" class="text-acero-oscuro">›</span>
            }
            @if (e.enlace) {
              <a [routerLink]="e.enlace" [class]="clase(e) + ' underline-offset-4 hover:underline'">
                @if (e.estado === 'hecha') {
                  <span aria-hidden="true">✓ </span>
                }
                {{ e.etiqueta }}<span class="sr-only">{{ textoEstado(e) }}</span>
                <span class="block text-[0.6875rem] leading-tight font-medium empty:hidden">{{ e.detalle }}</span>
              </a>
            } @else {
              <span [class]="clase(e)">
                @if (e.estado === 'hecha') {
                  <span aria-hidden="true">✓ </span>
                }
                {{ e.etiqueta }}<span class="sr-only">{{ textoEstado(e) }}</span>
                <span class="block text-[0.6875rem] leading-tight font-medium empty:hidden">{{ e.detalle }}</span>
              </span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Pipeline {
  readonly etapas = input.required<EtapaPipeline[]>();
  readonly etiqueta = input('Flujo del documento');

  protected clase(e: EtapaPipeline): string {
    const base = 'block rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
    if (e.estado === 'actual') return `${base} bg-epico text-white shadow-md shadow-epico/25`;
    if (e.estado === 'hecha') return `${base} bg-white text-carbon ring-1 ring-acero`;
    return `${base} text-texto-suave`;
  }

  protected textoEstado(e: EtapaPipeline): string {
    return { hecha: ' (completada)', actual: ' (etapa actual)', pendiente: ' (pendiente)' }[e.estado];
  }
}
