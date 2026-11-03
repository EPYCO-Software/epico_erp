import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-flota',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Flota" subtitle="Ollas revolvedoras, bombas y unidades" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Unidades activas">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Asignaciones">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Flota {}
