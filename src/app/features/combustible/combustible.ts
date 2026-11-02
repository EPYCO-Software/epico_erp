import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-combustible',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Combustible" subtitle="Control de cargas y rendimiento de diésel" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Cargas recientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Rendimiento por unidad">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Combustible {}
