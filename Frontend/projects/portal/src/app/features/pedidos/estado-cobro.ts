import { Component, computed, input } from '@angular/core';
import { BadgeCheck, CircleDollarSign, FileCheck, FileClock } from 'lucide';
import { EstadoCobro, Icon } from 'ui';
import { ESTADO_COBRO } from '../../core/services/pedidos.service';

const ESTILO: Record<EstadoCobro, { icono: typeof FileCheck; clase: string }> = {
  por_facturar: { icono: CircleDollarSign, clase: 'bg-carbon/6 text-carbon' },
  en_facturacion: { icono: FileClock, clase: 'bg-[#FBF0DD] text-[#7A5410]' },
  facturado: { icono: FileCheck, clase: 'bg-[#E6F0F4] text-[#2B5F75]' },
  pagado: { icono: BadgeCheck, clase: 'bg-[#E5F0EA] text-[#2E5E4A]' },
};

/** Situación económica del pedido: tinte + icono + texto (nunca solo color). */
@Component({
  selector: 'app-estado-cobro',
  imports: [Icon],
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold whitespace-nowrap" [class]="estilo().clase">
      <ui-icon [icono]="estilo().icono" [tamano]="14" />{{ texto() }}
    </span>
  `,
})
export class EstadoCobroEtiqueta {
  readonly cobro = input.required<EstadoCobro>();
  /** "En facturación" en lugar de "En proceso de facturación" (tablas). */
  readonly corto = input(false);
  protected readonly estilo = computed(() => ESTILO[this.cobro()]);
  protected readonly texto = computed(() => (this.corto() && this.cobro() === 'en_facturacion' ? 'En facturación' : ESTADO_COBRO[this.cobro()]));
}
