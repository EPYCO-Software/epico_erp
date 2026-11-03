import { Component } from '@angular/core';
import { ChartColumn, Fuel, Route, Truck } from 'lucide';
import { EstadoPedido, FechaZonaPipe, GlassCard, KpiCard, PageHeader, PedidoVista, Planta } from 'ui';

// Datos mock hasta conectar el backend. Cada fecha lleva el offset de su planta.
const COZUMEL: Planta = { id: 'pl-czm', nombre: 'Cozumel', zonaHoraria: 'America/Cancun' };
const MERIDA: Planta = { id: 'pl-mid', nombre: 'Mérida', zonaHoraria: 'America/Merida' };
const de = (p: Planta) => ({ plantaId: p.id, plantaNombre: p.nombre, zonaHoraria: p.zonaHoraria });

const PEDIDOS: PedidoVista[] = [
  { id: '1', folio: 'P-1042', ...de(COZUMEL), clienteId: 'c1', clienteNombre: 'Constructora Delta', obraId: 'o1', obraNombre: 'Hotel Costa Azul', producto: "f'c 250 R28", volumenM3: 42, fechaHoraEntrega: '2026-11-02T07:30:00-05:00', estado: 'entregado', importe: 194880, cobro: 'facturado' },
  { id: '2', folio: 'P-1043', ...de(MERIDA), clienteId: 'c2', clienteNombre: 'Grupo Habita', obraId: 'o2', obraNombre: 'Fracc. Las Lomas', producto: "f'c 200 R28", volumenM3: 18, fechaHoraEntrega: '2026-11-02T08:15:00-06:00', estado: 'en_obra', importe: 83520, cobro: 'pagado' },
  { id: '3', folio: 'P-1044', ...de(MERIDA), clienteId: 'c3', clienteNombre: 'Infraestructura MX', obraId: 'o3', obraNombre: 'Puente Periférico', producto: "f'c 350 R14", volumenM3: 64, fechaHoraEntrega: '2026-11-02T09:00:00-06:00', estado: 'en_ruta', importe: 296960, cobro: 'por_facturar' },
  { id: '4', folio: 'P-1045', ...de(COZUMEL), clienteId: 'c4', clienteNombre: 'Edificaciones Sol', obraId: 'o4', obraNombre: 'Plaza Centro', producto: 'Mortero 1:4', volumenM3: 8, fechaHoraEntrega: '2026-11-02T10:30:00-05:00', estado: 'en_ruta', importe: 37120, cobro: 'por_facturar' },
  { id: '5', folio: 'P-1046', ...de(COZUMEL), clienteId: 'c1', clienteNombre: 'Constructora Delta', obraId: 'o5', obraNombre: 'Muelle Turístico', producto: "f'c 300 R28", volumenM3: 36, fechaHoraEntrega: '2026-11-02T11:45:00-05:00', estado: 'en_planta', importe: 167040, cobro: 'pagado' },
  { id: '6', folio: 'P-1047', ...de(MERIDA), clienteId: 'c5', clienteNombre: 'Particular', obraId: 'o6', obraNombre: 'Losa casa habitación', producto: "f'c 200 R28", volumenM3: 6, fechaHoraEntrega: '2026-11-02T12:00:00-06:00', estado: 'programado', importe: 27840, cobro: 'por_facturar' },
  { id: '7', folio: 'P-1048', ...de(MERIDA), clienteId: 'c2', clienteNombre: 'Grupo Habita', obraId: 'o2', obraNombre: 'Fracc. Las Lomas', producto: "f'c 200 R28", volumenM3: 12, fechaHoraEntrega: '2026-11-02T13:00:00-06:00', estado: 'cancelado', importe: 55680, cobro: 'por_facturar' },
];

// Tinte del color semántico + texto oscurecido: contraste AA en texto pequeño, y el estado también va escrito.
const ESTADO: Record<EstadoPedido, { label: string; clase: string }> = {
  programado: { label: 'Programado', clase: 'bg-[#ECEDEE] text-[#3F4347]' },
  en_planta: { label: 'En planta', clase: 'bg-carbon text-white' },
  en_ruta: { label: 'En ruta', clase: 'bg-[#E2EEF3] text-[#285E74]' },
  en_obra: { label: 'En obra', clase: 'bg-[#FAEFD9] text-[#7E5410]' },
  entregado: { label: 'Entregado', clase: 'bg-[#E3EFE9] text-[#2E5E4A]' },
  cancelado: { label: 'Cancelado', clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

@Component({
  selector: 'app-dashboard',
  imports: [FechaZonaPipe, GlassCard, KpiCard, PageHeader],
  template: `
    <ui-page-header title="Dashboard" subtitle="Resumen de la operación del día" />

    <section aria-label="Indicadores" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ui-kpi-card label="m³ vendidos hoy" [value]="186" unit="m³" [icon]="iconos.m3" hint="+12% vs. ayer" />
      <ui-kpi-card label="Pedidos en ruta" [value]="2" [icon]="iconos.ruta" hint="1 en planta" />
      <ui-kpi-card label="Ollas disponibles" [value]="7" unit="de 12" [icon]="iconos.ollas" hint="3 en mantenimiento" />
      <ui-kpi-card label="Litros de diésel" value="4,850" unit="L" [icon]="iconos.diesel" hint="Tanque al 61%" />
    </section>

    <ui-glass-card heading="Pedidos de hoy">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[54rem] text-left text-sm">
          <thead>
            <tr class="border-b border-acero">
              <th scope="col" class="px-3 py-2.5 font-semibold">Folio</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Cliente</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Obra</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Producto</th>
              <th scope="col" class="px-3 py-2.5 text-right font-semibold">m³</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Planta</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Hora</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (p of pedidos; track p.id) {
              <tr class="border-b border-acero/50 last:border-0 hover:bg-carbon/[0.03]">
                <td class="px-3 py-2 font-medium">{{ p.folio }}</td>
                <td class="px-3 py-2">{{ p.clienteNombre }}</td>
                <td class="px-3 py-2">{{ p.obraNombre }}</td>
                <td class="px-3 py-2">{{ p.producto }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ p.volumenM3 }}</td>
                <td class="px-3 py-2">{{ p.plantaNombre }}</td>
                <td class="px-3 py-2 tabular-nums">{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria : 'HH:mm' }}</td>
                <td class="px-3 py-2">
                  <span class="inline-block rounded-md px-2 py-0.5 text-xs font-bold {{ estado(p.estado).clase }}">{{ estado(p.estado).label }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </ui-glass-card>
  `,
})
export default class Dashboard {
  protected readonly pedidos = PEDIDOS;
  protected readonly iconos = { m3: ChartColumn, ruta: Route, ollas: Truck, diesel: Fuel };
  protected estado(estado: EstadoPedido) {
    return ESTADO[estado];
  }
}
