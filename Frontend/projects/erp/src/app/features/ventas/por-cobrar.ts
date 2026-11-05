import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Search } from 'lucide';
import { FechaZonaPipe, Icon, METODO_PAGO, PedidoVista } from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, filtrarPedidos } from './datos';
import { DetallePedido } from './detalle-pedido';
import { PlantaFila } from './planta-pedido';

/**
 * Ventas → Por cobrar: solo las órdenes con cobro "Por cobrar" (toda orden nueva nace así), de las plantas elegidas,
 * como las demás listas: casillas (una, varias o todas); clic o Enter abre la vista previa a la derecha (Editar, cobro,
 * método de pago y planta) y doble clic la vista completa. El cobro solo se cambia con la orden abierta (que se vea
 * completa); la que cambia sale de la lista. La planta siempre a la vista: si contestó y, sin enviar, "Enviar a planta"
 * (una o las marcadas) sin abrir la orden.
 */
@Component({
  selector: 'app-por-cobrar',
  imports: [DecimalPipe, DetallePedido, EnEncabezado, FechaZonaPipe, Icon, PanelLateral, PlantaFila],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Por cobrar</h1>
        <form role="search" class="relative min-w-0 flex-1" (submit)="$event.preventDefault()">
          <label for="buscar-por-cobrar" class="sr-only">Buscar órdenes por cobrar por folio, cliente u obra</label>
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="17"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave max-sm:hidden"
          />
          <input
            id="buscar-por-cobrar"
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
          <!-- Las marcadas que aún no van a planta: enviarlas de una vez. El cobro se cambia en la orden abierta. -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 pb-2">
            <p class="text-sm text-texto-suave">
              {{ casillas.marcadas().length ? conteo() : 'Abre una orden para cambiar su cobro.' }}
            </p>
            @if (porEnviar().length) {
              <button type="button" [class]="botonEnviar" (click)="enviarMarcadas()">
                Enviar a planta {{ porEnviar().length === 1 ? 'la seleccionada' : 'las ' + porEnviar().length + ' seleccionadas' }}
              </button>
            }
          </div>
          <p class="px-1 pb-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
          <div tabindex="0" role="region" aria-label="Órdenes por cobrar" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-240]="!previa()">
              <caption class="sr-only">
                Órdenes por cobrar. Clic o Enter en una fila abre su vista previa (ahí se cambia el cobro); doble clic, su
                vista completa. La casilla solo marca; "Enviar a planta" envía el requerimiento sin abrirla.
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
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Obra</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Importe</th>
                  <!-- Con la vista previa abierta, el método de pago se ve en ella; la planta siempre a la vista -->
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Método de pago</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Planta</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filas(); track p.id) {
                  <tr
                    [id]="'fila-' + p.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [attr.aria-current]="p.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(p)"
                    (dblclick)="verCompleta(p)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(p)"
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
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ p.obraNombre }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">$ {{ p.importe | number: '1.2-2' }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ metodos[p.metodoPago ?? 'sin_metodo'] }}</td>
                    <!-- "Enviar a planta" no abre la fila -->
                    <td class="px-3 py-1.5" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <app-planta-fila [p]="p" (enviado)="aviso.set($event)" />
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="px-3 py-12 text-center text-texto-suave">
                      {{ texto() ? 'Ninguna orden por cobrar coincide con la búsqueda.' : 'No hay órdenes por cobrar en las plantas elegidas.' }}
                    </td>
                  </tr>
                }
              </tbody>
              @if (filas().length) {
                <tfoot>
                  <tr>
                    <th scope="row" [attr.colspan]="previa() ? 4 : 5" class="px-3 pt-3 pb-1 text-right font-normal text-texto-suave">
                      Total por cobrar
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
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-pedido [p]="p" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class PorCobrar {
  private readonly ventas = inject(VentasService);
  private readonly plantas = inject(PlantasService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly metodos = METODO_PAGO;
  protected readonly texto = signal('');
  protected readonly aviso = signal('');
  protected readonly filas = computed(() =>
    filtrarPedidos(this.ventas.pedidos(), this.plantas.seleccion(), this.texto()).filter((p) => p.cobro === 'por_cobrar'),
  );
  protected readonly total = computed(() => this.filas().reduce((t, p) => (p.estado === 'cancelado' ? t : t + p.importe), 0));

  /** Las marcadas; se desmarcan al cambiar la búsqueda, las plantas o al salir de la lista (cambiar su cobro). */
  protected readonly casillas = seleccionMultiple(this.filas);
  /** Las marcadas que aún no se envían a planta. */
  protected readonly porEnviar = computed(() =>
    this.filas().filter((p) => this.casillas.marcadas().includes(p.id) && (p.estatusPlanta ?? 'no_enviado') === 'no_enviado'),
  );
  protected readonly botonEnviar =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-epico bg-white px-3 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected enviarMarcadas(): void {
    const lista = this.porEnviar();
    for (const p of lista) this.ventas.estatusPlanta(p.id, 'enviado');
    this.aviso.set(lista.length === 1 ? `${lista[0].folio}: requerimiento enviado a planta.` : `${lista.length} requerimientos enviados a planta.`);
  }
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 orden' : `${n} órdenes`;
  });

  protected readonly vista = vistaPrevia();
  /** Contra la lista: si la orden deja de estar por cobrar (o un filtro la oculta), la vista previa se cierra. */
  protected readonly previa = computed(() => this.filas().find((p) => p.id === this.vista.abiertaId()) ?? null);

  private readonly detalle = viewChild(DetallePedido);

  /** Con cambios sin guardar en el editor de la vista previa, se pregunta antes de dejarla. */
  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en esta orden. ¿Descartarlos?');
  }

  protected abrir(p: PedidoVista): void {
    if (p.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(p.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(p: PedidoVista): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/ordenes', p.folio]);
  }
}
