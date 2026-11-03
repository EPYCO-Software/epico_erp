import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-laboratorio',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Laboratorio" subtitle="Resultados de resistencia de tus colados" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Ensayes recientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Muestras pendientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Laboratorio {}
