import { Component, computed, input } from '@angular/core';
import {
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  CircleDollarSign,
  CircleDashed,
  CircleX,
  Clock,
  CreditCard,
  Factory,
  FileCheck,
  FileClock,
  HandCoins,
  IconNode,
  MapPin,
  Send,
  Truck,
} from 'lucide';
import { ESTADO_COBRO, ESTADO_PEDIDO, ESTATUS_PLANTA, EstadoCobro, EstadoPedido, EstatusPlanta } from '../models/pedido';
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
  por_cobrar: { icono: HandCoins, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  por_facturar: { icono: FileClock, clase: 'bg-carbon/6 text-carbon' },
  facturado: { icono: FileCheck, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  credito: { icono: CreditCard, clase: 'bg-[#EFE8F6] text-[#5B3B80]' },
  pagado: { icono: BadgeCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
  finalizado: { icono: CheckCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
};

const ESTILO_PLANTA: Record<EstatusPlanta, { icono: IconNode; clase: string }> = {
  no_enviado: { icono: CircleDashed, clase: 'bg-carbon/6 text-carbon' },
  enviado: { icono: Send, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  confirmado: { icono: CircleCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
  actualizacion: { icono: CalendarClock, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  rechazada: { icono: CircleX, clase: 'bg-[#F6E3E1] text-[#8E332C]' },
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
  /** Para tablas; hoy todos los textos son cortos (se deja por compatibilidad con quien lo usa). */
  readonly corto = input(false);
  protected readonly clase = ETIQUETA;
  protected readonly estilo = computed(() => ESTILO_COBRO[this.cobro()]);
  protected readonly texto = computed(() => ESTADO_COBRO[this.cobro()]);
}

/** Estatus del requerimiento a la planta (ERP): tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'ui-estatus-planta',
  imports: [Icon],
  template: `<span [class]="clase + ' ' + estilo().clase"><ui-icon [icono]="estilo().icono" [tamano]="14" />{{ texto() }}</span>`,
})
export class EstatusPlantaEtiqueta {
  readonly estatus = input.required<EstatusPlanta>();
  protected readonly clase = ETIQUETA;
  protected readonly estilo = computed(() => ESTILO_PLANTA[this.estatus()]);
  protected readonly texto = computed(() => ESTATUS_PLANTA[this.estatus()]);
}
