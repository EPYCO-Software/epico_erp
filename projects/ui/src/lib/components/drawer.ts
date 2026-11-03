import { Component, ElementRef, effect, input, model, viewChild } from '@angular/core';
import { X } from 'lucide';
import { Icon } from './icon';

let siguienteId = 0;

/**
 * Panel lateral modal sobre <dialog> nativo: el navegador da la trampa de foco, el cierre con Esc,
 * el fondo inerte y la devolución del foco al cerrar.
 */
@Component({
  selector: 'ui-drawer',
  imports: [Icon],
  // El <dialog> vive en la capa superior; el host no debe ocupar lugar ni sumar gaps en el layout del padre.
  host: { class: 'contents' },
  template: `
    <dialog
      #dialogo
      [attr.aria-labelledby]="tituloId"
      class="glass-strong fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] rounded-l-none p-0 text-carbon backdrop:bg-carbon/40 backdrop:backdrop-blur-[2px]"
      (close)="abierto.set(false)"
      (click)="cerrarSiFondo($event)"
    >
      <div class="flex h-full flex-col overflow-y-auto p-4">
        <div class="mb-4 flex items-center justify-between">
          <h2 [id]="tituloId" class="text-lg font-bold">{{ titulo() }}</h2>
          <button
            type="button"
            class="inline-flex size-11 items-center justify-center rounded-xl hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
            aria-label="Cerrar menú"
            (click)="abierto.set(false)"
          >
            <ui-icon [icono]="iconoCerrar" />
          </button>
        </div>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Drawer {
  readonly abierto = model(false);
  readonly titulo = input.required<string>();

  protected readonly tituloId = `ui-drawer-${siguienteId++}`;
  protected readonly iconoCerrar = X;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) d.showModal();
      else if (!this.abierto() && d.open) d.close();
    });
  }

  /** El clic en el ::backdrop llega con target = <dialog>; el contenido está dentro del div. */
  protected cerrarSiFondo(event: MouseEvent): void {
    if (event.target === this.dialogo().nativeElement) this.abierto.set(false);
  }
}
