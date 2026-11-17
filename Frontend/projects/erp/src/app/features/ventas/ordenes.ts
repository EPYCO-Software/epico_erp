import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { ESTADO_COBRO, ESTADO_PEDIDO, ESTATUS_PLANTA, EstadoCobro, EstadoCobroEtiqueta, EstadoPedido, EstadoPedidoEtiqueta, EstatusPlanta, FechaZonaPipe, PedidoVista, Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, filtrarPedidos } from './datos';
import { DetallePedido } from './detalle-pedido';
import { PlantaFila } from './planta-pedido';
import { permisosSesion } from '../../core/permisos';

/** La resistencia del concreto de la orden ("f´c 250", "MR 45"): el producto es su descripción completa, única por orden. */
const concretoDe = (producto: string) => /(f´c|f'c|MR)\s*(\d+)/i.exec(producto)?.slice(1, 3).join(' ').replace("f'c", 'f´c') ?? '';

/**
 * Ventas → Órdenes: las órdenes de venta (un pedido por entrega) que salen de confirmar cotizaciones, como la lista de
 * Odoo y con lo mismo que Cotizaciones: la barra va en el encabezado, clic o Enter abre la vista previa a la derecha y
 * doble clic la vista completa. Solo las de las plantas elegidas en el encabezado.
 */
@Component({
  selector: 'app-ordenes',
  imports: [
    Buscador, DecimalPipe,
    RouterLink,
    EstadoCobroEtiqueta,
    EstadoPedidoEtiqueta,
    PlantaFila,
    FechaZonaPipe,
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
          @if (puede('ventas.pedidos.crear')) {
            <a routerLink="/ventas/ordenes/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Órdenes de venta</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-orden"
          etiqueta="Buscar órdenes por folio, cliente, obra, producto o cotización"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <p class="px-1 pt-3 pb-1 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Planta</th>
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
                    <td class="px-3 py-2.5">{{ p.obraNombre }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ p.producto }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ p.volumenM3 | number: '1.0-1' }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">$ {{ p.importe | number: '1.2-2' }}</td>
                    <td class="px-3 py-2"><ui-estado-pedido [estado]="p.estado" /></td>
                    <!-- "Enviar a planta" no abre la fila -->
                    <td class="px-3 py-1.5" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <app-planta-fila [p]="p" (enviado)="aviso.set($event)" />
                    </td>
                    <td class="px-3 py-2" [class.hidden]="previa()"><ui-estado-cobro [cobro]="p.cobro" [corto]="true" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="11" class="px-3 py-12 text-center text-texto-suave">
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
                    <td [attr.colspan]="previa() ? 2 : 3"></td>
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
export default class Ordenes {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly ventas = inject(VentasService);
  private readonly plantas = inject(PlantasService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly texto = signal('');
  protected readonly aviso = signal('');
  private readonly base = computed(() => filtrarPedidos(this.ventas.pedidos(), this.plantas.seleccion(), this.texto()));
  /** Filtros por columna, en el buscador. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly filas = computed(() => {
    const f = this.filtros();
    return this.base().filter(
      (p) =>
        enRango(f, 'entrega', p.fechaHoraEntrega) &&
        pasaFiltro(f, 'concreto', concretoDe(p.producto)) &&
        enRango(f, 'volumen', p.volumenM3) &&
        enRango(f, 'importe', p.importe) &&
        pasaFiltro(f, 'estado', p.estado) &&
        pasaFiltro(f, 'planta', p.plantaId) &&
        pasaFiltro(f, 'estatus', p.estatusPlanta ?? 'no_enviado') &&
        pasaFiltro(f, 'cobro', p.cobro),
    );
  });
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const base = this.base();
    const plantas = new Map(base.map((p) => [p.plantaId, p.plantaNombre]));
    const conteo = (fn: (p: PedidoVista) => boolean) => base.filter(fn).length;
    return [
      { id: 'entrega', titulo: 'Entrega', rango: 'fecha' },
      { id: 'concreto', titulo: 'Concreto', opciones: opcionesDe(base, (p) => concretoDe(p.producto)) },
      { id: 'volumen', titulo: 'Volumen', rango: 'numero', sufijo: ' m³' },
      { id: 'importe', titulo: 'Importe', rango: 'numero', prefijo: '$' },
      { id: 'estado', titulo: 'Estado', opciones: (Object.keys(ESTADO_PEDIDO) as EstadoPedido[]).map((id) => ({ id, nombre: ESTADO_PEDIDO[id], n: conteo((p) => p.estado === id) })) },
      { id: 'planta', titulo: 'Planta', opciones: opcionesDe(base, (p) => p.plantaId, (id) => plantas.get(id) ?? id) },
      { id: 'estatus', titulo: 'Estatus en planta', opciones: (Object.keys(ESTATUS_PLANTA) as EstatusPlanta[]).map((id) => ({ id, nombre: ESTATUS_PLANTA[id], n: conteo((p) => (p.estatusPlanta ?? 'no_enviado') === id) })) },
      { id: 'cobro', titulo: 'Cobro', opciones: (Object.keys(ESTADO_COBRO) as EstadoCobro[]).map((id) => ({ id, nombre: ESTADO_COBRO[id], n: conteo((p) => p.cobro === id) })) },
    ];
  });
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
    if (!this.puedeDejarla()) return;
    void this.router.navigate(['/ventas/ordenes', p.folio]);
  }
}
