import { Component, ElementRef, effect, inject, input } from '@angular/core';
import { IconNode, createElement } from 'lucide';

/**
 * Icono de Lucide (licencia ISC). Importar cada icono por nombre desde 'lucide' para que el bundle solo lleve
 * los usados. Siempre decorativo: el nombre accesible va en el botón o enlace que lo contiene.
 */
@Component({
  selector: 'ui-icon',
  host: { 'aria-hidden': 'true', class: 'inline-flex shrink-0' },
  template: '',
})
export class Icon {
  readonly icono = input.required<IconNode>();
  readonly tamano = input(20);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    effect(() => {
      const t = this.tamano();
      host.replaceChildren(createElement(this.icono(), { width: t, height: t, 'stroke-width': 2 }));
    });
  }
}
