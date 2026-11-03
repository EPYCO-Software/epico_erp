import { Component, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Check, MapPin, Plus, X } from 'lucide';
import { Icon, Mapa } from 'ui';
import { NuevaObra } from '../../core/services/obras.service';
import { ObraForm } from '../obras/obra-form';
import { CotizadorState } from './cotizador.state';

/** Paso 3, al final: a qué obra va el concreto. Elegir una registrada o agregar una nueva con su ubicación. */
@Component({
  selector: 'app-obra-entrega',
  imports: [Icon, Mapa, ObraForm],
  template: `
    <section aria-labelledby="obra-titulo" class="mt-4 rounded-2xl bg-white/85 p-4 shadow-sm sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="obra-titulo" class="text-lg font-bold">Obra de entrega</h2>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-acero-oscuro bg-white px-3 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
          [attr.aria-expanded]="agregando()"
          aria-controls="obra-nueva"
          (click)="alternarFormulario()"
        >
          <ui-icon [icono]="agregando() ? iconos.cerrar : iconos.agregar" [tamano]="16" />{{ agregando() ? 'Cancelar' : 'Agregar obra' }}
        </button>
      </div>

      @if (s.faltaObra()) {
        <p role="alert" class="mt-3 rounded-xl bg-[#F6E3E1] px-4 py-2.5 text-sm font-medium text-[#8E332C]">Selecciona o agrega la obra donde entregaremos el concreto.</p>
      }

      @if (s.obras().length) {
        <div role="radiogroup" aria-labelledby="obra-titulo" class="mt-3 grid gap-2 xl:grid-cols-2">
          @for (o of s.obras(); track o.id) {
            <label
              class="group flex cursor-pointer items-start gap-3 rounded-xl border-2 border-transparent bg-white p-3 shadow-sm transition-colors hover:border-acero has-checked:border-epico has-checked:bg-[#FDF6F6] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico"
            >
              <input type="radio" name="obra" class="sr-only" [checked]="s.obraId() === o.id" (change)="s.elegirObra(o.id)" />
              <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-carbon/4 text-carbon/80 group-has-checked:bg-epico group-has-checked:text-white">
                <ui-icon [icono]="iconos.pin" [tamano]="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{{ o.nombre }}</span>
                <span class="block text-sm text-texto-suave">{{ o.direccion }} · {{ o.municipio }}</span>
                @if (o.ubicacion) {
                  <span class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#2E5E4A]">
                    <ui-icon [icono]="iconos.check" [tamano]="12" />Ubicación GPS
                  </span>
                }
              </span>
            </label>
          }
        </div>
      } @else {
        <p class="mt-2 text-sm text-texto-suave">Aún no tienes obras registradas. Agrega la primera para continuar.</p>
      }

      @if (s.obra(); as o) {
        <div class="mt-4">
          <p class="mb-2 text-sm">
            <span class="font-semibold">Ubicación de entrega:</span> {{ o.nombre }}
            @if (!o.ubicacion) {
              <span class="block text-texto-suave">Se muestra la dirección aproximada. Para más precisión, registra la obra con su ubicación GPS.</span>
            }
          </p>
          <ui-mapa class="h-60" [ubicacion]="o.ubicacion" [direccion]="o.direccion + ', ' + o.municipio" [titulo]="'Mapa de la obra ' + o.nombre" />
          @if (o.referencias) {
            <p class="mt-2 text-sm text-texto-suave"><span class="font-medium text-carbon">Referencias:</span> {{ o.referencias }}</p>
          }
        </div>
      } @else {
        <p class="mt-3 rounded-xl bg-carbon/4 px-4 py-3 text-sm text-texto-suave">Elige una obra para ver su ubicación en el mapa.</p>
      }

      @if (agregando()) {
        <app-obra-form id="obra-nueva" class="mt-4 block" (guardada)="guardar($event)" />
      }
    </section>
  `,
})
export class ObraEntrega {
  protected readonly s = inject(CotizadorState);
  protected readonly iconos = { pin: MapPin, agregar: Plus, cerrar: X, check: Check };
  protected readonly agregando = signal(false);
  private readonly formulario = viewChild(ObraForm);
  private readonly injector = inject(Injector);

  protected alternarFormulario(): void {
    this.agregando.update((v) => !v);
    // Esperar a que el formulario exista en el DOM antes de enfocarlo.
    if (this.agregando()) afterNextRender(() => this.formulario()?.enfocar(), { injector: this.injector });
  }

  protected guardar(datos: NuevaObra): void {
    const obra = this.s.agregarObra(datos);
    this.s.mensaje.set(`Obra "${obra.nombre}" agregada y seleccionada.`);
    this.agregando.set(false);
  }
}
