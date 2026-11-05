import { Component, ElementRef, Injector, afterNextRender, afterRenderEffect, computed, inject, input, output, viewChild } from '@angular/core';
import { Minus, SendHorizontal, X } from 'lucide';
import { FechaZonaPipe, Icon } from 'ui';
import { Conversacion, EstadoPersona, MensajeriaService, YO, formatoCuando } from '../core/mensajeria';
import { PlantasService } from '../core/plantas';
import { AvatarChat } from './avatar-chat';

const ESTADOS: Record<EstadoPersona, string> = { en_linea: 'En línea', ausente: 'Ausente', desconectado: 'Desconectado' };

/** Nombre a mostrar: "#ventas" para canales, el de la persona para chats. */
export function tituloConversacion(c: Conversacion): string {
  return c.tipo === 'canal' ? `#${c.nombre}` : c.nombre;
}

/** Lleva el foco al campo de escribir del chat cuando ya está en pantalla (al abrirlo o restaurarlo). */
export function enfocarChat(id: string, injector: Injector): void {
  afterNextRender(() => document.getElementById(`chat-entrada-${id}`)?.focus(), { injector });
}

/** Ventana de un chat o canal, como las de Odoo: encabezado con minimizar y cerrar, mensajes y campo para escribir. */
@Component({
  selector: 'app-ventana-chat',
  imports: [AvatarChat, FechaZonaPipe, Icon],
  host: { class: 'block shrink-0' },
  template: `
    @let c = conversacion();
    <section
      [attr.aria-labelledby]="'chat-titulo-' + c.id"
      class="glass-strong flex h-[min(30rem,calc(100dvh-6.5rem))] w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white/92"
      (keydown.escape)="minimizar.emit()"
    >
      <header class="flex items-center gap-2.5 border-b border-acero/50 py-1.5 pr-1.5 pl-3">
        <app-avatar-chat [nombre]="c.nombre" [canal]="c.tipo === 'canal'" [estado]="persona()?.estado" class="size-8 text-sm" />
        <div class="min-w-0 flex-1">
          <h2 [id]="'chat-titulo-' + c.id" class="truncate text-[15px] leading-tight font-bold">{{ titulo() }}</h2>
          @if (persona(); as p) {
            <p class="text-xs text-texto-suave">{{ estados[p.estado] }}</p>
          }
        </div>
        <button
          type="button"
          class="flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
          [attr.aria-label]="'Minimizar chat ' + titulo()"
          (click)="minimizar.emit()"
        >
          <ui-icon [icono]="iconos.minimizar" [tamano]="18" />
        </button>
        <button
          type="button"
          class="flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
          [attr.aria-label]="'Cerrar chat ' + titulo()"
          (click)="cerrar.emit()"
        >
          <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
        </button>
      </header>

      <!-- tabindex: se puede desplazar con el teclado aunque no haya nada enfocable dentro -->
      <div
        #historial
        role="log"
        tabindex="0"
        [attr.aria-labelledby]="'chat-titulo-' + c.id"
        class="flex flex-1 scroll-caja flex-col gap-2.5 px-3 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
      >
        <!-- Inicio de la conversación; mt-auto deja los mensajes abajo mientras sean pocos -->
        <div class="mt-auto px-1 pb-2">
          <div class="flex items-center gap-2.5">
            <app-avatar-chat [nombre]="c.nombre" [canal]="c.tipo === 'canal'" class="size-9 text-base" />
            <p class="text-lg font-semibold">{{ titulo() }}</p>
          </div>
          <p class="mt-1.5 text-sm text-texto-suave">
            {{ c.tipo === 'canal' ? 'Este es el inicio del canal ' + titulo() + '.' : 'Este es el inicio de tus mensajes directos con ' + c.nombre + '.' }}
          </p>
        </div>
        @for (m of c.mensajes; track m.id) {
          @let mio = m.autorId === yo;
          <div class="flex flex-col" [class]="mio ? 'items-end' : 'items-start'">
            @if (!mio && c.tipo === 'canal') {
              <span class="px-1 text-xs font-semibold">{{ autor(m.autorId) }}</span>
            }
            <p
              class="max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-line"
              [class]="mio ? 'rounded-br-sm bg-epico/10' : 'rounded-bl-sm border border-acero/40 bg-white'"
            >
              <span class="sr-only">{{ mio ? 'Tú' : autor(m.autorId) }}: </span>{{ m.texto }}
            </p>
            <time class="mt-0.5 px-1 text-[0.6875rem] text-texto-suave" [attr.datetime]="m.fecha">
              {{ m.fecha | fechaZona: zona() : formato(m.fecha) }}
            </time>
          </div>
        }
      </div>

      <form class="flex items-center gap-2 border-t border-acero/50 p-2.5" (submit)="enviar($event)">
        <label [for]="'chat-entrada-' + c.id" class="sr-only">Mensaje para {{ titulo() }}</label>
        <input
          #entrada
          [id]="'chat-entrada-' + c.id"
          type="text"
          autocomplete="off"
          class="campo h-10 rounded-full px-4 text-sm"
          [placeholder]="'Mensaje a ' + titulo() + '…'"
        />
        <button
          type="submit"
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-epico text-white transition-colors hover:bg-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
          aria-label="Enviar mensaje"
        >
          <ui-icon [icono]="iconos.enviar" [tamano]="18" />
        </button>
      </form>
    </section>
  `,
})
export class VentanaChat {
  private readonly mensajeria = inject(MensajeriaService);
  private readonly plantas = inject(PlantasService);

  readonly conversacion = input.required<Conversacion>();
  readonly minimizar = output();
  readonly cerrar = output();

  protected readonly yo = YO;
  protected readonly estados = ESTADOS;
  protected readonly iconos = { minimizar: Minus, cerrar: X, enviar: SendHorizontal };
  protected readonly titulo = computed(() => tituloConversacion(this.conversacion()));
  protected readonly persona = computed(() => this.mensajeria.persona(this.conversacion().personaId));
  /** Las horas se muestran en la zona de la planta principal, nunca en la del navegador. */
  protected readonly zona = computed(() => this.plantas.actual().zonaHoraria);

  private readonly historial = viewChild.required<ElementRef<HTMLElement>>('historial');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  constructor() {
    // Siempre a la vista el último mensaje.
    afterRenderEffect(() => {
      this.conversacion().mensajes.length;
      const h = this.historial().nativeElement;
      h.scrollTop = h.scrollHeight;
    });
  }

  protected autor(id: string): string {
    return this.mensajeria.persona(id)?.nombre ?? 'Alguien';
  }

  protected formato(iso: string): string {
    return formatoCuando(iso, this.zona());
  }

  protected enviar(event: Event): void {
    event.preventDefault();
    const campo = this.entrada().nativeElement;
    this.mensajeria.enviar(this.conversacion().id, campo.value);
    campo.value = '';
  }
}
