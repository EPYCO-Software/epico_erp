import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-obras',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Mis obras" subtitle="Obras activas y su avance de colados" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Obras activas">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Próximos colados">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Obras {}
