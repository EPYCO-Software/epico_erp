import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Check, Folder, Package, Star } from 'lucide';
import { DisenoGuardado, Icon, PERSONALIZADO, SOLUCIONES, buscarSolucion, textoResistencia } from 'ui';
import { CotizadorState } from './cotizador.state';

@Component({
  selector: 'app-paso-solucion',
  imports: [NgTemplateOutlet, Icon],
  template: `
    <!-- Título y pestañas en una sola fila; en pantallas angostas las pestañas bajan a la siguiente línea. -->
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 id="paso-titulo" tabindex="-1" class="text-lg font-bold outline-none">
        {{ s.pestana() === 'soluciones' ? '¿Cómo quieres empezar?' : 'Mis diseños guardados' }}
      </h2>
      <div role="tablist" aria-label="Cómo empezar tu cotización" class="inline-flex gap-0.5 rounded-xl bg-white/70 p-0.5 shadow-sm">
        @for (t of pestanas; track t.id) {
          <button
            type="button"
            role="tab"
            [id]="'tab-' + t.id"
            [attr.aria-controls]="'panel-' + t.id"
            [attr.aria-selected]="s.pestana() === t.id"
            [tabIndex]="s.pestana() === t.id ? 0 : -1"
            class="flex h-9 items-center gap-1.5 rounded-[0.625rem] px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            [class]="s.pestana() === t.id ? 'bg-epico text-white shadow-sm shadow-epico/25' : 'text-carbon hover:bg-white'"
            (click)="s.pestana.set(t.id)"
            (keydown.arrowRight)="cambiarPestana()"
            (keydown.arrowLeft)="cambiarPestana()"
          >
            <ui-icon [icono]="t.icono" [tamano]="16" />
            {{ t.id === 'soluciones' ? 'Soluciones' : 'Mis diseños guardados (' + s.disenos().length + ')' }}
          </button>
        }
      </div>
    </div>

    @if (s.pestana() === 'soluciones') {
      <div role="tabpanel" id="panel-soluciones" aria-labelledby="tab-soluciones" class="mt-3">
        @if (s.faltaSolucion()) {
          <p role="alert" class="mt-2 rounded-xl bg-[#F6E3E1] px-4 py-2.5 text-sm font-medium text-[#8E332C]">Elige una solución para continuar.</p>
        }
        <div role="radiogroup" aria-labelledby="paso-titulo" class="mt-3 grid gap-3 xl:grid-cols-2">
          @for (sol of opciones; track sol.id) {
            <label
              class="group flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-transparent bg-white/85 p-3 pr-4 shadow-sm transition-colors hover:border-acero has-checked:border-epico has-checked:bg-[#FDF6F6] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico"
            >
              <input type="radio" name="solucion" class="sr-only" [value]="sol.id" [checked]="s.solucionId() === sol.id" (change)="s.elegirSolucion(sol.id)" />
              <span class="flex h-14 w-18 shrink-0 items-center justify-center border-r border-acero/60 pr-3 text-carbon/80">
                <ui-icon [icono]="sol.icono" [tamano]="38" class="[&_svg]:stroke-[1.5]" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-base leading-snug font-bold sm:text-lg">{{ sol.id === personalizado ? 'Configurar desde cero' : sol.nombre }}</span>
                <span class="block text-sm text-texto-suave">{{ sol.id === personalizado ? 'Define tus propias especificaciones' : sol.descripcion }}</span>
              </span>
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-acero-oscuro text-white group-has-checked:border-epico group-has-checked:bg-epico"
              >
                <ui-icon [icono]="iconos.check" [tamano]="14" class="hidden group-has-checked:inline-flex [&_svg]:stroke-3" />
              </span>
            </label>
          }
        </div>

        <div class="mt-6 flex items-center justify-between gap-3">
          <h2 class="text-lg font-bold">Mis diseños guardados</h2>
          @if (s.disenos().length > 2) {
            <button type="button" class="min-h-11 rounded text-sm font-semibold text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico" (click)="s.pestana.set('disenos')">
              Ver todos ({{ s.disenos().length }})
            </button>
          }
        </div>
        @if (s.disenos().length) {
          <ul class="mt-3 space-y-2">
            @for (d of s.disenos().slice(0, 2); track d.id) {
              <li><ng-container [ngTemplateOutlet]="filaDiseno" [ngTemplateOutletContext]="{ $implicit: d }" /></li>
            }
          </ul>
        } @else {
          <p class="mt-2 text-sm text-texto-suave">Aún no tienes diseños. Al configurar un concreto puedes guardarlo para reutilizarlo.</p>
        }

      </div>
    } @else {
      <div role="tabpanel" id="panel-disenos" aria-labelledby="tab-disenos" class="mt-3">
        <p class="text-sm text-texto-suave">Reutiliza las especificaciones de colados anteriores. Los favoritos aparecen primero.</p>
        @if (s.disenos().length) {
          <ul class="mt-3 space-y-2">
            @for (d of s.disenos(); track d.id) {
              <li><ng-container [ngTemplateOutlet]="filaDiseno" [ngTemplateOutletContext]="{ $implicit: d }" /></li>
            }
          </ul>
        } @else {
          <p class="mt-3 rounded-2xl bg-white/70 px-5 py-8 text-center text-sm text-texto-suave">Aún no tienes diseños guardados.</p>
        }
      </div>
    }

    <ng-template #filaDiseno let-d>
      <div class="flex items-center gap-3 rounded-2xl bg-white/85 p-3 shadow-sm sm:gap-4">
        <span class="hidden h-11 w-14 shrink-0 items-center justify-center border-r border-acero/60 pr-3 text-carbon/80 sm:flex">
          <ui-icon [icono]="icono(d)" [tamano]="30" class="[&_svg]:stroke-[1.5]" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-bold">{{ d.nombre }}</span>
          <span class="block truncate text-sm text-texto-suave">{{ resumen(d) }}</span>
        </span>
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
          [class]="d.favorito ? 'text-epico [&_svg]:fill-current' : 'text-texto-suave'"
          [attr.aria-pressed]="d.favorito"
          [attr.aria-label]="'Favorito: ' + d.nombre"
          (click)="s.alternarFavorito(d.id)"
        >
          <ui-icon [icono]="iconos.estrella" />
        </button>
        <button
          type="button"
          class="h-10 shrink-0 rounded-xl border border-acero-oscuro bg-white px-3 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico sm:px-4"
          [attr.aria-label]="'Usar diseño ' + d.nombre"
          (click)="s.usarDiseno(d)"
        >
          Usar diseño
        </button>
      </div>
    </ng-template>
  `,
})
export class PasoSolucion {
  protected readonly s = inject(CotizadorState);
  /** "Configurar desde cero" primero: es lo que más se usa. */
  protected readonly opciones = [PERSONALIZADO, ...SOLUCIONES];
  protected readonly personalizado = PERSONALIZADO.id;
  protected readonly iconos = { check: Check, estrella: Star };
  protected readonly pestanas = [
    { id: 'soluciones' as const, icono: Package },
    { id: 'disenos' as const, icono: Folder },
  ];

  protected icono(d: DisenoGuardado) {
    return buscarSolucion(d.solucionId)?.icono ?? Package;
  }

  protected resumen(d: DisenoGuardado): string {
    const e = d.especificacion;
    return `${textoResistencia(e)} · Rev. ${e.revenimientoCm} cm · TMA ${e.tmaMm} mm`;
  }

  /** Pestañas ARIA: las flechas cambian de pestaña y mueven el foco. */
  protected cambiarPestana(): void {
    const nueva = this.s.pestana() === 'soluciones' ? 'disenos' : 'soluciones';
    this.s.pestana.set(nueva);
    queueMicrotask(() => document.getElementById('tab-' + nueva)?.focus());
  }
}
