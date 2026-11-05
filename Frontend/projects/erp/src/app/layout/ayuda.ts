import { Component, ElementRef, computed, effect, input, model, viewChild } from '@angular/core';
import { X } from 'lucide';
import { Icon } from 'ui';

/** Ayuda del ERP (menú del avatar): atajos de teclado y cómo se usa lo principal. <dialog> nativo modal. */
@Component({
  selector: 'app-ayuda',
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <dialog
      #dialogo
      aria-labelledby="ayuda-titulo"
      class="glass-strong m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
    >
      <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
        <h2 id="ayuda-titulo" class="text-lg font-bold">Ayuda</h2>
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
          aria-label="Cerrar ayuda"
          (click)="abierto.set(false)"
        >
          <ui-icon [icono]="iconoCerrar" />
        </button>
      </div>

      <div class="grid gap-6 px-6 py-5">
        <section aria-labelledby="ayuda-atajos">
          <h3 id="ayuda-atajos" class="text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">Atajos de teclado</h3>
          <dl class="mt-2.5 grid gap-2 text-[15px]">
            @for (a of atajos(); track a.accion) {
              <div class="flex items-center justify-between gap-4">
                <dt>{{ a.accion }}</dt>
                <dd class="flex gap-1">
                  @for (t of a.teclas; track t) {
                    <kbd
                      class="flex h-6 min-w-6 items-center justify-center rounded-md border border-carbon/10 bg-carbon/5 px-1.5 font-sans text-xs text-texto-suave"
                      >{{ t }}</kbd
                    >
                  }
                </dd>
              </div>
            }
          </dl>
        </section>

        <section aria-labelledby="ayuda-uso">
          <h3 id="ayuda-uso" class="text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">Cómo se usa</h3>
          <ul class="mt-2.5 grid gap-2.5 text-[15px] leading-relaxed">
            <li>
              <strong>Módulos.</strong> Entra desde la pantalla de inicio o búscalos arriba. Si uno no está activado, pídeselo a
              tu administrador.
            </li>
            <li>
              <strong>Plantas.</strong> En el botón de la fábrica eliges con qué plantas trabajas: clic en un nombre para usar
              solo esa, o marca varias casillas para combinarlas.
            </li>
            <li>
              <strong>Mensajes.</strong> En el globo están tus notificaciones, chats y canales. Cada chat se abre abajo a la
              derecha; al minimizarlo queda como una burbuja.
            </li>
            <li>
              <strong>Preferencias.</strong> Tu teléfono, firma de correo y avisos están en «Mis preferencias», en este mismo
              menú.
            </li>
          </ul>
        </section>

        <section aria-labelledby="ayuda-soporte">
          <h3 id="ayuda-soporte" class="text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">¿Algo no funciona?</h3>
          <!-- shortcut: sin canal de soporte de EPICO todavía; poner aquí su correo o WhatsApp cuando exista. -->
          <p class="mt-2.5 text-[15px] leading-relaxed">Avísale al administrador del ERP en tu empresa.</p>
        </section>
      </div>

      <form method="dialog" class="flex justify-end border-t border-acero/50 px-6 py-4">
        <button type="submit" class="boton-primario h-11 w-auto px-6" autofocus>Entendido</button>
      </form>
    </dialog>
  `,
})
export class Ayuda {
  readonly abierto = model(false);
  /** "Ctrl" o "⌘", la misma que muestra el buscador del encabezado. */
  readonly teclaMod = input('Ctrl');

  protected readonly iconoCerrar = X;
  protected readonly atajos = computed(() => [
    { accion: 'Buscar un módulo', teclas: [this.teclaMod(), 'K'] },
    { accion: 'Cerrar un menú o ventana, o minimizar el chat', teclas: ['Esc'] },
    { accion: 'Moverse entre pestañas', teclas: ['←', '→'] },
  ]);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) d.showModal();
      else if (!this.abierto() && d.open) d.close();
    });
  }
}
