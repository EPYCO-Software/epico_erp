import { Component, computed, inject, input, model } from '@angular/core';
import { AccesoService, AjustesUsuario, permitido, ponerPermiso, tiene } from './acceso';
import { MatrizPermisos } from './matriz-permisos';

/**
 * Los permisos de un usuario: arranca con los de su rol (marcados) y aquí se le quitan o agregan, sin tocar el rol.
 * Solo se guarda la diferencia (`ajustes`), así un cambio posterior al rol también le llega. Quien edita solo toca los
 * permisos que él tiene.
 */
@Component({
  selector: 'app-permisos-usuario',
  host: { class: 'block' },
  imports: [MatrizPermisos],
  template: `
    <p class="mb-2 text-sm text-texto-suave">
      Marcados: lo que le da su rol. Desmarca lo que no debe usar o marca algo extra; el rol no cambia.
      @if (cambios()) {
        <span class="font-semibold text-carbon">{{ cambios() }}</span>
        <button type="button" class="ml-1 font-semibold text-epico-oscuro underline underline-offset-2" (click)="ajustes.set({ agregados: [], quitados: [] })">
          Volver a los del rol
        </button>
      }
    </p>
    @if (delRol().includes('*')) {
      <p role="note" class="mb-2 rounded-lg bg-[#FDF2E3] px-3 py-2 text-sm text-[#7A4B0C]">
        Tiene acceso total (root). Si le quitas cualquier permiso deja de serlo y ya no verá todas las empresas.
      </p>
    }
    <app-matriz-permisos
      [marcada]="marcada()"
      [puedo]="puedo()"
      [nota]="nota()"
      (alternar)="poner([$event.clave], $event.marcar)"
      (alternarModulo)="poner($event.claves, $event.marcar)"
    />
  `,
})
export class PermisosUsuario {
  private readonly acceso = inject(AccesoService);

  /** Lo que da su rol (unión de los roles de sus accesos). */
  readonly delRol = input.required<string[]>();
  readonly ajustes = model.required<AjustesUsuario>();

  protected readonly marcada = computed(() => {
    const rol = this.delRol();
    const a = this.ajustes();
    return (clave: string) => permitido(rol, a, clave);
  });
  protected readonly puedo = computed(() => {
    const mios = this.acceso.mios();
    return (clave: string) => tiene(mios, clave);
  });
  protected readonly nota = computed(() => {
    const a = this.ajustes();
    return (clave: string) => (a.agregados.includes(clave) ? 'Agregado' : tiene(a.quitados, clave) ? 'Quitado' : '');
  });
  protected readonly cambios = computed(() => {
    const { agregados, quitados } = this.ajustes();
    const partes = [
      agregados.length ? `${agregados.length} ${agregados.length === 1 ? 'agregado' : 'agregados'}` : '',
      quitados.length ? `${quitados.length} ${quitados.length === 1 ? 'quitado' : 'quitados'}` : '',
    ].filter(Boolean);
    return partes.length ? `Distinto a su rol: ${partes.join(' y ')}.` : '';
  });

  protected poner(claves: string[], marcar: boolean): void {
    const rol = this.delRol();
    this.ajustes.update((a) => claves.reduce((x, c) => ponerPermiso(rol, x, c, marcar), a));
  }
}
