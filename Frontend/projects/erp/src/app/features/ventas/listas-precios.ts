import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { Icon } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { DetalleLista } from './detalle-lista';
import { ListaPrecios, ListasPreciosService, filtrarListas, textoPlantas } from './precios';

/**
 * Ventas → Productos → Listas de precios (/ventas/listas-de-precios), como en Odoo: varias listas, cada una con su
 * moneda y sus plantas (lo común: una por planta). Lo mismo que las demás listas: casillas, clic o Enter abre la vista
 * previa a la derecha y doble clic la vista completa; Nuevo da de alta otra.
 */
@Component({
  selector: 'app-listas-precios',
  imports: [Icon, RouterLink, EnEncabezado, PanelLateral, DetalleLista],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          <a routerLink="/ventas/listas-de-precios/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Listas de precios</h1>
        </div>
        <form role="search" class="relative min-w-0 flex-1" (submit)="$event.preventDefault()">
          <label for="buscar-lista" class="sr-only">Buscar listas por nombre, moneda o planta</label>
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="17"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave max-sm:hidden"
          />
          <input
            id="buscar-lista"
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
  private readonly servicio = inject(ListasPreciosService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly texto = signal('');
  protected readonly filas = computed(() => filtrarListas(this.servicio.listas(), this.texto()));
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
