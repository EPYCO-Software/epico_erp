import { Component, ElementRef, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MessageCircle, SendHorizontal, User, X } from 'lucide';
import { Desvanecer, Icon } from 'ui';
import { ChatService } from '../core/services/chat.service';

/**
 * Burbuja de atención al cliente: flota abajo a la derecha por encima de todo (z-70) y no ocupa ni reserva
 * espacio en ninguna página. En celular, si la página tiene una barra fija inferior ([data-barra-inferior]),
 * se sube sobre ella para no tapar su botón.
 */
@Component({
  selector: 'app-chat-flotante',
  imports: [DatePipe, Desvanecer, Icon],
  // contents: el componente no ocupa lugar en el layout del shell; todo lo suyo es fixed.
  host: { class: 'contents' },
  template: `
    @if (chat.abierto()) {
      <section
        id="chat-panel"
        role="dialog"
        aria-labelledby="chat-titulo"
        class="glass-strong fixed inset-x-3 top-20 bottom-24 z-70 max-lg:[body:has([data-barra-inferior])_&]:bottom-44 flex flex-col overflow-hidden rounded-3xl bg-white/95 transition duration-200 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none sm:inset-x-auto sm:top-auto sm:right-5 sm:h-[min(34rem,calc(100dvh-9rem))] sm:w-96"
        (keydown.escape)="cerrar()"
      >
        <div class="flex items-center gap-3 border-b border-acero/50 px-4 py-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-epico/10 text-epico">
            <ui-icon [icono]="iconos.chat" [tamano]="22" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 id="chat-titulo" class="font-bold">Atención al cliente</h2>
            <p class="flex items-center gap-1.5 text-xs font-medium" [class]="chat.enLinea() ? 'text-correcto' : 'text-texto-suave'">
              <span class="size-2 rounded-full" [class]="chat.enLinea() ? 'bg-correcto' : 'bg-acero-oscuro'" aria-hidden="true"></span>
              {{ chat.enLinea() ? 'En línea' : 'Fuera de línea' }}
            </p>
          </div>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            aria-label="Cerrar chat"
            (click)="cerrar()"
          >
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>

        <div #log uiDesvanecer role="log" aria-live="polite" aria-labelledby="chat-titulo" class="sin-barra flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          @for (m of chat.mensajes(); track m.id) {
            <div class="flex items-end gap-2" [class.flex-row-reverse]="m.de === 'cliente'">
              @if (m.de === 'asesor') {
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-carbon/5 text-texto-suave">
                  <ui-icon [icono]="iconos.asesor" [tamano]="16" />
                </span>
              }
              <div class="flex max-w-[80%] flex-col" [class.items-end]="m.de === 'cliente'">
                <p
                  class="rounded-2xl px-3.5 py-2 text-sm"
                  [class]="m.de === 'asesor' ? 'rounded-bl-sm bg-white shadow-sm' : 'rounded-br-sm bg-epico text-white'"
                >
                  <span class="sr-only">{{ m.de === 'asesor' ? 'Asesor:' : 'Tú:' }}</span>{{ m.texto }}
                </p>
                <time class="mt-1 px-1 text-[0.6875rem] text-texto-suave" [attr.datetime]="m.fecha">{{ m.fecha | date: 'HH:mm' }}</time>
              </div>
            </div>
          }
          @if (chat.escribiendo()) {
            <div class="flex items-end gap-2">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-carbon/5 text-texto-suave">
                <ui-icon [icono]="iconos.asesor" [tamano]="16" />
              </span>
              <p class="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm">
                <span class="sr-only">El asesor está escribiendo</span>
                @for (d of [0, 150, 300]; track d) {
                  <span class="size-1.5 animate-bounce rounded-full bg-acero-oscuro motion-reduce:animate-none" [style.animation-delay.ms]="d" aria-hidden="true"></span>
                }
              </p>
            </div>
          }
        </div>

        <form class="flex gap-2 border-t border-acero/50 p-3" (submit)="enviar($event)">
          <label for="chat-mensaje" class="sr-only">Escribe tu mensaje</label>
          <input #entrada id="chat-mensaje" type="text" autocomplete="off" placeholder="Escribe tu mensaje…" class="campo h-11 px-3.5 text-sm" />
          <button
            type="submit"
            class="flex size-11 shrink-0 items-center justify-center rounded-[0.625rem] bg-epico text-white hover:bg-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            aria-label="Enviar mensaje"
          >
            <ui-icon [icono]="iconos.enviar" />
          </button>
        </form>
      </section>
    }

    <button
      #burbuja
      type="button"
      class="fixed right-3 bottom-5 z-70 flex size-14 max-lg:[body:has([data-barra-inferior])_&]:bottom-24 items-center justify-center rounded-full bg-epico text-white shadow-xl shadow-epico/30 transition hover:scale-105 hover:bg-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-epico motion-reduce:transition-none sm:right-5"
      [attr.aria-label]="etiquetaBurbuja()"
      [attr.aria-expanded]="chat.abierto()"
      aria-controls="chat-panel"
      (click)="chat.abierto() ? cerrar() : abrir()"
    >
      <ui-icon [icono]="chat.abierto() ? iconos.cerrar : iconos.chat" [tamano]="26" />
      @if (chat.hayNoLeidos() && !chat.abierto()) {
        <span
          class="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-white bg-carbon text-xs font-bold"
          aria-hidden="true"
        >
          {{ chat.noLeidos() }}
        </span>
      }
    </button>
  `,
})
export class ChatFlotante {
  protected readonly chat = inject(ChatService);
  protected readonly iconos = { chat: MessageCircle, cerrar: X, asesor: User, enviar: SendHorizontal };

  private readonly burbuja = viewChild.required<ElementRef<HTMLButtonElement>>('burbuja');
  private readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // Al abrir, el foco va directo a escribir.
    effect(() => this.entrada()?.nativeElement.focus());
    // Siempre mostrar el último mensaje.
    afterRenderEffect(() => {
      this.chat.mensajes();
      this.chat.escribiendo();
      const l = this.log()?.nativeElement;
      if (l) l.scrollTop = l.scrollHeight;
    });
  }

  protected etiquetaBurbuja(): string {
    if (this.chat.abierto()) return 'Cerrar chat de atención al cliente';
    const n = this.chat.noLeidos();
    return `Abrir chat de atención al cliente${n ? `, ${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : ''}`;
  }

  protected abrir(): void {
    this.chat.abrir();
  }

  protected cerrar(): void {
    this.chat.cerrar();
    this.burbuja().nativeElement.focus();
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    const input = this.entrada()?.nativeElement;
    if (!input) return;
    this.chat.enviar(input.value);
    input.value = '';
  }
}
