import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft } from 'lucide';
import { Icon } from 'ui';
import { buscarModulo } from '../../core/modulos';
import { IconoModulo } from '../inicio/icono-modulo';

/**
 * /modulos/:id: aviso de módulo no activado (también llega aquí quien escribe la dirección de su página, ver
 * moduloActivoGuard) o, si está activo pero aún sin página, "en construcción". Con `seccion` (data de la ruta): una
 * sección de un módulo que aún no tiene página.
 */
@Component({
  selector: 'app-proximamente',
  imports: [RouterLink, Icon, IconoModulo],
  host: { class: 'flex justify-center pt-6 lg:pt-14' },
  template: `
    <section class="glass flex w-full max-w-xl flex-col items-center px-6 py-10 text-center sm:px-12">
      @if (seccion()) {
        <h1 class="text-3xl font-bold tracking-[-0.02em] text-carbon">{{ seccion() }}</h1>
        <p class="mt-3 max-w-md text-texto-suave">Estamos construyendo esta sección. Muy pronto podrás trabajarla desde aquí.</p>
      } @else if (modulo(); as m) {
        <span
          class="flex size-20 items-center justify-center rounded-[16px] border border-white bg-white shadow-[0_1px_2px_rgb(26_26_28/0.08),0_10px_22px_-10px_rgb(26_26_28/0.25)]"
        >
          <app-icono-modulo [modulo]="m.id" class="size-15" />
        </span>
        @if (m.activo) {
          <h1 class="mt-6 text-3xl font-bold tracking-[-0.02em] text-carbon">{{ m.nombre }}</h1>
          <p class="mt-3 max-w-md text-texto-suave">
            Estamos construyendo este módulo. Muy pronto podrás trabajarlo desde aquí.
          </p>
        } @else {
          <h1 class="mt-6 text-2xl font-bold tracking-[-0.02em] text-carbon">{{ m.nombre }} no está activado</h1>
          <p class="mt-3 max-w-md text-texto-suave">
            Este módulo no está activado actualmente para tu empresa. Si lo necesitas, pide a tu administrador que lo
            active.
          </p>
        }
      } @else {
        <h1 class="text-3xl font-bold tracking-[-0.02em] text-carbon">Módulo no encontrado</h1>
        <p class="mt-3 text-texto-suave">Revisa la dirección o elige un módulo de la lista.</p>
      }
      <a
        routerLink="/inicio"
        class="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
      >
        <ui-icon [icono]="iconoVolver" [tamano]="18" />Volver a módulos
      </a>
    </section>
  `,
})
export default class Proximamente {
  /** Viene de la ruta /modulos/:id */
  readonly id = input('');
  /** Viene de data.seccion de la ruta */
  readonly seccion = input<string>();
  protected readonly modulo = computed(() => buscarModulo(this.id()));
  protected readonly iconoVolver = ArrowLeft;
}
