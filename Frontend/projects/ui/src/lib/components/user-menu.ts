import { Component, DestroyRef, booleanAttribute, computed, inject, input, output, viewChild } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Router } from '@angular/router';
import { ChevronDown, IconNode, LogOut, UserRound } from 'lucide';
import { AuthService } from '../auth/auth.service';
import { Icon } from './icon';

/**
 * Iniciales para el avatar: con 2 letras toma la inicial de las dos primeras palabras ("Ana Pech" → "AP") o, si el
 * nombre es una sola palabra, sus dos primeras letras ("operaciones" → "OP").
 */
export function iniciales(nombre: string, letras = 1): string {
  const palabras = nombre.trim().split(/[\s._-]+/).filter(Boolean);
  if (!palabras.length) return '?';
  const texto = letras > 1 && palabras.length > 1 ? palabras[0][0] + palabras[1][0] : palabras[0].slice(0, letras);
  return texto.toUpperCase();
}

/** Opción propia de la app en el menú (p. ej. "Ayuda"); al elegirla se emite su `id` en `elegir`. */
export interface OpcionUsuario {
  id: string;
  etiqueta: string;
  icono: IconNode;
}

/**
 * Avatar con menú de usuario (Angular CDK Menu: teclado y ARIA de menú incluidos). Se abre con clic o teclado y
 * también al pasar el mouse; abierto así, se cierra al sacar el mouse del avatar y del menú, o con Esc.
 */
@Component({
  selector: 'ui-user-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon],
  host: { '(document:keydown.escape)': 'cerrarSiHover()' },
  template: `
    <button
      type="button"
      class="flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
      [class]="etiqueta() ? 'py-1 pr-2 pl-1 transition-colors hover:bg-carbon/5' : ''"
      aria-label="Menú de usuario"
      [cdkMenuTriggerFor]="menu"
      (pointerenter)="alEntrar($event)"
      (pointerleave)="alSalir()"
      (click)="clic()"
    >
      <span
        class="flex size-9 items-center justify-center rounded-full text-sm font-semibold"
        [class]="claro() ? 'bg-[#dfe4ea] text-[#1f2a44] inset-shadow-[0_1px_0_rgb(255_255_255/0.8)]' : 'bg-carbon text-white'"
        aria-hidden="true"
      >
        {{ iniciales() }}
      </span>
      @if (etiqueta()) {
        <span class="hidden items-center gap-2 font-medium sm:flex" aria-hidden="true">
          {{ etiqueta() }}<ui-icon [icono]="iconoAbrir" [tamano]="18" class="text-texto-suave" />
        </span>
      }
    </button>

    <ng-template #menu>
      <!-- El CDK pinta el menú al final de <body>; la región con nombre lo deja dentro de un landmark (axe "region"). -->
      <section aria-label="Cuenta de usuario" (pointerenter)="cancelarEspera()" (pointerleave)="alSalir()">
        <!-- El correo es el nombre accesible del menú; el texto visible es solo decorativo. -->
        <div cdkMenu class="glass-strong mt-2 min-w-60 p-2 text-carbon" [attr.aria-label]="'Cuenta de ' + correo()">
          <div aria-hidden="true" class="truncate border-b border-acero/50 px-3 pt-1 pb-2.5 text-sm text-texto-suave">
            {{ correo() }}
          </div>
          @if (perfilPath()) {
            <button cdkMenuItem type="button" [class]="claseOpcion + ' mt-1'" (cdkMenuItemTriggered)="irAPerfil()">
              <ui-icon [icono]="iconoPerfil" [tamano]="18" />Perfil y facturación
            </button>
          }
          @for (o of opciones(); track o.id; let primera = $first) {
            <button cdkMenuItem type="button" [class]="claseOpcion" [class.mt-1]="primera" (cdkMenuItemTriggered)="elegir.emit(o.id)">
              <ui-icon [icono]="o.icono" [tamano]="18" />{{ o.etiqueta }}
            </button>
          }
          @if (opciones().length) {
            <div role="separator" class="mx-1 my-1 border-t border-acero/50"></div>
          }
          <button cdkMenuItem type="button" [class]="claseOpcion" (cdkMenuItemTriggered)="cerrarSesion()">
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
  /** Letras del avatar: 1 (portal) o 2 iniciales (ERP). */
  readonly letras = input(1);
  /** Avatar claro (gris azulado con texto oscuro) en lugar de carbón. */
  readonly claro = input(false, { transform: booleanAttribute });
  /** Opciones de la app, antes de "Cerrar sesión" (en el ERP: Ayuda y Mis preferencias). */
  readonly opciones = input<OpcionUsuario[]>([]);
  readonly elegir = output<string>();

  protected readonly iconoSalir = LogOut;
  protected readonly iconoAbrir = ChevronDown;
  protected readonly iconoPerfil = UserRound;
  protected readonly claseOpcion =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium outline-none hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:ring-2 focus-visible:ring-epico';
  protected readonly correo = computed(() => this.auth.sesion()?.usuario.correo ?? '');
  protected readonly iniciales = computed(() => iniciales(this.auth.sesion()?.usuario.nombre ?? '?', this.letras()));

  private readonly disparador = viewChild.required(CdkMenuTrigger);
  /** El menú abierto se abrió al pasar el mouse (no con clic ni teclado): se cierra al sacar el mouse. */
  private porHover = false;
  private espera?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
  }

  /** Solo con mouse: en touch el toque ya llega como clic. Una pausa corta evita abrirlo al pasar de largo. */
  protected alEntrar(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    this.programar(100, () => {
      if (this.disparador().isOpen()) return;
      this.disparador().open();
      this.porHover = true;
    });
  }

  /** Margen para cruzar del avatar al menú sin que se cierre. */
  protected alSalir(): void {
    this.programar(250, () => {
      if (this.porHover) this.disparador().close();
    });
  }

  protected cancelarEspera(): void {
    clearTimeout(this.espera);
  }

  /**
   * El CDK alterna el menú en su propio listener de clic, que corre antes que este. Si estaba abierto por hover, ese
   * clic lo cerró: se vuelve a abrir y queda fijo (ya no se cierra al sacar el mouse).
   */
  protected clic(): void {
    clearTimeout(this.espera);
    const t = this.disparador();
    if (this.porHover && !t.isOpen()) {
      t.open();
      t.getMenu()?.focusFirstItem('mouse');
    }
    this.porHover = false;
  }

  /** Esc cierra el menú abierto por hover aunque el foco no esté en él (WCAG 1.4.13). */
  protected cerrarSiHover(): void {
    if (this.porHover && this.disparador().isOpen()) this.disparador().close();
  }

  protected cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  protected irAPerfil(): void {
    if (this.perfilPath()) void this.router.navigateByUrl(this.perfilPath()!);
  }

  private programar(ms: number, accion: () => void): void {
    clearTimeout(this.espera);
    this.espera = setTimeout(accion, ms);
  }
}
