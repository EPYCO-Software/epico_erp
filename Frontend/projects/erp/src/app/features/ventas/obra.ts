import { Component, computed, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, registro } from './datos';
import { DetalleObra } from './detalle-obra';

/** Vista completa de una obra (/ventas/obras/:id), con su historial (notas y actividades) a la derecha. */
@Component({
  selector: 'app-obra-venta',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleObra],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Obras" ruta="/ventas/obras" [actual]="o()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (o(); as o) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-obra vista="completa" [o]="o" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.obra(o.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">{{ ventas.cargando() ? 'Cargando…' : 'No encontramos esa obra' }}</h1>
        <a
          routerLink="/ventas/obras"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a obras</a
        >
      </section>
    }
  `,
})
export default class ObraVenta {
  /** Parámetro de la ruta. */
  readonly id = input.required<string>();
  protected readonly ventas = inject(VentasService);
  protected readonly o = computed(() => this.ventas.obras().find((x) => x.id === this.id()) ?? null);
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
  private readonly detalle = viewChild(DetalleObra);

  /** canDeactivate de la ruta: editándola, pregunta antes de salir. */
  puedeSalir(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando esta obra. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }
}
