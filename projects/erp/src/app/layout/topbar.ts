import { Component, inject, input, output } from '@angular/core';
import { Avatar } from 'primeng/avatar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { OverlayBadge } from 'primeng/overlaybadge';
import { NotificationsService } from '../core/services/notifications.service';

@Component({
  selector: 'app-topbar',
  imports: [Avatar, IconField, InputIcon, InputText, OverlayBadge],
  host: { class: 'glass flex items-center gap-3 px-4 py-3' },
  template: `
    <button
      type="button"
      class="icon-btn lg:hidden"
      aria-label="Abrir menú"
      (click)="openMenu.emit()"
    >
      <i class="pi pi-bars" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="icon-btn hidden lg:inline-flex"
      [attr.aria-label]="collapsed() ? 'Expandir menú lateral' : 'Colapsar menú lateral'"
      [attr.aria-expanded]="!collapsed()"
      (click)="toggleCollapse.emit()"
    >
      <i class="pi" [class]="collapsed() ? 'pi-angle-double-right' : 'pi-angle-double-left'" aria-hidden="true"></i>
    </button>

    <span class="text-lg font-bold tracking-wide text-white">EPICO <span class="text-sky-300">ERP</span></span>

    <form role="search" class="ml-auto hidden sm:block" (submit)="$event.preventDefault()">
      <p-iconfield>
        <p-inputicon class="pi pi-search" />
        <input pInputText type="search" placeholder="Buscar…" aria-label="Buscar" class="w-64" />
      </p-iconfield>
    </form>

    <button
      type="button"
      class="icon-btn ml-auto sm:ml-0"
      [attr.aria-label]="'Notificaciones, ' + notifications.unread() + ' sin leer'"
    >
      <p-overlaybadge [value]="notifications.unread()" severity="danger">
        <i class="pi pi-bell text-lg" aria-hidden="true"></i>
      </p-overlaybadge>
    </button>

    <p-avatar icon="pi pi-user" shape="circle" ariaLabel="Perfil de usuario" styleClass="bg-sky-500/30! text-white!" />
  `,
  styles: `
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      color: var(--color-slate-200);
    }
    .icon-btn:hover {
      background: rgb(255 255 255 / 0.1);
      color: white;
    }
    .icon-btn:focus-visible {
      outline: 2px solid var(--color-sky-300);
    }
  `,
})
export class Topbar {
  readonly collapsed = input(false);
  readonly openMenu = output();
  readonly toggleCollapse = output();
  protected readonly notifications = inject(NotificationsService);
}
