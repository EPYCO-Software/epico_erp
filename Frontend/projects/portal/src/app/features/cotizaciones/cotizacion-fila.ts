import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ChevronDown, ClipboardCheck, CopyPlus, Download, ExternalLink, LoaderCircle, MapPin, PencilLine } from 'lucide';
import { AuthService, CotizacionGuardada, Icon, ModoEdicion } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { ObrasService } from '../../core/services/obras.service';
import { ESTADO_PEDIDO, PedidosService } from '../../core/services/pedidos.service';
import { MAQUINARIA, SERVICIOS } from '../catalogo/datos';
import { agruparPorObra, fechaHoraCorta, lineasPartida, pesos, totales } from '../catalogo/presupuesto';
import { etiquetas } from '../catalogo/reglas';

/**
 * Una cotización guardada: datos clave, acciones (PDF, modificar, usar como base) y un resumen que se despliega
 * en la misma página, sin modal.
 */
@Component({
  selector: 'app-cotizacion-fila',
  imports: [DecimalPipe, Icon, RouterLink],
  template: `
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="min-w-0">
        <p role="heading" [attr.aria-level]="anidada() ? 3 : 2" class="flex flex-wrap items-center gap-2 font-bold" [class]="anidada() ? 'text-base' : 'text-lg'">
          @if (enlazar()) {
            <a [routerLink]="['/cotizaciones', c().folio]" class="rounded underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico">{{ c().folio }}</a>
          } @else {
            {{ c().folio }}
          }
          @if (vigente()) {
            <span class="rounded-md bg-[#E5F0EA] px-2 py-0.5 text-xs font-semibold text-[#2E5E4A]">Vigente</span>
          } @else if (anidada()) {
            <span class="rounded-md bg-carbon/6 px-2 py-0.5 text-xs font-semibold text-texto-suave">Sustituida</span>
          }
        </p>
        <p class="text-sm text-texto-suave">
          {{ fecha(c().fecha) }} · {{ obras() }} · {{ volumen() | number: '1.0-1' }} m³
          @if (referencia(); as r) {
            · {{ r }}
          }
        </p>
        @if (pedidos().length) {
          <ul class="mt-2 flex flex-wrap gap-2" aria-label="Pedidos generados">
            @for (pe of pedidos(); track pe.id) {
              <li>
                <a
                  [routerLink]="['/pedidos', pe.folio]"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-[#E5F0EA] px-2.5 py-1 text-sm font-semibold text-[#2E5E4A] hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                >
                  <ui-icon [icono]="iconos.pedido" [tamano]="15" />Pedido {{ pe.folio }} · {{ estadoPedido[pe.estado] }}
                </a>
              </li>
            }
          </ul>
        }
      </div>
      <p class="text-right">
        <span class="block text-xs tracking-wide text-texto-suave uppercase">Neto estimado</span>
        <span class="text-lg font-bold">\${{ pesos(total().neto) }}</span>
      </p>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        [class]="boton"
        [attr.aria-expanded]="abierta()"
        [attr.aria-controls]="'detalle-' + c().id"
        (click)="abierta.set(!abierta())"
      >
        <ui-icon [icono]="iconos.desplegar" [tamano]="16" [class.rotate-180]="abierta()" />
        {{ abierta() ? 'Ocultar resumen' : 'Ver resumen' }}<span class="sr-only"> de {{ c().folio }}</span>
      </button>
      <button type="button" [class]="boton" [disabled]="pdf() !== null" [attr.aria-busy]="pdf() === 'abrir'" (click)="verPdf('abrir')">
        <ui-icon [icono]="pdf() === 'abrir' ? iconos.cargando : iconos.abrir" [tamano]="16" [class.animate-spin]="pdf() === 'abrir'" />
        Ver PDF<span class="sr-only"> de {{ c().folio }} en una pestaña nueva</span>
      </button>
      <button type="button" [class]="boton" [disabled]="pdf() !== null" [attr.aria-busy]="pdf() === 'descargar'" (click)="verPdf('descargar')">
        <ui-icon [icono]="pdf() === 'descargar' ? iconos.cargando : iconos.descargar" [tamano]="16" [class.animate-spin]="pdf() === 'descargar'" />
        Descargar<span class="sr-only"> PDF de {{ c().folio }}</span>
      </button>
      <button type="button" [class]="boton" (click)="editar('revision')">
        <ui-icon [icono]="iconos.modificar" [tamano]="16" />Modificar<span class="sr-only"> {{ c().folio }} (crea una revisión)</span>
      </button>
      <button type="button" [class]="boton" (click)="editar('base')">
        <ui-icon [icono]="iconos.base" [tamano]="16" />Usar como base<span class="sr-only"> para una cotización nueva</span>
      </button>
    </div>
    <p class="mt-1 text-sm font-medium text-[#8E332C] empty:hidden" aria-live="polite">{{ error() }}</p>

    @if (abierta()) {
      <div [id]="'detalle-' + c().id" class="mt-4 space-y-4 border-t border-acero/60 pt-4">
        @for (g of grupos(); track g.obra.id) {
          <section [attr.aria-label]="'Entrega en ' + g.obra.nombre">
            <p role="heading" [attr.aria-level]="anidada() ? 4 : 3" class="flex flex-wrap items-center gap-1.5 font-semibold">
              <ui-icon [icono]="iconos.obra" [tamano]="16" class="text-epico" />{{ g.obra.nombre }}
              <span class="font-normal text-texto-suave">· {{ g.obra.direccion }}, {{ g.obra.municipio }}</span>
            </p>
            <ul class="mt-2 space-y-2">
              @for (p of g.partidas; track p.id) {
                <li class="rounded-xl bg-white/80 p-3 text-sm">
                  <p class="flex flex-wrap justify-between gap-x-4">
                    <span class="font-semibold">{{ p.nombre }} · {{ p.volumenM3 | number: '1.0-1' }} m³</span>
                    <span>Entrega {{ fecha(p.entrega) }}</span>
                  </p>
                  <p class="mt-0.5 text-texto-suave">{{ etiquetas(p).join(' · ') }}</p>
                  @if (servicios(p); as sv) {
                    <p class="mt-0.5 text-texto-suave">Servicios: {{ sv }}</p>
                  }
                  <ul class="mt-2 divide-y divide-acero/30 border-t border-acero/40">
                    @for (l of lineas(p); track $index) {
                      <li class="flex justify-between gap-4 py-1">
                        <span>{{ l.concepto }} <span class="text-texto-suave">({{ l.cantidad | number: '1.0-2' }} {{ l.unidad }} × \${{ pesos(l.precio) }})</span></span>
                        <span class="font-medium whitespace-nowrap">\${{ pesos(l.importe) }}</span>
                      </li>
                    }
                  </ul>
                </li>
              }
            </ul>
          </section>
        }
        <dl class="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt class="text-texto-suave">Subtotal</dt>
          <dd class="text-right">\${{ pesos(total().subtotal) }}</dd>
          <dt class="text-texto-suave">IVA 16%</dt>
          <dd class="text-right">\${{ pesos(total().iva) }}</dd>
          <dt class="font-bold">Neto</dt>
          <dd class="text-right font-bold">\${{ pesos(total().neto) }}</dd>
        </dl>
      </div>
    }
  `,
})
export class CotizacionFila {
  readonly c = input.required<CotizacionGuardada>();
  /** Versión anterior mostrada dentro de su serie. */
  readonly anidada = input(false);
  /** Versión más reciente de una serie con revisiones. */
  readonly vigente = input(false);
  /** Resumen desplegado al iniciar (página de detalle). */
  readonly expandida = input(false);
  /** El folio enlaza a la página de la cotización (no, si ya se está en ella). */
  readonly enlazar = input(true);

  private readonly cotizacion = inject(CotizacionService);
  private readonly obrasService = inject(ObrasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly pedidosService = inject(PedidosService);
  protected readonly estadoPedido = ESTADO_PEDIDO;
  protected readonly pedidos = computed(() => this.pedidosService.deCotizacion(this.c().id));

  protected readonly iconos = {
    desplegar: ChevronDown, abrir: ExternalLink, descargar: Download, cargando: LoaderCircle,
    modificar: PencilLine, base: CopyPlus, obra: MapPin, pedido: ClipboardCheck,
  };
  protected readonly boton =
    'inline-flex h-10 items-center gap-1.5 rounded-lg border border-acero-oscuro bg-white px-3 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-60';
  protected readonly abierta = linkedSignal(() => this.expandida());
  protected readonly pdf = signal<'abrir' | 'descargar' | null>(null);
  protected readonly error = signal('');

  protected readonly fecha = fechaHoraCorta;
  protected readonly pesos = pesos;
  protected readonly lineas = lineasPartida;
  protected readonly etiquetas = (p: CotizacionGuardada['partidas'][number]) => etiquetas(p.especificacion);
  protected readonly grupos = computed(() => agruparPorObra(this.c().partidas, this.obrasService.obras()));
  protected readonly obras = computed(() => this.grupos().map((g) => g.obra.nombre).join(', '));
  protected readonly volumen = computed(() => this.c().partidas.reduce((t, p) => t + p.volumenM3, 0));
  protected readonly total = computed(() => totales(this.c().partidas.flatMap(lineasPartida)));
  protected readonly referencia = computed(() => this.cotizacion.referencia(this.c()));

  protected servicios(p: CotizacionGuardada['partidas'][number]): string {
    const sv = SERVICIOS.filter((s) => p.servicios.includes(s.id) && s.id !== 'renta-maquinaria').map((s) => s.nombre);
    const mq = p.maquinaria.map((m) => `${MAQUINARIA.find((x) => x.id === m.tipo)!.nombre} (${m.dias} ${m.dias === 1 ? 'día' : 'días'})`);
    return [...sv, ...mq].join(', ');
  }

  protected async verPdf(modo: 'abrir' | 'descargar'): Promise<void> {
    const c = this.c();
    this.pdf.set(modo);
    this.error.set('');
    try {
      const { abrirCotizacionPdf, descargarCotizacionPdf } = await import('../catalogo/pdf-cotizacion');
      const datos = {
        folio: c.folio, fecha: new Date(c.fecha), partidas: c.partidas, obras: this.obrasService.obras(),
        cliente: this.auth.sesion()?.usuario ?? { nombre: 'Cliente', correo: '' },
        referencia: this.referencia() ?? undefined,
      };
      await (modo === 'abrir' ? abrirCotizacionPdf(datos) : descargarCotizacionPdf(datos));
    } catch {
      this.error.set('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      this.pdf.set(null);
    }
  }

  /** Lleva la cotización al catálogo: como revisión de su serie o como base de una nueva. */
  protected editar(modo: ModoEdicion): void {
    const enCurso = this.cotizacion.partidas().length;
    if (enCurso && !confirm(`Tienes ${enCurso} ${enCurso === 1 ? 'producto' : 'productos'} en una cotización sin guardar. ¿Reemplazarlos?`)) return;
    this.cotizacion.editar(this.c(), modo);
    void this.router.navigateByUrl('/catalogo');
  }
}
