import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { registro } from './datos';
import { DetallePrograma } from './detalle-programa';
import { ProgramasService } from './lealtad';

/** Vista completa de un programa (/ventas/descuentos-y-lealtad/:id): la hoja y su historial a la derecha. */
@Component({
  selector: 'app-programa',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetallePrograma],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Descuentos y lealtad" ruta="/ventas/descuentos-y-lealtad" [actual]="p()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (p(); as p) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-programa vista="completa" [p]="p" />
          </article>
        </div>
        <aside appHistorial [registro]="registro.programa(p.id)"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos el programa {{ id() }}</h1>
        <a
          routerLink="/ventas/descuentos-y-lealtad"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a descuentos y lealtad</a
        >
      </section>
    }
  `,
})
export default class ProgramaCompleto {
  /** De la ruta /ventas/descuentos-y-lealtad/:id */
  readonly id = input.required<string>();

  private readonly servicio = inject(ProgramasService);
  protected readonly p = computed(() => this.servicio.programa(this.id()));
  protected readonly registro = registro;
  protected readonly cajas = CAJAS_VISTA;
}
