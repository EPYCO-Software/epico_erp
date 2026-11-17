import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { mensajeDe } from '../ventas/datos';
import { AccesoService } from './acceso';
import { FormRol, RolListo } from './form-rol';

/** Seguridad y plataforma → Roles → Nuevo: nombre, descripción y permisos; al crearlo, a su vista completa. */
@Component({
  selector: 'app-nuevo-rol',
  imports: [EnEncabezado, FormRol, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Roles" ruta="/configuracion/roles" actual="Nuevo rol" />
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.hoja + ' max-w-5xl'">
          <p role="alert" class="mb-3 text-sm font-medium text-[#8E332C] empty:hidden">{{ error() }}</p>
          <app-form-rol [guardando]="guardando()" (listo)="crear($event)" (descartar)="volver()" />
        </div>
      </div>
    </div>
  `,
})
export default class NuevoRol {
  private readonly router = inject(Router);
  private readonly acceso = inject(AccesoService);
  protected readonly cajas = CAJAS_VISTA;
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected async crear(l: RolListo): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const r = await this.acceso.crearRol(l.nombre, l.descripcion, l.permisos);
      await this.router.navigate(['/configuracion/roles', r.id]);
    } catch (e) {
      this.error.set(mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected volver(): void {
    void this.router.navigateByUrl('/configuracion/roles');
  }
}
