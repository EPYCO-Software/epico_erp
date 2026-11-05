import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ListFilter, Search, X } from 'lucide';
import { AuthService, CotizacionVista, EstadoCotizacion, FechaZonaPipe, Icon } from 'ui';
import { PlantasService } from '../../core/plantas';
import { AvatarChat } from '../../layout/avatar-chat';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { ESTADOS_COTIZACION, VentasService, filtrarCotizaciones, totalVigente } from './datos';
import { DetalleCotizacion } from './detalle-cotizacion';
import { FiltrosCotizaciones } from './filtros-cotizaciones';

const O = new Intl.ListFormat('es', { type: 'disjunction' });

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
    DecimalPipe,
    RouterLink,
    FechaZonaPipe,
    Icon,
    AvatarChat,
    EnEncabezado,
    PanelLateral,
    FiltrosCotizaciones,
    DetalleCotizacion,
  ],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          <a routerLink="nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          <!-- En celular el título ya se ve marcado en el menú del módulo -->
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Cotizaciones</h1>
        </div>

        <form role="search" class="min-w-0 flex-1" (submit)="$event.preventDefault()">
          <div
            class="flex min-h-9 items-center gap-2 rounded-lg border border-acero-oscuro bg-white/65 pr-1 pl-3 transition-colors hover:border-carbon has-[input:focus]:border-epico has-[input:focus]:outline-3 has-[input:focus]:outline-epico/25"
          >
            <ui-icon [icono]="iconos.buscar" [tamano]="17" class="shrink-0 text-texto-suave max-sm:hidden" />
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5">
              @for (f of facetas(); track f.id) {
                <span class="inline-flex h-6.5 items-center gap-1 rounded-md bg-epico/10 pl-2 text-sm font-medium text-epico-oscuro">
                  <ui-icon [icono]="iconos.filtro" [tamano]="14" class="max-sm:hidden" />
                  {{ f.texto }}
                  <button
                    type="button"
                    class="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-epico/15 focus-visible:outline-2 focus-visible:outline-epico"
                    [attr.aria-label]="'Quitar filtro: ' + f.texto"
                    (click)="f.quitar(); entrada.focus()"
                  >
                    <ui-icon [icono]="iconos.quitar" [tamano]="14" />
                  </button>
                </span>
              }
              <label for="buscar-cotizacion" class="sr-only">Buscar cotizaciones por folio, cliente u obra</label>
              <input
                #entrada
                id="buscar-cotizacion"
                type="search"
                autocomplete="off"
                placeholder="Buscar…"
                class="h-7 min-w-14 flex-1 bg-transparent text-[15px] text-carbon outline-none placeholder:text-texto-suave [&::-webkit-search-cancel-button]:appearance-none"
                [value]="texto()"
                (input)="texto.set($any($event.target).value)"
                (keydown.escape)="texto.set('')"
              />
            </div>
            <app-filtros-cotizaciones class="h-7 shrink-0" [(soloMias)]="soloMias" [(estados)]="elegidos" />
          </div>
        </form>

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
                    <td class="px-3 py-2.5 font-semibold">{{ c.folio }}</td>
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
  private readonly plantas = inject(PlantasService);
  private readonly correo = inject(AuthService).sesion()?.usuario.correo ?? null;

  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly iconos = { buscar: Search, filtro: ListFilter, quitar: X };

  protected readonly texto = signal('');
  /** Como Odoo: la lista abre con "Mis cotizaciones". */
  protected readonly soloMias = signal(true);
  protected readonly elegidos = signal<EstadoCotizacion[]>([]);

  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  protected readonly filas = computed(() =>
    filtrarCotizaciones(this.ventas.cotizaciones(), {
      plantas: this.plantas.seleccion(),
      vendedorId: this.soloMias() ? this.correo : null,
      estados: this.elegidos(),
      texto: this.texto(),
    }),
  );
  protected readonly total = computed(() => totalVigente(this.filas()));

  /** Las marcadas con las casillas; se desmarcan al cambiar la búsqueda, los filtros o las plantas, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);

  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 cotización' : `${n} cotizaciones`;
  });

  /** Filtros aplicados, como etiquetas dentro del buscador; la X los quita. */
  protected readonly facetas = computed(() => {
    const facetas: { id: string; texto: string; quitar: () => void }[] = [];
    if (this.soloMias()) facetas.push({ id: 'mias', texto: 'Mis cotizaciones', quitar: () => this.soloMias.set(false) });
    const elegidos = (Object.keys(ESTADOS_COTIZACION) as EstadoCotizacion[]).filter((e) => this.elegidos().includes(e));
    if (elegidos.length) {
      const texto = O.format(elegidos.map((e) => ESTADOS_COTIZACION[e].nombre));
      facetas.push({ id: 'estado', texto, quitar: () => this.elegidos.set([]) });
    }
    return facetas;
  });

  protected readonly obras = this.ventas.obras;
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
