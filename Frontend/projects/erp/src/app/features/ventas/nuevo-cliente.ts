import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { CambiosCliente, VentasService, mensajeDe } from './datos';
import { EditorCliente } from './editor-cliente';

/**
 * Nuevo cliente (/ventas/clientes/nuevo): contacto, empresa y datos de facturación, con el mismo formulario que su
 * edición; al guardar, a su vista completa (ahí se le ven sus obras, cotizaciones y pedidos).
 */
@Component({
  selector: 'app-nuevo-cliente',
  imports: [EnEncabezado, EditorCliente, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Clientes" ruta="/ventas/clientes" actual="Nuevo cliente" />
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <article [class]="cajas.hoja + ' max-w-4xl'">
          <h1 class="text-2xl font-bold tracking-[-0.02em]">Nuevo cliente</h1>
          <p class="mt-1 text-sm text-texto-suave">
            Sus obras se agregan al cotizarle; su cuenta del portal la crea él con el correo de su contacto.
          </p>
          @if (error()) {
            <p role="alert" class="mt-4 text-sm font-medium text-[#8E332C]">{{ error() }}</p>
          }
          <app-editor-cliente class="mt-6 block" [guardando]="guardando()" (listo)="crear($event)" (descartar)="descartar()" />
        </article>
      </div>
    </div>
  `,
})
export default class NuevoClientePagina {
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  private readonly editor = viewChild.required(EditorCliente);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly error = signal('');
  protected readonly guardando = signal(false);
  private creado = false;

  protected async crear(c: CambiosCliente): Promise<void> {
    this.error.set('');
    this.guardando.set(true);
    try {
      const nuevo = await this.ventas.altaCliente(c);
      this.creado = true;
      void this.router.navigate(['/ventas/clientes', nuevo.id]);
    } catch (e) {
      this.error.set(mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/clientes']);
  }

  /** canDeactivate de la ruta: con datos capturados y sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return this.creado || !this.editor().sinGuardar() || confirm('Hay datos sin guardar del cliente nuevo. ¿Descartarlos?');
  }
}
