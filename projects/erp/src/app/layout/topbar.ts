import { Component, inject, input, output } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Bell, ChevronsLeft, ChevronsRight, Menu, Search } from 'lucide';
import { Icon, UserMenu } from 'ui';
import { NotificationsService } from '../core/services/notifications.service';

@Component({
  selector: 'app-topbar',
  imports: [NgOptimizedImage, Icon, UserMenu],
  host: { role: 'banner', class: 'glass flex items-center gap-3 px-4 py-3' },
  template: `
    <button
      type="button"
      class="inline-flex size-11 items-center justify-center rounded-xl text-carbon hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico lg:hidden"
      aria-label="Abrir menú"
      (click)="openMenu.emit()"
    >
      <ui-icon [icono]="iconos.menu" />
    </button>
    <button
      type="button"
      class="hidden size-11 items-center justify-center rounded-xl text-carbon hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico lg:inline-flex"
      [attr.aria-label]="collapsed() ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
      [attr.aria-expanded]="!collapsed()"
      (click)="toggleCollapse.emit()"
    >
      <ui-icon [icono]="collapsed() ? iconos.expandir : iconos.colapsar" />
    </button>

    <span class="flex items-center gap-3">
      <img ngSrc="/ui/marca/isotipo-epico-erp.webp" width="400" height="307" priority alt="" class="h-9 w-auto" />
      <span class="text-lg font-extrabold tracking-wide text-carbon">EPICO <span class="font-semibold text-epico">ERP</span></span>
    </span>

    <form role="search" class="ml-auto hidden sm:block" (submit)="$event.preventDefault()">
      <div class="relative">
        <ui-icon [icono]="iconos.buscar" [tamano]="18" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
        <input type="search" placeholder="Buscar…" aria-label="Buscar" class="campo h-11 w-64 pr-3 pl-10" />
      </div>
    </form>

    <button
      type="button"
      class="relative inline-flex size-11 items-center justify-center rounded-xl text-carbon hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico ml-auto sm:ml-0"
      [attr.aria-label]="'Notificaciones, ' + notifications.unread() + ' sin leer'"
    >
      <span class="relative">
        <ui-icon [icono]="iconos.campana" />
        @if (notifications.unread()) {
          <span class="absolute -top-2 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-epico px-1 text-[0.6875rem] leading-none font-bold text-white" aria-hidden="true">
            {{ notifications.unread() }}
          </span>
        }
      </span>
    </button>

    <ui-user-menu />
  `,
})
export class Topbar {
  readonly collapsed = input(false);
  readonly openMenu = output();
  readonly toggleCollapse = output();
  protected readonly notifications = inject(NotificationsService);
  protected readonly iconos = { menu: Menu, expandir: ChevronsRight, colapsar: ChevronsLeft, buscar: Search, campana: Bell };
}
