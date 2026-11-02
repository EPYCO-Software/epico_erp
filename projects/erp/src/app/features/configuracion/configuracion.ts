import { Component } from '@angular/core';
import { GlassCard, PageHeader } from 'ui';

@Component({
  selector: 'app-configuracion',
  imports: [GlassCard, PageHeader],
  template: `
    <ui-page-header title="Configuración" subtitle="Parámetros generales del sistema" />
    <div class="grid gap-4 md:grid-cols-2">
      <ui-glass-card heading="Empresa">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
      <ui-glass-card heading="Usuarios y permisos">
        <p class="text-sm text-slate-300">Próximamente.</p>
      </ui-glass-card>
    </div>
  `,
})
export default class Configuracion {}
