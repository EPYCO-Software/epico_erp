import { Component, computed, input } from '@angular/core';
import { Minus, TrendingDown, TrendingUp } from 'lucide';
import { Icon } from 'ui';
import { variacion } from './reporte-datos';

export interface Indicador {
  nombre: string;
  /** Ya con formato. */
  valor: string;
  actual: number;
  /** El de la comparación; null si este indicador no se compara. */
  antes: number | null;
  /** Una línea de contexto debajo (p. ej. "de 25 clientes"). */
  nota?: string;
  /** Cuando bajar es lo bueno (clientes inactivos): invierte verde/rojo, no la flecha. */
  menosEsMejor?: boolean;
}

/**
 * Los indicadores de un reporte: el número grande y su variación contra la comparación, con flecha y texto ("Subió
 * 12 % vs. periodo anterior"), nunca solo color.
 */
@Component({
  selector: 'app-indicadores-reporte',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
      @for (k of vista(); track k.nombre) {
        <div class="glass p-4">
          <p class="text-sm font-semibold text-texto-suave">{{ k.nombre }}</p>
          <p class="mt-1 text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{{ k.valor }}</p>
          @if (k.cambio) {
            <p class="mt-1 flex items-center gap-1 text-sm" [class]="k.clase"><ui-icon [icono]="k.icono" [tamano]="16" />{{ k.cambio }}</p>
          }
          @if (k.nota) {
            <p class="mt-0.5 text-sm text-texto-suave">{{ k.nota }}</p>
          }
        </div>
      }
    </section>
  `,
})
export class IndicadoresReporte {
  readonly indicadores = input.required<Indicador[]>();
  /** "periodo anterior" o "el año pasado". */
  readonly comparado = input.required<string>();

  protected readonly vista = computed(() =>
    this.indicadores().map((k) => {
      if (k.antes === null) return { ...k, cambio: '', clase: '', icono: Minus };
      const v = variacion(k.actual, k.antes);
      const plano = v !== null && Math.abs(v) < 0.5;
      const bueno = v !== null && (k.menosEsMejor ? v < 0 : v > 0);
      return {
        ...k,
        cambio:
          v === null
            ? 'Sin datos para comparar'
            : plano
              ? `Igual que ${this.comparado()}`
              : `${v > 0 ? 'Subió' : 'Bajó'} ${Math.abs(v).toLocaleString('es-MX', { maximumFractionDigits: 1 })} % vs. ${this.comparado()}`,
        icono: v === null || plano ? Minus : v > 0 ? TrendingUp : TrendingDown,
        clase: v === null || plano ? 'text-texto-suave' : bueno ? 'text-[#2E5E4A]' : 'text-[#8E332C]',
      };
    }),
  );
}
