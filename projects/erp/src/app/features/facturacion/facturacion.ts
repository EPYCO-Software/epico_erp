import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-facturacion',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Facturación" subtitle="Facturas y cobranza" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Facturas del mes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Cuentas por cobrar">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Facturacion {}
