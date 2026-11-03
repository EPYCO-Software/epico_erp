import { DestroyRef, Directive, ElementRef, afterNextRender, inject, signal } from '@angular/core';

/**
 * Para contenedores con scroll: mientras quede contenido por ver abajo, desvanece el borde inferior
 * (utilidad `desvanecer-abajo`) como pista de que hay más. Al llegar al final, el degradado desaparece.
 * Se recalcula al hacer scroll, al cambiar de tamaño y cuando cambia el contenido (filtros, mensajes…).
 */
@Directive({
  selector: '[uiDesvanecer]',
  host: {
    '(scroll)': 'medir()',
    '[class.desvanecer-abajo]': 'masAbajo()',
  },
})
export class Desvanecer {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroy = inject(DestroyRef);
  protected readonly masAbajo = signal(false);

  constructor() {
    afterNextRender(() => {
      const ro = new ResizeObserver(() => this.medir());
      const mo = new MutationObserver(() => this.medir());
      ro.observe(this.el);
      mo.observe(this.el, { childList: true, subtree: true, characterData: true });
      this.medir();
      this.destroy.onDestroy(() => {
        ro.disconnect();
        mo.disconnect();
      });
    });
  }

  protected medir(): void {
    const e = this.el;
    // 2 px de tolerancia por redondeos de zoom y escalado de Windows.
    this.masAbajo.set(e.scrollHeight - e.scrollTop - e.clientHeight > 2);
  }
}
