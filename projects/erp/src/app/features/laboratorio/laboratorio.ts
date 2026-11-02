import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-laboratorio',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Laboratorio" subtitle="Control de calidad y ensayes" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Muestras pendientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Resultados de resistencia">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Laboratorio {}
