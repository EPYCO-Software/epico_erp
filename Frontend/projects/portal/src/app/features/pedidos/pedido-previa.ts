import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArrowRight, Truck } from 'lucide';
import { EstadoPedidoEtiqueta, FechaZonaPipe, Icon, PedidoVista, Pipeline } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { SeguimientoService } from '../../core/services/seguimiento.service';
import { CobroPedido } from './cobro-pedido';
import { etapasFlujo } from './flujo';
import { senal } from './seguimiento';
import { porEntregarse } from './seguimiento-entrega';

/** Vista previa de un pedido en Mis pedidos (columna derecha), sin salir de la lista. */
@Component({
  selector: 'app-pedido-previa',
  imports: [CobroPedido, DecimalPipe, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, Pipeline, RouterLink],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-2">
      <h2 id="previa-titulo" class="text-lg font-bold">Pedido {{ p().folio }}</h2>
      <ui-estado-pedido [estado]="p().estado" />
    </div>
    <ui-pipeline class="mt-3" [etapas]="etapas()" etiqueta="Flujo del pedido" />

    <dl class="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      <dt class="text-texto-suave">Producto</dt>
      <dd class="font-medium">{{ p().producto }}</dd>
      <dt class="text-texto-suave">Volumen</dt>
      <dd>{{ p().volumenM3 | number: '1.0-1' }} m³</dd>
      <dt class="text-texto-suave">Entrega</dt>
      <dd>{{ p().fechaHoraEntrega | fechaZona: p().zonaHoraria }}</dd>
      <dt class="text-texto-suave">Obra</dt>
      <dd><a [routerLink]="['/obras', p().obraId]" class="font-medium underline-offset-4 hover:text-epico hover:underline">{{ p().obraNombre }}</a></dd>
      <dt class="text-texto-suave">Cotización</dt>
      <dd>
        @if (cotizacion(); as c) {
          <a [routerLink]="['/cotizaciones', c.folio]" class="underline-offset-4 hover:text-epico hover:underline">{{ c.folio }}</a>
        } @else {
          <span class="text-texto-suave">Pedido directo</span>
        }
      </dd>
    </dl>

    @if (porEntregarse()) {
      <a
        [routerLink]="['/pedidos', p().folio]"
        fragment="seguimiento"
        class="mt-4 flex items-center gap-3 rounded-xl bg-[#FDF2F2] px-3 py-2.5 text-sm hover:bg-[#FBE6E6] focus-visible:outline-2 focus-visible:outline-epico"
      >
        <ui-icon [icono]="iconos.camion" [tamano]="20" class="text-epico" />
        <span class="min-w-0 flex-1">
          <span class="block font-semibold text-epico-oscuro">Ver dónde van los camiones</span>
          <span class="block text-xs text-texto-suave">{{ resumenCamiones() }}</span>
        </span>
        <ui-icon [icono]="iconos.abrir" [tamano]="16" class="text-epico-oscuro" />
      </a>
    }

    <h3 class="mt-5 mb-2 text-sm font-bold tracking-wide text-texto-suave uppercase">Estado de cuenta</h3>
    <app-cobro-pedido [p]="p()" />

    <a [routerLink]="['/pedidos', p().folio]" class="boton-primario mt-5 h-11">
      Abrir pedido<ui-icon [icono]="iconos.abrir" [tamano]="18" />
    </a>
  `,
})
export class PedidoPrevia {
  readonly p = input.required<PedidoVista>();
  private readonly cotizaciones = inject(CotizacionService);
  private readonly seguimiento = inject(SeguimientoService);
  protected readonly iconos = { abrir: ArrowRight, camion: Truck };
  protected readonly porEntregarse = computed(() => porEntregarse(this.p()));
  protected readonly resumenCamiones = computed(() => {
    const v = this.seguimiento.viajesDe(this.p().id);
    if (!v.length) return 'Aún sin camiones asignados';
    const vivos = v.filter((x) => senal(x, this.seguimiento.ahora()) === 'en_vivo').length;
    return `${v.length} ${v.length === 1 ? 'camión' : 'camiones'} · ${vivos} en vivo`;
  });
  protected readonly cotizacion = computed(() => this.cotizaciones.buscarCotizacion(this.p().cotizacionId));
  protected readonly etapas = computed(() => etapasFlujo(this.cotizacion(), [this.p()], 'pedido'));
}
