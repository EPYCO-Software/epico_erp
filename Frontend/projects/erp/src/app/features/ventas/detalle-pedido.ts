import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Download, FileText, Maximize2, X } from 'lucide';
import {
  ESTADO_PEDIDO,
  EstadoCobroEtiqueta,
  EstadoPedido,
  EstadoPedidoEtiqueta,
  FechaZonaPipe,
  Icon,
  PedidoVista,
  ResumenCotizacion,
  descargarCotizacionPdf,
  pesos,
} from 'ui';
import { BarraEstados, BotonRelacion } from '../../layout/vista-completa';
import { VentasService } from './datos';

const FLUJO: EstadoPedido[] = ['programado', 'en_planta', 'en_ruta', 'en_obra', 'entregado'];

/**
 * Una orden de venta (pedido de una entrega), igual en la vista previa de Órdenes y en su vista completa: producto,
 * volumen, obra, fecha y planta, estados de entrega y cobro, la cotización de la que salió (trazabilidad; en la vista
 * completa ese botón va en la barra, como en Odoo) y su partida con el formato de la cotización.
 */
@Component({
  selector: 'app-detalle-pedido',
  imports: [
    DecimalPipe,
    RouterLink,
    BarraEstados,
    BotonRelacion,
    EstadoCobroEtiqueta,
    EstadoPedidoEtiqueta,
    FechaZonaPipe,
    Icon,
    ResumenCotizacion,
  ],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <p class="text-sm font-semibold text-texto-suave">Orden de venta</p>
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ p().folio }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="flex flex-wrap items-center gap-2 text-lg font-bold outline-none">
            {{ p().folio }}<ui-estado-pedido [estado]="p().estado" />
          </h2>
        }
        <p class="text-sm text-texto-suave">{{ p().producto }} · {{ p().volumenM3 | number: '1.0-1' }} m³</p>
      </div>
      @if (completa()) {
        <app-barra-estados class="mt-1" etiqueta="Estado de la entrega" [pasos]="pasos()" [actual]="p().estado" />
      } @else {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a
            [routerLink]="['/ventas/ordenes', p().folio]"
            aria-label="Abrir en vista completa"
            title="Abrir en vista completa"
            [class]="botonIcono"
          >
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2 empty:hidden">
      @if (!completa() && cotizacion(); as c) {
        <app-boton-relacion
          etiqueta="Cotización"
          [valor]="c.folio"
          [ruta]="['/ventas/cotizaciones', c.id]"
          [icono]="iconos.cotizacion"
        />
      }
      <!-- La orden de venta con el mismo formato que la cotización impresa (necesita su partida) -->
      @if (partida()) {
        <button
          type="button"
          aria-label="Descargar PDF"
          class="inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-60"
          [disabled]="generandoPdf()"
          (click)="descargarPdf()"
        >
          <ui-icon [icono]="iconos.pdf" [tamano]="16" />PDF
        </button>
      }
    </div>
    <p class="mt-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorPdf() }}</p>

    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
      <dl class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-texto-suave">Cliente</dt>
        <dd>
          <a [routerLink]="['/ventas/clientes', p().clienteId]" [class]="enlace">{{ p().clienteNombre }}</a>
        </dd>
        <dt class="text-texto-suave">Entrega</dt>
        <dd>{{ p().fechaHoraEntrega | fechaZona: p().zonaHoraria }}</dd>
        <dt class="text-texto-suave">Obra</dt>
        <dd>{{ p().obraNombre }}</dd>
        <dt class="text-texto-suave">Planta</dt>
        <dd>{{ p().plantaNombre }}</dd>
        @if (cotizacion(); as c) {
          <dt class="text-texto-suave">Vendedor</dt>
          <dd>{{ c.vendedorNombre }}</dd>
        }
        <dt class="self-center text-texto-suave">Cobro</dt>
        <dd>
          <ui-estado-cobro [cobro]="p().cobro" />
          @if (p().facturaFolio; as factura) {
            <span class="ml-1.5 text-texto-suave">{{ factura }}</span>
          }
        </dd>
      </dl>
      <p class="shrink-0 text-right">
        <span class="block text-xs tracking-wide text-texto-suave uppercase">Importe con IVA</span>
        <span class="text-lg font-bold">\${{ pesos(p().importe) }}</span>
      </p>
    </div>

    @if (partida(); as partida) {
      <ui-resumen-cotizacion
        class="mt-4 border-t border-acero/60 pt-4"
        [partidas]="[partida]"
        [descuento]="descuento()"
        [obras]="obras()"
        [nivel]="completa() ? 2 : 3"
      />
    }
  `,
})
export class DetallePedido {
  private readonly ventas = inject(VentasService);

  readonly p = input.required<PedidoVista>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = { cerrar: X, completa: Maximize2, cotizacion: FileText, pdf: Download };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly enlace =
    'rounded font-medium underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly pesos = pesos;
  protected readonly obras = this.ventas.obras;
  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly cotizacion = computed(() => this.ventas.cotizaciones().find((c) => c.id === this.p().cotizacionId));
  /** La partida de su cotización o, si es una orden directa, la suya. */
  protected readonly partida = computed(
    () => this.cotizacion()?.partidas.find((x) => x.id === this.p().partidaId) ?? this.p().partida,
  );
  protected readonly descuento = computed(() => this.cotizacion()?.descuento ?? this.p().descuento);
  protected readonly generandoPdf = signal(false);
  protected readonly errorPdf = linkedSignal({ source: computed(() => this.p().id), computation: () => '' });

  /** La orden de venta en PDF, con el formato de la cotización impresa: su partida, con la fecha de hoy. */
  protected async descargarPdf(): Promise<void> {
    const p = this.p();
    const c = this.cotizacion();
    const partida = this.partida();
    if (!partida) return;
    this.generandoPdf.set(true);
    this.errorPdf.set('');
    try {
      await descargarCotizacionPdf({
        tipo: 'orden',
        emitida: true,
        folio: p.folio,
        fecha: new Date(),
        cliente: { nombre: p.clienteNombre, correo: this.ventas.cliente(p.clienteId)?.contacto.correo ?? '' },
        partidas: [partida],
        obras: this.obras(),
        referencia: c ? `Cotización: ${c.folio}` : 'Orden directa, sin cotización',
        descuento: this.descuento(),
      });
    } catch {
      this.errorPdf.set('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      this.generandoPdf.set(false);
    }
  }
  /** Programado › En planta › En ruta › En obra › Entregado; el cancelado termina en Cancelado. */
  protected readonly pasos = computed(() =>
    (this.p().estado === 'cancelado' ? (['programado', 'cancelado'] as EstadoPedido[]) : FLUJO).map((id) => ({
      id,
      nombre: ESTADO_PEDIDO[id],
    })),
  );
}
