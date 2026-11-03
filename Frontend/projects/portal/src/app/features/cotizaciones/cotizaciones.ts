import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronDown, GitBranch } from 'lucide';
import { Icon, PageHeader } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { CotizacionFila } from './cotizacion-fila';

/** Cotizaciones guardadas, una tarjeta por serie: la versión vigente arriba y sus revisiones anteriores anidadas. */
@Component({
  selector: 'app-cotizaciones',
  imports: [CotizacionFila, Icon, PageHeader, RouterLink],
  template: `
    <ui-page-header title="Mis cotizaciones" subtitle="Consulta, descarga, modifica o toma de base tus cotizaciones guardadas" />
    @for (s of series(); track s.actual.serie) {
      <article class="glass mb-4 p-4 sm:p-5" [attr.aria-label]="'Cotización ' + s.actual.folio">
        <app-cotizacion-fila [c]="s.actual" [vigente]="s.anteriores.length > 0" />

        @if (s.anteriores.length) {
          <div class="mt-4 border-t border-acero/60 pt-3">
            <button
              type="button"
              class="flex min-h-10 items-center gap-2 rounded text-sm font-semibold text-texto-suave hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
              [attr.aria-expanded]="abiertas().has(s.actual.serie)"
              [attr.aria-controls]="'versiones-' + s.actual.id"
              (click)="alternar(s.actual.serie)"
            >
              <ui-icon [icono]="iconos.serie" [tamano]="16" />
              Versiones anteriores ({{ s.anteriores.length }})
              <ui-icon [icono]="iconos.desplegar" [tamano]="16" [class.rotate-180]="abiertas().has(s.actual.serie)" />
            </button>
            @if (abiertas().has(s.actual.serie)) {
              <ol [id]="'versiones-' + s.actual.id" class="mt-2 space-y-3 border-l-2 border-acero pl-4 sm:ml-2">
                @for (c of s.anteriores; track c.id) {
                  <li class="rounded-xl bg-white/60 p-3 sm:p-4"><app-cotizacion-fila [c]="c" [anidada]="true" /></li>
                }
              </ol>
            }
          </div>
        }
      </article>
    } @empty {
      <p class="glass px-5 py-8 text-center text-texto-suave">
        Aún no tienes cotizaciones guardadas.
        <a routerLink="/catalogo" class="font-semibold text-epico underline underline-offset-4 hover:text-epico-oscuro">Configura tu pedido</a>
      </p>
    }
  `,
})
export default class Cotizaciones {
  protected readonly series = inject(CotizacionService).series;
  protected readonly iconos = { serie: GitBranch, desplegar: ChevronDown };
  /** Series con las versiones anteriores desplegadas. */
  protected readonly abiertas = signal(new Set<string>());

  protected alternar(serie: string): void {
    this.abiertas.update((a) => {
      const n = new Set(a);
      if (!n.delete(serie)) n.add(serie);
      return n;
    });
  }
}
