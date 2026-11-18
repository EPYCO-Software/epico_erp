import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ChevronLeft, ChevronRight } from 'lucide';
import { DEFAULT_TIMEZONE, Icon, PedidoVista } from 'ui';
import { porConfirmar } from './datos';

export type ModoCalendario = 'dia' | 'semana' | 'mes';

// ── Días como 'YYYY-MM-DD' (sin zona: la aritmética va en UTC para no brincar con horarios de verano) ──
const aFecha = (dia: string) => new Date(dia + 'T00:00:00Z');
const aDia = (d: Date) => d.toISOString().slice(0, 10);
export const sumarDias = (dia: string, n: number) => aDia(new Date(aFecha(dia).getTime() + n * 86_400_000));
/** El lunes de su semana. */
export const inicioSemana = (dia: string) => sumarDias(dia, -((aFecha(dia).getUTCDay() + 6) % 7));
/** 'YYYY-MM-DD' y 'HH:mm' de un instante en la zona de su planta. */
export function enZona(iso: string, zona: string): { dia: string; hora: string } {
  const f = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { dia: `${f['year']}-${f['month']}-${f['day']}`, hora: `${f['hour']}:${f['minute']}` };
}
/** Los días que se ven: 1 (día), 7 (semana, de lunes a domingo) o 42 (mes en 6 semanas, de lunes a domingo). */
export function diasVisibles(modo: ModoCalendario, dia: string): string[] {
  if (modo === 'dia') return [dia];
  if (modo === 'semana') return Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana(dia), i));
  const primero = inicioSemana(dia.slice(0, 8) + '01');
  return Array.from({ length: 42 }, (_, i) => sumarDias(primero, i));
}
/** Avanza o retrocede un día, una semana o un mes. */
export function mover(modo: ModoCalendario, dia: string, paso: 1 | -1): string {
  if (modo === 'dia') return sumarDias(dia, paso);
  if (modo === 'semana') return sumarDias(dia, 7 * paso);
  const d = aFecha(dia.slice(0, 8) + '01');
  d.setUTCMonth(d.getUTCMonth() + paso);
  return aDia(d);
}

export interface EntregaDelDia {
  p: PedidoVista;
  hora: string;
}
/** Las órdenes por día (en la hora de su planta), cada día ordenado por hora. */
export function porDia(pedidos: PedidoVista[]): Map<string, EntregaDelDia[]> {
  const mapa = new Map<string, EntregaDelDia[]>();
  for (const p of pedidos) {
    const { dia, hora } = enZona(p.fechaHoraEntrega, p.zonaHoraria);
    mapa.set(dia, [...(mapa.get(dia) ?? []), { p, hora }]);
  }
  for (const l of mapa.values()) l.sort((a, b) => a.hora.localeCompare(b.hora));
  return mapa;
}

const horaDe = (e: EntregaDelDia) => Number(e.hora.slice(0, 2));
/** Las entregas de un día por hora (0–23). */
export const agruparPorHora = (entregas: EntregaDelDia[]) =>
  entregas.reduce((m, e) => m.set(horaDe(e), [...(m.get(horaDe(e)) ?? []), e]), new Map<number, EntregaDelDia[]>());
/**
 * Las filas de hora: de 06:00 a 20:00 (la jornada) y, si hay entregas antes o después, hasta ellas. `ocupada` = alguna
 * entrega en esa hora (crece); las demás son delgadas.
 */
export function horasVisibles(entregas: EntregaDelDia[], desde = 6, hasta = 20): { hora: number; etiqueta: string; ocupada: boolean }[] {
  const conEntrega = new Set(entregas.map(horaDe));
  const ini = Math.min(desde, ...conEntrega);
  const fin = Math.max(hasta, ...conEntrega);
  return Array.from({ length: fin - ini + 1 }, (_, i) => ini + i).map((hora) => ({
    hora,
    etiqueta: `${String(hora).padStart(2, '0')}:00`,
    ocupada: conEntrega.has(hora),
  }));
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', ...o });
const DIA_LARGO = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DIA_CORTO = fmt({ weekday: 'short', day: 'numeric' });
const DIA_SEMANA = fmt({ weekday: 'short' });
const MES = fmt({ month: 'long', year: 'numeric' });
const DIA_MES = fmt({ day: 'numeric', month: 'short' });

/** Cómo se ve cada orden: por confirmar (ámbar), confirmada (verde), entregada (gris) o cancelada (tachada). */
function tono(p: PedidoVista): { clase: string; texto: string } {
  if (p.estado === 'cancelado') return { clase: 'border-l-acero-oscuro bg-carbon/5 text-texto-suave line-through', texto: 'Cancelada' };
  if (p.estado === 'entregado') return { clase: 'border-l-acero-oscuro bg-white/70 text-texto-suave', texto: 'Entregada' };
  if (porConfirmar(p)) return { clase: 'border-l-atencion bg-[#FBF0DD] text-[#5C3F0C]', texto: 'Por confirmar' };
  return { clase: 'border-l-correcto bg-[#E5F0EA] text-[#244C3B]', texto: 'Confirmada' };
}

/**
 * Calendario de entregas de Órdenes (Día, Semana o Mes): las mismas órdenes de la lista (búsqueda, filtros y plantas),
 * cada una en su día y hora de planta, con el total de órdenes y m³ por día para ver si se alcanza a entregar. Clic en
 * una orden abre su vista previa; doble clic, la vista completa. En Mes, "+N más" abre ese día.
 */
@Component({
  selector: 'app-calendario-entregas',
  imports: [DecimalPipe, Icon],
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 pb-2">
      <div class="flex items-center gap-2">
        <button type="button" [class]="boton" (click)="dia.set(hoy)">Hoy</button>
        <button type="button" [class]="botonIcono" [attr.aria-label]="'Anterior: ' + nombreModo()" (click)="dia.set(mover(modo(), dia(), -1))">
          <ui-icon [icono]="iconos.antes" [tamano]="18" />
        </button>
        <button type="button" [class]="botonIcono" [attr.aria-label]="'Siguiente: ' + nombreModo()" (click)="dia.set(mover(modo(), dia(), 1))">
          <ui-icon [icono]="iconos.despues" [tamano]="18" />
        </button>
        <h2 class="ml-1 text-lg font-bold first-letter:uppercase" aria-live="polite">{{ titulo() }}</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <p class="text-sm text-texto-suave">{{ resumen() }}</p>
        <fieldset class="flex rounded-[0.625rem] bg-carbon/5 p-0.5">
          <legend class="sr-only">Ver el calendario por</legend>
          @for (m of modos; track m.id) {
            <label class="segmento px-3 py-1 text-sm">
              <input type="radio" name="modo-calendario" class="sr-only" [value]="m.id" [checked]="modo() === m.id" (change)="modo.set(m.id)" />
              {{ m.nombre }}
            </label>
          }
        </fieldset>
      </div>
    </div>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 px-1 pb-2 text-xs text-texto-suave" aria-label="Colores del calendario">
      <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-atencion" aria-hidden="true"></span>Por confirmar</li>
      <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-correcto" aria-hidden="true"></span>Confirmada</li>
      <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-acero-oscuro" aria-hidden="true"></span>Entregada o cancelada</li>
    </ul>

    @switch (modo()) {
      @case ('mes') {
        <div class="overflow-x-auto pb-2">
          <div class="grid min-w-[56rem] grid-cols-7 gap-px overflow-hidden rounded-xl bg-acero/40" role="presentation">
            @for (d of semana(); track d) {
              <p class="bg-white/80 px-2 py-1 text-center text-xs font-bold tracking-wide text-texto-suave uppercase" aria-hidden="true">{{ d }}</p>
            }
            @for (d of celdas(); track d.dia) {
              <section
                [attr.aria-label]="d.etiqueta"
                class="min-h-28 min-w-0 bg-white/80 p-1.5"
                [class.opacity-55]="!d.delMes"
              >
                <div class="flex items-baseline justify-between gap-1">
                  <span class="text-sm font-semibold" [class]="d.dia === hoy ? 'rounded-full bg-epico px-1.5 text-white' : ''">{{ d.numero }}</span>
                  @if (d.entregas.length) {
                    <span class="text-xs text-texto-suave tabular-nums">{{ d.m3 | number: '1.0-1' }} m³</span>
                  }
                </div>
                <ul class="mt-1 grid grid-cols-1 gap-0.5">
                  @for (e of d.entregas.slice(0, 3); track e.p.id) {
                    <li>
                      <button type="button" [class]="evento(e.p) + ' w-full truncate px-1.5 py-0.5 text-left text-xs'" [attr.data-folio]="e.p.folio" [attr.aria-current]="e.p.id === abiertaId() ? 'true' : null" (click)="abrir.emit(e.p)" (dblclick)="verCompleta.emit(e.p)">
                        <span class="font-semibold tabular-nums">{{ e.hora }}</span> {{ e.p.folio }}<span class="sr-only">, {{ e.p.clienteNombre }}, {{ e.p.volumenM3 }} m³, {{ tono(e.p).texto }}</span>
                      </button>
                    </li>
                  }
                </ul>
                @if (d.entregas.length > 3) {
                  <button type="button" class="mt-0.5 rounded text-xs font-semibold text-epico-oscuro hover:underline focus-visible:outline-2 focus-visible:outline-epico" (click)="verDia(d.dia)">
                    +{{ d.entregas.length - 3 }} más
                  </button>
                }
              </section>
            }
          </div>
        </div>
      }
      @default {
        <!--
          Como el calendario de Apple: una fila por hora con su línea divisoria. Las horas con entregas crecen lo que
          necesitan; las vacías quedan delgadas (siguen viéndose para distinguir mañana y tarde). Semana: 7 columnas con
          scroll de lado en pantallas chicas; Día: una sola, con más detalle.
        -->
        <div class="overflow-x-auto pb-2">
          <table class="w-full table-fixed border-separate border-spacing-0 rounded-xl bg-white/75 text-xs" [class]="modo() === 'semana' ? 'min-w-[63rem]' : ''">
            <caption class="sr-only">Entregas por hora{{ modo() === 'dia' ? ' del día' : ' de la semana' }}; cada orden con su hora de planta.</caption>
            <colgroup>
              <col class="w-14" />
              @for (d of celdas(); track d.dia) {
                <col />
              }
            </colgroup>
            <thead>
              <tr>
                <th scope="col" class="sticky left-0 bg-transparent"><span class="sr-only">Hora</span></th>
                @for (d of celdas(); track d.dia) {
                  <th scope="col" class="border-b border-l border-acero/50 px-2 pt-2 pb-1.5 text-left align-top font-normal" [class]="d.dia === hoy ? 'bg-[#FDF2F2]' : ''">
                    <span class="block text-sm font-bold first-letter:uppercase" [class.text-epico-oscuro]="d.dia === hoy">
                      {{ modo() === 'dia' ? d.etiqueta : d.corto }}
                    </span>
                    <span class="block text-texto-suave tabular-nums">
                      {{ d.entregas.length ? d.entregas.length + (d.entregas.length === 1 ? ' orden' : ' órdenes') + ' · ' + (d.m3 | number: '1.0-1') + ' m³' : 'Sin entregas' }}
                    </span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (h of horas(); track h.hora) {
                <tr>
                  <th scope="row" class="border-t border-acero/40 pr-2 text-right align-top font-normal text-texto-suave tabular-nums" [class]="h.ocupada ? 'pt-1.5' : 'h-5 py-0 text-[11px] leading-5'">
                    {{ h.etiqueta }}
                  </th>
                  @for (d of celdas(); track d.dia) {
                    <td class="border-t border-l border-acero/40 align-top" [class]="(h.ocupada ? 'p-1' : 'h-5 p-0') + (d.dia === hoy ? ' bg-[#FDF2F2]/60' : '')">
                      @if (d.porHora.get(h.hora); as lista) {
                        <ul class="grid grid-cols-1 gap-1">
                          @for (e of lista; track e.p.id) {
                            <li>
                              <button
                                type="button"
                                [class]="evento(e.p) + ' w-full px-2 py-1 text-left'"
                                [attr.data-folio]="e.p.folio"
                                [attr.aria-current]="e.p.id === abiertaId() ? 'true' : null"
                                (click)="abrir.emit(e.p)"
                                (dblclick)="verCompleta.emit(e.p)"
                              >
                                <span class="flex items-baseline justify-between gap-2">
                                  <span class="font-bold tabular-nums">{{ e.hora }}</span>
                                  <span class="tabular-nums">{{ e.p.volumenM3 | number: '1.0-1' }} m³</span>
                                </span>
                                <span class="block truncate font-semibold">{{ e.p.folio }} · {{ e.p.clienteNombre }}</span>
                                <span class="block truncate">{{ e.p.obraNombre }}</span>
                                @if (modo() === 'dia') {
                                  <span class="block truncate">{{ e.p.producto }} · {{ e.p.plantaNombre }} · {{ tono(e.p).texto }}</span>
                                } @else {
                                  <span class="sr-only">{{ tono(e.p).texto }}</span>
                                }
                              </button>
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
        </div>
      }
    }
  `,
})
export class CalendarioEntregas {
  readonly pedidos = input.required<PedidoVista[]>();
  readonly abiertaId = input<string | null>(null);
  readonly abrir = output<PedidoVista>();
  readonly verCompleta = output<PedidoVista>();

  protected readonly iconos = { antes: ChevronLeft, despues: ChevronRight };
  protected readonly boton =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly modos: { id: ModoCalendario; nombre: string }[] = [
    { id: 'dia', nombre: 'Día' },
    { id: 'semana', nombre: 'Semana' },
    { id: 'mes', nombre: 'Mes' },
  ];
  protected readonly mover = mover;
  protected readonly tono = tono;
  /** Hoy en la zona por omisión de las plantas. */
  protected readonly hoy = enZona(new Date().toISOString(), inject(DEFAULT_TIMEZONE)).dia;
  protected readonly modo = signal<ModoCalendario>('semana');
  protected readonly dia = signal(this.hoy);
  protected readonly nombreModo = computed(() => ({ dia: 'día', semana: 'semana', mes: 'mes' })[this.modo()]);
  protected readonly semana = computed(() => diasVisibles('semana', this.hoy).map((d) => DIA_SEMANA.format(aFecha(d))));

  private readonly mapa = computed(() => porDia(this.pedidos()));
  protected readonly celdas = computed(() => {
    const mes = this.dia().slice(0, 7);
    return diasVisibles(this.modo(), this.dia()).map((dia) => {
      const entregas = this.mapa().get(dia) ?? [];
      return {
        dia,
        numero: Number(dia.slice(8)),
        delMes: dia.startsWith(mes),
        etiqueta: DIA_LARGO.format(aFecha(dia)),
        corto: DIA_CORTO.format(aFecha(dia)),
        entregas,
        porHora: agruparPorHora(entregas),
        // Las canceladas no cuentan para lo que hay que entregar
        m3: entregas.reduce((s, e) => (e.p.estado === 'cancelado' ? s : s + e.p.volumenM3), 0),
      };
    });
  });
  /** Filas de Día y Semana: de 06:00 a 20:00 como mínimo, ampliadas a la primera y última entrega que se ven. */
  protected readonly horas = computed(() => horasVisibles(this.celdas().flatMap((c) => c.entregas)));
  protected readonly titulo = computed(() => {
    const d = this.dia();
    if (this.modo() === 'dia') return DIA_LARGO.format(aFecha(d));
    if (this.modo() === 'mes') return MES.format(aFecha(d));
    const ini = inicioSemana(d);
    return `${DIA_MES.format(aFecha(ini))} – ${DIA_MES.format(aFecha(sumarDias(ini, 6)))} ${ini.slice(0, 4)}`;
  });
  /** Lo que hay que entregar en lo que se ve (del mes, sin los días de relleno; sin canceladas). */
  protected readonly resumen = computed(() => {
    const dias = this.celdas().filter((c) => this.modo() !== 'mes' || c.delMes);
    const vivas = dias.flatMap((c) => c.entregas).filter((e) => e.p.estado !== 'cancelado');
    const pendientes = vivas.filter((e) => porConfirmar(e.p)).length;
    const m3 = vivas.reduce((s, e) => s + e.p.volumenM3, 0);
    return `${vivas.length} ${vivas.length === 1 ? 'entrega' : 'entregas'} · ${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(m3)} m³${pendientes ? ` · ${pendientes} por confirmar` : ''}`;
  });

  protected evento(p: PedidoVista): string {
    return `block rounded-md border-l-4 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-epico aria-[current=true]:ring-2 aria-[current=true]:ring-epico ${tono(p).clase}`;
  }
  protected verDia(dia: string): void {
    this.dia.set(dia);
    this.modo.set('dia');
  }
}
