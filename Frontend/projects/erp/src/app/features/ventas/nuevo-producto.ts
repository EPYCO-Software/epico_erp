import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { NuevoProducto, VentasService } from './datos';
import { FormProducto } from './form-producto';

/**
 * Ventas → Productos → Nuevo (/ventas/productos/nuevo): alta de un producto con el formulario de form-producto.ts (el
 * mismo de la edición). Guardar y Descartar en la barra; al guardar, a su vista completa.
 */
@Component({
  selector: 'app-nuevo-producto',
  imports: [EnEncabezado, FormProducto, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion lista="Productos" ruta="/ventas/productos" actual="Nuevo producto" />
        <div class="ml-auto flex gap-2">
          <button type="submit" form="nuevo-producto" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Guardar</button>
          <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <app-form-producto formId="nuevo-producto" [class]="cajas.hoja + ' max-w-5xl'" (listo)="crear($event)" />
      </div>
    </div>
  `,
})
export default class NuevoProductoPagina {
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  private readonly formulario = viewChild.required(FormProducto);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly botonSecundario =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected crear(n: NuevoProducto): void {
    const p = this.ventas.crearProducto(n);
    void this.router.navigate(['/ventas/productos', p.id]);
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/productos']);
  }

  /** canDeactivate de la ruta: con cambios sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return !this.formulario().sinGuardar() || confirm('Hay cambios sin guardar en el producto. ¿Descartarlos?');
  }
}
