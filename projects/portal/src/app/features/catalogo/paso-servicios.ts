import { Component, inject, signal } from '@angular/core';
import { CalendarClock, Moon } from 'lucide';
import { Icon } from 'ui';
import { CotizadorState } from './cotizador.state';
import { MAQUINARIA, SERVICIOS } from './datos';
import { aInputLocal, limitesEntrega } from './entrega';
import { ObraEntrega } from './obra-entrega';

@Component({
  selector: 'app-paso-servicios',
  imports: [Icon, ObraEntrega],
  template: `
    <section aria-labelledby="paso-titulo" class="rounded-2xl bg-white/85 p-4 shadow-sm sm:p-5">
      <h2 id="paso-titulo" tabindex="-1" class="text-lg font-bold outline-none">Servicios para tu obra</h2>
      <p class="text-sm text-texto-suave">Opcionales. Tu asesor los incluye en la misma cotización.</p>

      <ul class="mt-4 space-y-2">
        @for (sv of servicios; track sv.id) {
          <li>
            <label
              class="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-transparent bg-white p-3 shadow-sm transition-colors hover:border-acero has-checked:border-epico has-checked:bg-[#FDF6F6] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico"
            >
              <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-carbon/4 text-carbon/80">
                <ui-icon [icono]="sv.icono" [tamano]="24" class="[&_svg]:stroke-[1.6]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{{ sv.nombre }}</span>
                <span class="block text-sm text-texto-suave">{{ sv.descripcion }}</span>
                @if (sv.id === 'colado-nocturno' && s.entregaNocturna()) {
                  <span id="nocturno-auto" class="mt-1 block text-sm font-semibold text-epico-oscuro">Incluido por horario nocturno</span>
                }
              </span>
              <span class="flex shrink-0 items-center gap-2 text-sm font-medium text-texto-suave">
                @if (sv.id === 'colado-nocturno' && s.entregaNocturna()) {
                  <input type="checkbox" class="casilla" checked disabled aria-describedby="nocturno-auto" />
                } @else {
                  <input type="checkbox" class="casilla" [checked]="s.servicios().includes(sv.id)" (change)="s.alternarServicio(sv.id)" />
                  <span class="hidden sm:inline" aria-hidden="true">Agregar</span>
                }
              </span>
            </label>

            @if (sv.id === 'renta-maquinaria' && s.servicios().includes('renta-maquinaria')) {
              <fieldset class="mt-2 ml-4 rounded-xl border-l-4 border-epico/40 bg-white/70 py-3 pr-3 pl-4 sm:ml-15">
                <legend class="sr-only">Equipos a rentar</legend>
                <p class="text-sm font-semibold">¿Qué equipo necesitas?</p>
                @if (s.faltaMaquinaria() && s.intentoAgregar()) {
                  <p role="alert" class="mt-2 rounded-lg bg-[#F6E3E1] px-3 py-2 text-sm font-medium text-[#8E332C]">Elige al menos un equipo o quita "Renta de maquinaria".</p>
                }
                <ul class="mt-2 space-y-2">
                  @for (m of maquinaria; track m.id) {
                    <li class="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg py-1">
                        <input type="checkbox" class="casilla" [checked]="dias(m.id) !== null" (change)="s.alternarMaquinaria(m.id)" />
                        <ui-icon [icono]="m.icono" [tamano]="20" class="text-carbon/70" />
                        <span class="min-w-0">
                          <span class="block text-sm font-semibold">{{ m.nombre }}</span>
                          <span class="block text-xs text-texto-suave">{{ m.descripcion }}</span>
                        </span>
                      </label>
                      @if (dias(m.id); as d) {
                        <span class="flex items-center gap-2 text-sm">
                          <label [for]="'dias-' + m.id" class="text-texto-suave">Días<span class="sr-only"> de renta: {{ m.nombre }}</span></label>
                          <input
                            [id]="'dias-' + m.id"
                            type="number"
                            min="1"
                            max="30"
                            inputmode="numeric"
                            class="campo h-9 w-20 px-2.5 text-center"
                            [value]="d"
                            (change)="s.diasMaquinaria(m.id, +$any($event.target).value)"
                          />
                        </span>
                      }
                    </li>
                  }
                </ul>
              </fieldset>
            }
          </li>
        }
      </ul>
      @if (s.especificacion().colocacion === 'bombeo') {
        <p class="mt-3 text-sm text-texto-suave">Elegiste colocación por bombeo: incluye al menos una bomba. Si quitas ambas, la colocación cambia a directa.</p>
      }
    </section>

    <section aria-labelledby="entrega-titulo" class="mt-4 rounded-2xl bg-white/85 p-4 shadow-sm sm:p-5">
      <h2 id="entrega-titulo" class="flex items-center gap-2 text-lg font-bold">
        <ui-icon [icono]="iconos.fecha" [tamano]="20" class="text-epico" />Fecha de entrega estimada
      </h2>
      <p id="entrega-ayuda" class="text-sm text-texto-suave">Mínimo 24 horas de anticipación y máximo 6 meses. Tu asesor confirma la disponibilidad.</p>
      <label for="entrega" class="mt-3 block text-sm font-medium">Fecha y hora</label>
      <input
        id="entrega"
        type="datetime-local"
        step="900"
        class="campo mt-1.5 h-11 max-w-72 px-3.5"
        [min]="limites.min"
        [max]="limites.max"
        [value]="s.entregaLocal()"
        [attr.aria-invalid]="verError() ? 'true' : null"
        [attr.aria-describedby]="verError() ? 'entrega-ayuda entrega-error' : 'entrega-ayuda'"
        (input)="s.definirEntrega($any($event.target).value)"
        (blur)="tocado.set(true)"
      />
      @if (verError()) {
        <p id="entrega-error" class="mt-1.5 text-sm font-medium text-[#8E332C]">{{ s.errorEntrega() }}</p>
      }
      @if (s.entregaNocturna()) {
        <p class="mt-3 flex items-start gap-2 rounded-lg bg-carbon/5 px-3 py-2 text-sm" role="status">
          <ui-icon [icono]="iconos.nocturno" [tamano]="18" class="mt-px shrink-0" />
          Entrega entre 18:00 y 07:00: es una entrega especial y se agregó el servicio de colado en horario nocturno.
        </p>
      }
    </section>

    <app-obra-entrega />
  `,
})
export class PasoServicios {
  protected readonly s = inject(CotizadorState);
  protected readonly servicios = SERVICIOS;
  protected readonly maquinaria = MAQUINARIA;
  protected readonly iconos = { fecha: CalendarClock, nocturno: Moon };
  protected readonly tocado = signal(false);
  protected readonly verError = () => !!this.s.errorEntrega() && (this.tocado() || this.s.intentoAgregar());
  private readonly ventana = limitesEntrega(new Date());
  protected readonly limites = { min: aInputLocal(this.ventana.min), max: aInputLocal(this.ventana.max) };

  /** Días de renta del equipo, o null si no está elegido. */
  protected dias(tipo: (typeof MAQUINARIA)[number]['id']): number | null {
    return this.s.maquinaria().find((x) => x.tipo === tipo)?.dias ?? null;
  }
}
