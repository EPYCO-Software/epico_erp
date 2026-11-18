import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Maximize2, X } from 'lucide';
import { EstadoPedidoEtiqueta, Icon, PedidoVista } from 'ui';
import { ViajesPedido } from '../ventas/viajes-pedido';
import { ReagendaOrden } from './reagenda-orden';

/**
 * Vista previa de una orden para logística (Órdenes, Despacho): sus datos, la fecha de entrega (reagendar o solicitar)
 * y sus unidades (asignar, avanzar, tiempo de viaje). El botón de ampliar abre la orden completa de Ventas.
 */
@Component({
  selector: 'app-previa-orden',
  imports: [DecimalPipe, EstadoPedidoEtiqueta, Icon, RouterLink, ReagendaOrden, ViajesPedido],
  host: { class: 'block' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="previa-titulo" tabindex="-1" class="flex flex-wrap items-center gap-2 text-lg font-bold outline-none">
          {{ p().folio }}<ui-estado-pedido [estado]="p().estado" />
        </h2>
        <p class="text-sm text-texto-suave">{{ p().producto }} · {{ p().volumenM3 | number: '1.0-1' }} m³</p>
      </div>
      <div class="-mt-1 -mr-1 flex shrink-0">
        <a [routerLink]="['/ventas/ordenes', p().folio]" aria-label="Abrir la orden completa" title="Abrir la orden completa" [class]="botonIcono">
          <ui-icon [icono]="iconos.completa" [tamano]="17" />
        </a>
        <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
          <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
        </button>
      </div>
    </div>
    <dl class="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      <dt class="text-texto-suave">Cliente</dt>
      <dd>{{ p().clienteNombre }}</dd>
      <dt class="text-texto-suave">Obra</dt>
      <dd>{{ p().obraNombre }}</dd>
      <dt class="text-texto-suave">Planta</dt>
      <dd>{{ p().plantaNombre }}</dd>
      <dt class="text-texto-suave">Situación</dt>
      <dd>{{ p().confirmadaEn ? 'Confirmada' : 'Solicitud de confirmación (esperando a planta)' }}</dd>
    </dl>
    <app-reagenda-orden class="mt-4" [p]="p()" (cambio)="cambio.emit()" />
    <app-viajes-pedido class="mt-3" [p]="p()" (cambio)="cambio.emit()" />
  `,
})
export class PreviaOrden {
  readonly p = input.required<PedidoVista>();
  readonly cerrar = output();
  /** Algo cambió (fecha, unidades, tiempos): quien la usa recarga lo suyo. */
  readonly cambio = output<void>();

  protected readonly iconos = { cerrar: X, completa: Maximize2 };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
}
