import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FileText } from 'lucide';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { BotonRelacion, CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, registro } from './datos';
import { DetallePedido } from './detalle-pedido';

/**
 * Vista completa de una orden de venta (/ventas/ordenes/:folio), como el formulario de Odoo: en la barra "Nuevo", la
 * ruta de regreso a Órdenes de venta y el botón a la cotización de la que salió (trazabilidad); debajo, la hoja
 * (detalle-pedido.ts). Se abre con doble clic en Órdenes, con el botón de vista completa o desde su cotización.
 */
@Component({
  selector: 'app-pedido',
  imports: [RouterLink, EnEncabezado, BotonRelacion, Historial, RutaNavegacion, DetallePedido],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a routerLink="/ventas/ordenes/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
        <app-ruta-navegacion lista="Órdenes de venta" ruta="/ventas/ordenes" [actual]="folio()" />
        @if (cotizacion(); as c) {
          <app-boton-relacion
            class="sm:ml-6"
            etiqueta="Cotización"
            [valor]="c.folio"
            [ruta]="['/ventas/cotizaciones', c.id]"
            [icono]="iconoCotizacion"
          />
        }
      </div>
    </ng-template>

    @if (p(); as p) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-pedido vista="completa" [p]="p" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.pedido(p.folio)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos la orden {{ folio() }}</h1>
        <a
          routerLink="/ventas/ordenes"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a órdenes de venta</a
        >
      </section>
    }
  `,
})
export default class PedidoVenta {
  /** De la ruta /ventas/ordenes/:folio */
  readonly folio = input.required<string>();

  private readonly ventas = inject(VentasService);
  protected readonly p = computed(() => this.ventas.pedidos().find((x) => x.folio === this.folio()));
  protected readonly cotizacion = computed(() => this.ventas.cotizaciones().find((c) => c.id === this.p()?.cotizacionId));
  protected readonly iconoCotizacion = FileText;
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
