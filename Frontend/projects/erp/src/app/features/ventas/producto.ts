import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, registro } from './datos';
import { DetalleProducto } from './detalle-producto';

/**
 * Vista completa de un producto (/ventas/productos/:id), como el formulario de Odoo: en la barra, la ruta de regreso a
 * Productos; la hoja (detalle-producto.ts, con todo su uso) y su historial a la derecha. Doble clic en la lista o el
 * botón de vista completa de la vista previa.
 */
@Component({
  selector: 'app-producto',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleProducto],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Productos" ruta="/ventas/productos" [actual]="p()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (p(); as p) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-producto vista="completa" [p]="p" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.producto(p.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos el producto {{ id() }}</h1>
        <a
          routerLink="/ventas/productos"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a productos</a
        >
      </section>
    }
  `,
})
export default class ProductoCompleto {
  /** De la ruta /ventas/productos/:id */
  readonly id = input.required<string>();

  private readonly ventas = inject(VentasService);
  protected readonly p = computed(() => this.ventas.productos().find((x) => x.id === this.id()));
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
