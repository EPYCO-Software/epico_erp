import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-ventas',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Ventas" subtitle="Cotizaciones y ventas de concreto" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Ventas del mes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Cotizaciones abiertas">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Ventas {}
