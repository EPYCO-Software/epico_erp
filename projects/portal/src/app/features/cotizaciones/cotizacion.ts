import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClipboardCheck, Info } from 'lucide';
import { Icon, Pipeline } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { etapasFlujo } from '../pedidos/flujo';
import { CotizacionFila } from './cotizacion-fila';

/** Página de una cotización: encabezado con el flujo (cotización → pedido → entrega) y su detalle. */
@Component({
  selector: 'app-cotizacion',
  imports: [CotizacionFila, Icon, Pipeline, RouterLink],
  template: `
    <nav aria-label="Ruta de navegación" class="mb-2 text-sm">
      <ol class="flex flex-wrap items-center gap-1.5 text-texto-suave">
        <li><a routerLink="/cotizaciones" class="font-medium text-epico underline-offset-4 hover:underline">Mis cotizaciones</a></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{{ folio() }}</li>
      </ol>
    </nav>

    @if (cot(); as c) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <h1 class="text-2xl font-bold tracking-[-0.02em]">Cotización {{ c.folio }}</h1>
        <ui-pipeline [etapas]="etapas()" etiqueta="Flujo de la cotización" />
      </header>

      @if (sustituta(); as s) {
        <p class="mb-4 flex items-start gap-2 rounded-xl bg-[#EAF3F7] px-4 py-3 text-sm">
          <ui-icon [icono]="iconos.info" [tamano]="18" class="mt-px shrink-0 text-[#2B5F75]" />
          <span>
            Esta versión fue sustituida por
            <a [routerLink]="['/cotizaciones', s.folio]" class="font-semibold text-[#2B5F75] underline underline-offset-4">{{ s.folio }}</a>.
          </span>
        </p>
      } @else if (!pedidos().length) {
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/80 px-4 py-3 shadow-sm">
          <p class="text-sm"><span class="font-semibold">¿Todo listo?</span> Al aceptar se genera un pedido por producto, ligado a esta cotización.</p>
          <button type="button" class="boton-primario h-11 w-auto px-5" (click)="aceptar()">
            <ui-icon [icono]="iconos.pedido" [tamano]="18" />Aceptar y generar pedido
          </button>
        </div>
      }
      <p class="sr-only" aria-live="polite">{{ aviso() }}</p>

      <article class="glass p-4 sm:p-5" [attr.aria-label]="'Cotización ' + c.folio">
        <app-cotizacion-fila [c]="c" [expandida]="true" [enlazar]="false" [vigente]="!sustituta() && esSerie()" />
      </article>
    } @else {
      <p class="glass px-5 py-8 text-center text-texto-suave">
        No encontramos la cotización {{ folio() }}.
        <a routerLink="/cotizaciones" class="font-semibold text-epico underline underline-offset-4">Ver mis cotizaciones</a>
      </p>
    }
  `,
})
export default class Cotizacion {
  /** Parámetro de la ruta. */
  readonly folio = input.required<string>();

  private readonly cotizaciones = inject(CotizacionService);
  private readonly pedidosService = inject(PedidosService);
  protected readonly iconos = { pedido: ClipboardCheck, info: Info };
  protected readonly aviso = signal('');

  protected readonly cot = computed(() => this.cotizaciones.cotizaciones().find((c) => c.folio === this.folio()) ?? null);
  private readonly serie = computed(() => this.cotizaciones.series().find((s) => s.actual.serie === this.cot()?.serie));
  /** Versión vigente de la serie, si no es esta. */
  protected readonly sustituta = computed(() => {
    const vigente = this.serie()?.actual;
    return vigente && vigente.id !== this.cot()?.id ? vigente : null;
  });
  protected readonly esSerie = computed(() => !!this.serie()?.anteriores.length);
  protected readonly pedidos = computed(() => (this.cot() ? this.pedidosService.deCotizacion(this.cot()!.id) : []));
  protected readonly etapas = computed(() => etapasFlujo(this.cot(), this.pedidos(), 'cotizacion'));

  protected aceptar(): void {
    const nuevos = this.pedidosService.generarDesdeCotizacion(this.cot()!);
    this.aviso.set(`Cotización aceptada. ${nuevos.length === 1 ? 'Se generó el pedido' : 'Se generaron los pedidos'} ${nuevos.map((p) => p.folio).join(', ')}.`);
  }
}
