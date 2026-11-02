import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-remisiones',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Remisiones" subtitle="Comprobantes de entrega por viaje" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Remisiones recientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Volumen entregado">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Remisiones {}
