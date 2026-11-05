import { Component, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { ChevronDown, Info, TriangleAlert } from 'lucide';
import { ADITIVOS, Aditivo, CEMENTO_LABEL, Colocacion, EXPOSICIONES, EspecificacionConcreto, Exposicion, FieldError, Icon, OPCIONES, TipoCemento } from 'ui';
import { CotizadorState } from './cotizador.state';

const EDAD_LABEL: Record<number, string> = { 28: '28 días (estándar)', 14: '14 días', 7: '7 días (rápido)', 3: '3 días (muy rápido)' };

@Component({
  selector: 'app-paso-especificaciones',
  imports: [FormField, FieldError, Icon],
  template: `
    <section aria-labelledby="paso-titulo" class="rounded-2xl bg-white/85 p-4 shadow-sm sm:p-5">
      <h2 id="paso-titulo" tabindex="-1" class="text-lg font-bold outline-none">Especificaciones del concreto</h2>

      <!-- Dos columnas desde md: cada control ocupa lo que necesita (un "10 cm" no requiere todo el ancho). -->
      <div class="mt-4 grid gap-x-5 gap-y-4 md:grid-cols-2">
        <div>
          <label for="volumen" class="mb-1.5 block text-sm font-medium">Volumen estimado</label>
          <div class="flex">
            <input
              id="volumen"
              type="number"
              step="0.5"
              inputmode="decimal"
              class="campo h-11 rounded-r-none px-4"
              [formField]="s.f.volumenM3"
              [attr.aria-invalid]="s.f.volumenM3().touched() && s.f.volumenM3().invalid()"
              aria-describedby="volumen-unidad volumen-error"
            />
            <span id="volumen-unidad" class="flex h-11 items-center rounded-r-[0.625rem] border border-l-0 border-acero-oscuro bg-carbon/4 px-4">m³</span>
          </div>
          <ui-field-error [campo]="s.f.volumenM3" errorId="volumen-error" />
        </div>

        <div>
          <label for="resistencia" class="mb-1.5 block text-sm font-medium">Resistencia</label>
          <div class="relative">
            <select id="resistencia" class="campo h-11 appearance-none pr-10 pl-4" (change)="resistencia($any($event.target).value)">
              <optgroup label="Compresión f'c">
                @for (v of opciones.fc; track v) {
                  <option [value]="'fc-' + v" [selected]="e().tipoResistencia === 'fc' && e().resistenciaKgCm2 === v">f'c {{ v }} kg/cm²</option>
                }
              </optgroup>
              <optgroup label="Módulo de ruptura MR (pavimentos)">
                @for (v of opciones.mr; track v) {
                  <option [value]="'mr-' + v" [selected]="e().tipoResistencia === 'mr' && e().resistenciaKgCm2 === v">MR {{ v }} kg/cm²</option>
                }
              </optgroup>
            </select>
            <ui-icon [icono]="iconos.abajo" [tamano]="18" class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-texto-suave" />
          </div>
        </div>

        <div>
          <label for="edad" class="mb-1.5 block text-sm font-medium">Edad de diseño</label>
          <div class="relative">
            <select id="edad" class="campo h-11 appearance-none pr-10 pl-4" (change)="s.actualizar({ edadDias: +$any($event.target).value })">
              @for (v of opciones.edades; track v) {
                <option [value]="v" [selected]="e().edadDias === v">{{ edadLabel[v] }}</option>
              }
            </select>
            <ui-icon [icono]="iconos.abajo" [tamano]="18" class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-texto-suave" />
          </div>
        </div>

        <div>
          <label for="revenimiento" class="mb-1.5 block text-sm font-medium">Revenimiento</label>
          <div class="relative">
            <select id="revenimiento" class="campo h-11 appearance-none pr-10 pl-4" (change)="s.actualizar({ revenimientoCm: +$any($event.target).value })">
              @for (v of opciones.revenimientos; track v) {
                <option [value]="v" [selected]="e().revenimientoCm === v">{{ v }} cm</option>
              }
            </select>
            <ui-icon [icono]="iconos.abajo" [tamano]="18" class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-texto-suave" />
          </div>
        </div>

        <div>
          <label for="tma" class="mb-1.5 block text-sm font-medium">Tamaño máximo de agregado</label>
          <div class="relative">
            <select id="tma" class="campo h-11 appearance-none pr-10 pl-4" (change)="s.actualizar({ tmaMm: +$any($event.target).value })">
              @for (v of opciones.tma; track v) {
                <option [value]="v" [selected]="e().tmaMm === v">{{ v }} mm</option>
              }
            </select>
            <ui-icon [icono]="iconos.abajo" [tamano]="18" class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-texto-suave" />
          </div>
        </div>

        <div>
          <label for="cemento" class="mb-1.5 block text-sm font-medium">Tipo de cemento</label>
          <div class="relative">
            <select id="cemento" class="campo h-11 appearance-none pr-10 pl-4" (change)="s.actualizar({ cemento: $any($event.target).value })">
              @for (v of opciones.cementos; track v) {
                <option [value]="v" [selected]="e().cemento === v">{{ cementoLabel[v] }}</option>
              }
            </select>
            <ui-icon [icono]="iconos.abajo" [tamano]="18" class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-texto-suave" />
          </div>
        </div>

        <div>
          <span id="exposicion-label" class="mb-1.5 block text-sm font-medium">Exposición</span>
          <div role="radiogroup" aria-labelledby="exposicion-label" class="grid grid-cols-3 gap-1 rounded-xl bg-carbon/5 p-1">
            @for (x of exposiciones; track x.id) {
              <label class="segmento">
                <input type="radio" name="exposicion" class="sr-only" [checked]="e().exposicion === x.id" (change)="exposicion(x.id)" />{{ x.label }}
              </label>
            }
          </div>
        </div>

        <div>
          <span id="colocacion-label" class="mb-1.5 block text-sm font-medium">Colocación</span>
          <div role="radiogroup" aria-labelledby="colocacion-label" class="grid grid-cols-2 gap-1 rounded-xl bg-carbon/5 p-1">
            @for (c of colocaciones; track c.id) {
              <label class="segmento">
                <input type="radio" name="colocacion" class="sr-only" [checked]="e().colocacion === c.id" (change)="colocacion(c.id)" />{{ c.label }}
              </label>
            }
          </div>
        </div>

        <div class="md:col-span-2">
          <span id="aditivos-label" class="mb-1.5 block text-sm font-medium">Aditivos <span class="font-normal text-texto-suave">(opcional)</span></span>
          <div role="group" aria-labelledby="aditivos-label" class="flex flex-wrap gap-2">
            @for (a of aditivos; track a.id) {
              <label
                class="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-acero-oscuro bg-white px-3 text-sm transition-colors hover:border-carbon has-checked:border-epico has-checked:bg-[#FDF6F6] has-checked:font-semibold has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico"
              >
                <input type="checkbox" class="casilla size-4" [checked]="e().aditivos.includes(a.id)" (change)="alternarAditivo(a.id)" />{{ a.label }}
              </label>
            }
          </div>
        </div>
      </div>

      <p class="mt-5 flex items-start gap-3 rounded-xl bg-[#FDF2F2] px-4 py-3 text-sm text-carbon">
        <ui-icon [icono]="iconos.info" [tamano]="20" class="mt-px text-epico" />
        Valores sugeridos para esta aplicación. Confirma las especificaciones con tu responsable técnico.
      </p>

      @if (s.avisos().length) {
        <ul class="mt-3 space-y-2" aria-label="Recomendaciones técnicas">
          @for (a of s.avisos(); track a.texto) {
            <li class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-atencion/50 bg-[#FAEFD9] px-4 py-3 text-sm text-[#5C3D0B]">
              <ui-icon [icono]="iconos.aviso" [tamano]="20" class="text-[#7E5410]" />
              <span class="min-w-0 flex-1">{{ a.texto }}</span>
              @if (a.arreglo) {
                <button
                  type="button"
                  class="min-h-10 rounded-lg bg-white px-3 font-semibold text-[#5C3D0B] shadow-sm hover:bg-[#FFFDF8] focus-visible:outline-2 focus-visible:outline-epico"
                  (click)="s.actualizar(a.arreglo)"
                >
                  {{ a.accion }}
                </button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PasoEspecificaciones {
  protected readonly s = inject(CotizadorState);
  protected readonly e = this.s.especificacion;
  protected readonly opciones = OPCIONES;
  protected readonly cementoLabel: Record<TipoCemento, string> = CEMENTO_LABEL;
  protected readonly edadLabel = EDAD_LABEL;
  protected readonly exposiciones = EXPOSICIONES;
  protected readonly aditivos = ADITIVOS;
  protected readonly colocaciones: { id: Colocacion; label: string }[] = [
    { id: 'directa', label: 'Directa' },
    { id: 'bombeo', label: 'Bombeo' },
  ];
  protected readonly iconos = { abajo: ChevronDown, info: Info, aviso: TriangleAlert };

  protected resistencia(valor: string): void {
    const [tipo, kg] = valor.split('-');
    this.s.actualizar({ tipoResistencia: tipo as EspecificacionConcreto['tipoResistencia'], resistenciaKgCm2: +kg });
  }

  protected exposicion(x: Exposicion): void {
    this.s.actualizar({ exposicion: x });
  }

  protected colocacion(c: Colocacion): void {
    this.s.actualizar({ colocacion: c });
  }

  protected alternarAditivo(a: Aditivo): void {
    const actual = this.e().aditivos;
    this.s.actualizar({ aditivos: actual.includes(a) ? actual.filter((x) => x !== a) : [...actual, a] });
  }
}
