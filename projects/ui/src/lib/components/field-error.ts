import { Component, computed, input } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { CircleAlert } from 'lucide';
import { Icon } from './icon';

/** Primer error de un campo de Signal Forms, visible cuando el usuario ya lo tocó. Enlazar con aria-describedby. */
@Component({
  selector: 'ui-field-error',
  imports: [Icon],
  template: `
    @if (mensaje(); as m) {
      <p [id]="errorId()" class="mt-1.5 flex items-center gap-1.5 text-sm text-critico">
        <ui-icon [icono]="icono" [tamano]="16" />{{ m }}
      </p>
    }
  `,
})
export class FieldError {
  readonly campo = input.required<FieldTree<unknown>>();
  readonly errorId = input.required<string>();

  protected readonly icono = CircleAlert;

  protected readonly mensaje = computed(() => {
    const estado = this.campo()();
    return estado.touched() && estado.invalid() ? (estado.errors()[0]?.message ?? 'Revisa este campo.') : null;
  });
}
