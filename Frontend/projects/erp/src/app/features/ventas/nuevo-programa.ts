import { Component, computed, inject, input, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { DatosPrograma, FormPrograma } from './form-programa';
import { PLANTILLAS, ProgramasService, TipoPrograma } from './lealtad';
import { PlantillasPrograma } from './plantillas-programa';

/**
 * Nuevo programa (/ventas/descuentos-y-lealtad/nuevo): sin plantilla, las 7 tarjetas para elegir; con
 * ?plantilla=…, su formulario con los valores de ejemplo. Al guardar, a su vista completa.
 */
@Component({
  selector: 'app-nuevo-programa',
  imports: [EnEncabezado, FormPrograma, PlantillasPrograma, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion lista="Descuentos y lealtad" ruta="/ventas/descuentos-y-lealtad" actual="Nuevo programa" />
        @if (tipo()) {
          <div class="ml-auto flex gap-2">
            <button type="submit" form="nuevo-programa" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Guardar</button>
            <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
          </div>
        }
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        @if (tipo(); as tipo) {
          <!-- Uno por plantilla: con Atrás a otra plantilla, el formulario empieza de nuevo con sus valores -->
          @for (t of [tipo]; track t) {
            <app-form-programa formId="nuevo-programa" [nuevoTipo]="t" [class]="cajas.hoja + ' max-w-5xl'" (listo)="crear($event)" />
          }
        } @else {
          <section [class]="cajas.hoja" aria-labelledby="plantillas-titulo">
            <h1 id="plantillas-titulo" class="text-center text-2xl font-bold tracking-[-0.02em]">Nuevo programa</h1>
            <p class="mt-1 text-center text-texto-suave">Elige una plantilla; después ajustas sus valores.</p>
            <app-plantillas-programa class="mt-6" />
          </section>
        }
      </div>
    </div>
  `,
})
export default class NuevoProgramaPagina {
  /** ?plantilla= de la ruta. */
  readonly plantilla = input<string>();

  private readonly servicio = inject(ProgramasService);
  private readonly router = inject(Router);
  private readonly formulario = viewChild(FormPrograma);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly botonSecundario =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly tipo = computed(() => PLANTILLAS.find((p) => p.tipo === this.plantilla())?.tipo as TipoPrograma | undefined);

  protected crear(d: DatosPrograma): void {
    const p = this.servicio.crear({ ...d, cupones: [] });
    void this.router.navigate(['/ventas/descuentos-y-lealtad', p.id]);
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/descuentos-y-lealtad']);
  }

  /** canDeactivate de la ruta: con cambios sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return !this.formulario()?.sinGuardar() || confirm('Hay cambios sin guardar en el programa. ¿Descartarlos?');
  }
}
