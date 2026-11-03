import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormField } from '@angular/forms/signals';
import { CalendarClock, Check, ChevronRight, Folder, MapPin, Plus, Send, ShieldCheck, Trash2 } from 'lucide';
import { Icon } from 'ui';
import { CotizadorState } from './cotizador.state';
import { MAQUINARIA, SERVICIOS, buscarSolucion } from './datos';
import { deInputLocal } from './entrega';
import { fechaHoraCorta } from './presupuesto';
import { textoResistencia } from './reglas';

/** Columna derecha: lo que se está configurando ("Tu selección") y las partidas ya agregadas ("Tu cotización"). */
@Component({
  selector: 'app-resumen',
  imports: [DecimalPipe, FormField, Icon],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <section aria-labelledby="seleccion-titulo" class="glass p-4 sm:p-5">
      <h2 id="seleccion-titulo" class="text-xl font-bold">Tu selección</h2>

      @if (s.solucion(); as sol) {
        <div class="mt-3 flex items-center gap-3 border-b border-acero/50 pb-3">
          <span class="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/80 text-carbon/80 shadow-sm">
            <ui-icon [icono]="sol.icono" [tamano]="32" class="[&_svg]:stroke-[1.5]" />
          </span>
          <div class="min-w-0">
            <p class="leading-snug font-bold">{{ s.nombre() }}</p>
            <p class="text-sm text-texto-suave">{{ s.modelo().volumenM3 | number: '1.0-1' }} m³ estimados</p>
          </div>
        </div>

        <ul class="mt-3 flex flex-wrap gap-2" aria-label="Especificaciones">
          @for (t of s.etiquetas(); track t) {
            <li class="rounded-lg bg-carbon/5 px-2.5 py-1 text-sm">{{ t }}</li>
          }
          @if (s.especificacion().colocacion === 'bombeo') {
            <li class="flex items-center gap-1 rounded-lg bg-[#FDF2F2] px-2.5 py-1 text-sm font-medium text-epico-oscuro">
              <ui-icon [icono]="iconos.check" [tamano]="14" />Bombeo incluido
            </li>
          }
        </ul>
        @if (serviciosElegidos().length) {
          <p class="mt-2 text-sm text-texto-suave">Servicios: {{ serviciosElegidos().join(', ') }}</p>
        }
        @if (maquinariaElegida().length) {
          <p class="mt-1 text-sm text-texto-suave">Maquinaria: {{ maquinariaElegida().join(', ') }}</p>
        }
        <p class="mt-2 flex items-start gap-1.5 text-sm">
          <ui-icon [icono]="iconos.obra" [tamano]="16" class="mt-0.5 text-texto-suave" />
          @if (s.obra(); as o) {
            <span><span class="font-medium">{{ o.nombre }}</span><span class="text-texto-suave"> · {{ o.municipio }}</span></span>
          } @else {
            <span class="text-texto-suave">Sin obra de entrega (elígela en Servicios)</span>
          }
        </p>
        <p class="mt-1 flex items-start gap-1.5 text-sm">
          <ui-icon [icono]="iconos.fecha" [tamano]="16" class="mt-0.5 text-texto-suave" />
          @if (entrega(); as e) {
            <span><span class="font-medium">{{ e }}</span>@if (s.entregaNocturna()) {<span class="text-texto-suave"> · nocturna</span>}</span>
          } @else {
            <span class="text-texto-suave">Sin fecha de entrega (indícala en Servicios)</span>
          }
        </p>

        <div class="mt-4 border-t border-acero/50 pt-4">
          <label for="nombre-diseno" class="text-sm font-medium">Guardar como</label>
          <input id="nombre-diseno" type="text" autocomplete="off" placeholder="Ej. Pavimento patio norte" class="campo mt-1.5 h-11 px-3.5" [formField]="s.f.nombreDiseno" />
          <button
            type="button"
            class="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            (click)="s.guardarDiseno()"
          >
            <ui-icon [icono]="iconos.guardar" [tamano]="18" />Guardar diseño
          </button>
          <button type="button" class="boton-primario mt-2.5 h-12" (click)="s.siguiente()">
            @if (s.paso() === 3) {
              <ui-icon [icono]="iconos.agregar" />
            }
            {{ s.textoAccion() }}
            @if (s.paso() !== 3) {
              <ui-icon [icono]="iconos.siguiente" />
            }
          </button>
        </div>
      } @else {
        <p class="mt-2 text-sm text-texto-suave">Elige una solución o un diseño guardado para ver aquí tus especificaciones.</p>
      }

      <p class="mt-3 text-sm font-medium text-correcto empty:hidden" aria-live="polite">{{ s.mensaje() }}</p>
    </section>

    <section aria-labelledby="cotizacion-titulo" class="glass p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-3">
        <h2 id="cotizacion-titulo" class="text-xl font-bold">
          Tu cotización
          @if (s.edicion(); as e) {
            <span class="block text-sm font-medium text-texto-suave">{{ e.modo === 'revision' ? 'Modificando' : 'Basada en' }} {{ e.origen.folio }}</span>
          }
        </h2>
        @if (s.partidas().length) {
          <span class="text-sm text-texto-suave">{{ s.partidas().length }} {{ s.partidas().length === 1 ? 'concreto' : 'concretos' }} · {{ s.volumenTotal() | number: '1.0-1' }} m³</span>
        }
      </div>

      @if (s.partidas().length) {
        <ul class="mt-3 space-y-2">
          @for (p of s.partidas(); track p.id) {
            <li class="flex items-center gap-3 rounded-xl bg-white/80 p-3 shadow-sm">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-carbon/4 text-carbon/80">
                <ui-icon [icono]="icono(p.solucionId)" [tamano]="22" class="[&_svg]:stroke-[1.6]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ p.nombre }}</span>
                <span class="block truncate text-xs text-texto-suave">
                  {{ p.volumenM3 | number: '1.0-1' }} m³ · {{ resistencia(p) }} · Rev. {{ p.especificacion.revenimientoCm }} cm
                  @if (p.servicios.length) {
                    · {{ p.servicios.length }} {{ p.servicios.length === 1 ? 'servicio' : 'servicios' }}
                  }
                </span>
                <span class="block truncate text-xs text-texto-suave">Entrega: {{ nombreObra(p.obraId) }} · {{ fecha(p.entrega) }}</span>
              </span>
              <button
                type="button"
                class="flex size-10 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-carbon/5 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico"
                [attr.aria-label]="'Quitar ' + p.nombre + ' de la cotización'"
                (click)="s.quitarPartida(p.id)"
              >
                <ui-icon [icono]="iconos.quitar" [tamano]="18" />
              </button>
            </li>
          }
        </ul>
        <button type="button" class="boton-primario mt-3 h-12 bg-carbon! shadow-carbon/20! hover:bg-black!" (click)="s.paso.set('enviar')">
          <ui-icon [icono]="iconos.enviar" [tamano]="18" />Solicitar precios
        </button>
      } @else {
        <p class="mt-2 text-sm text-texto-suave">Agrega uno o varios concretos (por ejemplo, losa y firme) y pide los precios en una sola solicitud.</p>
      }
      <p class="mt-3 flex items-center gap-2 text-xs text-texto-suave">
        <ui-icon [icono]="iconos.seguro" [tamano]="16" />No se generará un pedido hasta que aceptes la cotización.
      </p>
    </section>
  `,
})
export class Resumen {
  protected readonly s = inject(CotizadorState);
  protected readonly iconos = { check: Check, guardar: Folder, agregar: Plus, quitar: Trash2, enviar: Send, seguro: ShieldCheck, obra: MapPin, siguiente: ChevronRight, fecha: CalendarClock };
  protected readonly fecha = fechaHoraCorta;
  /** Fecha elegida, solo si es válida. */
  protected readonly entrega = computed(() => {
    const d = deInputLocal(this.s.entregaLocal());
    return d && !this.s.errorEntrega() ? fechaHoraCorta(d.toISOString()) : null;
  });
  protected readonly serviciosElegidos = computed(() =>
    SERVICIOS.filter((sv) => this.s.servicios().includes(sv.id)).map((sv) => sv.nombre),
  );
  protected readonly resistencia = (p: { especificacion: Parameters<typeof textoResistencia>[0] }) => textoResistencia(p.especificacion);

  protected readonly maquinariaElegida = computed(() =>
    this.s.maquinaria().map((m) => `${MAQUINARIA.find((x) => x.id === m.tipo)!.nombre} (${m.dias} ${m.dias === 1 ? 'día' : 'días'})`),
  );

  protected nombreObra(id: string): string {
    return this.s.obras().find((o) => o.id === id)?.nombre ?? 'Obra no encontrada';
  }

  protected icono(solucionId: string) {
    return buscarSolucion(solucionId)?.icono ?? Plus;
  }
}
