import { Component, booleanAttribute, computed, input } from '@angular/core';
import { EstadoPersona } from '../core/mensajeria';

/** Tonos de la paleta EPICO, oscurecidos para que la inicial blanca pase AA (4.5:1). */
const COLORES = ['#AE5442', '#3F8065', '#2F6E8A', '#8A6A3F', '#5B5F97', '#A31217'];

/**
 * Avatar de una persona o canal: cuadro de color con su inicial (o "#") y, si está en línea o ausente, un punto de
 * estado. Decorativo: el nombre y el estado van en texto en quien lo usa. El tamaño y el texto, por clase en el host.
 */
@Component({
  selector: 'app-avatar-chat',
  host: { class: 'relative inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <span
      class="flex size-full items-center justify-center leading-none font-semibold text-white"
      [class]="redondo() ? 'rounded-full' : 'rounded-[22%]'"
      [style.background-color]="color()"
    >
      {{ canal() ? '#' : inicial() }}
    </span>
    @if (estado() === 'en_linea' || estado() === 'ausente') {
      <span
        class="absolute -right-0.5 -bottom-0.5 size-[30%] max-h-3.5 max-w-3.5 min-h-2.5 min-w-2.5 rounded-full ring-2 ring-white"
        [class]="estado() === 'en_linea' ? 'bg-correcto' : 'bg-atencion'"
      ></span>
    }
  `,
})
export class AvatarChat {
  readonly nombre = input.required<string>();
  readonly canal = input(false, { transform: booleanAttribute });
  readonly redondo = input(false, { transform: booleanAttribute });
  readonly estado = input<EstadoPersona>();

  protected readonly inicial = computed(() => this.nombre().trim().charAt(0).toUpperCase());
  protected readonly color = computed(() => {
    let suma = 0;
    for (const letra of this.nombre()) suma += letra.charCodeAt(0);
    return COLORES[suma % COLORES.length];
  });
}
