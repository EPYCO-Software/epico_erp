import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-pedidos',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Pedidos" subtitle="Programación y seguimiento de colados" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Programación del día">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Pedidos pendientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Pedidos {}
