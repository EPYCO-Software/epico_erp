import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ArrowLeft, MessageCircle, SquarePen, X } from 'lucide';
import { FechaZonaPipe, Icon } from 'ui';
import { Conversacion, MensajeriaService, Notificacion, YO, formatoCuando } from '../core/mensajeria';
import { normalizar } from '../core/modulos';
import { PlantasService } from '../core/plantas';
import { IconoModulo } from '../features/inicio/icono-modulo';
import { AvatarChat } from './avatar-chat';
import { moverEntrePestanas } from './pestanas';
import { colocarBajo } from './popover';
import { enfocarChat } from './ventana-chat';

type Pestana = 'notificaciones' | 'chats' | 'canales';

const PESTANAS: { id: Pestana; nombre: string; vacio: string }[] = [
  { id: 'notificaciones', nombre: 'Notificaciones', vacio: 'No tienes notificaciones.' },
  { id: 'chats', nombre: 'Chats', vacio: 'Aún no tienes chats. Empieza uno con «Mensaje nuevo».' },
  { id: 'canales', nombre: 'Canales', vacio: 'No perteneces a ningún canal.' },
];

const ESTADOS = { en_linea: 'en línea', ausente: 'ausente', desconectado: 'desconectado' };

/**
 * Globo de mensajes del encabezado, como el de Odoo: un solo icono para notificaciones, chats y canales. En
 * "Notificaciones" se ve todo junto; clic en un chat o canal lo abre abajo a la derecha. Panel con `popover` nativo
 * (Esc, clic fuera y foco de vuelta los da el navegador), igual que el selector de plantas.
 */
@Component({
  selector: 'app-menu-mensajeria',
  imports: [AvatarChat, FechaZonaPipe, Icon, IconoModulo],
  template: `
    <button
      #disparador
      id="boton-mensajeria"
      type="button"
      popovertarget="panel-mensajeria"
      class="relative inline-flex size-11 items-center justify-center rounded-xl text-carbon transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
      [attr.aria-label]="etiqueta()"
    >
      <ui-icon [icono]="iconos.mensajes" [tamano]="23" [grosor]="2" />
      @if (mensajeria.noLeidos()) {
        <span
          class="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-epico px-1 text-xs leading-none font-bold text-white ring-2 ring-white"
          aria-hidden="true"
        >
          {{ mensajeria.noLeidos() }}
        </span>
      }
    </button>

    <div
      #panel
      id="panel-mensajeria"
      popover
      role="dialog"
      aria-label="Mensajes y notificaciones"
      class="glass-strong m-0 w-[min(30rem,calc(100vw-1rem))] overflow-hidden p-0 text-carbon inset-auto"
      (beforetoggle)="alAbrir($event)"
      (toggle)="alCerrar($event)"
    >
      @if (!nuevo()) {
        <div class="flex items-center justify-between gap-2 border-b border-acero/50 px-2 py-2">
          <div role="tablist" aria-label="Mensajes y notificaciones" class="flex gap-0.5">
            @for (t of pestanas; track t.id; let i = $index) {
              <button
                type="button"
                role="tab"
                [id]="'mensajeria-tab-' + t.id"
                aria-controls="mensajeria-lista"
                [attr.aria-selected]="pestana() === t.id"
                [attr.autofocus]="pestana() === t.id ? '' : null"
                [tabIndex]="pestana() === t.id ? 0 : -1"
                class="h-9 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico sm:px-3"
                [class]="pestana() === t.id ? 'bg-epico/10 text-epico-oscuro' : 'text-texto-suave hover:bg-carbon/5 hover:text-carbon'"
                (click)="pestana.set(t.id)"
                (keydown)="elegirPestana(moverEntrePestanas($event, i))"
              >
                {{ t.nombre }}
              </button>
            }
          </div>
          <button
            #botonNuevo
            type="button"
            class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/8 focus-visible:outline-2 focus-visible:outline-epico sm:px-3"
            (click)="empezarNuevo()"
          >
            <!-- En celular no cabe el texto junto a las pestañas: queda el icono y el texto para lectores de pantalla -->
            <ui-icon [icono]="iconos.nuevo" [tamano]="18" class="sm:hidden" /><span class="max-sm:sr-only">Mensaje nuevo</span>
          </button>
        </div>

        <div
          id="mensajeria-lista"
          role="tabpanel"
          [attr.aria-labelledby]="'mensajeria-tab-' + pestana()"
          class="max-h-[min(30rem,calc(100dvh-7rem))] scroll-caja"
        >
          <ul class="divide-y divide-acero/40">
            @if (pestana() === 'notificaciones') {
              @for (n of mensajeria.notificaciones(); track n.id) {
                <li class="relative">
                  <button
                    type="button"
                    class="flex w-full items-start gap-3 py-3 pr-11 pl-3 text-left transition-colors hover:bg-carbon/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
                    (click)="abrirNotificacion(n)"
                  >
                    <span
                      class="flex size-11 shrink-0 items-center justify-center rounded-[22%] border border-white bg-white shadow-[0_1px_2px_rgb(26_26_28/0.1)]"
                    >
                      <app-icono-modulo [modulo]="n.modulo" class="size-8" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-baseline justify-between gap-2">
                        <span class="truncate" [class]="n.leida ? 'font-semibold' : 'font-bold'">{{ n.titulo }}</span>
                        <time class="shrink-0 text-xs text-texto-suave" [attr.datetime]="n.fecha">{{ n.fecha | fechaZona: zona() : formato(n.fecha) }}</time>
                      </span>
                      <span class="line-clamp-2 text-sm text-texto-suave">{{ n.texto }}</span>
                      @if (!n.leida) {
                        <span class="sr-only">Sin leer.</span>
                      }
                    </span>
                  </button>
                  <button
                    type="button"
                    class="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
                    [attr.aria-label]="'Descartar notificación: ' + n.titulo"
                    (click)="mensajeria.descartarNotificacion(n.id)"
                  >
                    <ui-icon [icono]="iconos.cerrar" [tamano]="16" />
                  </button>
                  @if (!n.leida) {
                    <span class="pointer-events-none absolute top-11 right-4 size-2.5 rounded-full bg-epico" aria-hidden="true"></span>
                  }
                </li>
              }
            }
            @for (c of lista(); track c.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-carbon/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
                  (click)="abrirChat(c.id)"
                >
                  <app-avatar-chat
                    [nombre]="c.nombre"
                    [canal]="c.tipo === 'canal'"
                    [estado]="mensajeria.persona(c.personaId)?.estado"
                    class="size-11 text-lg"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline justify-between gap-2">
                      <span class="truncate" [class]="c.noLeidos ? 'font-bold' : 'font-semibold'">{{ c.nombre }}</span>
                      @if (ultimo(c); as u) {
                        <time class="shrink-0 text-xs text-texto-suave" [attr.datetime]="u.fecha">{{ u.fecha | fechaZona: zona() : formato(u.fecha) }}</time>
                      }
                    </span>
                    <span class="flex items-start gap-2">
                      <span class="line-clamp-2 flex-1 text-sm" [class]="c.noLeidos ? 'text-carbon' : 'text-texto-suave'">{{ resumen(c) }}</span>
                      @if (c.noLeidos) {
                        <span
                          class="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-epico px-1.5 text-xs leading-none font-bold text-white"
                          aria-hidden="true"
                          >{{ c.noLeidos }}</span
                        >
                      }
                    </span>
                    <span class="sr-only">{{ detalle(c) }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
          @if (vacia()) {
            <p class="px-6 py-10 text-center text-sm text-texto-suave">{{ textoVacio() }}</p>
          }
        </div>
      } @else {
        <div class="flex items-center gap-1 border-b border-acero/50 px-2 py-2">
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            aria-label="Volver a mensajes"
            (click)="volver()"
          >
            <ui-icon [icono]="iconos.volver" [tamano]="18" />
          </button>
          <h2 class="text-sm font-bold">Mensaje nuevo</h2>
        </div>
        <div class="p-3">
          <label for="buscar-persona" class="sr-only">Buscar una persona</label>
          <input
            #buscador
            id="buscar-persona"
            type="search"
            autocomplete="off"
            placeholder="¿A quién le escribes?"
            class="campo h-10 px-3 text-sm"
            [value]="filtro()"
            (input)="filtro.set($any($event.target).value)"
          />
        </div>
        <ul class="max-h-80 scroll-caja pb-2" aria-label="Personas">
          @for (p of personas(); track p.id) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-carbon/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
                (click)="escribirA(p.id)"
              >
                <app-avatar-chat [nombre]="p.nombre" [estado]="p.estado" class="size-10 text-base" />
                <span class="min-w-0">
                  <span class="block truncate font-semibold">{{ p.nombre }}</span>
                  <span class="block truncate text-sm text-texto-suave">{{ p.puesto }}</span>
                  <span class="sr-only">, {{ estados[p.estado] }}</span>
                </span>
              </button>
            </li>
          } @empty {
            <li class="px-6 py-8 text-center text-sm text-texto-suave">Nadie coincide con «{{ filtro() }}».</li>
          }
        </ul>
      }
    </div>
  `,
})
export class MenuMensajeria {
  protected readonly mensajeria = inject(MensajeriaService);
  private readonly plantas = inject(PlantasService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly pestanas = PESTANAS;
  protected readonly estados = ESTADOS;
  protected readonly iconos = { mensajes: MessageCircle, cerrar: X, volver: ArrowLeft, nuevo: SquarePen };
  protected readonly moverEntrePestanas = moverEntrePestanas;
  protected readonly pestana = signal<Pestana>('notificaciones');
  protected readonly nuevo = signal(false);
  protected readonly filtro = signal('');
  /** Horas en la zona de la planta principal, nunca en la del navegador. */
  protected readonly zona = computed(() => this.plantas.actual().zonaHoraria);

  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  private readonly botonNuevo = viewChild<ElementRef<HTMLButtonElement>>('botonNuevo');

  /** En "Notificaciones" va todo junto (como Odoo); en las otras, solo chats o solo canales. */
  protected readonly lista = computed(() => {
    const todas = this.mensajeria.recientes();
    const p = this.pestana();
    return p === 'notificaciones' ? todas : todas.filter((c) => c.tipo === (p === 'chats' ? 'chat' : 'canal'));
  });
  protected readonly vacia = computed(
    () => !this.lista().length && (this.pestana() !== 'notificaciones' || !this.mensajeria.notificaciones().length),
  );
  protected readonly textoVacio = computed(() => PESTANAS.find((t) => t.id === this.pestana())!.vacio);
  protected readonly personas = computed(() => {
    const palabras = normalizar(this.filtro()).split(/\s+/).filter(Boolean);
    return this.mensajeria.personas.filter((p) => {
      const texto = normalizar(`${p.nombre} ${p.puesto}`);
      return palabras.every((x) => texto.includes(x));
    });
  });

  protected etiqueta(): string {
    const n = this.mensajeria.noLeidos();
    return `Mensajes y notificaciones${n ? `, ${n} sin leer` : ''}`;
  }

  protected alAbrir(e: Event): void {
    if ((e as ToggleEvent).newState === 'open') colocarBajo(this.panel().nativeElement, this.disparador().nativeElement, 480);
  }

  /** Al cerrarse vuelve a la lista, para que al abrir de nuevo el foco caiga en la pestaña elegida. */
  protected alCerrar(e: Event): void {
    if ((e as ToggleEvent).newState !== 'closed') return;
    this.nuevo.set(false);
    this.filtro.set('');
  }

  protected elegirPestana(i: number): void {
    if (i >= 0) this.pestana.set(PESTANAS[i].id);
  }

  protected ultimo(c: Conversacion) {
    return c.mensajes[c.mensajes.length - 1];
  }

  protected formato(iso: string): string {
    return formatoCuando(iso, this.zona());
  }

  /** Último mensaje: "Tú: …" si es tuyo y "Nombre: …" en los canales. */
  protected resumen(c: Conversacion): string {
    const u = this.ultimo(c);
    if (!u) return 'Sin mensajes todavía';
    if (u.autorId === YO) return `Tú: ${u.texto}`;
    return c.tipo === 'canal' ? `${this.mensajeria.persona(u.autorId)?.nombre ?? 'Alguien'}: ${u.texto}` : u.texto;
  }

  /** Lo que el avatar y el contador dicen con color, en texto para lectores de pantalla. */
  protected detalle(c: Conversacion): string {
    const partes = [c.tipo === 'canal' ? 'Canal' : ''];
    const estado = this.mensajeria.persona(c.personaId)?.estado;
    if (estado) partes.push(ESTADOS[estado]);
    if (c.noLeidos) partes.push(`${c.noLeidos} ${c.noLeidos === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}`);
    return partes.filter(Boolean).join(', ');
  }

  protected abrirChat(id: string): void {
    this.mensajeria.abrir(id);
    this.panel().nativeElement.hidePopover();
    enfocarChat(id, this.injector);
  }

  protected abrirNotificacion(n: Notificacion): void {
    this.mensajeria.leerNotificacion(n.id);
    this.panel().nativeElement.hidePopover();
    void this.router.navigateByUrl(n.ruta);
  }

  protected empezarNuevo(): void {
    this.nuevo.set(true);
    afterNextRender(() => this.buscador()?.nativeElement.focus(), { injector: this.injector });
  }

  protected volver(): void {
    this.nuevo.set(false);
    this.filtro.set('');
    afterNextRender(() => this.botonNuevo()?.nativeElement.focus(), { injector: this.injector });
  }

  protected escribirA(personaId: string): void {
    const id = this.mensajeria.chatCon(personaId);
    if (id) this.abrirChat(id);
  }
}
