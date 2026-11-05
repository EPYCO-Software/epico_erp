import { DestroyRef, Directive, Service, TemplateRef, inject, signal } from '@angular/core';

/**
 * Barra de la página dentro del encabezado, debajo del menú del módulo: el panel de control de Odoo ("Nuevo", título,
 * buscador). Queda fija arriba con el resto del encabezado. La página la declara con `<ng-template appEnEncabezado>`;
 * sus enlaces, datos y componentes siguen siendo los de la página (la plantilla se evalúa donde se declaró).
 */
@Service()
export class BarraEncabezado {
  readonly plantilla = signal<TemplateRef<unknown> | null>(null);
}

@Directive({ selector: 'ng-template[appEnEncabezado]' })
export class EnEncabezado {
  constructor() {
    const barra = inject(BarraEncabezado);
    const plantilla = inject(TemplateRef);
    barra.plantilla.set(plantilla);
    // Solo la quita si sigue siendo la suya (la página nueva pudo poner otra antes).
    inject(DestroyRef).onDestroy(() => barra.plantilla() === plantilla && barra.plantilla.set(null));
  }
}
