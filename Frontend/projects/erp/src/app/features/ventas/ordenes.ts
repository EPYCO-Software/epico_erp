import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { EstadoCobroEtiqueta, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, PedidoVista } from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, filtrarPedidos } from './datos';
import { DetallePedido } from './detalle-pedido';

/**
 * Ventas → Órdenes: las órdenes de venta (un pedido por entrega) que salen de confirmar cotizaciones, como la lista de
 * Odoo y con lo mismo que Cotizaciones: la barra va en el encabezado, clic o Enter abre la vista previa a la derecha y
 * doble clic la vista completa. Solo las de las plantas elegidas en el encabezado.
 */
@Component({
  selector: 'app-ordenes',
  imports: [
    DecimalPipe,
    RouterLink,
    EstadoCobroEtiqueta,
    EstadoPedidoEtiqueta,
    FechaZonaPipe,
    Icon,
    EnEncabezado,
    PanelLateral,
    DetallePedido,
  ],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          <a routerLink="/ventas/ordenes/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Órdenes de venta</h1>
        </div>
        <form role="search" class="relative min-w-0 flex-1" (submit)="$event.preventDefault()">
          <label for="buscar-orden" class="sr-only">Buscar órdenes por folio, cliente, obra, producto o cotización</label>
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="17"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave max-sm:hidden"
          />
          <input
            id="buscar-orden"
            type="search"
            autocomplete="off"
            placeholder="Buscar…"
            class="campo h-9 rounded-lg bg-white/65! pr-3 pl-3 text-[15px] sm:pl-9"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
            (keydown.escape)="texto.set('')"
          />
        </form>
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <div
            tabindex="0"
            role="region"
            aria-label="Tabla de órdenes de venta"
            [class]="cajas.region"
          >
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-240]="!previa()">
              <caption class="sr-only">
                Órdenes de venta, un pedido por entrega. Clic o Enter en una fila abre su vista previa; doble clic, su vista
                completa. La casilla solo marca.
              </caption>
              <thead [class]="cajas.titulos">
                <tr>
                  <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                    <input
                      type="checkbox"
                      class="casilla block"
                      aria-label="Marcar todas"
                      [checked]="casillas.todas()"
                      [indeterminate]="casillas.algunas()"
                      [disabled]="!filas().length"
                      (change)="casillas.marcarTodas($any($event.target).checked)"
                    />
                  </th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Folio</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Entrega</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Cliente</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Obra</th>
                  <!-- Con la vista previa abierta, producto y cobro se ven en ella -->
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Producto</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">m³</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Importe</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Cobro</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filas(); track p.id) {
                  <tr
                    [id]="'fila-' + p.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [class.text-texto-suave]="p.estado === 'cancelado'"
                    [attr.aria-current]="p.id === vista.abiertaId() ? 'true' : null"
                    (click)="vista.abrir(p.id)"
                    (dblclick)="verCompleta(p)"
                    (keydown.enter)="$event.target === $event.currentTarget && vista.abrir(p.id)"
                  >
                    <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + p.folio"
                        [checked]="casillas.marcadas().includes(p.id)"
                        (change)="casillas.alternar(p.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 font-semibold">{{ p.folio }}</td>
                    <td class="px-3 py-2.5 tabular-nums">{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria }}</td>
                    <td class="px-3 py-2.5">{{ p.clienteNombre }}</td>
                    <td class="px-3 py-2.5">{{ p.obraNombre }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ p.producto }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ p.volumenM3 | number: '1.0-1' }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">$ {{ p.importe | number: '1.2-2' }}</td>
                    <td class="px-3 py-2"><ui-estado-pedido [estado]="p.estado" /></td>
                    <td class="px-3 py-2" [class.hidden]="previa()"><ui-estado-cobro [cobro]="p.cobro" [corto]="true" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="10" class="px-3 py-12 text-center text-texto-suave">
                      Ninguna orden coincide con la búsqueda en las plantas elegidas.
                    </td>
                  </tr>
                }
              </tbody>
              @if (filas().length) {
                <tfoot>
                  <tr>
                    <th scope="row" [attr.colspan]="previa() ? 6 : 7" class="px-3 pt-3 pb-1 text-right font-normal text-texto-suave">
                      Total sin canceladas
                    </th>
                    <td class="px-3 pt-3 pb-1 text-right font-bold tabular-nums">$ {{ total() | number: '1.2-2' }}</td>
                    <td [attr.colspan]="previa() ? 1 : 2"></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as p) {
        <aside appPanelLateral (cerrar)="vista.cerrar()">
          <app-detalle-pedido [p]="p" (cerrar)="vista.cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Ordenes {
  private readonly ventas = inject(VentasService);
  private readonly plantas = inject(PlantasService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly texto = signal('');
  protected readonly filas = computed(() => filtrarPedidos(this.ventas.pedidos(), this.plantas.seleccion(), this.texto()));
  protected readonly total = computed(() =>
    this.filas().reduce((t, p) => (p.estado === 'cancelado' ? t : t + p.importe), 0),
  );
  /** Las marcadas con las casillas; se desmarcan al cambiar la búsqueda o las plantas, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 orden' : `${n} órdenes`;
  });

  protected readonly vista = vistaPrevia();
  /** Contra la lista filtrada: si un filtro la oculta, la vista previa se cierra. */
  protected readonly previa = computed(() => this.filas().find((p) => p.id === this.vista.abiertaId()) ?? null);

  protected verCompleta(p: PedidoVista): void {
    void this.router.navigate(['/ventas/ordenes', p.folio]);
  }
}
