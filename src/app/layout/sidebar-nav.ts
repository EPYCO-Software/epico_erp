import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_GROUPS } from './nav-items';

@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Navegación principal" class="flex flex-col gap-4">
      @for (group of groups; track group.label) {
        <div>
          <p
            class="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300"
            [class.sr-only]="collapsed()"
          >
            {{ group.label }}
          </p>
          <ul class="flex flex-col gap-1">
            @for (item of group.items; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-sky-400/20 text-white ring-1 ring-sky-300/30"
                  ariaCurrentWhenActive="page"
                  [attr.title]="collapsed() ? item.label : null"
                  (click)="navigate.emit()"
                  class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300"
                  [class.justify-center]="collapsed()"
                >
                  <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
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
