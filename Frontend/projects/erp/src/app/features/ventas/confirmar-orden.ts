import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CalendarClock, MapPin, TriangleAlert, X } from 'lucide';
import { Icon } from 'ui';

/** Una entrega a recordar antes de confirmar: cuándo (hora de su planta), dónde y cuánto. */
export interface EntregaPorConfirmar {
  id: string;
  titulo: string;
  /** ISO 8601. */
  fecha: string;
  zona: string;
  lugar: string;
  m3: number;
}
export interface AccionConfirmar {
  id: string;
  texto: string;
  primaria?: boolean;
}

/** "jueves 20 de noviembre de 2026, 10:00" en la zona de la planta. */
export const fechaEntregaLarga = (iso: string, zona: string) =>
  new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zona }).format(new Date(iso));

/**
 * Antes de confirmar una orden (o de crear las de una cotización) se recuerda cada entrega: día y hora en la planta, obra
 * y m³; las que ya pasaron se marcan. Quien confirma elige la acción (p. ej. "Crear órdenes" o "Crear y confirmar").
 */
@Component({
  selector: 'app-confirmar-orden',
  imports: [DecimalPipe, Icon],
  host: { class: 'contents' },
  template: `
    <!-- Esc cierra el diálogo; que no llegue al panel de la lista, que también se cierra con Esc. -->
    <dialog
      #dialogo
      aria-labelledby="confirmar-orden-titulo"
      aria-describedby="confirmar-orden-ayuda"
      class="glass-strong m-auto w-[min(34rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
        <h2 id="confirmar-orden-titulo" class="text-lg font-bold">{{ titulo() }}</h2>
        <button
          type="button"
          aria-label="Cerrar sin confirmar"
          class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
          (click)="abierto.set(false)"
        >
          <ui-icon [icono]="iconos.cerrar" />
        </button>
      </div>

      <div class="grid gap-3 px-6 py-5">
        <p id="confirmar-orden-ayuda" class="text-texto-suave">
          Revisa {{ entregas().length === 1 ? 'la fecha y hora de entrega' : 'las fechas y horas de entrega' }} antes de confirmar.
        </p>
        <ul class="grid gap-2">
          @for (e of entregas(); track e.id) {
            <li class="rounded-xl bg-white/85 px-4 py-3">
              <p class="font-semibold">{{ e.titulo }} · {{ e.m3 | number: '1.0-1' }} m³</p>
              <p class="mt-1 flex items-center gap-2 text-base font-bold first-letter:uppercase">
                <ui-icon [icono]="iconos.fecha" [tamano]="18" class="shrink-0 text-epico" />
                <span class="first-letter:uppercase">{{ larga(e.fecha, e.zona) }}</span>
              </p>
              <p class="mt-0.5 flex items-center gap-2 text-sm text-texto-suave">
                <ui-icon [icono]="iconos.lugar" [tamano]="15" class="shrink-0" />{{ e.lugar }}
              </p>
              @if (paso(e.fecha)) {
                <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#8E332C]">
                  <ui-icon [icono]="iconos.alerta" [tamano]="15" />Esta fecha ya pasó: edita la entrega antes de confirmar.
                </p>
              }
            </li>
          }
        </ul>
      </div>

      <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
        @for (a of acciones(); track a.id) {
          <button
            type="button"
            [class]="a.primaria ? 'boton-primario h-11 w-auto px-5' : secundario"
            (click)="elegir(a.id)"
          >
            {{ a.texto }}
          </button>
        }
        <button type="button" [class]="secundario" (click)="abierto.set(false)">Cancelar</button>
      </div>
    </dialog>
  `,
})
export class ConfirmarOrden {
  readonly titulo = input.required<string>();
  readonly entregas = input.required<EntregaPorConfirmar[]>();
  readonly acciones = input.required<AccionConfirmar[]>();
  readonly abierto = model(false);
  readonly elegido = output<string>();

  protected readonly iconos = { cerrar: X, fecha: CalendarClock, lugar: MapPin, alerta: TriangleAlert };
  protected readonly secundario =
    'inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly larga = fechaEntregaLarga;
  protected paso(iso: string): boolean {
    return Date.parse(iso) < Date.now();
  }

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) d.showModal();
      else if (!this.abierto() && d.open) d.close();
    });
  }

  protected elegir(id: string): void {
    this.abierto.set(false);
    this.elegido.emit(id);
  }
}
