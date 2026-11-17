import { Component, computed, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService } from '../ventas/datos';
import { AccesoService, nombreUsuario } from './acceso';
import { DetalleUsuario } from './detalle-usuario';

/** Vista completa de un usuario (/configuracion/usuarios/:id), con su historial a la derecha. */
@Component({
  selector: 'app-usuario',
  imports: [RouterLink, EnEncabezado, Historial, RutaNavegacion, DetalleUsuario],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Usuarios" ruta="/configuracion/usuarios" [actual]="u() ? nombre() : id()" />
      </div>
    </ng-template>

    @if (u(); as u) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <app-detalle-usuario vista="completa" [u]="u" />
          </article>
        </div>
        <aside appHistorial [registro]="'usuario:' + u.id"></aside>
      </div>
    } @else {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">{{ acceso.cargando() ? 'Cargando…' : 'No encontramos ese usuario' }}</h1>
        <a
          routerLink="/configuracion/usuarios"
          class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
          >Volver a usuarios</a
        >
      </section>
    }
  `,
})
export default class UsuarioVista {
  readonly id = input.required<string>();
  protected readonly acceso = inject(AccesoService);
  protected readonly u = computed(() => this.acceso.usuario(this.id()));
  protected readonly nombre = computed(() => nombreUsuario(this.u()!));
  protected readonly cajas = CAJAS_VISTA;
  private readonly detalle = viewChild(DetalleUsuario);

  /** canDeactivate de la ruta: editándolo, pregunta antes de salir (o de pasar a otro usuario). */
  puedeSalir(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando este usuario. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }

  constructor() {
    // shortcut: el historial del backend lo conecta VentasService (HistorialService.remoto); se crea aquí para que
    // también funcione al entrar directo. Separar el remoto de Ventas si pesa.
    inject(VentasService);
  }
}
