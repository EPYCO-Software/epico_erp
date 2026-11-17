import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { DetalleLista } from './detalle-lista';
import { ListaPrecios, ListasPreciosService, filtrarListas, textoPlantas } from './precios';
import { permisosSesion } from '../../core/permisos';

/**
 * Ventas → Productos → Listas de precios (/ventas/listas-de-precios), como en Odoo: varias listas, cada una con su
 * moneda y sus plantas (lo común: una por planta). Lo mismo que las demás listas: casillas, clic o Enter abre la vista
 * previa a la derecha y doble clic la vista completa; Nuevo da de alta otra.
 */
@Component({
  selector: 'app-listas-precios',
  imports: [Buscador, RouterLink, EnEncabezado, PanelLateral, DetalleLista],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          @if (puede('ventas.listas_precios.crear')) {
            <a routerLink="/ventas/listas-de-precios/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Listas de precios</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-lista"
          etiqueta="Buscar listas por nombre, moneda o planta"
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
          <div tabindex="0" role="region" aria-label="Tabla de listas de precios" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <caption class="sr-only">
                Listas de precios. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa. La casilla
                solo marca.
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Nombre de la lista</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Plantas</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Moneda</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="previa()">Líneas</th>
                </tr>
              </thead>
              <tbody>
                @for (l of filas(); track l.id) {
                  <tr
                    [id]="'fila-' + l.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [attr.aria-current]="l.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(l)"
                    (dblclick)="verCompleta(l)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(l)"
                  >
                    <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + l.nombre"
                        [checked]="casillas.marcadas().includes(l.id)"
                        (change)="casillas.alternar(l.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 font-semibold">{{ l.nombre }}</td>
                    <td class="px-3 py-2.5">{{ plantas(l) }}</td>
                    <td class="px-3 py-2.5">{{ l.moneda }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="previa()">{{ l.reglas.length }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-3 py-12 text-center text-texto-suave">Ninguna lista coincide con la búsqueda.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as l) {
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-lista [l]="l" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class ListasPrecios {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly servicio = inject(ListasPreciosService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly texto = signal('');
  private readonly base = computed(() => filtrarListas(this.servicio.listas(), this.texto()));
  /** Filtros por columna, en el buscador: planta (una lista sin plantas aplica en todas), moneda y si tiene líneas. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const base = this.base();
    return [
      { id: 'planta', titulo: 'Planta', opciones: opcionesDe(base.flatMap((l) => l.plantas), (p) => p, (p) => textoPlantas([p])) },
      { id: 'moneda', titulo: 'Moneda', opciones: opcionesDe(base, (l) => l.moneda) },
      {
        id: 'lineas',
        titulo: 'Líneas',
        opciones: [
          { id: 'si', nombre: 'Con líneas', n: base.filter((l) => l.reglas.length).length },
          { id: 'no', nombre: 'Sin líneas', n: base.filter((l) => !l.reglas.length).length },
        ],
      },
    ];
  });
  protected readonly filas = computed(() => {
    const f = this.filtros();
    return this.base().filter(
      (l) =>
        (!f['planta']?.length || !l.plantas.length || l.plantas.some((p) => f['planta'].includes(p))) &&
        pasaFiltro(f, 'moneda', l.moneda) &&
        pasaFiltro(f, 'lineas', l.reglas.length ? 'si' : 'no'),
    );
  });
  protected plantas(l: ListaPrecios): string {
    return textoPlantas(l.plantas);
  }

  /** Las marcadas; se desmarcan al cambiar la búsqueda, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 lista' : `${n} listas`;
  });

  protected readonly vista = vistaPrevia();
  /** Contra la lista filtrada: si la búsqueda la oculta, la vista previa se cierra. */
  protected readonly previa = computed(() => this.filas().find((l) => l.id === this.vista.abiertaId()) ?? null);
  private readonly detalle = viewChild(DetalleLista);

  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en esta lista. ¿Descartarlos?');
  }

  protected abrir(l: ListaPrecios): void {
    if (l.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(l.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(l: ListaPrecios): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/listas-de-precios', l.id]);
  }
}
