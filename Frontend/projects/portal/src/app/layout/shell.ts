import { Component, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Building2, FileText, Menu, Package, Store } from 'lucide';
import { Drawer, Icon, UserMenu } from 'ui';
import { ChatFlotante } from './chat-flotante';

const NAV = [
  { label: 'Catálogo', icon: Store, path: '/catalogo' },
  { label: 'Mis cotizaciones', icon: FileText, path: '/cotizaciones' },
  { label: 'Mis pedidos', icon: Package, path: '/pedidos' },
  { label: 'Mis obras', icon: Building2, path: '/obras' },
];

@Component({
  selector: 'app-shell',
  imports: [
    NgOptimizedImage,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Drawer,
    Icon,
    UserMenu,
    ChatFlotante,
  ],
  // --alto-contenido: alto libre bajo el encabezado (p-4 + h-16 + gap-4 + p-4 = 7rem). Lo usan las páginas
  // con columnas de scroll independiente (catálogo). Si cambia el encabezado o el espaciado, actualizarlo aquí.
  host: {
    class:
      'mx-auto flex min-h-dvh max-w-[120rem] flex-col gap-4 p-3 sm:p-4 lg:[--alto-contenido:calc(100dvh-7rem)]',
  },
  template: `
    <header class="glass sticky top-3 z-30 flex h-16 items-center gap-3 px-3 sm:px-5 lg:top-4">
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-xl text-carbon hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico lg:hidden"
        aria-label="Abrir menú"
        (click)="menuOpen.set(true)"
      >
        <ui-icon [icono]="iconoMenu" />
      </button>

      <a
        routerLink="/catalogo"
        class="flex shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-epico"
      >
        <img
          ngSrc="/ui/marca/isotipo-epico-erp.webp"
          width="400"
          height="307"
          priority
          alt="EPICO ERP, inicio"
          class="h-11 w-auto"
        />
      </a>

      <nav aria-label="Navegación principal" class="hidden flex-1 justify-center lg:flex">
        <ul class="flex h-16 items-stretch gap-2 xl:gap-6">
          @for (item of nav; track item.path) {
            <li class="flex">
              <a
                [routerLink]="item.path"
                routerLinkActive="font-semibold text-carbon after:bg-epico [&_ui-icon]:text-epico"
                ariaCurrentWhenActive="page"
                class="relative flex items-center gap-2.5 px-3 text-texto-suave transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full hover:text-carbon focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-epico"
              >
                <ui-icon [icono]="item.icon" />{{ item.label }}
              </a>
            </li>
          }
        </ul>
      </nav>

      <ui-user-menu etiqueta="Cliente" perfilPath="/perfil" class="ml-auto lg:ml-0" />
    </header>

    <ui-drawer [(abierto)]="menuOpen" titulo="Menú">
      <nav aria-label="Navegación principal">
        <ul class="flex flex-col gap-1">
          @for (item of nav; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-epico/10 font-semibold text-epico-oscuro ring-1 ring-epico/30"
                ariaCurrentWhenActive="page"
                (click)="menuOpen.set(false)"
                class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-carbon transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
              >
                <ui-icon [icono]="item.icon" />{{ item.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </ui-drawer>

    <main class="min-w-0 flex-1">
      <router-outlet />
    </main>

    <app-chat-flotante />
  `,
})
export class Shell {
  protected readonly nav = NAV;
  protected readonly menuOpen = signal(false);
  protected readonly iconoMenu = Menu;
}
