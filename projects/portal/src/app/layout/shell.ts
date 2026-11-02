import { Component, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { Drawer } from 'primeng/drawer';

const NAV = [
  { label: 'Mis obras', icon: 'pi-building', path: '/obras' },
  { label: 'Pedidos', icon: 'pi-clipboard', path: '/pedidos' },
  { label: 'Remisiones', icon: 'pi-truck', path: '/remisiones' },
  { label: 'Facturas', icon: 'pi-file', path: '/facturas' },
  { label: 'Laboratorio', icon: 'pi-filter', path: '/laboratorio' },
];

@Component({
  selector: 'app-shell',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, Avatar, Drawer],
  host: { class: 'mx-auto flex min-h-dvh max-w-7xl flex-col gap-4 p-3 lg:p-4' },
  template: `
    <header class="glass sticky top-3 z-10 flex items-center gap-3 px-4 py-3 lg:top-4">
      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300 md:hidden"
        aria-label="Abrir menú"
        (click)="menuOpen.set(true)"
      >
        <i class="pi pi-bars" aria-hidden="true"></i>
      </button>

      <a routerLink="/obras" class="mr-4 text-lg font-bold tracking-wide text-white">
        EPICO <span class="text-sm font-normal text-sky-300">Portal de clientes</span>
      </a>

      <nav aria-label="Navegación principal" class="hidden md:block">
        <ng-container [ngTemplateOutlet]="links" />
      </nav>

      <p-avatar icon="pi pi-user" shape="circle" ariaLabel="Perfil de usuario" class="ml-auto" styleClass="bg-sky-500/30! text-white!" />
    </header>

    <p-drawer
      [(visible)]="menuOpen"
      header="Menú"
      ariaCloseLabel="Cerrar menú"
      styleClass="w-72! glass-strong! rounded-l-none!"
    >
      <nav aria-label="Navegación principal">
        <ng-container [ngTemplateOutlet]="links" [ngTemplateOutletContext]="{ vertical: true }" />
      </nav>
    </p-drawer>

    <ng-template #links let-vertical="vertical">
      <ul class="flex gap-1" [class.flex-col]="vertical">
        @for (item of nav; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-sky-400/20 text-white ring-1 ring-sky-300/30"
              ariaCurrentWhenActive="page"
              (click)="menuOpen.set(false)"
              class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300"
            >
              <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
    </ng-template>

    <main class="min-w-0 flex-1">
      <router-outlet />
    </main>
  `,
})
export class Shell {
  protected readonly nav = NAV;
  protected readonly menuOpen = signal(false);
}
