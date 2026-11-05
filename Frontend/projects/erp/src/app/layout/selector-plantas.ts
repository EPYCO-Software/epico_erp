import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Factory } from 'lucide';
import { Icon } from 'ui';
import { PlantasService, RazonSocial } from '../core/plantas';
import { colocarBajo } from './popover';

/**
 * Selector de plantas del encabezado (como el de empresas de Odoo): plantas agrupadas por razón social.
 * Clic en un nombre = trabajar solo con esa planta (o con todas las de esa razón social); casillas = combinar
 * varias. Siempre queda al menos una. El panel es un `popover` nativo: cierra con Esc o al hacer clic fuera y
 * devuelve el foco al botón.
 */
@Component({
  selector: 'app-selector-plantas',
  imports: [Icon],
  template: `
    <button
      #disparador
      type="button"
      popovertarget="selector-plantas"
      class="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-[15px] text-carbon transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
      [attr.aria-label]="etiqueta()"
    >
      <ui-icon [icono]="iconoPlanta" [tamano]="23" [grosor]="1.7" />
      <span class="hidden whitespace-nowrap sm:inline">{{ plantas.actual().nombre }}</span>
      @if (plantas.otras()) {
        <span class="rounded-full bg-epico px-1.5 text-xs leading-5 font-bold text-white" aria-hidden="true">+{{ plantas.otras() }}</span>
      }
    </button>

    <div
      #panel
      id="selector-plantas"
      popover
      role="dialog"
      aria-labelledby="selector-plantas-titulo"
      class="glass-strong m-0 w-84 max-w-[calc(100vw-1rem)] p-2 text-carbon [inset:auto]"
      (beforetoggle)="alAbrir($event)"
    >
      <p id="selector-plantas-titulo" class="px-3 pt-1.5 pb-2 text-xs font-semibold tracking-[0.12em] text-texto-suave uppercase">
        Plantas
      </p>
      @for (r of plantas.razones; track r.id) {
        <div role="group" [attr.aria-label]="r.nombre" class="mb-1">
          <div class="flex items-center rounded-lg" [class.bg-epico/8]="plantas.estado(r) === 'todas'">
            <input
              #casillaRazon
              type="checkbox"
              class="casilla ml-3"
              [checked]="plantas.estado(r) === 'todas'"
              [indeterminate]="plantas.estado(r) === 'algunas'"
              [attr.aria-label]="'Todas las plantas de ' + r.nombre"
              (change)="alternarRazon(r, casillaRazon)"
            />
            <button
              type="button"
              class="min-h-10 flex-1 rounded-lg px-3 text-left text-sm font-semibold transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
              (click)="soloRazon(r)"
            >
              {{ r.nombre }}
            </button>
          </div>
          <ul class="ml-5 border-l border-acero/70 pl-1.5">
            @for (p of r.plantas; track p.id) {
              <li class="flex items-center rounded-lg" [class.bg-epico/8]="plantas.seleccion().includes(p.id)">
                <input
                  #casilla
                  type="checkbox"
                  class="casilla ml-2.5"
                  [checked]="plantas.seleccion().includes(p.id)"
                  [attr.aria-label]="'Incluir ' + p.nombre"
                  (change)="alternar(p.id, casilla)"
                />
                <button
                  type="button"
                  class="flex min-h-10 flex-1 items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
                  [attr.aria-current]="p.id === plantas.actualId() ? 'true' : null"
                  [attr.autofocus]="p.id === plantas.actualId() ? '' : null"
                  (click)="soloEsta(p.id)"
                >
                  {{ p.nombre }}
                  @if (p.id === plantas.actualId()) {
                    <span class="text-xs text-texto-suave">principal</span>
                  }
                </button>
              </li>
            }
          </ul>
        </div>
      }
      <p class="mt-1 border-t border-acero/50 px-3 pt-2 pb-1 text-xs leading-relaxed text-texto-suave">
        Elige un nombre para trabajar solo con esa planta, o marca varias casillas para combinarlas.
      </p>
      <p class="px-3 text-xs font-medium text-epico-oscuro empty:hidden" aria-live="polite">{{ aviso() }}</p>
    </div>
  `,
})
export class SelectorPlantas {
  protected readonly plantas = inject(PlantasService);
  protected readonly iconoPlanta = Factory;
  protected readonly aviso = signal('');
  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected etiqueta(): string {
    const otras = this.plantas.otras();
    const extra = otras ? ` y ${otras} ${otras === 1 ? 'planta más' : 'plantas más'}` : '';
    return `Plantas: ${this.plantas.actual().nombre}${extra}. Cambiar plantas`;
  }

  protected alAbrir(e: Event): void {
    if ((e as ToggleEvent).newState !== 'open') return;
    this.aviso.set('');
    colocarBajo(this.panel().nativeElement, this.disparador().nativeElement, 336); // w-84
  }

  protected soloEsta(id: string): void {
    this.plantas.soloEsta(id);
    this.panel().nativeElement.hidePopover();
  }

  protected soloRazon(r: RazonSocial): void {
    this.plantas.soloRazon(r);
    this.panel().nativeElement.hidePopover();
  }

  protected alternar(id: string, casilla: HTMLInputElement): void {
    const antes = this.plantas.seleccion();
    this.plantas.alternar(id);
    this.avisarSiNoCambio(antes);
    // Si no se pudo quitar (era la última), la casilla vuelve a quedar marcada.
    casilla.checked = this.plantas.seleccion().includes(id);
  }

  protected alternarRazon(r: RazonSocial, casilla: HTMLInputElement): void {
    const antes = this.plantas.seleccion();
    this.plantas.alternarRazon(r);
    this.avisarSiNoCambio(antes);
    casilla.checked = this.plantas.estado(r) === 'todas';
    casilla.indeterminate = this.plantas.estado(r) === 'algunas';
  }

  private avisarSiNoCambio(antes: string[]): void {
    this.aviso.set(this.plantas.seleccion() === antes ? 'Siempre debe quedar al menos una planta seleccionada.' : '');
  }
}
