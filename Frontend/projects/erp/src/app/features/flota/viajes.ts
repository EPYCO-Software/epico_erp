import { Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { Buscador, FiltrosElegidos, GrupoFiltro, MapaSeguimiento, PuntoMapa, RutaMapa, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, mensajeDe } from '../ventas/datos';
import { ESTADO_VIAJE, FlotaApi, PosicionUnidad, PuntoRecorrido, SITUACION_GPS, Unidad, nombreTipo, situacionGps } from './flota-api';
import { PanelGps } from './panel-gps';
import { plantasFlota } from './plantas-flota';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Cada cuánto se vuelven a pedir las posiciones. */
const REFRESCO_MS = 30_000;
type Situacion = keyof typeof SITUACION_GPS;
interface FilaMapa {
  id: string;
  numero: string;
  tipo: string;
  posicion: PosicionUnidad | null;
  situacion: Situacion;
}

/**
 * Logística → Operación → Mapa de flota (/flota/viajes), como el seguimiento de Loop4: todas las unidades en el mapa
 * con su última posición (GPS), y al lado la misma lista en texto (estado: en movimiento, detenida, sin señal o sin GPS;
 * viaje en curso). Clic en una unidad (en la lista o en el mapa) abre su panel: lo que dicen sus sensores ahora y su
 * recorrido (historial) dibujado en el mapa, con reproducción. Se actualiza cada 30 s; filtros en el buscador.
 */
@Component({
  selector: 'app-viajes',
  imports: [Buscador, EnEncabezado, MapaSeguimiento, PanelLateral, PanelGps],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Mapa de flota</h1>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-unidad-mapa" etiqueta="Buscar por unidad, orden o tipo" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ resumen() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">El mapa de flota necesita el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla + ' grid lg:grid-cols-[19rem_minmax(0,1fr)]'">
            <div class="min-w-0 border-b border-acero/50 lg:border-r lg:border-b-0">
              @if (error()) {
                <p class="px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
              }
              @if (!gpsConectado()) {
                <p class="border-b border-acero/50 px-4 py-2.5 text-xs text-texto-suave">
                  Traccar sin conectar: se ven las posiciones guardadas (demo o registradas). Al conectarlo, las de cada GPS.
                </p>
              }
              <ul class="grid max-h-[calc(100dvh-11rem)] content-start gap-1 overflow-x-hidden overflow-y-auto p-2" aria-label="Unidades">
                @for (f of filas(); track f.id) {
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-carbon/4 focus-visible:outline-2 focus-visible:outline-epico disabled:cursor-default disabled:hover:bg-transparent aria-current:bg-[#FDF2F2] aria-current:shadow-[inset_3px_0_0_var(--color-epico)]"
                      [attr.aria-current]="f.id === vista.abiertaId() ? 'true' : null"
                      [disabled]="!f.posicion"
                      (click)="abrir(f.id)"
                    >
                      <span class="flex items-baseline justify-between gap-2">
                        <span class="font-semibold">{{ f.numero }}</span>
                        <span [class]="'rounded-md px-1.5 text-[11px] font-bold ' + tono[f.situacion]">{{ situaciones[f.situacion] }}</span>
                      </span>
                      <span class="block truncate text-xs text-texto-suave">{{ detalle(f) }}</span>
                    </button>
                  </li>
                } @empty {
                  <li class="px-3 py-6 text-sm text-texto-suave">{{ posicionesRes.isLoading() ? 'Cargando posiciones…' : 'Ninguna unidad con esta búsqueda.' }}</li>
                }
              </ul>
            </div>
            <div class="min-h-96 p-2">
              <ui-mapa-seguimiento
                class="h-[calc(100dvh-11rem)] min-h-96"
                [puntos]="puntos()"
                [rutas]="rutas()"
                titulo="Mapa de la flota: cada unidad en su última posición"
                (elegir)="elegirEnMapa($event)"
              />
            </div>
          </div>
        </div>
        @if (abierta(); as u) {
          <aside appPanelLateral (cerrar)="cerrar()">
            <app-panel-gps [u]="u" (cerrar)="cerrar()" (recorrido)="recorrido.set($event)" (punto)="punto.set($event)" />
          </aside>
        }
      </div>
    }
  `,
})
export default class Viajes {
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  private readonly plantas = plantasFlota();
  protected readonly cajas = CAJAS_LISTA;
  protected readonly situaciones = SITUACION_GPS;
  protected readonly tono: Record<Situacion, string> = {
    en_movimiento: 'bg-[#E3EFE9] text-[#2E5E4A]',
    detenida: 'bg-[#E6F0F4] text-[#2B5F75]',
    sin_senal: 'bg-[#FBF0DD] text-[#7A5410]',
    sin_gps: 'bg-carbon/8 text-texto-suave',
  };

  protected readonly posicionesRes = resource({ loader: () => (this.conBackend ? this.api.posiciones() : Promise.resolve([] as PosicionUnidad[])) });
  /** Todas las unidades (las sin posición se listan como "Sin GPS"). */
  private readonly tablero = resource({ loader: () => (this.conBackend ? this.api.tablero() : Promise.resolve(null)) });
  protected readonly gpsConectado = computed(() => this.tablero.hasValue() && !!this.tablero.value()?.gps.configurado);
  protected readonly error = computed(() => (this.posicionesRes.error() ? mensajeDe(this.posicionesRes.error()) : ''));

  constructor() {
    if (!this.conBackend) return;
    const t = setInterval(() => this.posicionesRes.reload(), REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  /** Una fila por unidad activa de las plantas elegidas: con su posición si la tiene. */
  private readonly todas = computed<FilaMapa[]>(() => {
    const pos = new Map((this.posicionesRes.hasValue() ? this.posicionesRes.value() : []).map((p) => [p.equipoId, p]));
    const unidades: Unidad[] = (this.tablero.hasValue() ? (this.tablero.value()?.equipos ?? []) : []).map((f) => f.equipo).filter((u) => u.activo);
    return unidades
      .filter((u) => this.plantas.visible(u.sucursalIds?.length ? u.sucursalIds : [u.sucursalId]))
      .map((u) => {
        const posicion = pos.get(u.id) ?? null;
        return { id: u.id, numero: u.numeroEconomico, tipo: nombreTipo(u.tipo), posicion, situacion: (posicion ? situacionGps(posicion) : 'sin_gps') as Situacion };
      })
      .sort((a, b) => Number(!a.posicion) - Number(!b.posicion) || a.numero.localeCompare(b.numero, 'es', { numeric: true }));
  });
  protected detalle(f: FilaMapa): string {
    const v = f.posicion?.viaje;
    const vel = f.posicion && f.situacion === 'en_movimiento' ? `${Math.round(f.posicion.velocidadKmh ?? 0)} km/h` : '';
    return [f.tipo, v ? `${v.pedidoFolio} (${ESTADO_VIAJE[v.estado]})` : '', vel].filter(Boolean).join(' · ');
  }

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'situacion', titulo: 'Estado', opciones: opcionesDe(this.todas(), (f) => f.situacion, (id) => SITUACION_GPS[id as Situacion]) },
    { id: 'tipo', titulo: 'Tipo', opciones: opcionesDe(this.todas(), (f) => f.tipo) },
    { id: 'viaje', titulo: 'Viaje', opciones: opcionesDe(this.todas(), (f) => (f.posicion?.viaje ? 'en_viaje' : 'sin_viaje'), (id) => (id === 'en_viaje' ? 'En un viaje' : 'Sin viaje')) },
  ]);
  protected readonly filas = computed(() => {
    const q = normalizar(this.texto().trim());
    const f = this.filtros();
    return this.todas().filter(
      (x) =>
        (!q || normalizar(`${x.numero} ${x.tipo} ${x.posicion?.viaje?.pedidoFolio ?? ''}`).includes(q)) &&
        pasaFiltro(f, 'situacion', x.situacion) &&
        pasaFiltro(f, 'tipo', x.tipo) &&
        pasaFiltro(f, 'viaje', x.posicion?.viaje ? 'en_viaje' : 'sin_viaje'),
    );
  });
  protected readonly resumen = computed(() => {
    const t = this.filas();
    const n = (s: Situacion) => t.filter((x) => x.situacion === s).length;
    return `${n('en_movimiento')} en movimiento · ${n('detenida')} detenidas · ${n('sin_senal') + n('sin_gps')} sin señal`;
  });

  // ---------- Panel y mapa ----------
  protected readonly vista = vistaPrevia();
  protected readonly abierta = computed(() => this.filas().find((f) => f.id === this.vista.abiertaId())?.posicion ?? null);
  protected readonly recorrido = signal<PuntoRecorrido[]>([]);
  protected readonly punto = signal<PuntoRecorrido | null>(null);
  protected abrir(id: string): void {
    this.recorrido.set([]);
    this.punto.set(null);
    this.vista.abrir(id);
  }
  protected elegirEnMapa(id: string): void {
    if (this.filas().some((f) => f.id === id && f.posicion)) this.abrir(id);
  }
  protected cerrar(): void {
    this.recorrido.set([]);
    this.punto.set(null);
    this.vista.cerrar();
  }

  protected readonly puntos = computed<PuntoMapa[]>(() => {
    const abierta = this.vista.abiertaId();
    const unidades: PuntoMapa[] = this.filas()
      .filter((f) => f.posicion)
      .map((f) => ({
        id: f.id,
        tipo: 'camion' as const,
        lat: f.posicion!.lat,
        lng: f.posicion!.lng,
        etiqueta: f.numero,
        atenuado: f.situacion === 'sin_senal',
        resaltado: f.id === abierta,
      }));
    const p = this.punto();
    if (!p || !abierta) return unidades;
    // En la reproducción, la unidad elegida se ve donde iba en ese momento
    const numero = this.filas().find((f) => f.id === abierta)?.numero ?? '';
    return [...unidades.filter((u) => u.id !== abierta), { id: abierta, tipo: 'camion', lat: p.lat, lng: p.lng, etiqueta: numero, resaltado: true }];
  });
  protected readonly rutas = computed<RutaMapa[]>(() => {
    const r = this.recorrido();
    return r.length > 1 ? [{ id: `recorrido-${this.vista.abiertaId()}-${r[0].fecha}`, puntos: r.map((p) => [p.lat, p.lng] as [number, number]) }] : [];
  });
}
