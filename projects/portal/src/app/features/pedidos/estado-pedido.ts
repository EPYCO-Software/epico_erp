import { Component, computed, input } from '@angular/core';
import { CircleCheck, CircleX, Clock, Factory, MapPin, Truck } from 'lucide';
import { EstadoPedido, Icon } from 'ui';
import { ESTADO_PEDIDO } from '../../core/services/pedidos.service';

const ESTILO: Record<EstadoPedido, { icono: typeof Clock; clase: string }> = {
  programado: { icono: Clock, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  en_planta: { icono: Factory, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  en_ruta: { icono: Truck, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  en_obra: { icono: MapPin, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  entregado: { icono: CircleCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
  cancelado: { icono: CircleX, clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

/** Etiqueta de estado del pedido: tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'app-estado-pedido',
  imports: [Icon],
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold whitespace-nowrap" [class]="estilo().clase">
      <ui-icon [icono]="estilo().icono" [tamano]="14" />{{ texto() }}
    </span>
  `,
})
export class EstadoPedidoEtiqueta {
  readonly estado = input.required<EstadoPedido>();
  protected readonly estilo = computed(() => ESTILO[this.estado()]);
  protected readonly texto = computed(() => ESTADO_PEDIDO[this.estado()]);
}
