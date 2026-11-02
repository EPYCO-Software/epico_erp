import { Component } from '@angular/core';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { GlassCard } from '../../shared/glass-card';
import { KpiCard } from '../../shared/kpi-card';
import { PageHeader } from '../../shared/page-header';

type EstadoPedido = 'Programado' | 'En ruta' | 'Entregado' | 'Cancelado';

interface Pedido {
  folio: string;
  cliente: string;
  obra: string;
  producto: string;
  m3: number;
  hora: string;
  estado: EstadoPedido;
}

// Datos mock hasta conectar el backend.
const PEDIDOS: Pedido[] = [
  { folio: 'P-1042', cliente: 'Constructora Delta', obra: 'Torre Norte', producto: "f'c 250 R28", m3: 42, hora: '07:30', estado: 'Entregado' },
  { folio: 'P-1043', cliente: 'Grupo Habita', obra: 'Fracc. Las Lomas', producto: "f'c 200 R28", m3: 18, hora: '08:15', estado: 'En ruta' },
  { folio: 'P-1044', cliente: 'Infraestructura MX', obra: 'Puente Río Seco', producto: "f'c 350 R14", m3: 64, hora: '09:00', estado: 'En ruta' },
  { folio: 'P-1045', cliente: 'Edificaciones Sol', obra: 'Plaza Centro', producto: 'Mortero 1:4', m3: 8, hora: '10:30', estado: 'Programado' },
  { folio: 'P-1046', cliente: 'Constructora Delta', obra: 'Torre Sur', producto: "f'c 300 R28", m3: 36, hora: '11:45', estado: 'Programado' },
  { folio: 'P-1047', cliente: 'Particular', obra: 'Losa casa habitación', producto: "f'c 200 R28", m3: 6, hora: '12:00', estado: 'Cancelado' },
];

const SEVERIDAD: Record<EstadoPedido, 'success' | 'info' | 'secondary' | 'danger'> = {
  Entregado: 'success',
  'En ruta': 'info',
  Programado: 'secondary',
  Cancelado: 'danger',
};

@Component({
  selector: 'app-dashboard',
  imports: [TableModule, Tag, GlassCard, KpiCard, PageHeader],
  template: `
    <app-page-header title="Dashboard" subtitle="Resumen de la operación del día" />

    <section aria-label="Indicadores" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <app-kpi-card label="m³ vendidos hoy" [value]="186" unit="m³" icon="pi-chart-bar" hint="+12% vs. ayer" />
      <app-kpi-card label="Pedidos en ruta" [value]="2" icon="pi-truck" hint="4 programados" />
      <app-kpi-card label="Ollas disponibles" [value]="7" unit="de 12" icon="pi-cog" hint="3 en mantenimiento" />
      <app-kpi-card label="Litros de diésel" value="4,850" unit="L" icon="pi-gauge" hint="Tanque al 61%" />
    </section>

    <app-glass-card heading="Pedidos de hoy">
      <p-table [value]="pedidos" [tableStyle]="{ 'min-width': '48rem' }" size="small">
        <ng-template #header>
          <tr>
            <th scope="col">Folio</th>
            <th scope="col">Cliente</th>
            <th scope="col">Obra</th>
            <th scope="col">Producto</th>
            <th scope="col" class="text-right">m³</th>
            <th scope="col">Hora</th>
            <th scope="col">Estado</th>
          </tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td class="font-medium">{{ p.folio }}</td>
            <td>{{ p.cliente }}</td>
            <td>{{ p.obra }}</td>
            <td>{{ p.producto }}</td>
            <td class="text-right">{{ p.m3 }}</td>
            <td>{{ p.hora }}</td>
            <td><p-tag [value]="p.estado" [severity]="severidad(p.estado)" /></td>
          </tr>
        </ng-template>
      </p-table>
    </app-glass-card>
  `,
})
export default class Dashboard {
  protected readonly pedidos = PEDIDOS;
  protected severidad(estado: EstadoPedido) {
    return SEVERIDAD[estado];
  }
}
