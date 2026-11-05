import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { Conversacion, MensajeriaService } from '../core/mensajeria';
import { AvatarChat } from './avatar-chat';
import { VentanaChat, enfocarChat, tituloConversacion } from './ventana-chat';

/**
 * Chats abiertos, abajo a la derecha como en Odoo. Caben 3 ventanas a la vista; con más, esa zona se desplaza de lado
 * (la más reciente queda a la derecha). Los minimizados son burbujas redondas en la esquina, con su nombre al pasar
 * el mouse.
 */
@Component({
  selector: 'app-chats',
  imports: [AvatarChat, VentanaChat],
  host: { class: 'contents', '(document:keydown.escape)': 'sinEtiqueta.set(true)' },
  template: `
    @if (mensajeria.ventanas().length) {
      <div class="pointer-events-none fixed right-0 bottom-0 z-40 flex items-end sm:pr-3">
        @if (abiertas().length) {
          <!-- row-reverse: la primera (la más reciente) va a la derecha y el desplazamiento empieza ahí -->
          <div
            class="pointer-events-auto flex flex-row-reverse gap-3 overflow-x-auto p-3 scrollbar-thin"
            [class]="minimizadas().length ? 'max-w-[min(66rem,calc(100vw-5rem))]' : 'max-w-[min(66rem,calc(100vw-0.75rem))]'"
          >
            @for (c of abiertas(); track c.id) {
              <app-ventana-chat [conversacion]="c" (minimizar)="minimizar(c.id)" (cerrar)="cerrar(c.id)" />
            }
          </div>
        }
        @if (minimizadas().length) {
          <ul aria-label="Chats minimizados" class="pointer-events-auto flex flex-col-reverse gap-3 py-4 pr-3 pl-1">
            @for (c of minimizadas(); track c.id) {
              <li class="group relative flex" (pointerenter)="sinEtiqueta.set(false)" (focusin)="sinEtiqueta.set(false)">
                <!-- Nombre al pasar el mouse o con foco de teclado; Esc lo oculta. Está dentro del li para poder pasar
                     el puntero encima sin que desaparezca. -->
                <span
                  class="absolute top-1/2 right-full hidden -translate-y-1/2 pr-3 group-hover:block group-has-focus-visible:block"
                  [class.invisible]="sinEtiqueta()"
                  aria-hidden="true"
                >
                  <span
                    class="relative block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-carbon shadow-[0_4px_16px_-4px_rgb(26_26_28/0.3)]"
                  >
                    {{ titulo(c) }}
                    <span class="absolute top-1/2 -right-1 size-2.5 -translate-y-1/2 rotate-45 bg-white"></span>
                  </span>
                </span>
                <button
                  type="button"
                  [id]="'burbuja-' + c.id"
                  class="relative flex size-13 rounded-full shadow-[0_8px_20px_-8px_rgb(26_26_28/0.5)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-epico motion-reduce:transition-none"
                  [attr.aria-label]="etiqueta(c)"
                  (click)="restaurar(c.id)"
                >
                  <app-avatar-chat
                    [nombre]="c.nombre"
                    [canal]="c.tipo === 'canal'"
                    [estado]="mensajeria.persona(c.personaId)?.estado"
                    redondo
                    class="size-full text-xl"
                  />
                  @if (c.noLeidos) {
                    <span
                      class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-epico px-1 text-xs leading-none font-bold text-white ring-2 ring-white"
                      aria-hidden="true"
                      >{{ c.noLeidos }}</span
                    >
                  }
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class Chats {
  protected readonly mensajeria = inject(MensajeriaService);
  private readonly injector = inject(Injector);
  /** Esc oculta el nombre de la burbuja (WCAG 1.4.13) hasta que el puntero o el foco vuelven a entrar. */
  protected readonly sinEtiqueta = signal(false);

  /** La más reciente primero (row-reverse la pone a la derecha). */
  protected readonly abiertas = computed(() => this.conversacionesDe(this.mensajeria.ventanas().filter((v) => !v.minimizada)).reverse());
  protected readonly minimizadas = computed(() => this.conversacionesDe(this.mensajeria.ventanas().filter((v) => v.minimizada)));

  protected titulo(c: Conversacion): string {
    return tituloConversacion(c);
  }

  protected etiqueta(c: Conversacion): string {
    const n = c.noLeidos;
    return `Abrir chat ${tituloConversacion(c)}${n ? `, ${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : ''}`;
  }

  protected minimizar(id: string): void {
    this.mensajeria.minimizar(id);
    afterNextRender(() => document.getElementById(`burbuja-${id}`)?.focus(), { injector: this.injector });
  }

  protected cerrar(id: string): void {
    this.mensajeria.cerrar(id);
    // La ventana desaparece: el foco vuelve al globo de mensajes del encabezado.
    document.getElementById('boton-mensajeria')?.focus();
  }

  protected restaurar(id: string): void {
    this.mensajeria.abrir(id);
    enfocarChat(id, this.injector);
  }

  private conversacionesDe(ventanas: { id: string }[]): Conversacion[] {
    return ventanas.map((v) => this.mensajeria.conversacion(v.id)).filter((c): c is Conversacion => !!c);
  }
}
