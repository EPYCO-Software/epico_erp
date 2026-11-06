import { Service, computed, inject } from '@angular/core';
import { VENDEDORES, VentasService } from './datos';
import { CLIENTES_HISTORIAL, LineaVenta, Nombres, historialDemo, hoy } from './reporte-datos';

/**
 * De dónde leen los reportes (Ventas, Vendedores, Productos, Clientes): el historial de demostración y las órdenes del
 * ERP (sin canceladas, sin IVA), con los nombres y los precios de lista. Uno solo para todos: el historial se genera
 * una vez.
 */
@Service()
export class ReporteFuente {
  private readonly ventas = inject(VentasService);
  private readonly historial = historialDemo(hoy());

  readonly lineas = computed<LineaVenta[]>(() => {
    const vendedorDe = new Map(this.ventas.cotizaciones().map((c) => [c.id, c.vendedorId]));
    const ordenes = this.ventas
      .pedidos()
      .filter((p) => p.estado !== 'cancelado')
      .map((p): LineaVenta => {
        const esp = this.ventas.partidaDe(p).partida?.especificacion;
        return {
          folio: p.folio,
          fecha: p.fechaHoraEntrega.slice(0, 10),
          plantaId: p.plantaId,
          clienteId: p.clienteId,
          productoId: esp ? `${esp.tipoResistencia}-${esp.resistenciaKgCm2}` : p.producto,
          categoria: esp?.tipoResistencia === 'mr' ? 'concreto-mr' : 'concreto-fc',
          vendedorId: vendedorDe.get(p.cotizacionId ?? '') ?? Object.keys(VENDEDORES)[0],
          cantidad: p.volumenM3,
          unidad: 'M³',
          m3: p.volumenM3,
          importe: Math.round((p.importe / 1.16) * 100) / 100,
        };
      });
    return [...this.historial, ...ordenes];
  });

  readonly nombres = computed<Nombres>(() => ({
    producto: Object.fromEntries(this.ventas.productos().map((p) => [p.id, p.nombre])),
    cliente: { ...CLIENTES_HISTORIAL, ...Object.fromEntries(this.ventas.clientes().map((c) => [c.id, c.nombre])) },
  }));

  /** Precio de lista de cada producto (para "precio obtenido vs. lista"). */
  readonly precios = computed(() => Object.fromEntries(this.ventas.productos().map((p) => [p.id, p.precio])));

  /** Los que tienen ficha en Clientes (los del historial de demostración no). */
  readonly conFicha = computed(() => new Set(this.ventas.clientes().map((c) => c.id)));

  /** Para los filtros: solo productos y clientes con ventas, por nombre. */
  readonly productos = computed(() => {
    const ids = new Set(this.lineas().map((l) => l.productoId));
    return this.ventas.productos().filter((p) => ids.has(p.id));
  });
  readonly clientes = computed(() => {
    const n = this.nombres().cliente;
    return [...new Set(this.lineas().map((l) => l.clienteId))].map((id) => ({ id, nombre: n[id] ?? id })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
}
