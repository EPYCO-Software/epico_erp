import { Component, computed, input } from '@angular/core';
import { CircleCheck, CircleOff, Lock } from 'lucide';
import { Icon } from 'ui';

const ESTADOS = {
  activo: { texto: 'Activo', icono: CircleCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
  inactivo: { texto: 'Inactivo', icono: CircleOff, clase: 'bg-carbon/6 text-texto-suave' },
  bloqueado: { texto: 'Bloqueado por intentos', icono: Lock, clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

/** Situación de un usuario: tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'app-estado-usuario',
  imports: [Icon],
  host: { class: 'inline-flex' },
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold" [class]="e().clase">
      <ui-icon [icono]="e().icono" [tamano]="14" />{{ e().texto }}
    </span>
  `,
})
export class EstadoUsuarioEtiqueta {
  readonly estado = input.required<keyof typeof ESTADOS>();
  protected readonly e = computed(() => ESTADOS[this.estado()]);
}
