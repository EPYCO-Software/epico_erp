import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-pedidos',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Pedidos" subtitle="Programación y seguimiento de colados" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Programación del día">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Pedidos pendientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Pedidos {}
