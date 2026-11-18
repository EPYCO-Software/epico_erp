import { Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EyeOff } from 'lucide';
import { AuthService, CotizacionVista, EstadoCotizacion, FechaZonaPipe, Icon, Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { PlantasService } from '../../core/plantas';
import { AvatarChat } from '../../layout/avatar-chat';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { ESTADOS_COTIZACION, VentasService, filtrarCotizaciones, totalVigente } from './datos';
import { DetalleCotizacion } from './detalle-cotizacion';
import { permisosSesion } from '../../core/permisos';


/**
 * Ventas → Cotizaciones: la vista de lista, como Odoo. La barra ("Nuevo", título y buscador con los filtros aplicados
 * como etiquetas; por defecto "Mis cotizaciones") va dentro del encabezado. La tabla ocupa todo el ancho, con casillas
 * para marcar varias o todas, y suma las no canceladas. Solo muestra las de las plantas elegidas en el encabezado.
 * Clic (o Enter) en una fila abre su vista previa a la derecha, como Mis pedidos del portal; en celular, debajo.
 * Doble clic abre la vista completa (cotizacion.ts).
 */
@Component({
  selector: 'app-cotizaciones',
  imports: [
    Buscador, DecimalPipe,
    RouterLink,
    FechaZonaPipe,
    Icon,
    AvatarChat,
    EnEncabezado,
    PanelLateral,
    DetalleCotizacion,
  ],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          @if (puede('ventas.cotizaciones.crear')) {
            <a routerLink="nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <!-- En celular el título ya se ve marcado en el menú del módulo -->
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">{{ recibidas() ? 'Cotizaciones recibidas' : 'Cotizaciones' }}</h1>
        </div>

        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-cotizacion"
          etiqueta="Buscar cotizaciones por folio, cliente u obra"
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
          <div tabindex="0" role="region" aria-label="Tabla de cotizaciones" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-240]="!previa()">
              <caption class="sr-only">
                Cotizaciones. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa.
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Fecha</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Cliente</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Obra</th>
                  <!-- Con la vista previa abierta, vendedor y planta se ven en ella: la tabla cabe sin scroll -->
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Vendedor</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Planta</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filas(); track c.id) {
                  <!-- La abierta, como en Mis pedidos del portal: tinte rojo y barra a la izquierda -->
                  <tr
                    [id]="'fila-' + c.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [class.text-texto-suave]="c.estado === 'cancelada'"
                    [attr.aria-current]="c.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(c)"
                    (dblclick)="verCompleta(c)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(c)"
                  >
                    <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + c.folio"
                        [checked]="casillas.marcadas().includes(c.id)"
                        (change)="casillas.alternar(c.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 font-semibold">
                      <span class="flex items-center gap-1.5">
                        {{ c.folio }}
                        @if (c.ocultaAlCliente) {
                          <ui-icon [icono]="iconos.oculta" [tamano]="15" class="text-texto-suave" title="Oculta al cliente" />
                          <span class="sr-only">(oculta al cliente)</span>
                        }
                      </span>
                    </td>
                    <td class="px-3 py-2.5 tabular-nums">{{ c.fecha | fechaZona: c.zonaHoraria }}</td>
                    <td class="px-3 py-2.5">{{ c.clienteNombre }}</td>
                    <td class="px-3 py-2.5">{{ c.obrasNombre }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">
                      <span class="flex items-center gap-2">
                        <app-avatar-chat [nombre]="c.vendedorNombre" class="size-6 text-xs" />{{ c.vendedorNombre }}
                      </span>
                    </td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ c.plantaNombre }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">$ {{ c.total | number: '1.2-2' }}</td>
                    <td class="px-3 py-2.5">
                      <span class="inline-block rounded-md px-2 py-0.5 text-xs font-bold {{ estados[c.estado].clase }}">
                        {{ estados[c.estado].nombre }}
                      </span>
                      @if (c.reemplazadaPorId) {
                        <span class="ml-1 inline-block rounded-md bg-[#FBF0DD] px-2 py-0.5 text-xs font-bold text-[#7A5410]">Reemplazada</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="px-3 py-12 text-center text-texto-suave">
                      Ninguna cotización coincide con la búsqueda y los filtros.
                    </td>
                  </tr>
                }
              </tbody>
              @if (filas().length) {
                <tfoot>
                  <tr>
                    <th scope="row" [attr.colspan]="previa() ? 5 : 7" class="px-3 pt-3 pb-1 text-right font-normal text-texto-suave">
                      Total sin canceladas
                    </th>
                    <td class="px-3 pt-3 pb-1 text-right font-bold tabular-nums">$ {{ total() | number: '1.2-2' }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as c) {
        <!-- Prueba: Liquid Glass en la vista previa -->
        <aside appPanelLateral liquido (cerrar)="cerrar()">
          <app-detalle-cotizacion [c]="c" [obras]="obras()" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Cotizaciones {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly plantas = inject(PlantasService);
  // El vendedor es el usuario: con API, su id; en la demo, su correo.
  private readonly correo = ((u) => u?.id ?? u?.correo ?? null)(inject(AuthService).sesion()?.usuario);

  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly iconos = { oculta: EyeOff };

  protected readonly texto = signal('');
  /** De la ruta (data.recibidas): Ventas → Cotizaciones recibidas, las que pidieron los clientes en el portal. */
  readonly recibidas = input(false);
  /**
   * Filtros por columna en el buscador. Como Odoo: la lista abre con "Mis cotizaciones" (vendedor = el usuario); las
   * recibidas, con todas las recibidas (aún sin responder).
   */
  protected readonly filtros = linkedSignal<FiltrosElegidos>((): FiltrosElegidos =>
    this.recibidas() ? { estado: ['recibida'] } : this.correo ? { vendedor: [this.correo] } : {},
  );

  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  /** Las de las plantas elegidas que coinciden con el texto: de ellas salen los conteos de cada filtro. */
  private readonly base = computed(() =>
    filtrarCotizaciones(this.ventas.cotizaciones(), { plantas: this.plantas.seleccion(), vendedorId: null, estados: [], texto: this.texto() }),
  );
  protected readonly filas = computed(() => {
    const f = this.filtros();
    return this.base().filter(
      (c) =>
        pasaFiltro(f, 'vendedor', c.vendedorId) &&
        pasaFiltro(f, 'estado', c.estado) &&
        pasaFiltro(f, 'planta', c.plantaId) &&
        pasaFiltro(f, 'oferta', c.reemplazadaPorId ? 'reemplazada' : 'vigente') &&
        enRango(f, 'fecha', c.fecha) &&
        enRango(f, 'total', c.total),
    );
  });
  protected readonly total = computed(() => totalVigente(this.filas()));

  /** Las marcadas con las casillas; se desmarcan al cambiar la búsqueda, los filtros o las plantas, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);

  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 cotización' : `${n} cotizaciones`;
  });

  /** Un grupo por columna: vendedor (el usuario, "Mis cotizaciones", primero), estado, planta, fecha y total. */
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const base = this.base();
    const nombres = new Map(base.map((c) => [c.vendedorId, c.vendedorNombre]));
    const vendedores = opcionesDe(base, (c) => c.vendedorId, (id) => (id === this.correo ? 'Mis cotizaciones' : (nombres.get(id) ?? id)));
    if (this.correo && !vendedores.some((v) => v.id === this.correo)) vendedores.push({ id: this.correo, nombre: 'Mis cotizaciones', n: 0 });
    vendedores.sort((a, b) => Number(b.id === this.correo) - Number(a.id === this.correo));
    const plantas = new Map(base.map((c) => [c.plantaId, c.plantaNombre]));
    return [
      { id: 'vendedor', titulo: 'Vendedor', opciones: vendedores },
      {
        id: 'estado',
        titulo: 'Estado',
        opciones: (Object.keys(ESTADOS_COTIZACION) as EstadoCotizacion[]).map((id) => ({
          id,
          nombre: ESTADOS_COTIZACION[id].nombre,
          n: base.filter((c) => c.estado === id).length,
        })),
      },
      { id: 'planta', titulo: 'Planta', opciones: opcionesDe(base, (c) => c.plantaId, (id) => plantas.get(id) ?? id) },
      {
        id: 'oferta',
        titulo: 'Negociación',
        opciones: [
          { id: 'vigente', nombre: 'Oferta vigente', n: base.filter((c) => !c.reemplazadaPorId).length },
          { id: 'reemplazada', nombre: 'Reemplazada por otra oferta', n: base.filter((c) => c.reemplazadaPorId).length },
        ],
      },
      { id: 'fecha', titulo: 'Fecha', rango: 'fecha' },
      { id: 'total', titulo: 'Total', rango: 'numero', prefijo: '$' },
    ];
  });

  protected readonly obras = this.ventas.destinos;
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly vista = vistaPrevia();
  /** Contra la lista filtrada: si un filtro la oculta, la vista previa se cierra (como en el portal). */
  protected readonly previa = computed(() => this.filas().find((c) => c.id === this.vista.abiertaId()) ?? null);

  private readonly detalle = viewChild(DetalleCotizacion);

  /** Con cambios sin guardar en el editor de la vista previa, se pregunta antes de dejarla. */
  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en esta cotización. ¿Descartarlos?');
  }

  protected abrir(c: CotizacionVista): void {
    if (c.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(c.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(c: CotizacionVista): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/cotizaciones', c.id]);
  }
}
