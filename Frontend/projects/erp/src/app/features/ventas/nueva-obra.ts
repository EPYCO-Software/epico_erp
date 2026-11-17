import { Component, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, mensajeDe } from './datos';
import { EditorObra, ObraLista } from './editor-obra';

/** Nueva obra (/ventas/obras/nueva, con ?cliente= para empezar ligada a uno): al guardar, a su vista completa. */
@Component({
  selector: 'app-nueva-obra',
  imports: [EnEncabezado, EditorObra, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Obras" ruta="/ventas/obras" actual="Nueva obra" />
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <article [class]="cajas.hoja + ' max-w-4xl'">
          <h1 class="text-2xl font-bold tracking-[-0.02em]">Nueva obra</h1>
          <p class="mt-1 mb-5 text-sm text-texto-suave">A dónde se entrega: con su punto GPS el operador llega sin perderse.</p>
          @if (error()) {
            <p role="alert" class="mb-4 text-sm font-medium text-[#8E332C]">{{ error() }}</p>
          }
          <app-editor-obra [clienteInicial]="cliente() ?? ''" [nivelTitulo]="2" (listo)="crear($event)" (descartar)="descartar()" />
        </article>
      </div>
    </div>
  `,
})
export default class NuevaObraPagina {
  /** ?cliente= de la ruta. */
  readonly cliente = input<string>();
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  private readonly editor = viewChild.required(EditorObra);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly error = signal('');
  private creada = false;

  protected async crear(l: ObraLista): Promise<void> {
    this.error.set('');
    try {
      const o = await this.ventas.guardarObra(null, l.clienteId, l.datos);
      this.creada = true;
      void this.router.navigate(['/ventas/obras', o.id]);
    } catch (e) {
      this.error.set(mensajeDe(e));
    }
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/obras']);
  }

  /** canDeactivate de la ruta: con datos capturados y sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return this.creada || !this.editor().sinGuardar() || confirm('Hay datos sin guardar de la obra nueva. ¿Descartarlos?');
  }
}
