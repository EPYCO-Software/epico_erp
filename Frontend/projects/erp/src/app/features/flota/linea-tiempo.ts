import { Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { ChevronLeft, ChevronRight } from 'lucide';
import { Buscador, DEFAULT_TIMEZONE, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro, offsetEn } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, mensajeDe } from '../ventas/datos';
import { enZona, sumarDias } from '../ventas/calendario-entregas';
import { COLOR_ETAPA, ESTADO_VIAJE, ETAPA, Etapa, FilaLineaTiempo, FlotaApi, enJornada, nombreTipo } from './flota-api';
import { PreviaOrden } from './previa-orden';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const REFRESCO_MS = 60_000;
const ETAPAS = Object.keys(ETAPA) as Etapa[];

/**
 * Logística → Operación → Línea de tiempo (/flota/linea-tiempo), como el despacho de Loop4: una fila por unidad y la
 * jornada en horas; cada viaje es una barra con sus etapas (carga, ida, en obra, regreso) — lo que ya pasó, sólido; lo
 * planeado, claro y punteado —, y los mantenimientos en gris. Así se ven huecos y choques de un vistazo. Clic en un
 * viaje abre su orden a la derecha. La línea roja es la hora actual.
 */
@Component({
  selector: 'app-linea-tiempo',
  imports: [Buscador, EnEncabezado, Icon, PanelLateral, PreviaOrden],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Línea de tiempo</h1>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-linea" etiqueta="Buscar por unidad, orden o cliente" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ resumen() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">La línea de tiempo necesita el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            <div class="flex flex-wrap items-center gap-3 border-b border-acero/50 px-4 py-2.5">
              <button type="button" [class]="boton" [disabled]="dia() === hoy" (click)="dia.set(hoy)">Hoy</button>
              <div class="flex">
                <button type="button" aria-label="Día anterior" [class]="botonIcono" (click)="mover(-1)"><ui-icon [icono]="iconos.antes" [tamano]="18" /></button>
                <button type="button" aria-label="Día siguiente" [class]="botonIcono" (click)="mover(1)"><ui-icon [icono]="iconos.despues" [tamano]="18" /></button>
              </div>
              <label for="linea-fecha" class="sr-only">Día</label>
              <input id="linea-fecha" type="date" class="campo h-9 w-auto px-2 text-sm" [value]="dia()" (change)="elegirDia($any($event.target).value)" />
              <h2 class="text-lg font-bold first-letter:uppercase">{{ titulo() }}</h2>
              <ul class="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave" aria-label="Leyenda">
                @for (e of etapas; track e) {
                  <li class="flex items-center gap-1"><span [class]="'inline-block size-3 rounded-sm ' + color[e]"></span>{{ nombreEtapa[e] }}</li>
                }
                <li class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm border border-dashed border-carbon/60 bg-carbon/15"></span>Planeado</li>
                <li class="flex items-center gap-1"><span class="inline-block size-3 rounded-sm bg-[#9AA0A6]"></span>Mantenimiento</li>
              </ul>
            </div>
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }

            <div tabindex="0" role="region" aria-label="Línea de tiempo por unidad" class="overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico">
              <div class="min-w-[72rem]">
                <!-- Horas -->
                <div class="sticky top-0 z-2 grid grid-cols-[9rem_minmax(0,1fr)] border-b border-acero/50 bg-white/95" aria-hidden="true">
                  <div></div>
                  <div class="relative h-7">
                    @for (h of horas(); track h.hora) {
                      <span class="absolute top-1.5 -translate-x-1/2 text-[11px] text-texto-suave tabular-nums" [style.left.%]="h.x">{{ h.etiqueta }}</span>
                    }
                  </div>
                </div>
                <ul aria-label="Unidades">
                  @for (f of filas(); track f.equipo.id) {
                    <li class="grid grid-cols-[9rem_minmax(0,1fr)] border-b border-acero/40">
                      <div class="px-3 py-2">
                        <p class="text-sm font-semibold">{{ f.equipo.numeroEconomico }}</p>
                        <p class="truncate text-xs text-texto-suave">{{ tipo(f) }}</p>
                      </div>
                      <div class="relative h-14">
                        <!-- Líneas de hora y la hora actual -->
                        @for (h of horas(); track h.hora) {
                          <span class="absolute inset-y-0 border-l border-acero/40" [style.left.%]="h.x" aria-hidden="true"></span>
                        }
                        @if (ahoraX() !== null) {
                          <span class="absolute inset-y-0 z-1 border-l-2 border-epico" [style.left.%]="ahoraX()" aria-hidden="true"></span>
                        }
                        @for (m of f.mantenimientos; track m.id) {
                          <span
                            class="absolute top-2 bottom-2 rounded-md bg-[#9AA0A6]"
                            [style.left.%]="x(m.inicio)"
                            [style.width.%]="ancho(m.inicio, m.fin)"
                            [title]="'Mantenimiento: ' + m.descripcion"
                          ><span class="sr-only">Mantenimiento: {{ m.descripcion }}, {{ hora(m.inicio) }} a {{ hora(m.fin) }}</span></span>
                        }
                        @for (v of f.viajes; track v.id) {
                          @if (v.etapas.length) {
                            <button
                              type="button"
                              class="absolute top-2 bottom-2 z-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon aria-current:outline-2 aria-current:outline-offset-1 aria-current:outline-carbon"
                              [style.left.%]="x(v.etapas[0].inicio)"
                              [style.width.%]="ancho(v.etapas[0].inicio, v.etapas[v.etapas.length - 1].fin)"
                              [attr.aria-current]="v.pedidoId === vista.abiertaId() ? 'true' : null"
                              [title]="v.pedidoFolio + ' · ' + v.clienteNombre + ' · ' + estados[v.estado]"
                              (click)="vista.abrir(v.pedidoId)"
                            >
                              <span class="sr-only">{{ textoViaje(v) }}</span>
                              <span class="absolute inset-0 flex overflow-hidden rounded-md" aria-hidden="true">
                                @for (e of v.etapas; track e.etapa + e.inicio) {
                                  <span
                                    [class]="'h-full ' + color[e.etapa] + (e.real ? '' : ' opacity-35 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgba(255,255,255,.55)_4px_7px)]')"
                                    [style.width.%]="proporcion(v.etapas, e)"
                                  ></span>
                                }
                              </span>
                              <span class="relative m-1 inline-block max-w-[calc(100%-0.5rem)] truncate rounded bg-white/90 px-1 align-top text-[11px] leading-4 font-bold text-carbon" aria-hidden="true">{{ v.pedidoFolio }}</span>
                            </button>
                          }
                        }
                      </div>
                    </li>
                  } @empty {
                    <li class="px-4 py-8 text-center text-sm text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : 'Ninguna unidad con esta búsqueda.' }}</li>
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>
        @if (previa(); as p) {
          <aside appPanelLateral (cerrar)="vista.cerrar()">
            <app-previa-orden [p]="p" (cerrar)="vista.cerrar()" (cambio)="datos.reload()" />
          </aside>
        }
      </div>
    }
  `,
})
export default class LineaTiempo {
  private readonly api = inject(FlotaApi);
  private readonly ventas = inject(VentasService);
  protected readonly conBackend = this.ventas.conBackend;
  private readonly zona = inject(DEFAULT_TIMEZONE);
  protected readonly cajas = CAJAS_LISTA;
  protected readonly iconos = { antes: ChevronLeft, despues: ChevronRight };
  protected readonly etapas = ETAPAS;
  protected readonly nombreEtapa = ETAPA;
  protected readonly color = COLOR_ETAPA;
  protected readonly estados = ESTADO_VIAJE;
  protected readonly boton =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';

  protected readonly hoy = enZona(new Date().toISOString(), this.zona).dia;
  protected readonly dia = signal(this.hoy);
  protected readonly titulo = computed(() =>
    new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(this.dia() + 'T12:00:00Z')),
  );
  protected mover(n: number): void {
    this.dia.update((d) => sumarDias(d, n));
  }
  protected elegirDia(v: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) this.dia.set(v);
  }

  protected readonly datos = resource({ params: () => (this.conBackend ? this.dia() : undefined), loader: ({ params }) => this.api.lineaTiempo(params) });
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  private readonly todas = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  constructor() {
    if (!this.conBackend) return;
    const t = setInterval(() => this.datos.reload(), REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'tipo', titulo: 'Tipo', opciones: opcionesDe(this.todas(), (f) => nombreTipo(f.equipo.tipo)) },
    { id: 'planta', titulo: 'Planta', opciones: opcionesDe(this.todas(), (f) => f.equipo.plantaNombres[0] ?? '—') },
    { id: 'ocupacion', titulo: 'Ocupación', opciones: opcionesDe(this.todas(), (f) => (f.viajes.length ? 'con' : 'sin'), (id) => (id === 'con' ? 'Con viajes' : 'Libres todo el día')) },
  ]);
  protected readonly filas = computed(() => {
    const q = normalizar(this.texto().trim());
    const f = this.filtros();
    return this.todas().filter(
      (x) =>
        (!q || normalizar([x.equipo.numeroEconomico, ...x.viajes.flatMap((v) => [v.pedidoFolio, v.clienteNombre])].join(' ')).includes(q)) &&
        pasaFiltro(f, 'tipo', nombreTipo(x.equipo.tipo)) &&
        pasaFiltro(f, 'planta', x.equipo.plantaNombres[0] ?? '—') &&
        pasaFiltro(f, 'ocupacion', x.viajes.length ? 'con' : 'sin'),
    );
  });
  protected readonly resumen = computed(() => {
    const f = this.filas();
    const viajes = f.reduce((t, x) => t + x.viajes.length, 0);
    return `${f.filter((x) => x.viajes.length).length} de ${f.length} unidades con viajes · ${viajes} viajes`;
  });

  /** La jornada: 05:00–21:00 de la planta, ampliada a lo que haya antes o después. */
  private readonly jornada = computed(() => {
    const base = (h: number) => Date.parse(`${this.dia()}T${String(h).padStart(2, '0')}:00:00${offsetEn(this.zona, new Date(this.dia() + 'T12:00:00Z'))}`);
    const tiempos = this.todas().flatMap((f) => [...f.viajes.flatMap((v) => v.etapas.flatMap((e) => [Date.parse(e.inicio), Date.parse(e.fin)])), ...f.mantenimientos.flatMap((m) => [Date.parse(m.inicio), Date.parse(m.fin)])]);
    const hora = 3_600_000;
    const desde = Math.min(base(5), ...tiempos.map((t) => Math.floor(t / hora) * hora));
    const hasta = Math.max(base(21), ...tiempos.map((t) => Math.ceil(t / hora) * hora));
    return { desde: Math.max(desde, base(0)), hasta: Math.min(hasta, base(24)) };
  });
  protected readonly horas = computed(() => {
    const { desde, hasta } = this.jornada();
    const r: { hora: number; etiqueta: string; x: number }[] = [];
    for (let t = desde; t <= hasta; t += 3_600_000) r.push({ hora: t, etiqueta: this.hora(new Date(t).toISOString()), x: ((t - desde) / (hasta - desde)) * 100 });
    return r;
  });
  protected readonly ahoraX = computed(() => {
    const { desde, hasta } = this.jornada();
    const ahora = Date.now();
    return ahora >= desde && ahora <= hasta ? ((ahora - desde) / (hasta - desde)) * 100 : null;
  });
  protected x(iso: string): number {
    const { desde, hasta } = this.jornada();
    return enJornada(iso, desde, hasta);
  }
  protected ancho(inicio: string, fin: string): number {
    return Math.max(0.6, this.x(fin) - this.x(inicio));
  }
  /** Lo que ocupa cada etapa dentro de la barra de su viaje (%). */
  protected proporcion(etapas: FilaLineaTiempo['viajes'][number]['etapas'], e: FilaLineaTiempo['viajes'][number]['etapas'][number]): number {
    const total = Date.parse(etapas[etapas.length - 1].fin) - Date.parse(etapas[0].inicio) || 1;
    return ((Date.parse(e.fin) - Date.parse(e.inicio)) / total) * 100;
  }
  protected hora(iso: string): string {
    return enZona(iso, this.zona).hora;
  }
  protected tipo(f: FilaLineaTiempo): string {
    return nombreTipo(f.equipo.tipo);
  }
  protected textoViaje(v: FilaLineaTiempo['viajes'][number]): string {
    const etapas = v.etapas.map((e) => `${ETAPA[e.etapa]} ${this.hora(e.inicio)}–${this.hora(e.fin)}${e.real ? '' : ' (planeado)'}`).join(', ');
    return `${v.pedidoFolio}, ${v.clienteNombre}, ${v.obraNombre}. ${ESTADO_VIAJE[v.estado]}. ${etapas}.`;
  }

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.ventas.pedidos().find((p) => p.id === this.vista.abiertaId()) ?? null);
}
