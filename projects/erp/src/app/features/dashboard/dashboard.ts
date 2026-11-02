import { Component } from '@angular/core';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { EstadoPedido, FechaZonaPipe, GlassCard, KpiCard, PageHeader, PedidoVista, Planta } from 'ui';

// Datos mock hasta conectar el backend. Cada fecha lleva el offset de su planta.
const COZUMEL: Planta = { id: 'pl-czm', nombre: 'Cozumel', zonaHoraria: 'America/Cancun' };
const MERIDA: Planta = { id: 'pl-mid', nombre: 'Mérida', zonaHoraria: 'America/Merida' };
const de = (p: Planta) => ({ plantaId: p.id, plantaNombre: p.nombre, zonaHoraria: p.zonaHoraria });

const PEDIDOS: PedidoVista[] = [
  { id: '1', folio: 'P-1042', ...de(COZUMEL), clienteId: 'c1', clienteNombre: 'Constructora Delta', obraId: 'o1', obraNombre: 'Hotel Costa Azul', producto: "f'c 250 R28", volumenM3: 42, fechaHoraEntrega: '2026-11-02T07:30:00-05:00', estado: 'entregado' },
  { id: '2', folio: 'P-1043', ...de(MERIDA), clienteId: 'c2', clienteNombre: 'Grupo Habita', obraId: 'o2', obraNombre: 'Fracc. Las Lomas', producto: "f'c 200 R28", volumenM3: 18, fechaHoraEntrega: '2026-11-02T08:15:00-06:00', estado: 'en_obra' },
  { id: '3', folio: 'P-1044', ...de(MERIDA), clienteId: 'c3', clienteNombre: 'Infraestructura MX', obraId: 'o3', obraNombre: 'Puente Periférico', producto: "f'c 350 R14", volumenM3: 64, fechaHoraEntrega: '2026-11-02T09:00:00-06:00', estado: 'en_ruta' },
  { id: '4', folio: 'P-1045', ...de(COZUMEL), clienteId: 'c4', clienteNombre: 'Edificaciones Sol', obraId: 'o4', obraNombre: 'Plaza Centro', producto: 'Mortero 1:4', volumenM3: 8, fechaHoraEntrega: '2026-11-02T10:30:00-05:00', estado: 'en_ruta' },
  { id: '5', folio: 'P-1046', ...de(COZUMEL), clienteId: 'c1', clienteNombre: 'Constructora Delta', obraId: 'o5', obraNombre: 'Muelle Turístico', producto: "f'c 300 R28", volumenM3: 36, fechaHoraEntrega: '2026-11-02T11:45:00-05:00', estado: 'en_planta' },
  { id: '6', folio: 'P-1047', ...de(MERIDA), clienteId: 'c5', clienteNombre: 'Particular', obraId: 'o6', obraNombre: 'Losa casa habitación', producto: "f'c 200 R28", volumenM3: 6, fechaHoraEntrega: '2026-11-02T12:00:00-06:00', estado: 'programado' },
  { id: '7', folio: 'P-1048', ...de(MERIDA), clienteId: 'c2', clienteNombre: 'Grupo Habita', obraId: 'o2', obraNombre: 'Fracc. Las Lomas', producto: "f'c 200 R28", volumenM3: 12, fechaHoraEntrega: '2026-11-02T13:00:00-06:00', estado: 'cancelado' },
];

const ESTADO: Record<EstadoPedido, { label: string; severity: 'success' | 'info' | 'warn' | 'secondary' | 'contrast' | 'danger' }> = {
  programado: { label: 'Programado', severity: 'secondary' },
  en_planta: { label: 'En planta', severity: 'contrast' },
  en_ruta: { label: 'En ruta', severity: 'info' },
  en_obra: { label: 'En obra', severity: 'warn' },
  entregado: { label: 'Entregado', severity: 'success' },
  cancelado: { label: 'Cancelado', severity: 'danger' },
};

@Component({
  selector: 'app-dashboard',
  imports: [FechaZonaPipe, TableModule, Tag, GlassCard, KpiCard, PageHeader],
  template: `
    <ui-page-header title="Dashboard" subtitle="Resumen de la operación del día" />

    <section aria-label="Indicadores" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ui-kpi-card label="m³ vendidos hoy" [value]="186" unit="m³" icon="pi-chart-bar" hint="+12% vs. ayer" />
      <ui-kpi-card label="Pedidos en ruta" [value]="2" icon="pi-truck" hint="1 en planta" />
      <ui-kpi-card label="Ollas disponibles" [value]="7" unit="de 12" icon="pi-cog" hint="3 en mantenimiento" />
      <ui-kpi-card label="Litros de diésel" value="4,850" unit="L" icon="pi-gauge" hint="Tanque al 61%" />
    </section>

    <ui-glass-card heading="Pedidos de hoy">
      <p-table [value]="pedidos" [tableStyle]="{ 'min-width': '54rem' }" size="small">
        <ng-template #header>
          <tr>
            <th scope="col">Folio</th>
            <th scope="col">Cliente</th>
            <th scope="col">Obra</th>
            <th scope="col">Producto</th>
            <th scope="col" class="text-right">m³</th>
            <th scope="col">Planta</th>
            <th scope="col">Hora</th>
            <th scope="col">Estado</th>
          </tr>
        </ng-template>
        <ng-template #body let-p>
          <tr>
            <td class="font-medium">{{ p.folio }}</td>
            <td>{{ p.clienteNombre }}</td>
            <td>{{ p.obraNombre }}</td>
            <td>{{ p.producto }}</td>
            <td class="text-right">{{ p.volumenM3 }}</td>
            <td>{{ p.plantaNombre }}</td>
            <td>{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria : 'HH:mm' }}</td>
            <td><p-tag [value]="estado(p.estado).label" [severity]="estado(p.estado).severity" /></td>
          </tr>
        </ng-template>
      </p-table>
    </ui-glass-card>
  `,
})
export default class Dashboard {
  protected readonly pedidos = PEDIDOS;
  protected estado(estado: EstadoPedido) {
    return ESTADO[estado];
  }
}
