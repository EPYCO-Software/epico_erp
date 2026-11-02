import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-clientes',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Clientes" subtitle="Cartera de clientes y obras" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Clientes activos">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Obras en curso">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Clientes {}
