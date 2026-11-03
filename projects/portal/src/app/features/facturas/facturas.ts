import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-facturas',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Facturas" subtitle="Facturas y estado de cuenta" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Facturas pendientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Pagos recientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Facturas {}
