import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-laboratorio',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Laboratorio" subtitle="Control de calidad y ensayes" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Muestras pendientes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Resultados de resistencia">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Laboratorio {}
