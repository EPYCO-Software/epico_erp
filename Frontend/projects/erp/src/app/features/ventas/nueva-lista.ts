import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { EditorLista } from './editor-lista';
import { DatosLista, ListasPreciosService } from './precios';

/**
 * Nueva lista de precios (/ventas/listas-de-precios/nueva): nombre, moneda y plantas; al guardar, a su vista completa,
 * donde se agregan sus líneas.
 */
@Component({
  selector: 'app-nueva-lista',
  imports: [EnEncabezado, EditorLista, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion lista="Listas de precios" ruta="/ventas/listas-de-precios" actual="Nueva lista" />
        <div class="ml-auto flex gap-2">
          <button type="submit" form="nueva-lista" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Guardar</button>
          <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <article [class]="cajas.hoja + ' max-w-3xl'">
          <h1 class="text-2xl font-bold tracking-[-0.02em]">Nueva lista de precios</h1>
          <p class="mt-1 text-sm text-texto-suave">Después de guardarla, agrega sus líneas: el precio de cada producto o categoría.</p>
          <app-editor-lista class="mt-6" formId="nueva-lista" [botones]="false" (listo)="crear($event)" />
        </article>
      </div>
    </div>
  `,
})
export default class NuevaListaPagina {
  private readonly servicio = inject(ListasPreciosService);
  private readonly router = inject(Router);
  private readonly editor = viewChild.required(EditorLista);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly botonSecundario =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected crear(d: DatosLista): void {
    const l = this.servicio.crear(d);
    void this.router.navigate(['/ventas/listas-de-precios', l.id]);
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/listas-de-precios']);
  }

  /** canDeactivate de la ruta: con cambios sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return !this.editor().sinGuardar() || confirm('Hay cambios sin guardar en la lista. ¿Descartarla?');
  }
}
