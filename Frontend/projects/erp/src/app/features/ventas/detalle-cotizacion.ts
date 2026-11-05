import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Check, ChevronRight, ClipboardCheck, Download, Maximize2, PencilLine, Send, X } from 'lucide';
import {
  CotizacionVista,
  ESTADO_PEDIDO,
  EstadoCotizacion,
  FechaZonaPipe,
  Icon,
  Obra,
  ResumenCotizacion,
  descargarCotizacionPdf,
  pesos,
} from 'ui';
import { BarraEstados } from '../../layout/vista-completa';
import { ESTADOS_COTIZACION, VentasService, modificable } from './datos';
import { CambiosCotizacion, EditorCotizacion } from './editor-cotizacion';
import { EnviarCotizacion } from './enviar-cotizacion';

const LISTA = new Intl.ListFormat('es');

/**
 * Una cotización con el mismo formato que en el portal: arriba folio, fecha, obras, m³ y "Neto estimado" (como
 * cotizacion-fila), más los datos de la concretera; debajo ui-resumen-cotizacion, el mismo resumen que ve el cliente.
 * Va en la vista previa de la lista (con botones de vista completa y cerrar) y en la vista completa (`vista="completa"`:
 * título h1 y los estados como en Odoo). En borrador o enviada: Enviar (enviar-cotizacion.ts), Confirmar pedido
 * (genera un pedido por partida) y Editar, que cambia el resumen por editor-cotizacion.ts. Ya como pedido, enlaza a
 * sus pedidos (pedido.ts).
 */
@Component({
  selector: 'app-detalle-cotizacion',
  imports: [DecimalPipe, FechaZonaPipe, Icon, ResumenCotizacion, RouterLink, BarraEstados, EditorCotizacion, EnviarCotizacion],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ c().folio }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="flex flex-wrap items-center gap-2 text-lg font-bold outline-none">
            {{ c().folio }}
            <span class="rounded-md px-2 py-0.5 text-xs font-bold {{ estado().clase }}">{{ estado().nombre }}</span>
          </h2>
        }
        <p class="text-sm text-texto-suave">
          {{ c().fecha | fechaZona: c().zonaHoraria }} · {{ c().obrasNombre }} · {{ volumen() | number: '1.0-1' }} m³
        </p>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a
            [routerLink]="['/ventas/cotizaciones', c().id]"
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

    @if (!editando() || pedidos().length || completa()) {
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        @if (!editando()) {
          <div class="flex flex-wrap gap-2">
            @if (puedeModificar()) {
              <!-- Como Odoo: en borrador se resalta Enviar; ya enviada, Confirmar -->
              <button type="button" [class]="enviada() ? botonSecundario : botonPrimario" (click)="enviando.set(true)">
                <ui-icon [icono]="iconos.enviar" [tamano]="16" />Enviar
              </button>
              <button type="button" [class]="enviada() ? botonPrimario : botonSecundario" (click)="confirmar()">
                <ui-icon [icono]="iconos.confirmar" [tamano]="16" />Confirmar pedido
              </button>
              <button #botonEditar type="button" [class]="botonSecundario" (click)="editar()">
                <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
              </button>
            }
            <!-- El mismo PDF que descarga el cliente en el portal -->
            <button
              type="button"
              aria-label="Descargar PDF"
              [class]="botonSecundario + ' disabled:opacity-60'"
              [disabled]="generandoPdf()"
              (click)="descargarPdf()"
            >
              <ui-icon [icono]="iconos.pdf" [tamano]="16" />PDF
            </button>
          </div>
        }
        @if (pedidos().length) {
          <!-- Como los botones de Odoo hacia la orden de venta: sus pedidos (uno por entrega), igual que en el portal -->
          <ul id="pedidos-cotizacion" class="flex flex-wrap gap-2" aria-label="Pedidos de esta cotización">
            @for (p of pedidos(); track p.id) {
              <li>
                <a
                  [routerLink]="['/ventas/ordenes', p.folio]"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-[#E5F0EA] px-2.5 py-1 text-sm font-semibold text-[#2E5E4A] hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                >
                  <ui-icon [icono]="iconos.pedido" [tamano]="15" />Pedido {{ p.folio }} · {{ estadoPedido[p.estado] }}
                </a>
              </li>
            }
          </ul>
        }
        @if (completa()) {
          <!-- Como la barra de estados de Odoo -->
          <app-barra-estados class="ml-auto" etiqueta="Estado de la cotización" [pasos]="pasos()" [actual]="c().estado" />
        }
      </div>
    }
    <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
    <p class="mt-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorPdf() }}</p>

    <div class="mt-3 flex flex-wrap items-end justify-between gap-4">
      <dl class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-texto-suave">Cliente</dt>
        <dd>
          <a
            [routerLink]="['/ventas/clientes', c().clienteId]"
            class="rounded font-medium underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico"
            >{{ c().clienteNombre }}</a
          >
        </dd>
        <dt class="text-texto-suave">Vendedor</dt>
        <dd>{{ c().vendedorNombre }}</dd>
        <dt class="text-texto-suave">Planta</dt>
        <dd>{{ c().plantaNombre }}</dd>
        @if (c().envio; as e) {
          <dt class="text-texto-suave">Enviada</dt>
          <dd>
            {{ e.fecha | fechaZona: c().zonaHoraria }} · {{ e.portal ? 'al portal' : 'por correo' }}, {{ e.correo }}
          </dd>
        }
      </dl>
      <p class="shrink-0 text-right">
        <span class="block text-xs tracking-wide text-texto-suave uppercase">Neto estimado</span>
        <span class="text-lg font-bold">\${{ pesos(c().total) }}</span>
      </p>
    </div>

    @if (editando()) {
      <app-editor-cotizacion
        class="mt-4 border-t border-acero/60 pt-4"
        [c]="c()"
        (listo)="guardar($event)"
        (descartar)="terminar('')"
      />
    } @else {
      <ui-resumen-cotizacion
        class="mt-4 border-t border-acero/60 pt-4"
        [partidas]="c().partidas"
        [descuento]="c().descuento"
        [obras]="obras()"
        [nivel]="completa() ? 2 : 3"
      />
    }

    <app-enviar-cotizacion [c]="c()" [(abierto)]="enviando" (enviada)="aviso.set($event)" />
  `,
})
export class DetalleCotizacion {
  private readonly ventas = inject(VentasService);
  private readonly injector = inject(Injector);

  readonly c = input.required<CotizacionVista>();
  readonly obras = input.required<Obra[]>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = {
    cerrar: X,
    completa: Maximize2,
    enviar: Send,
    confirmar: Check,
    editar: PencilLine,
    siguiente: ChevronRight,
    pedido: ClipboardCheck,
    pdf: Download,
  };
  protected readonly botonPrimario = 'boton-primario h-9 w-auto gap-2 px-3.5 text-sm';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly pesos = pesos;
  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly estado = computed(() => ESTADOS_COTIZACION[this.c().estado]);
  protected readonly volumen = computed(() => this.c().partidas.reduce((t, p) => t + p.volumenM3, 0));
  protected readonly puedeModificar = computed(() => modificable(this.c()));
  protected readonly enviada = computed(() => this.c().estado === 'enviada');
  protected readonly pedidos = computed(() => this.ventas.pedidosDe(this.c().id));
  protected readonly estadoPedido = ESTADO_PEDIDO;
  /** Borrador → Enviada → Pedido; la cancelada termina en Cancelada. */
  protected readonly pasos = computed(() =>
    (['borrador', 'enviada', this.c().estado === 'cancelada' ? 'cancelada' : 'pedido'] as EstadoCotizacion[]).map((id) => ({
      id,
      nombre: ESTADOS_COTIZACION[id].nombre,
    })),
  );

  // Al pasar a otra cotización (otra fila de la lista) se sale de la edición y se borra el aviso. Por id y en un
  // computed: guardar o enviar trae otra versión de la misma cotización y eso no debe borrar el aviso.
  private readonly id = computed(() => this.c().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly enviando = signal(false);
  protected readonly generandoPdf = signal(false);
  protected readonly errorPdf = linkedSignal({ source: this.id, computation: () => '' });

  /** El PDF con el formato de la cotización impresa, como lo descarga el cliente en el portal. */
  protected async descargarPdf(): Promise<void> {
    const c = this.c();
    this.generandoPdf.set(true);
    this.errorPdf.set('');
    try {
      await descargarCotizacionPdf({
        folio: c.folio,
        fecha: new Date(c.fecha),
        cliente: { nombre: c.clienteNombre, correo: this.ventas.cliente(c.clienteId)?.contacto.correo ?? '' },
        partidas: c.partidas,
        obras: this.obras(),
        referencia: c.revision ? `Revisión R${c.revision}` : undefined,
        descuento: c.descuento,
        emitida: true,
      });
    } catch {
      this.errorPdf.set('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      this.generandoPdf.set(false);
    }
  }

  private readonly editor = viewChild(EditorCotizacion);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

  /** Pasa a pedido (sus pedidos aparecen arriba) y el foco va al primero: es a donde se va después. */
  protected confirmar(): void {
    const nuevos = this.ventas.confirmar(this.c().id);
    const folios = LISTA.format(nuevos.map((p) => p.folio));
    this.aviso.set(
      nuevos.length === 1 ? `Se generó el pedido ${folios}.` : `Se generaron ${nuevos.length} pedidos, uno por entrega: ${folios}.`,
    );
    afterNextRender(() => document.querySelector<HTMLElement>('#pedidos-cotizacion a')?.focus(), { injector: this.injector });
  }

  protected editar(): void {
    this.aviso.set('');
    this.editando.set(true);
  }

  protected guardar(cambios: CambiosCotizacion): void {
    const antes = this.c();
    this.ventas.guardar(antes.id, cambios);
    this.terminar(
      antes.estado === 'enviada'
        ? `Cambios guardados como revisión R${antes.revision + 1}. Envíala para que el cliente la vea.`
        : 'Cambios guardados.',
    );
  }

  /** Al salir de la edición el foco vuelve a "Editar" (el botón con el que se entró). */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }
}
