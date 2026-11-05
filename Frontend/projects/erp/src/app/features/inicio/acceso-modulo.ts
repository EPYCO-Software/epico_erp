import { Component, booleanAttribute, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Modulo } from '../../core/modulos';
import { IconoModulo } from './icono-modulo';

/**
 * Acceso a un módulo, como un app launcher: cuadro blanco de 76 px con el icono y el nombre debajo.
 * Activo: enlace a su página. No activado: botón que pide mostrar el aviso (`noActivado`).
 * Con `favorito` lleva la estrella roja en la esquina.
 */
@Component({
  selector: 'app-acceso-modulo',
  imports: [RouterLink, NgTemplateOutlet, IconoModulo],
  host: { class: 'flex justify-center' },
  template: `
    @if (modulo().activo) {
      <a [routerLink]="modulo().ruta" class="group flex w-full max-w-37.5 flex-col items-center gap-2 text-center outline-none">
        <ng-container [ngTemplateOutlet]="contenido" />
      </a>
    } @else {
      <button
        type="button"
        class="group flex w-full max-w-37.5 cursor-pointer flex-col items-center gap-2 text-center outline-none"
        (click)="noActivado.emit(modulo())"
      >
        <ng-container [ngTemplateOutlet]="contenido" />
      </button>
    }

    <ng-template #contenido>
      <span
        class="relative flex size-19 items-center justify-center rounded-[14px] border border-white bg-white/90 shadow-[0_1px_2px_rgb(26_26_28/0.08),0_8px_18px_-8px_rgb(26_26_28/0.2)] backdrop-blur-md transition-[background-color,box-shadow] duration-150 group-hover:bg-white group-hover:shadow-[0_2px_4px_rgb(26_26_28/0.1),0_14px_26px_-10px_rgb(26_26_28/0.3)] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-epico"
      >
        <app-icono-modulo [modulo]="modulo().id" class="size-15" />
        @if (favorito()) {
          <svg class="absolute -top-2 -right-2 size-5.5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
              fill="#e0262c"
              stroke="#fff"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        }
      </span>
      <span class="text-sm leading-[1.15rem] text-carbon">
        {{ modulo().nombre }}
        @if (!modulo().activo) {
          <span class="sr-only">(no activado)</span>
        }
      </span>
    </ng-template>
  `,
})
export class AccesoModulo {
  readonly modulo = input.required<Modulo>();
  readonly favorito = input(false, { transform: booleanAttribute });
  readonly noActivado = output<Modulo>();
}
