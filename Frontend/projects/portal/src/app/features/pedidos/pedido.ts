import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FileText } from 'lucide';
import { FechaZonaPipe, Icon, Mapa, Pipeline } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { ObrasService } from '../../core/services/obras.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { CobroPedido } from './cobro-pedido';
import { EstadoPedidoEtiqueta } from './estado-pedido';
import { SeguimientoEntrega, porEntregarse } from './seguimiento-entrega';
import { etapasFlujo } from './flujo';

/** Página de un pedido: encabezado con el flujo y regreso a la cotización que lo originó. */
@Component({
  selector: 'app-pedido',
  imports: [CobroPedido, DecimalPipe, EstadoPedidoEtiqueta, SeguimientoEntrega, FechaZonaPipe, Icon, Mapa, Pipeline, RouterLink],
  template: `
    <nav aria-label="Ruta de navegación" class="mb-2 text-sm">
      <ol class="flex flex-wrap items-center gap-1.5 text-texto-suave">
        <li><a routerLink="/pedidos" class="font-medium text-epico underline-offset-4 hover:underline">Mis pedidos</a></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{{ folio() }}</li>
      </ol>
    </nav>

    @if (pedido(); as p) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-[-0.02em]">Pedido {{ p.folio }}</h1>
          <p class="mt-1"><app-estado-pedido [estado]="p.estado" /></p>
        </div>
        <ui-pipeline [etapas]="etapas()" etiqueta="Flujo del pedido" />
      </header>

      @if (porEntregarse()) {
        <section id="seguimiento" aria-labelledby="seguimiento-titulo" class="glass mb-4 scroll-mt-24 p-4 sm:p-5">
          <app-seguimiento-entrega [p]="p" />
        </section>
      }
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="datos-titulo" class="glass p-4 sm:p-5">
          <h2 id="datos-titulo" class="text-lg font-bold">Datos del pedido</h2>
          <dl class="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt class="text-texto-suave">Producto</dt>
            <dd class="font-medium">{{ p.producto }}</dd>
            <dt class="text-texto-suave">Volumen</dt>
            <dd>{{ p.volumenM3 | number: '1.0-1' }} m³</dd>
            <dt class="text-texto-suave">Entrega programada</dt>
            <dd>{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria }} <span class="text-texto-suave">(hora de la planta)</span></dd>
            <dt class="text-texto-suave">Obra</dt>
            <dd><a [routerLink]="['/obras', p.obraId]" class="font-medium underline-offset-4 hover:text-epico hover:underline">{{ p.obraNombre }}</a>@if (obra(); as o) {<span class="text-texto-suave"> · {{ o.direccion }}, {{ o.municipio }}</span>}</dd>
            <dt class="text-texto-suave">Cotización de origen</dt>
            <dd>
              @if (cotizacion(); as c) {
                <a
                  [routerLink]="['/cotizaciones', c.folio]"
                  class="inline-flex items-center gap-1.5 font-semibold text-epico underline underline-offset-4 hover:text-epico-oscuro"
                >
                  <ui-icon [icono]="iconos.cotizacion" [tamano]="16" />{{ c.folio }}
                </a>
              } @else {
                <span class="text-texto-suave">Pedido directo (sin cotización del portal)</span>
              }
            </dd>
          </dl>
          <h2 class="mt-6 mb-2 text-lg font-bold">Estado de cuenta</h2>
          <app-cobro-pedido class="block max-w-sm" [p]="p" />
        </section>
        @if (obra(); as o) {
          <ui-mapa class="h-64 lg:h-full" [ubicacion]="o.ubicacion" [direccion]="o.direccion + ', ' + o.municipio" [titulo]="'Mapa de la obra ' + o.nombre" />
        }
      </div>
    } @else {
      <p class="glass px-5 py-8 text-center text-texto-suave">
        No encontramos el pedido {{ folio() }}.
        <a routerLink="/pedidos" class="font-semibold text-epico underline underline-offset-4">Ver mis pedidos</a>
      </p>
    }
  `,
})
export default class PedidoDetalle {
  /** Parámetro de la ruta. */
  readonly folio = input.required<string>();

  private readonly pedidos = inject(PedidosService);
  private readonly cotizaciones = inject(CotizacionService);
  private readonly obras = inject(ObrasService);
  protected readonly iconos = { cotizacion: FileText };

  protected readonly pedido = computed(() => this.pedidos.buscar(this.folio()));
  protected readonly porEntregarse = computed(() => porEntregarse(this.pedido()));
  protected readonly obra = computed(() => this.obras.buscar(this.pedido()?.obraId ?? null));
  protected readonly cotizacion = computed(() => this.cotizaciones.buscarCotizacion(this.pedido()?.cotizacionId));
  /** El flujo considera todos los pedidos de la misma cotización. */
  protected readonly etapas = computed(() => {
    const p = this.pedido()!;
    const hermanos = p.cotizacionId ? this.pedidos.deCotizacion(p.cotizacionId) : [p];
    return etapasFlujo(this.cotizacion(), hermanos.length > 1 ? hermanos : [p], 'pedido');
  });
}
