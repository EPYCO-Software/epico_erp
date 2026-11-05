import { Component, computed, input } from '@angular/core';
import {
  BadgeCheck,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Clock,
  Factory,
  FileCheck,
  FileClock,
  IconNode,
  MapPin,
  Truck,
} from 'lucide';
import { ESTADO_COBRO, ESTADO_PEDIDO, EstadoCobro, EstadoPedido } from '../models/pedido';
import { Icon } from './icon';

const ESTILO_PEDIDO: Record<EstadoPedido, { icono: IconNode; clase: string }> = {
  programado: { icono: Clock, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  en_planta: { icono: Factory, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  en_ruta: { icono: Truck, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  en_obra: { icono: MapPin, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  entregado: { icono: CircleCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
  cancelado: { icono: CircleX, clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

const ESTILO_COBRO: Record<EstadoCobro, { icono: IconNode; clase: string }> = {
  por_facturar: { icono: CircleDollarSign, clase: 'bg-carbon/6 text-carbon' },
  en_facturacion: { icono: FileClock, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  facturado: { icono: FileCheck, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  pagado: { icono: BadgeCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
};

const ETIQUETA = 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold whitespace-nowrap';

/** Estado de entrega del pedido, igual en el portal y en el ERP: tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'ui-estado-pedido',
  imports: [Icon],
  template: `<span [class]="clase + ' ' + estilo().clase"><ui-icon [icono]="estilo().icono" [tamano]="14" />{{ texto() }}</span>`,
})
export class EstadoPedidoEtiqueta {
  readonly estado = input.required<EstadoPedido>();
  protected readonly clase = ETIQUETA;
  protected readonly estilo = computed(() => ESTILO_PEDIDO[this.estado()]);
  protected readonly texto = computed(() => ESTADO_PEDIDO[this.estado()]);
}

/** Situación económica del pedido, igual en el portal y en el ERP: tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'ui-estado-cobro',
  imports: [Icon],
  template: `<span [class]="clase + ' ' + estilo().clase"><ui-icon [icono]="estilo().icono" [tamano]="14" />{{ texto() }}</span>`,
})
export class EstadoCobroEtiqueta {
  readonly cobro = input.required<EstadoCobro>();
  /** "En facturación" en lugar de "En proceso de facturación" (tablas). */
  readonly corto = input(false);
  protected readonly clase = ETIQUETA;
  protected readonly estilo = computed(() => ESTILO_COBRO[this.cobro()]);
  protected readonly texto = computed(() =>
    this.corto() && this.cobro() === 'en_facturacion' ? 'En facturación' : ESTADO_COBRO[this.cobro()],
  );
}
