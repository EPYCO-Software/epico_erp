import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-pedidos',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Pedidos" subtitle="Seguimiento de tus pedidos de concreto" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Pedidos en curso">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Historial">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Pedidos {}
