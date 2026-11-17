import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MousePointerClick } from 'lucide';
import {
  Buscador,
  ESTADO_COBRO,
  FiltrosElegidos,
  GrupoFiltro,
  enRango,
  opcionesDe,
  pasaFiltro,
  ESTADO_PEDIDO,
  EstadoCobroEtiqueta,
  EstadoPedidoEtiqueta,
  FechaZonaPipe,
  Icon,
  PageHeader,
  PedidoVista,
  pesos,
} from 'ui';
import { PedidosService } from '../../core/services/pedidos.service';
import { PedidoPrevia } from './pedido-previa';

/**
 * Mis pedidos: un clic en la fila muestra la vista previa a la derecha; doble clic (o el folio) abre el pedido.
 * Con teclado: Tab hasta la fila y Enter para la vista previa.
 */
@Component({
  selector: 'app-pedidos',
  imports: [
    Buscador,
    DecimalPipe,
    EstadoCobroEtiqueta,
    EstadoPedidoEtiqueta,
    FechaZonaPipe,
    Icon,
    PageHeader,
    PedidoPrevia,
    RouterLink,
  ],
  template: `
    <ui-page-header
      title="Mis pedidos"
      subtitle="Entrega, facturación y pago de tus pedidos de concreto"
    >
      <dl class="ml-auto text-right whitespace-nowrap">
        <dt class="text-xs font-semibold tracking-wide text-texto-suave uppercase">
          Pendiente de pago
        </dt>
        <dd class="mt-0.5 text-xl font-bold tabular-nums">\${{ pesos(resumen().pendiente) }}</dd>
      </dl>
    </ui-page-header>

    <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="glass p-2 sm:p-3">
        @if (todosPedidos().length) {
          <ui-buscador
            class="mb-2"
            idBuscar="buscar-pedido"
            etiqueta="Buscar pedidos por folio u obra"
            [(texto)]="texto"
            [grupos]="grupos()"
            [(filtros)]="filtros"
          />
          <div class="relative overflow-x-auto">
            <table class="w-full min-w-2xl border-separate border-spacing-y-1 text-sm">
              <caption class="sr-only">
                Pedidos. Selecciona una fila para ver su vista previa; doble clic o el folio abren
                el pedido.
              </caption>
              <thead>
                <tr class="text-left text-xs tracking-wide text-texto-suave uppercase">
                  <th scope="col" class="px-3 py-2 font-semibold">Pedido</th>
                  <th scope="col" class="px-3 py-2 font-semibold">Obra</th>
                  <th scope="col" class="px-3 py-2 font-semibold">Entrega</th>
                  <th scope="col" class="px-3 py-2 font-semibold">Estado</th>
                  <th scope="col" class="px-3 py-2 text-right font-semibold">Importe</th>
                  <th scope="col" class="px-3 py-2 font-semibold">Cobro</th>
                </tr>
              </thead>
              <tbody>
                @if (pedidos().length) {
                  @for (p of pedidos(); track p.id) {
                    <tr
                      tabindex="0"
                      class="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-epico [&>td]:py-2.5 [&>td]:transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
                      [class]="
                        p.folio === seleccionado()?.folio
                          ? '[&>td]:bg-[#FDF2F2] [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-epico)]'
                          : '[&>td]:bg-transparent hover:[&>td]:bg-white/80 focus-visible:[&>td]:bg-white/80'
                      "
                      [attr.aria-current]="p.folio === seleccionado()?.folio ? 'true' : null"
                      (click)="seleccionar(p)"
                      (dblclick)="abrir(p)"
                      (keydown.enter)="teclaFila($event, p)"
                    >
                      <td class="px-3 whitespace-nowrap">
                        <a
                          [routerLink]="['/pedidos', p.folio]"
                          class="font-semibold text-epico underline-offset-4 hover:underline"
                          >{{ p.folio }}</a
                        >
                        <span class="block text-xs text-texto-suave"
                          >{{ p.producto }} · {{ p.volumenM3 | number: '1.0-1' }} m³</span
                        >
                      </td>
                      <td class="px-3">
                        <a
                          [routerLink]="['/obras', p.obraId]"
                          class="font-medium underline-offset-4 hover:text-epico hover:underline"
                          [attr.title]="'Ver la obra ' + p.obraNombre"
                          >{{ p.obraNombre }}</a
                        >
                      </td>
                      <td class="px-3 whitespace-nowrap">
                        {{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria }}
                      </td>
                      <td class="px-3"><ui-estado-pedido [estado]="p.estado" /></td>
                      <td class="px-3 text-right font-medium whitespace-nowrap">
                        \${{ pesos(p.importe) }}
                      </td>
                      <td class="px-3"><ui-estado-cobro [cobro]="p.cobro" [corto]="true" /></td>
                    </tr>
                  }
                } @else {
                  <tr>
                    <td colspan="6" class="px-3 py-10 text-center normal-case tracking-normal">
                      <p class="font-medium text-carbon">
                        No hay pedidos que coincidan con la búsqueda o los filtros.
                      </p>
                      <button
                        type="button"
                        class="mt-2 font-semibold text-epico underline underline-offset-4"
                        (click)="limpiarFiltros()"
                      >
                        Limpiar búsqueda y filtros
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="py-6 text-center text-texto-suave">
            Aún no tienes pedidos. Se generan al aceptar una cotización en
            <a
              routerLink="/cotizaciones"
              class="font-semibold text-epico underline underline-offset-4"
              >Mis cotizaciones</a
            >.
          </p>
        }
      </div>

      <aside
        id="previa"
        aria-labelledby="previa-titulo"
        aria-live="polite"
        class="glass p-4 sm:p-5 lg:sticky lg:top-24"
      >
        @if (seleccionado(); as p) {
          <app-pedido-previa [p]="p" />
        } @else {
          <h2 id="previa-titulo" class="sr-only">Vista previa del pedido</h2>
          <p class="flex flex-col items-center gap-2 py-8 text-center text-sm text-texto-suave">
            <ui-icon [icono]="iconos.seleccionar" [tamano]="28" />
            Haz clic en un pedido para ver aquí su resumen y estado de cuenta. Doble clic lo abre.
          </p>
        }
      </aside>
    </div>
  `,
})
export default class Pedidos {
  private readonly servicio = inject(PedidosService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly todosPedidos = this.servicio.pedidos;
  protected readonly resumen = this.servicio.resumen;
  protected readonly pesos = pesos;
  protected readonly iconos = { seleccionar: MousePointerClick };
  protected readonly texto = signal('');
  /** Estado, cobro y día de entrega, en el botón de filtros del buscador (ninguno marcado = todos). */
  protected readonly filtros = signal<FiltrosElegidos>({});
  /** Un grupo por columna: obra, entrega, estado, importe y cobro (ninguno marcado = todos). */
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const todos = this.todosPedidos();
    const n = (fn: (p: PedidoVista) => boolean) => todos.filter(fn).length;
    return [
      { id: 'obra', titulo: 'Obra', opciones: opcionesDe(todos, (p) => p.obraNombre) },
      { id: 'entrega', titulo: 'Entrega', rango: 'fecha' },
      { id: 'estado', titulo: 'Estado', opciones: Object.entries(ESTADO_PEDIDO).map(([id, nombre]) => ({ id, nombre, n: n((p) => p.estado === id) })) },
      { id: 'importe', titulo: 'Importe', rango: 'numero', prefijo: '$' },
      { id: 'cobro', titulo: 'Cobro', opciones: Object.entries(ESTADO_COBRO).map(([id, nombre]) => ({ id, nombre, n: n((p) => p.cobro === id) })) },
    ];
  });
  protected readonly pedidos = computed(() => {
    const f = this.filtros();
    const q = this.texto().trim().toLowerCase();
    return this.todosPedidos().filter(
      (p) =>
        pasaFiltro(f, 'obra', p.obraNombre) &&
        enRango(f, 'entrega', p.fechaHoraEntrega) &&
        pasaFiltro(f, 'estado', p.estado) &&
        enRango(f, 'importe', p.importe) &&
        pasaFiltro(f, 'cobro', p.cobro) &&
        (!q || `${p.folio} ${p.obraNombre}`.toLowerCase().includes(q)),
    );
  });

  private readonly folioSeleccionado = signal<string | null>(null);
  /** Se resuelve contra la lista filtrada para no mostrar un pedido oculto por los filtros. */
  protected readonly seleccionado = computed(
    () => this.pedidos().find((p) => p.folio === this.folioSeleccionado()) ?? null,
  );

  protected seleccionar(p: PedidoVista): void {
    this.folioSeleccionado.set(p.folio);
    // En celular la vista previa queda debajo de la tabla: llevarla a la vista.
    if (!matchMedia('(min-width: 64rem)').matches) {
      afterNextRender(
        () =>
          document.getElementById('previa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        { injector: this.injector },
      );
    }
  }

  protected abrir(p: PedidoVista): void {
    void this.router.navigate(['/pedidos', p.folio]);
  }

  protected limpiarFiltros(): void {
    this.filtros.set({});
    this.texto.set('');
  }

  /** Enter sobre la fila (no sobre sus enlaces) muestra la vista previa. */
  protected teclaFila(event: Event, p: PedidoVista): void {
    if (event.target === event.currentTarget) this.seleccionar(p);
  }
}
