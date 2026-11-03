import { Component, computed, inject, input } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Router } from '@angular/router';
import { ChevronDown, LogOut, UserRound } from 'lucide';
import { AuthService } from '../auth/auth.service';
import { Icon } from './icon';

/** Avatar con menú de usuario (Angular CDK Menu: teclado y ARIA de menú incluidos). */
@Component({
  selector: 'ui-user-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon],
  template: `
    <button
      type="button"
      class="flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
      [class]="etiqueta() ? 'py-1 pr-2 pl-1 hover:bg-carbon/5' : ''"
      aria-label="Menú de usuario"
      [cdkMenuTriggerFor]="menu"
    >
      <span
        class="flex size-9 items-center justify-center rounded-full bg-carbon text-sm font-semibold text-white"
        aria-hidden="true"
      >
        {{ inicial() }}
      </span>
      @if (etiqueta()) {
        <span class="hidden items-center gap-2 font-medium sm:flex" aria-hidden="true">
          {{ etiqueta() }}<ui-icon [icono]="iconoAbrir" [tamano]="18" class="text-texto-suave" />
        </span>
      }
    </button>

    <ng-template #menu>
      <!-- El CDK pinta el menú al final de <body>; la región con nombre lo deja dentro de un landmark (axe "region"). -->
      <section aria-label="Cuenta de usuario">
        <!-- El correo es el nombre accesible del menú; el texto visible es solo decorativo. -->
        <div
          cdkMenu
          class="glass-strong mt-2 min-w-60 p-2 text-carbon"
          [attr.aria-label]="'Cuenta de ' + correo()"
        >
          <div
            aria-hidden="true"
            class="truncate border-b border-acero/50 px-3 pt-1 pb-2.5 text-sm text-texto-suave"
          >
            {{ correo() }}
          </div>
          @if (perfilPath()) {
            <button
              cdkMenuItem
              type="button"
              class="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium outline-none hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:ring-2 focus-visible:ring-epico"
              (cdkMenuItemTriggered)="irAPerfil()"
            >
              <ui-icon [icono]="iconoPerfil" [tamano]="18" />Perfil y facturación
            </button>
          }
          <button
            cdkMenuItem
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium outline-none hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:ring-2 focus-visible:ring-epico"
            (cdkMenuItemTriggered)="salir()"
          >
            <ui-icon [icono]="iconoSalir" [tamano]="18" />Cerrar sesión
          </button>
        </div>
      </section>
    </ng-template>
  `,
})
export class UserMenu {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Texto visible junto al avatar (p. ej. "Cliente"). Sin él solo se muestra el avatar. */
  readonly etiqueta = input<string>();
  /** Ruta opcional del perfil; el ERP puede omitirla si no expone esta sección. */
  readonly perfilPath = input<string>();

  protected readonly iconoSalir = LogOut;
  protected readonly iconoAbrir = ChevronDown;
  protected readonly iconoPerfil = UserRound;
  protected readonly correo = computed(() => this.auth.sesion()?.usuario.correo ?? '');
  protected readonly inicial = computed(() =>
    (this.auth.sesion()?.usuario.nombre ?? '?').charAt(0).toUpperCase(),
  );

  protected salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  protected irAPerfil(): void {
    if (this.perfilPath()) void this.router.navigateByUrl(this.perfilPath()!);
  }
}
