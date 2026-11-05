import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MapPin } from 'lucide';
import { agruparPorObra, etiquetas, fechaHoraCorta, lineasPartida, pesos, textoServicios, totalesCotizacion } from '../cotizacion/formato';
import { PartidaCotizacion } from '../models/cotizacion';
import { Obra } from '../models/obra';
import { Icon } from './icon';

/**
 * Resumen de una cotización con el mismo formato en el portal y en el ERP: partidas agrupadas por obra (volumen,
 * entrega, especificación, servicios y líneas con precio) y al final subtotal, descuento (si lo hay), IVA y neto.
 * `nivel`: nivel de encabezado de cada obra, uno debajo del título de quien lo usa.
 */
@Component({
  selector: 'ui-resumen-cotizacion',
  imports: [DecimalPipe, Icon],
  host: { class: 'block space-y-4' },
  template: `
    @for (g of grupos(); track g.obra.id) {
      <section [attr.aria-label]="'Entrega en ' + g.obra.nombre">
        <p role="heading" [attr.aria-level]="nivel()" class="flex flex-wrap items-center gap-1.5 font-semibold">
          <ui-icon [icono]="iconoObra" [tamano]="16" class="text-epico" />{{ g.obra.nombre }}
          <span class="font-normal text-texto-suave">· {{ g.obra.direccion }}, {{ g.obra.municipio }}</span>
        </p>
        <ul class="mt-2 space-y-2">
          @for (p of g.partidas; track p.id) {
            <li class="rounded-xl bg-white/80 p-3 text-sm">
              <p class="flex flex-wrap justify-between gap-x-4">
                <span class="font-semibold">{{ p.nombre }} · {{ p.volumenM3 | number: '1.0-1' }} m³</span>
                <span>Entrega {{ fecha(p.entrega) }}</span>
              </p>
              <p class="mt-0.5 text-texto-suave">{{ etiquetas(p.especificacion).join(' · ') }}</p>
              @if (servicios(p); as sv) {
                <p class="mt-0.5 text-texto-suave">Servicios: {{ sv }}</p>
              }
              <ul class="mt-2 divide-y divide-acero/30 border-t border-acero/40">
                @for (l of lineas(p); track $index) {
                  <li class="flex justify-between gap-4 py-1">
                    <span>{{ l.concepto }} <span class="text-texto-suave">({{ l.cantidad | number: '1.0-2' }} {{ l.unidad }} × \${{ pesos(l.precio) }})</span></span>
                    <span class="font-medium whitespace-nowrap">\${{ pesos(l.importe) }}</span>
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      </section>
    }
    <dl class="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
      <dt class="text-texto-suave">Subtotal</dt>
      <dd class="text-right">\${{ pesos(total().subtotal) }}</dd>
      @if (total().descuento) {
        <dt class="text-texto-suave">Descuento {{ descuento() | number: '1.0-2' }}%</dt>
        <dd class="text-right">−\${{ pesos(total().descuento) }}</dd>
      }
      <dt class="text-texto-suave">IVA 16%</dt>
      <dd class="text-right">\${{ pesos(total().iva) }}</dd>
      <dt class="font-bold">Neto</dt>
      <dd class="text-right font-bold">\${{ pesos(total().neto) }}</dd>
    </dl>
  `,
})
export class ResumenCotizacion {
  readonly partidas = input.required<PartidaCotizacion[]>();
  readonly obras = input.required<Obra[]>();
  readonly nivel = input(3);
  /** % sobre el subtotal (CotizacionGuardada.descuento). */
  readonly descuento = input<number>();

  protected readonly iconoObra = MapPin;
  protected readonly grupos = computed(() => agruparPorObra(this.partidas(), this.obras()));
  protected readonly total = computed(() => totalesCotizacion({ partidas: this.partidas(), descuento: this.descuento() }));
  protected readonly fecha = fechaHoraCorta;
  protected readonly pesos = pesos;
  protected readonly lineas = lineasPartida;
  protected readonly etiquetas = etiquetas;
  protected readonly servicios = textoServicios;
}
