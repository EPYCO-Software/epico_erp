import { Component, ElementRef, computed, effect, inject, input, model, output, resource, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CalendarClock, X } from 'lucide';
import { Icon, METODO_PAGO, MetodoPago, TiemposViaje, textoDuracion } from 'ui';
import { mensajeDe } from '../ventas/datos';
import { fechaEntregaLarga } from '../ventas/confirmar-orden';
import { FilaTablero, FlotaApi, Operador, Viaje, categoriaDe, diasPara, fechaCorta, nombreTipo, textoCapacidad } from './flota-api';

/** Lo que el diálogo necesita de la orden (sirve igual desde la orden y desde el despacho). */
export interface OrdenAsignable {
  id: string;
  folio: string;
  /** ISO 8601 (con offset o UTC). */
  fechaHoraEntrega: string;
  zonaHoraria: string;
  obraNombre: string;
  volumenM3: number;
  metodoPago?: MetodoPago;
  /** Transporte + servicio: cuánto ocupa una olla. */
  tiempos?: TiemposViaje | null;
}

/** Las ollas llevan el concreto (cuentan para los m³); bombas y demás acompañan la orden completa. */
export const llevaConcreto = (tipo: string | null) => !!tipo && categoriaDe(tipo as never) === 'concreto';

const OTRO = '__otro';

/**
 * Asignar una unidad a una orden confirmada: recuerda la entrega y los m³ que faltan, ofrece solo las unidades
 * disponibles a esa hora (las demás con su motivo: taller, documentos vencidos, otro viaje…), el operador (del catálogo
 * o escrito) y el método de pago. Al asignar emite el viaje creado.
 */
@Component({
  selector: 'app-asignar-unidad',
  imports: [DecimalPipe, Icon],
  host: { class: 'contents' },
  template: `
    <dialog
      #dialogo
      [attr.aria-labelledby]="'asignar-titulo-' + orden().id"
      class="glass-strong m-auto w-[min(40rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate (submit)="asignar($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 [id]="'asignar-titulo-' + orden().id" class="text-lg font-bold">Asignar unidad a {{ orden().folio }}</h2>
          <button
            type="button"
            aria-label="Cerrar sin asignar"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            (click)="abierto.set(false)"
          >
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>

        <div class="grid gap-4 px-6 py-5">
          <p class="flex items-center gap-2 rounded-xl bg-white/85 px-4 py-3 font-semibold">
            <ui-icon [icono]="iconos.fecha" [tamano]="18" class="shrink-0 text-epico" />
            <span><span class="inline-block first-letter:uppercase">{{ entrega() }}</span> · {{ orden().obraNombre }} · faltan {{ restante() | number: '1.0-1' }} m³</span>
          </p>

          <fieldset [attr.aria-describedby]="'asignar-unidad-error-' + orden().id">
            <legend class="text-sm font-bold">Unidad</legend>
            @if (tablero.isLoading()) {
              <p class="mt-1 text-sm text-texto-suave">Buscando unidades disponibles…</p>
            } @else if (!opciones().length) {
              <p class="mt-1 text-sm text-texto-suave">No hay unidades activas en la flota. Dalas de alta en Logística → Unidades.</p>
            }
            <div class="mt-1 grid max-h-72 gap-1.5 overflow-y-auto pr-1">
              @for (o of opciones(); track o.equipo.id) {
                <label
                  class="flex cursor-pointer items-start gap-2 rounded-lg border border-acero/80 bg-white/80 px-3 py-2 text-sm has-checked:border-epico has-checked:bg-epico/8 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <input
                    type="radio"
                    class="casilla mt-0.5 rounded-full"
                    [name]="'asignar-unidad-' + orden().id"
                    [value]="o.equipo.id"
                    [checked]="equipoId() === o.equipo.id"
                    [disabled]="!o.disponible"
                    (change)="elegir(o)"
                  />
                  <span class="min-w-0">
                    <span class="font-semibold tabular-nums">{{ o.equipo.numeroEconomico }}</span>
                    <span class="text-texto-suave"> · {{ nombreTipo(o.equipo.tipo) }} · {{ capacidad(o.equipo) }} · {{ o.plantaNombre }}</span>
                    @if (!o.disponible) {
                      <span class="block text-xs font-semibold text-[#8E332C]">{{ o.motivo || 'No disponible' }}</span>
                    } @else if (habitual(o); as h) {
                      <span class="block text-xs text-texto-suave">Operador habitual: {{ h }}</span>
                    }
                  </span>
                </label>
              }
            </div>
            <p [id]="'asignar-unidad-error-' + orden().id" class="mt-1 text-sm font-medium text-critico empty:hidden">
              {{ intento() && !equipoId() ? 'Elige una unidad disponible.' : '' }}
            </p>
          </fieldset>

          @if (ventana(); as v) {
            <p class="rounded-lg bg-[#E6F0F4] px-3 py-2 text-sm text-[#24485A]">{{ v }}</p>
          }

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label [for]="'asignar-operador-' + orden().id" class="block text-sm font-bold">Operador</label>
              <select
                [id]="'asignar-operador-' + orden().id"
                class="campo mt-1 h-10 px-2"
                [attr.aria-invalid]="!!errorOperador()"
                [attr.aria-describedby]="'asignar-operador-error-' + orden().id"
                (change)="operadorId.set($any($event.target).value)"
              >
                <option value="" [selected]="!operadorId()">Sin operador por ahora</option>
                @for (op of operadores(); track op.id) {
                  <option [value]="op.id" [selected]="op.id === operadorId()">{{ op.nombre }}{{ licenciaVencida(op) ? ' (licencia vencida)' : '' }}</option>
                }
                <option [value]="otro" [selected]="operadorId() === otro">Otro (escribir nombre)</option>
              </select>
              <p [id]="'asignar-operador-error-' + orden().id" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ errorOperador() }}</p>
              @if (operadorId() === otro) {
                <label [for]="'asignar-operador-nombre-' + orden().id" class="sr-only">Nombre del operador</label>
                <input
                  [id]="'asignar-operador-nombre-' + orden().id"
                  class="campo mt-2 h-10 px-3"
                  autocomplete="off"
                  placeholder="Nombre del operador"
                  [value]="operadorNombre()"
                  (input)="operadorNombre.set($any($event.target).value)"
                />
              }
            </div>
            @if (concreto()) {
              <div>
                <label [for]="'asignar-m3-' + orden().id" class="block text-sm font-bold">m³ en este viaje</label>
                <input
                  [id]="'asignar-m3-' + orden().id"
                  type="number"
                  step="0.5"
                  class="campo mt-1 h-10 px-3 text-right tabular-nums"
                  [attr.aria-invalid]="!!errorM3()"
                  [attr.aria-describedby]="'asignar-m3-error-' + orden().id"
                  [value]="m3() ?? ''"
                  (input)="m3.set($any($event.target).valueAsNumber || null)"
                />
                <p [id]="'asignar-m3-error-' + orden().id" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ errorM3() }}</p>
              </div>
            }
            <div>
              <label [for]="'asignar-metodo-' + orden().id" class="block text-sm font-bold">Método de pago</label>
              <select
                [id]="'asignar-metodo-' + orden().id"
                class="campo mt-1 h-10 px-2"
                [attr.aria-invalid]="intento() && metodoPago() === 'sin_metodo'"
                [attr.aria-describedby]="'asignar-metodo-error-' + orden().id"
                (change)="metodoPago.set($any($event.target).value)"
              >
                @for (m of metodos; track m.id) {
                  <option [value]="m.id" [selected]="m.id === metodoPago()">{{ m.nombre }}</option>
                }
              </select>
              <p [id]="'asignar-metodo-error-' + orden().id" class="mt-1 text-sm font-medium text-critico empty:hidden">
                {{ intento() && metodoPago() === 'sin_metodo' ? 'Indica cómo paga el cliente.' : '' }}
              </p>
            </div>
          </div>
          <p class="text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
        </div>

        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto px-5" [disabled]="ocupado()">Asignar unidad</button>
          <button type="button" [class]="secundario" (click)="abierto.set(false)">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class AsignarUnidad {
  private readonly api = inject(FlotaApi);

  readonly orden = input.required<OrdenAsignable>();
  /** m³ que aún no llevan las ollas. */
  readonly restante = input.required<number>();
  readonly abierto = model(false);
  readonly asignado = output<Viaje>();

  protected readonly iconos = { cerrar: X, fecha: CalendarClock };
  protected readonly otro = OTRO;
  protected readonly nombreTipo = nombreTipo;
  protected readonly capacidad = textoCapacidad;
  protected readonly metodos = (Object.keys(METODO_PAGO) as MetodoPago[]).map((id) => ({ id, nombre: METODO_PAGO[id] }));
  protected readonly secundario =
    'inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly intento = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly equipoId = signal<string | null>(null);
  protected readonly operadorId = signal('');
  protected readonly operadorNombre = signal('');
  protected readonly m3 = signal<number | null>(null);
  protected readonly metodoPago = signal<MetodoPago>('sin_metodo');

  protected readonly tablero = resource({
    params: () => (this.abierto() ? this.orden().id : undefined),
    loader: ({ params }) => this.api.tablero(params),
  });
  /** El catálogo de operadores; sin permiso o sin catálogo aún, vacío (queda "Otro"). */
  private readonly catalogo = resource({
    params: () => (this.abierto() ? true : undefined),
    loader: () => this.api.lista<Operador>('operadores').catch(() => [] as Operador[]),
  });
  protected readonly operadores = computed(() => (this.catalogo.value() ?? []).filter((o) => o.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));

  private readonly orden_: Record<string, number> = { concreto: 0, bombeo: 1, carga: 2, maquinaria: 3, otro: 4 };
  /** Activas; primero las disponibles, por categoría (ollas, bombas…) y número. */
  protected readonly opciones = computed(() =>
    (this.tablero.hasValue() ? (this.tablero.value()?.equipos ?? []) : [])
      .filter((f) => f.equipo.activo)
      .sort(
        (a, b) =>
          Number(b.disponible) - Number(a.disponible) ||
          this.orden_[categoriaDe(a.equipo.tipo)] - this.orden_[categoriaDe(b.equipo.tipo)] ||
          a.equipo.numeroEconomico.localeCompare(b.equipo.numeroEconomico, 'es', { numeric: true }),
      ),
  );
  private readonly elegida = computed(() => this.opciones().find((o) => o.equipo.id === this.equipoId()));
  protected readonly concreto = computed(() => llevaConcreto(this.elegida()?.equipo.tipo ?? null));
  /** Lo que ocupará la unidad (olla: transporte + descarga); bombas y demás, según el servicio de su producto. */
  protected readonly ventana = computed(() => {
    const t = this.orden().tiempos;
    if (!t || !this.equipoId()) return '';
    if (!this.concreto()) return `La ocupará según el tiempo de servicio de su producto, más ${textoDuracion(t.transporteMin)} de transporte.`;
    const salida = Date.parse(this.orden().fechaHoraEntrega) - (t.transporteMin / 2) * 60_000;
    const h = (ms: number) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: this.orden().zonaHoraria }).format(new Date(ms));
    return `Queda ocupada de ${h(salida)} a ${h(salida + t.totalMin * 60_000)} (${textoDuracion(t.totalMin)}: ${textoDuracion(t.transporteMin)} de transporte + ${textoDuracion(t.servicioMin)} de servicio).`;
  });
  protected readonly entrega = computed(() => fechaEntregaLarga(this.orden().fechaHoraEntrega, this.orden().zonaHoraria));
  protected readonly errorM3 = computed(() => {
    if (!this.intento() || !this.concreto()) return '';
    const v = this.m3();
    if (!v || v <= 0) return 'Escribe los m³ de este viaje.';
    if (v > this.restante()) return `Quedan ${this.restante()} m³ por asignar.`;
    return '';
  });
  /** La licencia debe estar vigente el día de la entrega (el backend también lo revisa). */
  protected licenciaVencida(o: Operador): boolean {
    return !!o.licenciaVence && diasPara(o.licenciaVence, new Date(this.orden().fechaHoraEntrega)) < 0;
  }
  protected readonly errorOperador = computed(() => {
    const op = this.operadores().find((o) => o.id === this.operadorId());
    if (op && this.licenciaVencida(op)) return `La licencia de ${op.nombre} venció el ${fechaCorta(op.licenciaVence!)}.`;
    if (this.intento() && this.operadorId() === OTRO && !this.operadorNombre().trim()) return 'Escribe el nombre del operador.';
    return '';
  });
  protected habitual(o: FilaTablero): string | null {
    return o.operador?.nombre ?? this.operadores().find((x) => x.id === o.equipo.operadorId)?.nombre ?? o.equipo.operadorNombre;
  }

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        this.limpiar();
        d.showModal();
      } else if (!this.abierto() && d.open) d.close();
    });
  }

  private limpiar(): void {
    this.intento.set(false);
    this.error.set('');
    this.equipoId.set(null);
    this.operadorId.set('');
    this.operadorNombre.set('');
    this.m3.set(null);
    this.metodoPago.set(this.orden().metodoPago ?? 'sin_metodo');
  }

  protected elegir(o: FilaTablero): void {
    this.equipoId.set(o.equipo.id);
    // Su operador habitual: el del catálogo o, si solo hay nombre, escrito
    if (o.equipo.operadorId) this.operadorId.set(o.equipo.operadorId);
    else if (o.equipo.operadorNombre) {
      this.operadorId.set(OTRO);
      this.operadorNombre.set(o.equipo.operadorNombre);
    } else this.operadorId.set('');
    // La olla se llena hasta su capacidad o lo que falte
    if (llevaConcreto(o.equipo.tipo)) this.m3.set(Math.min(o.equipo.capacidad ?? this.restante(), this.restante()) || null);
  }

  protected async asignar(e: Event): Promise<void> {
    e.preventDefault();
    this.intento.set(true);
    if (!this.equipoId() || this.errorM3() || this.errorOperador() || this.metodoPago() === 'sin_metodo') return;
    this.ocupado.set(true);
    this.error.set('');
    const delCatalogo = this.operadorId() && this.operadorId() !== OTRO ? this.operadorId() : null;
    try {
      const v = await this.api.asignar(this.orden().id, {
        equipoId: this.equipoId()!,
        operadorId: delCatalogo,
        operadorNombre: delCatalogo ? null : this.operadorNombre().trim() || null,
        // Bombas y demás acompañan toda la orden
        volumenM3: this.concreto() ? this.m3()! : this.orden().volumenM3,
        ...(this.metodoPago() !== this.orden().metodoPago ? { metodoPago: this.metodoPago() } : {}),
      });
      this.abierto.set(false);
      this.asignado.emit(v);
    } catch (err) {
      this.error.set(mensajeDe(err));
      this.tablero.reload();
    } finally {
      this.ocupado.set(false);
    }
  }
}
