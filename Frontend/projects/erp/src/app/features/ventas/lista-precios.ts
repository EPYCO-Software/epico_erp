import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { registro } from './datos';
import { DetalleLista } from './detalle-lista';
import { ListasPreciosService } from './precios';

/**
 * Vista completa de una lista de precios (/ventas/listas-de-precios/:id): en la barra, la ruta de regreso; la hoja
 * (detalle-lista.ts) y su historial a la derecha.
 */
@Component({
  selector: 'app-lista-precios',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleLista],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Listas de precios" ruta="/ventas/listas-de-precios" [actual]="l()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (l(); as l) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-lista vista="completa" [l]="l" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.lista(l.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos la lista de precios {{ id() }}</h1>
        <a
          routerLink="/ventas/listas-de-precios"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a listas de precios</a
        >
      </section>
    }
  `,
})
export default class ListaPreciosCompleta {
  /** De la ruta /ventas/listas-de-precios/:id */
  readonly id = input.required<string>();

  private readonly servicio = inject(ListasPreciosService);
  protected readonly l = computed(() => this.servicio.lista(this.id()));
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
