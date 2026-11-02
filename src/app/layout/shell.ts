import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Drawer } from 'primeng/drawer';
import { SidebarNav } from './sidebar-nav';
import { Topbar } from './topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Drawer, SidebarNav, Topbar],
  host: { class: 'flex min-h-dvh gap-4 p-3 lg:p-4' },
  template: `
    <aside
      class="glass sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 overflow-y-auto p-3 transition-[width] duration-200 lg:block"
      [class]="collapsed() ? 'w-20' : 'w-64'"
    >
      <app-sidebar-nav [collapsed]="collapsed()" />
    </aside>

    <p-drawer
      [(visible)]="mobileOpen"
      header="EPICO ERP"
      ariaCloseLabel="Cerrar menú"
      styleClass="w-72! glass-strong! rounded-l-none!"
    >
      <app-sidebar-nav (navigate)="mobileOpen.set(false)" />
    </p-drawer>

    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <app-topbar
        class="sticky top-3 z-10 lg:top-4"
        [collapsed]="collapsed()"
        (openMenu)="mobileOpen.set(true)"
        (toggleCollapse)="collapsed.update((c) => !c)"
      />
      <main class="min-w-0 flex-1">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);
}
