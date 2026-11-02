import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-clientes',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Clientes" subtitle="Cartera de clientes y obras" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Clientes activos">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Obras en curso">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Clientes {}
