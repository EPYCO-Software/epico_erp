import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-mantenimiento',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Mantenimiento" subtitle="Mantenimiento preventivo y correctivo" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Órdenes de trabajo">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Próximos servicios">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Mantenimiento {}
