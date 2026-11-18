import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CalendarDays, Columns3, List, Map as IconoMapa, Search } from 'lucide';
import { ESTADO_COBRO, ESTADO_PEDIDO, ESTATUS_PLANTA, EstadoCobro, EstadoCobroEtiqueta, EstadoPedido, EstadoPedidoEtiqueta, EstatusPlanta, FechaZonaPipe, Icon, PedidoVista, Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { CalendarioEntregas } from './calendario-entregas';
import { VentasService, filtrarPedidos, porConfirmar } from './datos';
import { DetallePedido } from './detalle-pedido';
import { PlantaFila } from './planta-pedido';
import { permisosSesion } from '../../core/permisos';
import { ASIGNACION, Asignacion_, asignacionDe, gestionable, sinCamion } from '../flota/flota-api';
import { MapaOrdenes } from '../flota/mapa-ordenes';
import { TableroDespacho } from '../flota/tablero-despacho';

type Vista = 'lista' | 'calendario' | 'tablero' | 'mapa';

/** La resistencia del concreto de la orden ("f´c 250", "MR 45"): el producto es su descripción completa, única por orden. */
/** Por confirmar, confirmada o cancelada (filtro "Confirmación"). */
const confirmacion = (p: PedidoVista) => (p.estado === 'cancelado' ? 'cancelada' : porConfirmar(p) ? 'por_confirmar' : 'confirmada');

const concretoDe = (producto: string) => /(f´c|f'c|MR)\s*(\d+)/i.exec(producto)?.slice(1, 3).join(' ').replace("f'c", 'f´c') ?? '';

/**
 * Ventas → Órdenes: las órdenes de venta (un pedido por entrega) que salen de confirmar cotizaciones, como la lista de
 * Odoo y con lo mismo que Cotizaciones: la barra va en el encabezado, clic o Enter abre la vista previa a la derecha y
 * doble clic la vista completa. Solo las de las plantas elegidas en el encabezado.
 */
@Component({
  selector: 'app-ordenes',
  imports: [
    Buscador, CalendarioEntregas, DecimalPipe, Icon,
    RouterLink,
    EstadoCobroEtiqueta,
    EstadoPedidoEtiqueta,
    PlantaFila,
    FechaZonaPipe,
    EnEncabezado,
    PanelLateral,
    DetallePedido,
    MapaOrdenes,
    TableroDespacho,
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
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">{{ logistica() ? 'Órdenes' : 'Órdenes de venta' }}</h1>
          @if (logistica()) {
            <!-- Logística: cuántas aún no tienen camión (o les faltan m³); el botón las filtra -->
            <button
              type="button"
              [class]="faltanCamion() ? 'inline-flex h-9 items-center rounded-full bg-epico px-3.5 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico' : 'inline-flex h-9 items-center rounded-full bg-[#E3EFE9] px-3.5 text-sm font-bold whitespace-nowrap text-[#2E5E4A]'"
              [attr.aria-pressed]="soloSinCamion()"
              [disabled]="!faltanCamion()"
              (click)="alternarSinCamion()"
            >
              {{ faltanCamion() ? faltanCamion() + ' sin camión' : 'Todas con camión' }}
            </button>
          }
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-orden"
          etiqueta="Buscar órdenes por folio, cliente, obra, producto o cotización"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <div class="flex items-center justify-end gap-3">
          <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
          <!-- Como el selector de vistas de Odoo: lista o calendario de entregas -->
          <div class="flex rounded-[0.625rem] bg-carbon/5 p-0.5" role="group" aria-label="Ver las órdenes como">
            @for (v of vistas; track v.id) {
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-lg text-texto-suave transition-colors hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico aria-pressed:bg-white aria-pressed:text-carbon aria-pressed:shadow-sm"
                [attr.aria-pressed]="modo() === v.id"
                [attr.aria-label]="v.nombre"
                [title]="v.nombre"
                (click)="cambiarVista(v.id)"
              >
                <ui-icon [icono]="v.icono" [tamano]="17" />
              </button>
            }
          </div>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <p class="px-1 pt-3 pb-1 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
          @if (modo() === 'tablero') {
            <app-tablero-despacho [texto]="texto()" [abiertaId]="vista.abiertaId()" (abrir)="abrirId($event)" />
          } @else if (modo() === 'mapa') {
            <app-mapa-ordenes [pedidos]="filas()" [abiertaId]="vista.abiertaId()" (abrir)="abrirId($event)" />
          } @else if (modo() === 'calendario') {
            <app-calendario-entregas [pedidos]="filas()" [abiertaId]="vista.abiertaId()" (abrir)="abrir($event)" (verCompleta)="verCompleta($event)" />
          } @else {
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
                    <td class="px-3 py-2">
                      <ui-estado-pedido [estado]="p.estado" />
                      @if (pendiente(p)) {
                        <span class="ml-1 inline-block rounded-md bg-[#FBF0DD] px-2 py-0.5 text-xs font-bold text-[#7A5410]">Por confirmar</span>
                      }
                    </td>
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
          }
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
  protected readonly pendiente = porConfirmar;
  /**
   * Logística → Órdenes (/flota/ordenes, data.logistica): la misma página, solo con las órdenes listas para gestionarse
   * (confirmadas o en solicitud de confirmación a planta, sin entregar ni cancelar), el marcador "sin camión" con su
   * filtro, y además las vistas Tablero por horas (el del despacho) y Mapa.
   */
  readonly logistica = input(false);
  private readonly todasLasVistas: { id: Vista; nombre: string; icono: typeof List; logistica?: boolean }[] = [
    { id: 'lista', nombre: 'Lista', icono: List },
    { id: 'calendario', nombre: 'Calendario de entregas', icono: CalendarDays },
    { id: 'tablero', nombre: 'Tablero por horas', icono: Columns3, logistica: true },
    { id: 'mapa', nombre: 'Mapa', icono: IconoMapa, logistica: true },
  ];
  protected get vistas() {
    return this.todasLasVistas.filter((v) => !v.logistica || this.logistica());
  }
  /** De la URL (?vista=calendario|tablero|mapa) o lo que elija el usuario. */
  protected readonly modo = signal<Vista>(
    (['calendario', 'tablero', 'mapa'] as const).find((v) => v === inject(ActivatedRoute).snapshot.queryParamMap.get('vista')) ?? 'lista',
  );
  protected cambiarVista(v: Vista): void {
    this.modo.set(v);
    void this.router.navigate([], { queryParams: { vista: v === 'lista' ? null : v }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly texto = signal('');
  protected readonly aviso = signal('');
  private readonly base = computed(() => {
    const todas = filtrarPedidos(this.ventas.pedidos(), this.plantas.seleccion(), this.texto());
    return this.logistica() ? todas.filter((p) => gestionable(p) && !['entregado', 'cancelado'].includes(p.estado)) : todas;
  });
  /** Logística: el marcador de órdenes sin camión (ninguna unidad o faltan m³ de ollas). */
  protected readonly faltanCamion = computed(() => sinCamion(this.base()));
  protected readonly soloSinCamion = computed(() => {
    const a = this.filtros()['camion'] ?? [];
    return a.length === 2 && a.includes('sin_camion') && a.includes('parcial');
  });
  protected alternarSinCamion(): void {
    this.filtros.update((f) => ({ ...f, camion: this.soloSinCamion() ? [] : ['sin_camion', 'parcial'] }));
  }
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
        pasaFiltro(f, 'confirmacion', confirmacion(p)) &&
        pasaFiltro(f, 'planta', p.plantaId) &&
        pasaFiltro(f, 'estatus', p.estatusPlanta ?? 'no_enviado') &&
        pasaFiltro(f, 'cobro', p.cobro) &&
        pasaFiltro(f, 'camion', asignacionDe(p)),
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
      {
        id: 'confirmacion',
        titulo: 'Confirmación',
        opciones: (['por_confirmar', 'confirmada', 'cancelada'] as const).map((id) => ({
          id,
          nombre: { por_confirmar: 'Por confirmar', confirmada: 'Confirmada', cancelada: 'Cancelada' }[id],
          n: conteo((p) => confirmacion(p) === id),
        })),
      },
      { id: 'estado', titulo: 'Estado', opciones: (Object.keys(ESTADO_PEDIDO) as EstadoPedido[]).map((id) => ({ id, nombre: ESTADO_PEDIDO[id], n: conteo((p) => p.estado === id) })) },
      { id: 'planta', titulo: 'Planta', opciones: opcionesDe(base, (p) => p.plantaId, (id) => plantas.get(id) ?? id) },
      { id: 'estatus', titulo: 'Estatus en planta', opciones: (Object.keys(ESTATUS_PLANTA) as EstatusPlanta[]).map((id) => ({ id, nombre: ESTATUS_PLANTA[id], n: conteo((p) => (p.estatusPlanta ?? 'no_enviado') === id) })) },
      { id: 'cobro', titulo: 'Cobro', opciones: (Object.keys(ESTADO_COBRO) as EstadoCobro[]).map((id) => ({ id, nombre: ESTADO_COBRO[id], n: conteo((p) => p.cobro === id) })) },
      ...(this.logistica()
        ? [{ id: 'camion', titulo: 'Camión', opciones: (Object.keys(ASIGNACION) as Asignacion_[]).map((id) => ({ id, nombre: ASIGNACION[id], n: conteo((p) => asignacionDe(p) === id) })) }]
        : []),
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
  /**
   * Contra la lista filtrada: si un filtro la oculta, la vista previa se cierra. En el tablero por horas (logística) se
   * abren órdenes del día que pueden no estar en la lista: ahí se buscan en todas.
   */
  protected readonly previa = computed(
    () => (this.modo() === 'tablero' ? this.ventas.pedidos() : this.filas()).find((p) => p.id === this.vista.abiertaId()) ?? null,
  );

  private readonly detalle = viewChild(DetallePedido);

  /** Con cambios sin guardar en el editor de la vista previa, se pregunta antes de dejarla. */
  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en esta orden. ¿Descartarlos?');
  }

  /** Del tablero y del mapa llega el id. */
  protected abrirId(id: string): void {
    const p = this.ventas.pedidos().find((x) => x.id === id);
    if (p) this.abrir(p);
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
