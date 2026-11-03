import { Component, computed, input } from '@angular/core';
import { PedidoVista } from 'ui';
import { IVA, pesos } from '../catalogo/presupuesto';
import { EstadoCobroEtiqueta } from './estado-cobro';

/** Bloque económico de un pedido: importe con IVA desglosado, situación de cobro y factura. */
@Component({
  selector: 'app-cobro-pedido',
  imports: [EstadoCobroEtiqueta],
  template: `
    <dl class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
      <dt class="text-texto-suave">Subtotal</dt>
      <dd class="text-right">\${{ pesos(subtotal()) }}</dd>
      <dt class="text-texto-suave">IVA 16%</dt>
      <dd class="text-right">\${{ pesos(p().importe - subtotal()) }}</dd>
      <dt class="border-t border-acero/60 pt-1.5 font-bold">Total</dt>
      <dd class="border-t border-acero/60 pt-1.5 text-right font-bold">\${{ pesos(p().importe) }}</dd>
      <dt class="pt-2 text-texto-suave">Situación</dt>
      <dd class="pt-2 text-right"><app-estado-cobro [cobro]="p().cobro" /></dd>
      <dt class="text-texto-suave">Factura</dt>
      <dd class="text-right">{{ p().facturaFolio ?? (p().cobro === 'en_facturacion' ? 'En emisión' : 'Aún sin factura') }}</dd>
    </dl>
  `,
})
export class CobroPedido {
  readonly p = input.required<PedidoVista>();
  protected readonly pesos = pesos;
  protected readonly subtotal = computed(() => Math.round((this.p().importe / (1 + IVA)) * 100) / 100);
}
