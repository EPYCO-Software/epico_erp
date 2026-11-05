import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, registro } from './datos';
import { DetalleCliente } from './detalle-cliente';

/**
 * Vista completa de un cliente (/ventas/clientes/:id), como el formulario de Odoo: en la barra, la ruta de regreso a
 * Clientes; debajo, la hoja en dos columnas (detalle-cliente.ts). Se abre con doble clic o desde la vista previa.
 */
@Component({
  selector: 'app-cliente',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleCliente],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Clientes" ruta="/ventas/clientes" [actual]="c()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (c(); as c) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-cliente vista="completa" [c]="c" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.cliente(c.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos el cliente {{ id() }}</h1>
        <a
          routerLink="/ventas/clientes"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a clientes</a
        >
      </section>
    }
  `,
})
export default class ClienteVenta {
  /** De la ruta /ventas/clientes/:id */
  readonly id = input.required<string>();
  private readonly ventas = inject(VentasService);
  protected readonly c = computed(() => this.ventas.cliente(this.id()));
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
