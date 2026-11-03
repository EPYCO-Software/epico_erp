import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-mantenimiento',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Mantenimiento" subtitle="Mantenimiento preventivo y correctivo" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Órdenes de trabajo">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Próximos servicios">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Mantenimiento {}
