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
          <p class="mt-1 text-sm text-texto-suave">Sus obras se agregan al cotizarle o desde su ficha.</p>
          @if (ventas.conBackend) {
            <label class="mt-4 flex items-start gap-3 rounded-xl bg-white/80 p-3 text-sm">
              <input type="checkbox" class="casilla mt-0.5 size-4" [checked]="conCuenta()" (change)="conCuenta.set($any($event.target).checked)" />
              <span>
                <span class="block font-semibold">Darle acceso al portal de clientes</span>
                <span class="block text-texto-suave">
                  Le creamos su usuario con el correo del contacto y le enviamos su contraseña temporal. Solo entra al portal
                  (cotizar, sus obras y pedidos), nunca al ERP.
                </span>
              </span>
            </label>
          }
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
  protected readonly ventas = inject(VentasService);
  protected readonly conCuenta = signal(false);
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
      const correo = c.contacto.correo.trim().toLowerCase();
      if (this.conCuenta() && !correo) {
        this.error.set('Para darle acceso al portal escribe el correo del contacto: entrará con él.');
        document.getElementById('cliente-contacto-correo')?.focus();
        return;
      }
      const nuevo = await this.ventas.altaCliente(c);
      this.creado = true;
      // El cliente ya existe: si la cuenta falla, se avisa en su ficha (ahí se puede reintentar), nunca se repite el alta.
      const avisoCuenta = this.conCuenta() ? await this.crearCuenta(nuevo.id, `${c.contacto.nombre} ${c.contacto.apellidos}`.trim(), correo) : undefined;
      void this.router.navigate(['/ventas/clientes', nuevo.id], { state: { avisoCuenta } });
    } catch (e) {
      this.error.set(mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }

  private async crearCuenta(id: string, nombre: string, correo: string): Promise<{ clienteId: string; texto: string; error: boolean }> {
    try {
      const r = await this.ventas.crearCuentaPortal(id, { nombre: nombre || correo, correo });
      return {
        clienteId: id,
        texto: r.correoEnviado ? `Cliente y cuenta del portal creados: credenciales enviadas a ${correo}.` : `Cliente y cuenta creados, pero no se pudo enviar el correo: usa "Reenviar credenciales".`,
        error: !r.correoEnviado,
      };
    } catch (e) {
      return { clienteId: id, texto: `El cliente se creó, pero su cuenta del portal no: ${mensajeDe(e)}`, error: true };
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
