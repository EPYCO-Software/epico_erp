import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-ventas',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Ventas" subtitle="Cotizaciones y ventas de concreto" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Ventas del mes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Cotizaciones abiertas">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Ventas {}
