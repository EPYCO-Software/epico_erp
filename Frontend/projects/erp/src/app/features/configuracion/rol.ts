import { Component, computed, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService } from '../ventas/datos';
import { AccesoService } from './acceso';
import { DetalleRol } from './detalle-rol';

/** Vista completa de un rol (/configuracion/roles/:id), con su historial. */
@Component({
  selector: 'app-rol',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleRol],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Roles" ruta="/configuracion/roles" [actual]="r()?.nombre ?? id()" />
      </div>
    </ng-template>

    @if (r(); as r) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-rol vista="completa" [r]="r" />
          </article>
        </div>
        <aside appHistorial [registro]="'rol:' + r.id"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">{{ acceso.cargando() ? 'Cargando…' : 'No encontramos ese rol' }}</h1>
        <a
          routerLink="/configuracion/roles"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a roles</a
        >
      </section>
    }
  `,
})
export default class RolVista {
  readonly id = input.required<string>();
  protected readonly acceso = inject(AccesoService);
  protected readonly r = computed(() => this.acceso.rol(this.id()));
  protected readonly cajas = CAJAS_VISTA;
  private readonly detalle = viewChild(DetalleRol);

  /** canDeactivate de la ruta: editándolo, pregunta antes de salir (o de pasar a otro rol). */
  puedeSalir(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando este rol. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }

  constructor() {
    // Conecta el historial del backend (ver usuario.ts)
    inject(VentasService);
  }
}
