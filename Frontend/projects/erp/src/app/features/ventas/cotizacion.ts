import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, registro } from './datos';
import { DetalleCotizacion } from './detalle-cotizacion';

/**
 * Vista completa de una cotización (/ventas/cotizaciones/:id), como el formulario de Odoo: en la barra del encabezado
 * "Nuevo" y la ruta de regreso a Cotizaciones; debajo, la hoja con la cotización (detalle-cotizacion.ts, con Enviar y
 * Editar). Se abre con doble clic en la lista o con el botón de vista completa de la vista previa.
 */
@Component({
  selector: 'app-cotizacion',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleCotizacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center gap-4">
        <a routerLink="/ventas/cotizaciones/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
        <app-ruta-navegacion lista="Cotizaciones" ruta="/ventas/cotizaciones" [actual]="c()?.folio ?? id()" />
      </div>
    </ng-template>

    @if (c(); as c) {
      <!-- A la derecha (debajo en celular), su historial, como el chatter de Odoo; cada uno con su scroll -->
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-cotizacion vista="completa" [c]="c" [obras]="obras()" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.cotizacion(c.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos la cotización {{ id() }}</h1>
        <a
          routerLink="/ventas/cotizaciones"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a cotizaciones</a
        >
      </section>
    }
  `,
})
export default class CotizacionCompleta {
  /** De la ruta /ventas/cotizaciones/:id */
  readonly id = input.required<string>();

  private readonly ventas = inject(VentasService);
  protected readonly c = computed(() => this.ventas.cotizaciones().find((x) => x.id === this.id()));
  protected readonly obras = this.ventas.obras;
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
