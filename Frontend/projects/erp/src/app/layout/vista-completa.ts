import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconNode } from 'lucide';
import { Icon } from 'ui';
import { COLUMNA } from './panel-lateral';

/**
 * Las cajas de toda vista completa, iguales en todas las secciones: en escritorio, la hoja y su historial son columnas
 * del alto disponible (COLUMNA), alineadas arriba y abajo, y cada una se desplaza por su lado; en celular, una debajo
 * de la otra.
 */
export const CAJAS_VISTA = {
  contenedor: 'mx-auto flex w-full max-w-[96rem] flex-col gap-4 lg:h-full lg:flex-row',
  columna: COLUMNA + ' lg:min-w-0 lg:flex-1',
  hoja: 'glass min-w-0 p-5 sm:p-8',
};

/** Botón a un registro relacionado, como los de Odoo ("Compra 2"): icono, qué es y cuál. Da la trazabilidad. */
@Component({
  selector: 'app-boton-relacion',
  imports: [Icon, RouterLink],
  template: `
    <a
      [routerLink]="ruta()"
      class="inline-flex h-10 items-center gap-2.5 rounded-lg border border-acero-oscuro/70 bg-white/70 pr-3.5 pl-3 transition-colors hover:border-carbon hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
    >
      <ui-icon [icono]="icono()" [tamano]="20" class="text-epico" />
      <span class="text-left leading-tight">
        <span class="block text-sm font-semibold text-carbon">{{ etiqueta() }}</span>
        <span class="block text-xs text-texto-suave">{{ valor() }}</span>
      </span>
    </a>
  `,
})
export class BotonRelacion {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly ruta = input.required<string | unknown[]>();
  readonly icono = input.required<IconNode>();
}

/**
 * Ruta de una vista completa como la de Odoo: arriba, chica, la lista a la que se regresa ("Órdenes de venta");
 * debajo, en negritas, el registro abierto ("PED-26-0156").
 */
@Component({
  selector: 'app-ruta-navegacion',
  imports: [RouterLink],
  template: `
    <nav aria-label="Ruta de navegación" class="min-w-0">
      <ol class="leading-tight">
        <li>
          <a
            [routerLink]="ruta()"
            class="rounded text-[13px] font-semibold text-epico-oscuro underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-epico"
            >{{ lista() }}</a
          >
        </li>
        <li aria-current="page" class="truncate text-lg font-bold text-carbon">{{ actual() }}</li>
      </ol>
    </nav>
  `,
})
export class RutaNavegacion {
  readonly lista = input.required<string>();
  readonly ruta = input.required<string>();
  readonly actual = input.required<string>();
}

/**
 * Barra de estados como la de Odoo: segmentos con forma de flecha, el actual resaltado (aria-current="step").
 * En celular solo se ve el actual.
 */
@Component({
  selector: 'app-barra-estados',
  template: `
    <ol class="flex text-sm" [attr.aria-label]="etiqueta()">
      @for (p of pasos(); track p.id; let primero = $first) {
        <li
          class="-ml-1 flex h-8 items-center pr-5 pl-6 whitespace-nowrap first:ml-0 first:pl-3.5"
          [class]="p.id === actual() ? 'bg-[#FDF2F2] font-semibold text-epico-oscuro' : 'bg-carbon/6 text-texto-suave max-sm:hidden'"
          [style.clip-path]="primero ? flechaInicial : flecha"
          [attr.aria-current]="p.id === actual() ? 'step' : null"
        >
          {{ p.nombre }}
        </li>
      }
    </ol>
  `,
})
export class BarraEstados {
  readonly pasos = input.required<{ id: string; nombre: string }[]>();
  readonly actual = input.required<string>();
  readonly etiqueta = input.required<string>();

  protected readonly flechaInicial = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
  protected readonly flecha = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)';
}
