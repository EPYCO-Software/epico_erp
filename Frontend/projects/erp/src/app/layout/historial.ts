import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { ArrowRight } from 'lucide';
import { DEFAULT_TIMEZONE, FechaZonaPipe, FieldError, Icon } from 'ui';
import { Actividad, EventoHistorial, HistorialService, tituloActividad } from '../core/historial';
import { AvatarChat } from './avatar-chat';
import { COLUMNA } from './panel-lateral';
import { ICONOS_ACTIVIDAD, ProgramarActividad } from './programar-actividad';

/**
 * Historial de un registro a la derecha de su vista completa (debajo en celular), como el chatter de Odoo pero sin
 * mensajes: lo que se hizo con el registro (con sus campos antes → después), notas internas y actividades.
 * Uso: `<aside appHistorial registro="cotizacion:EPI-PRES-ESC-26092">`. En escritorio es una columna del alto
 * disponible que se desplaza con todo y caja (COLUMNA), como la hoja de al lado.
 */
@Component({
  selector: 'aside[appHistorial]',
  imports: [AvatarChat, FechaZonaPipe, FieldError, FormField, Icon, ProgramarActividad],
  host: {
    'aria-label': 'Historial',
    '[class]': 'columna',
  },
  template: `
    <div class="glass p-4 sm:p-5">
      <div class="flex flex-wrap gap-2">
        <button
          #botonNota
          type="button"
          aria-controls="historial-nota"
          [attr.aria-expanded]="escribiendo()"
          [class]="boton + (escribiendo() ? ' border-epico bg-epico/8 text-epico-oscuro' : '')"
          (click)="escribiendo() ? cerrarNota() : abrirNota()"
        >
          Registrar una nota
        </button>
        <button #botonActividad type="button" [class]="boton" (click)="programando.set(true)">Actividad</button>
      </div>

      @if (escribiendo()) {
        <form id="historial-nota" novalidate class="mt-3" (submit)="registrarNota($event)">
          <label for="historial-texto" class="sr-only">Nota interna</label>
          <textarea
            id="historial-texto"
            rows="3"
            placeholder="Registra una nota interna…"
            class="campo resize-y px-3 py-2 text-sm"
            aria-describedby="historial-texto-error"
            [formField]="f.texto"
          ></textarea>
          <ui-field-error [campo]="f.texto" errorId="historial-texto-error" />
          <div class="mt-2 flex gap-2">
            <button type="submit" class="boton-primario h-9 w-auto px-3.5 text-sm">Registrar</button>
            <button type="button" [class]="boton" (click)="cerrarNota()">Descartar</button>
          </div>
        </form>
      }
      <p class="sr-only" aria-live="polite">{{ aviso() }}</p>

      @if (actividades().length) {
        <h2 class="mt-5 text-xs font-bold tracking-wide text-texto-suave uppercase">Actividades planificadas</h2>
        <ul class="mt-2 space-y-2">
          @for (a of actividades(); track a.id) {
            <li class="rounded-xl bg-white/80 p-3 text-sm">
              <p class="flex items-start gap-2 font-semibold">
                <ui-icon [icono]="iconos[a.tipo]" [tamano]="16" class="mt-0.5 text-epico" />{{ titulo(a) }}
              </p>
              <p class="mt-0.5">
                <span class="font-semibold" [class]="vence(a).clase">{{ vence(a).texto }}</span>
                <span class="text-texto-suave"> · asignada a {{ a.asignadaA }}</span>
              </p>
              @if (a.nota) {
                <p class="mt-1 text-texto-suave">{{ a.nota }}</p>
              }
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" [class]="boton" (click)="hecha(a)">Marcar como hecho</button>
                <button type="button" [class]="boton" (click)="cancelar(a)">Cancelar</button>
              </div>
            </li>
          }
        </ul>
      }

      <h2 class="sr-only">Historial de cambios</h2>
      <ol class="mt-5 space-y-5">
        @for (g of grupos(); track g.dia) {
          <li>
            <p
              class="flex items-center gap-3 text-xs text-texto-suave before:h-px before:flex-1 before:bg-acero after:h-px after:flex-1 after:bg-acero"
            >
              {{ g.titulo }}
            </p>
            <ol class="mt-3 space-y-4">
              @for (e of g.eventos; track e.id) {
                <li class="flex gap-3">
                  <app-avatar-chat [nombre]="e.autor" class="size-9 text-sm" />
                  <div class="min-w-0 flex-1 text-sm">
                    <p>
                      <span class="font-semibold">{{ e.autor }}</span>
                      <span class="ml-1.5 text-xs text-texto-suave">{{ e.fecha | fechaZona: null : 'HH:mm' }}</span>
                    </p>
                    <div [class]="e.nota ? 'mt-1 rounded-lg bg-[#FBF0DD] px-2.5 py-1.5' : ''">
                      @if (e.nota) {
                        <p class="text-xs font-semibold text-[#7A5410]">Nota interna</p>
                      }
                      <p class="whitespace-pre-line">{{ e.texto }}</p>
                      @for (d of e.detalles; track $index) {
                        <p class="text-texto-suave">{{ d }}</p>
                      }
                    </div>
                    @for (c of e.cambios; track $index) {
                      <p class="flex flex-wrap items-center gap-x-1.5">
                        <span class="sr-only">{{ c.campo }}: de</span>
                        <span class="text-texto-suave">{{ c.antes }}</span>
                        <ui-icon [icono]="iconoFlecha" [tamano]="14" class="text-texto-suave" />
                        <span class="sr-only">a</span>
                        <span class="font-semibold text-epico-oscuro">{{ c.despues }}</span>
                        <span class="text-texto-suave italic" aria-hidden="true">({{ c.campo }})</span>
                      </p>
                    }
                  </div>
                </li>
              }
            </ol>
          </li>
        } @empty {
          <li class="text-sm text-texto-suave">Sin movimientos todavía.</li>
        }
      </ol>

      <app-programar-actividad [(abierto)]="programando" [registro]="registro()" (listo)="aviso.set($event)" />
    </div>
  `,
})
export class Historial {
  // 21.5 y 27.5rem: los 20 y 26rem de la caja más el relleno de la columna, que deja ver su sombra.
  protected readonly columna = COLUMNA + ' block lg:w-[21.5rem] lg:shrink-0 xl:w-[27.5rem]';
  private readonly historial = inject(HistorialService);
  private readonly injector = inject(Injector);
  private readonly zona = inject(DEFAULT_TIMEZONE);

  /** Clave del registro: "cotizacion:…", "pedido:…", "cliente:…". */
  readonly registro = input.required<string>();

  protected readonly titulo = tituloActividad;
  protected readonly iconos = ICONOS_ACTIVIDAD;
  protected readonly iconoFlecha = ArrowRight;
  protected readonly boton =
    'inline-flex h-9 items-center rounded-lg border border-acero-oscuro/60 bg-white/70 px-3 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly escribiendo = signal(false);
  protected readonly programando = signal(false);
  protected readonly aviso = signal('');
  protected readonly f = form(signal({ texto: '' }), (m) => required(m.texto, { message: 'Escribe la nota.' }));

  protected readonly actividades = computed(() => this.historial.actividadesDe(this.registro()));
  private readonly botonNota = viewChild.required<ElementRef<HTMLButtonElement>>('botonNota');
  private readonly botonActividad = viewChild.required<ElementRef<HTMLButtonElement>>('botonActividad');

  private readonly diaTitulo = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: this.zona });
  /** Por día, del más reciente al más antiguo, como Odoo ("5 nov 2026"). */
  protected readonly grupos = computed(() => {
    const grupos: { dia: string; titulo: string; eventos: EventoHistorial[] }[] = [];
    for (const e of this.historial.de(this.registro())) {
      const dia = new Date(e.fecha).toLocaleDateString('en-CA', { timeZone: this.zona });
      const ultimo = grupos.at(-1);
      if (ultimo?.dia === dia) ultimo.eventos.push(e);
      else grupos.push({ dia, titulo: this.diaTitulo.format(new Date(e.fecha)), eventos: [e] });
    }
    return grupos;
  });

  /** Como Odoo: vencida en rojo, hoy en ámbar y a futuro en verde (con texto, no solo color). */
  protected vence(a: Actividad): { texto: string; clase: string } {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: this.zona });
    const dias = Math.round((Date.parse(a.fechaLimite) - Date.parse(hoy)) / 86_400_000);
    if (dias < 0) return { texto: dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`, clase: 'text-critico' };
    if (dias === 0) return { texto: 'Vence hoy', clase: 'text-[#7A5410]' };
    return { texto: dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`, clase: 'text-[#2E5E4A]' };
  }

  protected abrirNota(): void {
    this.f().reset({ texto: '' });
    this.escribiendo.set(true);
    afterNextRender(() => document.getElementById('historial-texto')?.focus(), { injector: this.injector });
  }

  /** El foco vuelve al botón con que se abrió. */
  protected cerrarNota(): void {
    this.escribiendo.set(false);
    this.botonNota().nativeElement.focus();
  }

  protected async registrarNota(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      this.historial.nota(this.registro(), this.f.texto().value().trim());
      this.cerrarNota();
      this.aviso.set('Nota registrada.');
      return undefined;
    });
    if (!valido) document.getElementById('historial-texto')?.focus();
  }

  // Su botón desaparece con la actividad: el foco pasa a "Actividad".
  protected hecha(a: Actividad): void {
    this.historial.marcarHecha(a);
    this.aviso.set('Actividad registrada como hecha.');
    this.botonActividad().nativeElement.focus();
  }

  protected cancelar(a: Actividad): void {
    this.historial.cancelar(a);
    this.aviso.set('Actividad cancelada.');
    this.botonActividad().nativeElement.focus();
  }
}
