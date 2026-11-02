import { Component } from '@angular/core';
import { GlassCard } from '../../shared/glass-card';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-facturacion',
  imports: [GlassCard, PageHeader],
  template: `
    <app-page-header title="Facturación" subtitle="Facturas y cobranza" />
    <div class="grid gap-4 md:grid-cols-2">
      <app-glass-card heading="Facturas del mes">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
      <app-glass-card heading="Cuentas por cobrar">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </app-glass-card>
    </div>
  `,
})
export default class Facturacion {}
