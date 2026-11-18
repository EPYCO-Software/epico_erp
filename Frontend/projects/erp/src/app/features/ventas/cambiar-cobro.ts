import { Component, computed, inject, input, output } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChevronDown } from 'lucide';
import { ESTADO_COBRO, EstadoCobro, EstadoCobroEtiqueta, Icon, PedidoVista, pesos } from 'ui';
import { VentasService, mensajeDe, sinCreditoPara } from './datos';

/**
 * Cambiar el cobro de una orden (Por cobrar → Pagado, Crédito…): botón con menú de cobros y, al elegir, una segunda
 * confirmación (sacarla de "Por cobrar" es a propósito). Queda en su historial. Solo en la orden abierta (vista previa o
 * vista completa), nunca desde una lista: así quien cambia el cobro ve la orden completa.
 */
@Component({
  selector: 'app-cambiar-cobro',
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, EstadoCobroEtiqueta, Icon],
  template: `
    <button
      type="button"
      class="inline-flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-acero-oscuro bg-white px-3 text-sm font-semibold whitespace-nowrap transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
      [attr.aria-label]="'Cambiar cobro de ' + p().folio + ', ahora ' + actual()"
      [cdkMenuTriggerFor]="menu"
    >
      Cambiar cobro<ui-icon [icono]="iconoAbrir" [tamano]="16" />
    </button>
    <ng-template #menu>
      <section [attr.aria-label]="'Nuevo cobro de ' + p().folio">
        <div cdkMenu [attr.aria-label]="'Nuevo cobro de ' + p().folio" class="glass-strong mt-1 min-w-52 p-1.5 text-carbon">
          @for (c of opciones(); track c) {
            <button
              cdkMenuItem
              type="button"
              class="flex w-full items-center rounded-lg px-2 py-1.5 hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:outline-none"
              (cdkMenuItemTriggered)="elegir(c)"
            >
              <ui-estado-cobro [cobro]="c" />
            </button>
          }
        </div>
      </section>
    </ng-template>
  `,
})
export class CambiarCobro {
  private readonly ventas = inject(VentasService);

  readonly p = input.required<PedidoVista>();
  /** Lo que pasó, para anunciarlo (aria-live de quien lo usa). */
  readonly cambiado = output<string>();

  protected readonly iconoAbrir = ChevronDown;
  protected readonly actual = computed(() => ESTADO_COBRO[this.p().cobro]);
  protected readonly opciones = computed(() => (Object.keys(ESTADO_COBRO) as EstadoCobro[]).filter((c) => c !== this.p().cobro));

  protected async elegir(cobro: EstadoCobro): Promise<void> {
    const p = this.p();
    // Sin la ficha del cliente (rol sin ver clientes) no se sabe su crédito: decide el backend
    if (cobro === 'credito' && this.ventas.cliente(p.clienteId)) {
      const credito = this.ventas.creditoDe(p.clienteId);
      const motivo = sinCreditoPara(credito, p.importe);
      if (motivo) return void this.cambiado.emit(`${p.folio}: ${motivo}`);
      if (!confirm(`¿Pasar ${p.folio} ($${pesos(p.importe)}) a crédito? Le quedarán $${pesos(credito.disponible! - p.importe)} disponibles y vence en ${credito.dias} días.`)) return;
      return this.aplicar(p, cobro);
    }
    if (!confirm(`¿Cambiar el cobro de ${p.folio} de "${ESTADO_COBRO[p.cobro]}" a "${ESTADO_COBRO[cobro]}"?`)) return;
    await this.aplicar(p, cobro);
  }

  private async aplicar(p: PedidoVista, cobro: EstadoCobro): Promise<void> {
    try {
      await this.ventas.cambiarCobro(p.id, cobro);
      this.cambiado.emit(`${p.folio}: el cobro pasó a "${ESTADO_COBRO[cobro]}".`);
    } catch (e) {
      this.cambiado.emit(`${p.folio}: ${mensajeDe(e)}`);
    }
  }
}
