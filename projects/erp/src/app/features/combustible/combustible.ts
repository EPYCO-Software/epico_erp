import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-combustible',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Combustible" subtitle="Control de cargas y rendimiento de diésel" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Cargas recientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Rendimiento por unidad">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Combustible {}
