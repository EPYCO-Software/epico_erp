import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from 'ui';
import { NAV_GROUPS } from './nav-items';

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <nav aria-label="Navegación principal" class="flex flex-col gap-4">
      @for (group of groups; track group.label) {
        <div>
          <p
            class="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-texto-suave"
            [class.sr-only]="collapsed()"
          >
            {{ group.label }}
          </p>
          <ul class="flex flex-col gap-1">
            @for (item of group.items; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-epico/10 font-semibold text-epico-oscuro ring-1 ring-epico/30"
                  ariaCurrentWhenActive="page"
                  [attr.title]="collapsed() ? item.label : null"
                  (click)="navigate.emit()"
                  class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-carbon transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
                  [class.justify-center]="collapsed()"
                >
                  <ui-icon [icono]="item.icon" [tamano]="18" />
                  <span [class.sr-only]="collapsed()">{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        </div>
      }
    </nav>
  `,
})
export class SidebarNav {
  readonly collapsed = input(false);
  readonly navigate = output();
  protected readonly groups = NAV_GROUPS;
}
