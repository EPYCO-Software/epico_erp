import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-inventario',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Inventario" subtitle="Cemento, agregados y aditivos" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Existencias">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Movimientos recientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Inventario {}
