import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { mensajeDe } from '../ventas/datos';
import { AccesoService } from './acceso';
import { FormUsuario, UsuarioListo } from './form-usuario';

/** Seguridad y plataforma → Usuarios → Nuevo: alta con sus accesos; al crearlo, a su vista completa. */
@Component({
  selector: 'app-nuevo-usuario',
  imports: [EnEncabezado, FormUsuario, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 items-center">
        <app-ruta-navegacion lista="Usuarios" ruta="/configuracion/usuarios" actual="Nuevo usuario" />
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.hoja + ' max-w-4xl'">
          <p role="alert" class="mb-3 text-sm font-medium text-[#8E332C] empty:hidden">{{ error() }}</p>
          <app-form-usuario [guardando]="guardando()" (listo)="crear($event)" (descartar)="volver()" />
        </div>
      </div>
    </div>
  `,
})
export default class NuevoUsuario {
  private readonly router = inject(Router);
  private readonly acceso = inject(AccesoService);
  protected readonly cajas = CAJAS_VISTA;
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected async crear(l: UsuarioListo): Promise<void> {
    this.guardando.set(true);
    this.error.set('');
    try {
      const u = await this.acceso.crearUsuario(l.datos, l.accesos, l.password, l.ajustes);
      await this.router.navigate(['/configuracion/usuarios', u.id]);
    } catch (e) {
      this.error.set((e as { status?: number }).status === 409 ? 'Ya existe un usuario con ese correo.' : mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected volver(): void {
    void this.router.navigateByUrl('/configuracion/usuarios');
  }
}
