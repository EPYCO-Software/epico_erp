import { Component, ElementRef, computed, effect, inject, input, output, resource, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FileText, PenLine, Truck, X } from 'lucide';
import { Icon, MapaSeguimiento, METODO_PAGO, PedidoVista, PuntoMapa, textoDuracion } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { ACCION_VIAJE, ESTADO_VIAJE, FlotaApi, Viaje, gestionable, nombreTipo, siguienteEstado, textoVentana } from '../flota/flota-api';
import { AsignarUnidad, llevaConcreto } from '../flota/asignar-unidad';
import { Firma } from '../flota/firma';
import { aDataUrl, remisionPdf } from '../flota/documentos-pdf';
import { VentasService, mensajeDe } from './datos';

/**
 * Logística de una orden confirmada: sus unidades (cada una es un viaje/remisión), el método de pago, el avance de cada
 * viaje (Programado › Cargando › En ruta › En obra › Regresando › Terminado) y, si la unidad tiene GPS (Traccar), su
 * posición en el mapa. "Asignar unidad" (asignar-unidad.ts) solo ofrece las disponibles para la hora de la entrega.
 */
@Component({
  selector: 'app-viajes-pedido',
  imports: [DecimalPipe, Icon, MapaSeguimiento, RouterLink, AsignarUnidad, Firma],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="viajes-titulo" class="rounded-xl bg-white/70 p-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        @if (nivel() === 2) {
          <h2 id="viajes-titulo" class="font-semibold">Unidades y seguimiento</h2>
        } @else {
          <h3 id="viajes-titulo" class="font-semibold">Unidades y seguimiento</h3>
        }
        @if (asignable() && puede('operacion.remisiones.crear')) {
          <button type="button" class="boton-primario h-9 w-auto px-3.5 text-sm" (click)="abierto.set(true)">
            <ui-icon [icono]="iconoCamion" [tamano]="16" />Asignar unidad
          </button>
        }
      </div>

      @if (pendiente()) {
        <p class="mt-1 text-sm text-texto-suave">Confirma la orden (o envía el requerimiento a planta) para asignarle unidades.</p>
      } @else {
        @if (p().tiempos; as t) {
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Tiempo de viaje: <strong>{{ duracion(t.totalMin) }}</strong>
              <span class="text-texto-suave">&nbsp;({{ duracion(t.transporteMin) }} de transporte{{ t.transporteCalculado ? ', por la distancia' : '' }} + {{ duracion(t.servicioMin) }} de servicio)</span>
            </span>
            @if (puedeTiempos() && !editandoTiempo()) {
              <button type="button" [class]="botonChico" (click)="editarTiempo()">Cambiar transporte</button>
            }
          </div>
          @if (editandoTiempo()) {
            <form novalidate class="mt-2 flex flex-wrap items-end gap-2" (submit)="guardarTiempo($event)">
              <div>
                <label for="viajes-transporte" class="block text-xs font-bold">Transporte ida y vuelta (min)</label>
                <input
                  id="viajes-transporte"
                  type="number"
                  step="5"
                  class="campo mt-1 h-8 w-32 px-2 text-right tabular-nums"
                  [attr.aria-invalid]="!!errorTiempo()"
                  aria-describedby="viajes-transporte-error"
                  [value]="transporte() ?? ''"
                  (input)="transporte.set($any($event.target).valueAsNumber || null)"
                />
              </div>
              <button type="submit" class="boton-primario h-8 w-auto px-3 text-xs" [disabled]="ocupado()">Guardar</button>
              <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="usarCalculado()">Usar el de la distancia</button>
              <button type="button" [class]="botonChico" (click)="editandoTiempo.set(false)">Cancelar</button>
              <p id="viajes-transporte-error" class="w-full text-sm font-medium text-critico empty:hidden">{{ errorTiempo() }}</p>
            </form>
          }
        }
        <p class="mt-1 text-sm text-texto-suave">
          {{ asignados() | number: '1.0-1' }} de {{ p().volumenM3 | number: '1.0-1' }} m³ asignados en ollas
          @if (restante() > 0) {
            · <strong class="text-carbon">faltan {{ restante() | number: '1.0-1' }} m³</strong>
          }
          · Pago: {{ metodo() }}
        </p>
        @if (viajes.isLoading() && !viajes.hasValue()) {
          <p class="mt-2 text-sm text-texto-suave">Cargando unidades…</p>
        }
        @if (lista().length) {
          <ul class="mt-2 grid gap-2" aria-label="Unidades de la orden">
            @for (v of lista(); track v.id) {
              <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 px-3 py-2 text-sm">
                <div class="min-w-0">
                  <p class="font-semibold">
                    @if (v.equipoId) {
                      <a [routerLink]="['/flota/unidades', v.equipoId]" class="underline-offset-4 hover:text-epico hover:underline">{{ v.numeroEconomico }}</a>
                    } @else {
                      Sin unidad
                    }
                    <span class="font-normal text-texto-suave">&nbsp;· {{ tipo(v) }}{{ llevaConcreto(v.tipoEquipo) ? ' · ' + (v.volumenM3 | number: '1.0-1') + ' m³' : '' }}</span>
                  </p>
                  <p class="text-texto-suave">
                    {{ v.operadorNombre || 'Sin operador' }} · {{ v.folio }}{{ ventana(v) ? ' · ocupa ' + ventana(v) : '' }}{{ textoPosicion(v) }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-md bg-[#E6F0F4] px-2 py-0.5 text-xs font-bold text-[#2B5F75]">{{ estadoViaje[v.estado] }}</span>
                  <button type="button" [class]="botonChico + ' gap-1'" [disabled]="ocupado()" (click)="remision(v)">
                    <ui-icon [icono]="iconoPdf" [tamano]="13" />Remisión<span class="sr-only"> {{ v.folio }} en PDF</span>
                  </button>
                  @if (puede('operacion.remisiones.editar') && ['en_obra', 'regresando', 'terminado'].includes(v.estado)) {
                    <button type="button" [class]="botonChico + ' gap-1'" (click)="abrirFirma(v)">
                      <ui-icon [icono]="iconoFirma" [tamano]="13" />Firma<span class="sr-only"> de recibido de {{ v.folio }}</span>
                    </button>
                  }
                  @if (puede('operacion.remisiones.editar')) {
                    @if (siguiente(v); as s) {
                      <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="avanzar(v, s)">
                        {{ accion[s] }}<span class="sr-only"> ({{ v.numeroEconomico }})</span>
                      </button>
                    }
                    @if (v.estado === 'programado') {
                      <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="quitar(v)">
                        Quitar<span class="sr-only"> {{ v.numeroEconomico }}</span>
                      </button>
                    }
                  }
                </div>
              </li>
            }
          </ul>
        } @else if (viajes.hasValue()) {
          <p class="mt-2 text-sm text-texto-suave">Aún no tiene unidades asignadas.</p>
        }
        @if (puntos().length) {
          <ui-mapa-seguimiento class="mt-3 h-64" [puntos]="puntos()" [titulo]="'Mapa de las unidades de la orden ' + p().folio" />
        }
      }
      <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
      <p class="mt-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
    </section>

    <app-asignar-unidad [orden]="p()" [restante]="restante()" [(abierto)]="abierto" (asignado)="asignado($event)" />

    <dialog
      #dialogoFirma
      aria-labelledby="firma-titulo"
      class="glass-strong m-auto w-[min(32rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px]"
      (close)="firmando.set(null)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate (submit)="guardarFirma($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="firma-titulo" class="text-lg font-bold">Firma de recibido · {{ firmando()?.folio }}</h2>
          <button type="button" aria-label="Cerrar sin firmar" class="flex size-11 items-center justify-center rounded-xl text-texto-suave hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico" (click)="firmando.set(null)">
            <ui-icon [icono]="iconoCerrar" />
          </button>
        </div>
        <div class="grid gap-3 px-6 py-5">
          <div>
            <label for="firma-recibe" class="block text-sm font-bold">Nombre de quien recibe</label>
            <input id="firma-recibe" class="campo mt-1 h-10 px-3" autocomplete="name" [attr.aria-invalid]="intentoFirma() && !recibe().trim()" aria-describedby="firma-recibe-error" [value]="recibe()" (input)="recibe.set($any($event.target).value)" />
            <p id="firma-recibe-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intentoFirma() && !recibe().trim() ? 'Escribe quién recibe.' : '' }}</p>
          </div>
          @if (firmando()) {
            <app-firma etiqueta="Firma de quien recibe" />
          }
          <p class="text-sm font-medium text-critico empty:hidden" role="alert">{{ errorFirma() }}</p>
        </div>
        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto px-5" [disabled]="ocupado()">Guardar firma</button>
          <button type="button" class="inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico" (click)="firmando.set(null)">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class ViajesPedido {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly ventas = inject(VentasService);

  readonly p = input.required<PedidoVista>();
  readonly nivel = input<2 | 3>(3);
  /** Tras asignar, avanzar, quitar o cambiar tiempos (quien la usa recarga lo suyo, p. ej. el tablero). */
  readonly cambio = output<void>();

  protected readonly iconoCamion = Truck;
  protected readonly iconoPdf = FileText;
  protected readonly iconoFirma = PenLine;
  protected readonly iconoCerrar = X;
  protected readonly estadoViaje = ESTADO_VIAJE;
  protected readonly accion = ACCION_VIAJE;
  protected readonly siguiente = (v: Viaje) => siguienteEstado(v.estado);
  protected readonly llevaConcreto = llevaConcreto;
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  /** Ni confirmada ni en solicitud de confirmación a planta: aún no se gestiona. */
  protected readonly pendiente = computed(() => !gestionable(this.p()));
  /** Se asignan unidades a una orden confirmada que aún no se entrega ni se cancela. */
  protected readonly asignable = computed(() => !this.pendiente() && !['entregado', 'cancelado'].includes(this.p().estado));
  protected readonly abierto = signal(false);

  protected readonly viajes = resource({
    params: () => (this.pendiente() ? undefined : this.p().id),
    loader: ({ params }) => this.api.viajes(params),
  });
  protected readonly lista = computed(() => (this.viajes.hasValue() ? this.viajes.value() : []));
  protected readonly asignados = computed(() => this.lista().filter((v) => llevaConcreto(v.tipoEquipo)).reduce((t, v) => t + v.volumenM3, 0));
  protected readonly restante = computed(() => Math.max(0, Math.round((this.p().volumenM3 - this.asignados()) * 10) / 10));
  protected readonly metodo = computed(() => METODO_PAGO[this.p().metodoPago ?? 'sin_metodo']);
  protected readonly duracion = textoDuracion;
  protected ventana(v: Viaje): string {
    return textoVentana(v, this.p().zonaHoraria);
  }
  protected readonly puedeTiempos = computed(() => this.puede('operacion.remisiones.editar') || this.puede('ventas.pedidos.editar'));
  protected readonly editandoTiempo = signal(false);
  protected readonly transporte = signal<number | null>(null);
  protected readonly errorTiempo = signal('');
  protected editarTiempo(): void {
    this.errorTiempo.set('');
    this.transporte.set(this.p().tiempos?.transporteMin ?? null);
    this.editandoTiempo.set(true);
  }
  protected async guardarTiempo(e: Event): Promise<void> {
    e.preventDefault();
    const t = this.transporte();
    if (!t || t < 5) return this.errorTiempo.set('Escribe los minutos de ida y vuelta (5 o más).');
    await this.cambiarTiempo(t);
  }
  protected usarCalculado(): Promise<void> {
    return this.cambiarTiempo(null);
  }
  private async cambiarTiempo(min: number | null): Promise<void> {
    this.errorTiempo.set('');
    await this.accionViaje(() => this.api.tiempos(this.p().id, min), min ? `Transporte: ${textoDuracion(min)} ida y vuelta.` : 'Transporte calculado por la distancia.');
    if (!this.error()) this.editandoTiempo.set(false);
  }

  protected tipo(v: Viaje): string {
    return v.tipoEquipo ? nombreTipo(v.tipoEquipo) : 'Unidad';
  }
  protected textoPosicion(v: Viaje): string {
    if (!v.posicion) return '';
    return ` · GPS hace ${Math.max(0, Math.round((Date.now() - Date.parse(v.posicion.fecha)) / 60_000))} min`;
  }
  protected readonly puntos = computed<PuntoMapa[]>(() =>
    this.lista()
      .filter((v) => v.posicion && v.estado !== 'terminado')
      .map((v) => ({ id: v.id, tipo: 'camion' as const, lat: v.posicion!.lat, lng: v.posicion!.lng, etiqueta: v.numeroEconomico ?? v.folio })),
  );

  protected readonly aviso = signal('');
  protected readonly error = signal('');
  protected readonly ocupado = signal(false);

  // ---------- Remisión (PDF) y firma de recibido ----------
  /** El PDF de la remisión de un viaje, con la firma si ya la tiene. */
  protected async remision(v: Viaje): Promise<void> {
    await this.accionViaje(async () => {
      const d = await this.api.remision(v.id);
      const firma = d.firmaArchivoId ? await this.api.urlArchivo(d.firmaArchivoId).then((u) => fetch(u).then((r) => r.blob())).then(aDataUrl).catch(() => null) : null;
      await remisionPdf(d, firma);
    }, `Remisión ${v.folio} descargada.`);
  }
  protected readonly firmando = signal<Viaje | null>(null);
  protected readonly recibe = signal('');
  protected readonly intentoFirma = signal(false);
  protected readonly errorFirma = signal('');
  private readonly firma = viewChild(Firma);
  private readonly dialogoFirma = viewChild.required<ElementRef<HTMLDialogElement>>('dialogoFirma');
  private readonly abrirDialogo = effect(() => {
    const d = this.dialogoFirma().nativeElement;
    if (this.firmando() && !d.open) d.showModal();
    else if (!this.firmando() && d.open) d.close();
  });
  protected abrirFirma(v: Viaje): void {
    this.recibe.set('');
    this.intentoFirma.set(false);
    this.errorFirma.set('');
    this.firmando.set(v);
  }
  protected async guardarFirma(e: Event): Promise<void> {
    e.preventDefault();
    this.intentoFirma.set(true);
    const v = this.firmando();
    if (!v || !this.recibe().trim()) return;
    const png = await this.firma()?.png();
    if (!png) return this.errorFirma.set('Falta la firma.');
    this.ocupado.set(true);
    this.errorFirma.set('');
    try {
      const archivoId = await this.api.subirArchivo(png, `firma-${v.folio}.png`, 'firma', { tipo: 'Remision', id: v.id });
      await this.api.firmar(v.id, archivoId, this.recibe().trim());
      this.firmando.set(null);
      this.aviso.set(`Firma de ${this.recibe().trim()} guardada en ${v.folio}.`);
    } catch (err) {
      this.errorFirma.set(mensajeDe(err));
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async asignado(v: Viaje): Promise<void> {
    this.error.set('');
    await this.recargar();
    this.aviso.set(`${v.numeroEconomico ?? 'Unidad'} asignada a ${this.p().folio}.`);
  }

  protected async avanzar(v: Viaje, estado: NonNullable<ReturnType<typeof siguienteEstado>>): Promise<void> {
    await this.accionViaje(() => this.api.avanzar(v.id, estado), `${v.numeroEconomico ?? v.folio}: ${ESTADO_VIAJE[estado]}.`);
  }

  protected async quitar(v: Viaje): Promise<void> {
    if (!confirm(`¿Quitar ${v.numeroEconomico ?? v.folio} de la orden ${this.p().folio}?`)) return;
    await this.accionViaje(() => this.api.quitar(this.p().id, v.id), `${v.numeroEconomico ?? v.folio} ya no va en esta orden.`);
  }

  private async accionViaje(hacer: () => Promise<unknown>, aviso: string): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    this.error.set('');
    try {
      await hacer();
      await this.recargar();
      this.aviso.set(aviso);
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Sus viajes y la orden (cambian su estado, unidades y método de pago). */
  private async recargar(): Promise<void> {
    this.viajes.reload();
    await this.ventas.refrescarPedido(this.p().id).catch(() => undefined);
    this.cambio.emit();
  }
}
