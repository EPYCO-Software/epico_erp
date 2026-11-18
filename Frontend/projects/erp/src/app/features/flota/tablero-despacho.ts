import { Component, DestroyRef, computed, inject, input, output, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChevronLeft, ChevronRight, Truck } from 'lucide';
import { DEFAULT_TIMEZONE, FiltrosElegidos, Icon, pasaFiltro, textoDuracion } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { enZona, horasVisibles, sumarDias } from '../ventas/calendario-entregas';
import {
  ACCION_VIAJE,
  COLUMNAS_DESPACHO,
  ColumnaDespacho,
  FilaDespacho,
  FlotaApi,
  NOMBRE_COLUMNA,
  PedidoDespacho,
  TarjetaDespacho,
  Viaje,
  columnasDespacho,
  nombreTipo,
  siguienteEstado,
  textoVentana,
} from './flota-api';
import { AsignarUnidad, OrdenAsignable, llevaConcreto } from './asignar-unidad';
import { plantasFlota } from './plantas-flota';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const REFRESCO_MS = 30_000;

/** La hora (0–23) en la que va una tarjeta: la orden, a la de su entrega; el viaje, a la de su salida (o la entrega). */
export function horaTarjeta(t: TarjetaDespacho): number {
  const iso = t.tipo === 'viaje' ? (t.viaje.salidaProgramada ?? t.pedido.fechaHoraEntrega) : t.pedido.fechaHoraEntrega;
  return Number(enZona(iso, t.pedido.zonaHoraria).hora.slice(0, 2));
}

/**
 * El día de entregas como tablero: columnas Por asignar › Programado › Cargando › En ruta › En obra › Regresando ›
 * Terminado y, como el calendario, una fila por hora con su línea (06:00–20:00, ampliado si hay antes o después; las
 * horas vacías quedan delgadas). Desde la tarjeta se asigna unidad y se avanza el viaje; clic en el folio abre la orden
 * en la vista previa de quien lo usa (salida `abrir`). Se actualiza cada 30 s. Lo usan Despacho y Logística → Órdenes.
 */
@Component({
  selector: 'app-tablero-despacho',
  imports: [DecimalPipe, Icon, RouterLink, AsignarUnidad],
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center gap-3 border-b border-acero/50 px-4 py-2.5">
      <button type="button" [class]="boton" [disabled]="dia() === hoy" (click)="dia.set(hoy)">Hoy</button>
      <div class="flex">
        <button type="button" aria-label="Día anterior" [class]="botonIcono" (click)="mover(-1)"><ui-icon [icono]="iconos.antes" [tamano]="18" /></button>
        <button type="button" aria-label="Día siguiente" [class]="botonIcono" (click)="mover(1)"><ui-icon [icono]="iconos.despues" [tamano]="18" /></button>
      </div>
      <label for="despacho-fecha" class="sr-only">Día del despacho</label>
      <input id="despacho-fecha" type="date" class="campo h-9 w-auto px-2 text-sm" [value]="dia()" (change)="elegirDia($any($event.target).value)" />
      <h2 class="text-lg font-bold first-letter:uppercase">{{ titulo() }}</h2>
      <p class="ml-auto text-sm text-texto-suave">{{ resumen() }} · {{ datos.isLoading() ? 'actualizando…' : 'se actualiza cada 30 s' }}</p>
    </div>
    @if (error()) {
      <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
    }
    <p class="border-b border-acero/50 px-4 py-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>

    <div tabindex="0" role="region" aria-label="Tablero del despacho por hora" class="overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico">
      <table class="w-full min-w-[96rem] table-fixed border-separate border-spacing-0 text-sm">
        <caption class="sr-only">Entregas del día por hora y por estado. Clic en el folio abre la orden.</caption>
        <colgroup>
          <col class="w-16" />
          @for (c of columnas; track c) {
            <col />
          }
        </colgroup>
        <thead>
          <tr>
            <th scope="col" class="sticky left-0 z-1 bg-white/95"><span class="sr-only">Hora</span></th>
            @for (c of columnas; track c) {
              <th scope="col" class="border-b border-l border-acero/50 bg-white/95 px-3 py-2 text-left font-bold">
                <span class="flex items-center justify-between gap-2">
                  {{ nombre[c] }}
                  <span class="rounded-full bg-carbon/8 px-2 text-xs tabular-nums">{{ tablero()[c].length }}</span>
                </span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (h of horas(); track h.hora) {
            <tr>
              <th scope="row" class="sticky left-0 z-1 border-t border-acero/40 bg-white/90 pr-2 text-right align-top font-normal text-texto-suave tabular-nums" [class]="h.ocupada ? 'pt-2' : 'h-6 py-0 text-[11px] leading-6'">
                {{ h.etiqueta }}
              </th>
              @for (c of columnas; track c) {
                <td class="border-t border-l border-acero/40 align-top" [class]="h.ocupada ? 'p-1.5' : 'h-6 p-0'">
                  @if (celdas().get(c + ':' + h.hora); as lista) {
                    <ul class="grid grid-cols-1 gap-1.5">
                      @for (t of lista; track t.id) {
                        <li
                          class="min-w-0 rounded-xl bg-white/95 px-3 py-2 shadow-[0_1px_2px_rgb(0_0_0/0.06)] aria-current:ring-2 aria-current:ring-epico"
                          [class.border-l-4]="c === 'por_asignar'"
                          [class.border-epico]="c === 'por_asignar'"
                          [attr.aria-current]="t.pedido.id === abiertaId() ? 'true' : null"
                        >
                          <p class="flex items-baseline justify-between gap-2">
                            <button
                              type="button"
                              class="min-w-0 truncate rounded font-bold whitespace-nowrap underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                              [title]="'Ver ' + t.pedido.folio"
                              (click)="abrir.emit(t.pedido.id)"
                            >
                              {{ t.pedido.folio }}
                            </button>
                            <span class="shrink-0 font-semibold tabular-nums">{{ hora(t.pedido) }}</span>
                          </p>
                          <p class="truncate text-xs text-texto-suave" [title]="t.pedido.clienteNombre + ' · ' + t.pedido.obraNombre">{{ t.pedido.clienteNombre }} · {{ t.pedido.obraNombre }}</p>
                          @if (t.tipo === 'orden') {
                            <p class="mt-1 text-xs">
                              <strong>Faltan {{ t.faltan | number: '1.0-1' }} m³</strong>
                              @if (t.pedido.tiempos; as ti) {
                                <span class="text-texto-suave"> · viaje de {{ duracion(ti.totalMin) }}</span>
                              }
                            </p>
                            @if (!t.pedido.confirmadaEn) {
                              <p class="text-xs font-semibold text-[#2B5F75]">Solicitud de confirmación</p>
                            }
                            @if (puede('operacion.remisiones.crear')) {
                              <button type="button" class="boton-primario mt-2 h-8 w-full px-3 text-xs" (click)="asignar(t.pedido, t.faltan)">
                                <ui-icon [icono]="iconos.camion" [tamano]="14" />Asignar unidad<span class="sr-only"> a {{ t.pedido.folio }}</span>
                              </button>
                            }
                          } @else {
                            <p class="mt-1 text-xs">
                              @if (t.viaje.equipoId) {
                                <a [routerLink]="['/flota/unidades', t.viaje.equipoId]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ t.viaje.numeroEconomico }}</a>
                              }
                              <span class="text-texto-suave"> · {{ tipo(t.viaje) }}{{ llevaConcreto(t.viaje.tipoEquipo) ? ' · ' + (t.viaje.volumenM3 | number: '1.0-1') + ' m³' : '' }}</span>
                            </p>
                            <p class="truncate text-xs text-texto-suave">
                              {{ t.viaje.operadorNombre || 'Sin operador' }}{{ ventana(t.viaje, t.pedido.zonaHoraria) ? ' · ' + ventana(t.viaje, t.pedido.zonaHoraria) : '' }}
                            </p>
                            @if (puede('operacion.remisiones.editar') && siguiente(t.viaje); as s) {
                              <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="avanzar(t.viaje, s)">
                                {{ accion[s] }}<span class="sr-only"> ({{ t.viaje.numeroEconomico }}, {{ t.pedido.folio }})</span>
                              </button>
                            }
                          }
                        </li>
                      }
                    </ul>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
      @if (!visibles().length) {
        <p class="px-4 py-8 text-center text-sm text-texto-suave">{{ datos.isLoading() ? 'Cargando el día…' : 'No hay entregas este día con esta búsqueda.' }}</p>
      }
    </div>

    @if (porAsignar(); as o) {
      <app-asignar-unidad [orden]="o.orden" [restante]="o.faltan" [(abierto)]="abierto" (asignado)="asignado($event)" />
    }
  `,
})
export class TableroDespacho {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly ventas = inject(VentasService);
  private readonly plantas = plantasFlota();
  private readonly zona = inject(DEFAULT_TIMEZONE);

  /** Búsqueda y filtros del buscador de la página. */
  readonly texto = input('');
  readonly filtros = input<FiltrosElegidos>({});
  readonly abiertaId = input<string | null>(null);
  /** Clic en el folio: el id del pedido. */
  readonly abrir = output<string>();

  protected readonly iconos = { antes: ChevronLeft, despues: ChevronRight, camion: Truck };
  protected readonly columnas = COLUMNAS_DESPACHO;
  protected readonly nombre = NOMBRE_COLUMNA;
  protected readonly accion = ACCION_VIAJE;
  protected readonly llevaConcreto = llevaConcreto;
  protected readonly duracion = textoDuracion;
  protected readonly ventana = textoVentana;
  protected readonly siguiente = (v: Viaje) => siguienteEstado(v.estado);
  protected readonly boton =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonChico =
    'mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  readonly hoy = enZona(new Date().toISOString(), this.zona).dia;
  readonly dia = signal(this.hoy);
  protected readonly titulo = computed(() =>
    new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(this.dia() + 'T12:00:00Z')),
  );
  protected mover(n: number): void {
    this.dia.update((d) => sumarDias(d, n));
  }
  protected elegirDia(v: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) this.dia.set(v);
  }

  protected readonly datos = resource({ params: () => (this.ventas.conBackend ? this.dia() : undefined), loader: ({ params }) => this.api.despacho(params) });
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  /** Lo del día, de las plantas elegidas en el encabezado (para los filtros de la página). */
  readonly filas = computed<FilaDespacho[]>(() => (this.datos.hasValue() ? this.datos.value() : []).filter((f) => this.plantas.visible([f.pedido.sucursalId])));

  constructor() {
    if (!this.ventas.conBackend) return;
    const t = setInterval(() => this.datos.reload(), REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  readonly visibles = computed(() => {
    const q = normalizar(this.texto().trim());
    const f = this.filtros();
    return this.filas().filter(
      (x) =>
        (!q || normalizar([x.pedido.folio, x.pedido.clienteNombre, x.pedido.obraNombre, ...x.viajes.map((v) => v.numeroEconomico ?? '')].join(' ')).includes(q)) &&
        pasaFiltro(f, 'planta', x.pedido.plantaNombre) &&
        pasaFiltro(f, 'cliente', x.pedido.clienteNombre),
    );
  });
  protected readonly tablero = computed<Record<ColumnaDespacho, TarjetaDespacho[]>>(() => columnasDespacho(this.visibles()));
  /** Tarjetas por "columna:hora", ordenadas por hora exacta. */
  protected readonly celdas = computed(() => {
    const m = new Map<string, TarjetaDespacho[]>();
    for (const c of COLUMNAS_DESPACHO) {
      for (const t of [...this.tablero()[c]].sort((a, b) => this.instante(a) - this.instante(b))) {
        const k = `${c}:${horaTarjeta(t)}`;
        m.set(k, [...(m.get(k) ?? []), t]);
      }
    }
    return m;
  });
  private instante(t: TarjetaDespacho): number {
    return Date.parse(t.tipo === 'viaje' ? (t.viaje.salidaProgramada ?? t.pedido.fechaHoraEntrega) : t.pedido.fechaHoraEntrega);
  }
  protected readonly horas = computed(() => {
    const todas = COLUMNAS_DESPACHO.flatMap((c) => this.tablero()[c]);
    return horasVisibles(todas.map((t) => ({ hora: String(horaTarjeta(t)).padStart(2, '0') + ':00' })) as never);
  });
  readonly resumen = computed(() => {
    const f = this.visibles().filter((x) => x.pedido.estado !== 'cancelado');
    const m3 = f.reduce((t, x) => t + x.pedido.volumenM3, 0);
    return `${f.length} ${f.length === 1 ? 'orden' : 'órdenes'} · ${m3.toLocaleString('es-MX')} m³`;
  });

  protected hora(p: PedidoDespacho): string {
    return enZona(p.fechaHoraEntrega, p.zonaHoraria).hora;
  }
  protected tipo(v: Viaje): string {
    return v.tipoEquipo ? nombreTipo(v.tipoEquipo) : 'Unidad';
  }

  /** Para que la página recargue después de un cambio hecho en su vista previa. */
  recargar(): void {
    this.datos.reload();
  }

  // ---------- Acciones ----------
  protected readonly abierto = signal(false);
  protected readonly porAsignar = signal<{ orden: OrdenAsignable; faltan: number } | null>(null);
  protected readonly aviso = signal('');
  protected readonly ocupado = signal(false);

  protected asignar(p: PedidoDespacho, faltan: number): void {
    this.aviso.set('');
    this.porAsignar.set({ orden: { ...p }, faltan });
    this.abierto.set(true);
  }
  protected async asignado(v: Viaje): Promise<void> {
    this.aviso.set(`${v.numeroEconomico ?? 'Unidad'} asignada a ${this.porAsignar()?.orden.folio}.`);
    this.datos.reload();
    await this.ventas.refrescarPedido(this.porAsignar()!.orden.id).catch(() => undefined);
  }
  protected async avanzar(v: Viaje, estado: NonNullable<ReturnType<typeof siguienteEstado>>): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    try {
      await this.api.avanzar(v.id, estado);
      this.aviso.set(`${v.numeroEconomico ?? v.folio}: ${this.nombre[estado]}.`);
      this.datos.reload();
    } catch (e) {
      this.aviso.set(mensajeDe(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
