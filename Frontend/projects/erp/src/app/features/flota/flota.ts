import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Maximize2, PencilLine, X } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { CATEGORIAS_UNIDAD, ESTADO_UNIDAD, EstadoUnidad, FilaTablero, FlotaApi, Operador, Unidad, categoriaDe, estadoFila, nombreTipo, textoCapacidad } from './flota-api';
import { FormUnidad } from './form-unidad';
import { RecorridosUnidad } from './recorridos-unidad';
import { plantasFlota } from './plantas-flota';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const ESTADOS = Object.keys(ESTADO_UNIDAD) as EstadoUnidad[];

/**
 * Logística → Flota → Unidades (/flota), como las listas de Ventas: casillas para marcar (y cambiar el estado o dar de
 * baja varias), el selector de plantas del encabezado, filtros en el buscador; clic abre la vista previa (solo lectura,
 * con los cambios de estado a la mano y "Editar"), doble clic la ficha completa. Una unidad puede operar en varias plantas.
 */
@Component({
  selector: 'app-flota',
  imports: [Buscador, RouterLink, EnEncabezado, PanelLateral, FormUnidad, Icon, RecorridosUnidad],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('flota.equipos.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="nueva()">Nueva unidad</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Unidades</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-unidad"
          etiqueta="Buscar unidades por número, placas, marca u operador"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 class="text-xl font-bold">La flota necesita el servidor</h2>
        <p class="mt-1 text-texto-suave">Las unidades, sus viajes y su GPS se guardan en el backend. Entra con el servidor conectado.</p>
      </section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <!-- columna-caja: una sola caja adentro (el resumen y los avisos van dentro de ella) -->
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            @if (casillas.marcadas().length && puede('flota.equipos.editar')) {
              <div class="flex flex-wrap items-center gap-2 border-b border-acero/50 bg-[#FDF2F2] px-4 py-2 text-sm" role="group" aria-label="Acciones para las unidades marcadas">
                <span class="font-semibold">{{ casillas.marcadas().length }} marcadas:</span>
                @for (e of estados; track e) {
                  <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="cambiarEstado(casillas.marcadas(), e)">{{ nombreEstadoUnidad[e] }}</button>
                }
                <button type="button" [class]="botonChico" [disabled]="ocupado()" (click)="darDeBaja(casillas.marcadas())">Dar de baja</button>
              </div>
            } @else {
              <p class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-acero/50 px-4 py-2.5 text-sm text-texto-suave">
                <span><strong class="text-carbon tabular-nums">{{ resumen().disponibles }}</strong> disponibles</span>
                <span><strong class="text-carbon tabular-nums">{{ resumen().enViaje }}</strong> en viaje</span>
                <span><strong class="text-carbon tabular-nums">{{ resumen().taller }}</strong> en mantenimiento o fuera de servicio</span>
                <span>GPS: <strong class="text-carbon">{{ gpsConectado() ? 'Traccar conectado' : 'Traccar sin conectar' }}</strong></span>
                <a routerLink="/flota/viajes" class="font-semibold text-carbon underline-offset-4 hover:text-epico hover:underline">Ver en el mapa</a>
              </p>
            }
            <p class="border-b border-acero/50 px-4 py-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ avisoLista() }}</p>
            <div tabindex="0" role="region" aria-label="Tabla de unidades" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-240]="!vista.abiertaId()">
                <caption class="sr-only">Unidades de la flota. Clic o Enter en una fila abre su vista previa; doble clic, su ficha completa. La casilla solo marca.</caption>
                <thead [class]="cajas.titulos">
                  <tr>
                    <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                      <input
                        type="checkbox"
                        class="casilla block"
                        aria-label="Marcar todas"
                        [checked]="casillas.todas()"
                        [indeterminate]="casillas.algunas()"
                        [disabled]="!filas().length"
                        (change)="casillas.marcarTodas($any($event.target).checked)"
                      />
                    </th>
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Unidad</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Tipo</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Plantas</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="vista.abiertaId()">Capacidad</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Operador</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">GPS</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of filas(); track f.equipo.id) {
                    <tr
                      [id]="'fila-' + f.equipo.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="f.equipo.id === vista.abiertaId() ? 'true' : null"
                      (click)="abrir(f.equipo.id)"
                      (dblclick)="completa(f.equipo.id)"
                      (keydown.enter)="$event.target === $event.currentTarget && abrir(f.equipo.id)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          class="casilla block"
                          [attr.aria-label]="'Marcar ' + f.equipo.numeroEconomico"
                          [checked]="casillas.marcadas().includes(f.equipo.id)"
                          (change)="casillas.alternar(f.equipo.id)"
                        />
                      </td>
                      <td class="py-2.5 pr-3 pl-1">
                        <span class="block font-semibold tabular-nums">{{ f.equipo.numeroEconomico }}</span>
                        <span class="block text-xs text-texto-suave">{{ subtitulo(f.equipo) }}</span>
                      </td>
                      <td class="px-3 py-2.5">
                        <span class="block">{{ tipo(f.equipo) }}</span>
                        <span class="block text-xs text-texto-suave">{{ categoria(f.equipo) }}</span>
                      </td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ plantasDe(f) }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="vista.abiertaId()">{{ capacidad(f.equipo) }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ operadorDe(f) }}</td>
                      <td class="px-3 py-2.5">
                        <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap ' + estado(f).tono">{{ estado(f).texto }}</span>
                      </td>
                      <td class="px-3 py-2.5 text-texto-suave" [class.hidden]="vista.abiertaId()">{{ textoGps(f) }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="px-3 py-12 text-center text-texto-suave">
                        {{ tablero.isLoading() ? 'Cargando la flota…' : todas().length ? 'Ninguna unidad coincide con la búsqueda o las plantas elegidas.' : 'Aún no hay unidades: da de alta la primera.' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        @if (vista.abiertaId()) {
          <aside appPanelLateral (cerrar)="cerrar()">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ previa() ? previa()!.equipo.numeroEconomico : 'Nueva unidad' }}</h2>
                @if (previa(); as f) {
                  <p class="text-sm text-texto-suave">{{ tipo(f.equipo) }} · {{ categoria(f.equipo) }}</p>
                }
              </div>
              <div class="-mt-1 -mr-1 flex shrink-0">
                @if (previa(); as f) {
                  <a [routerLink]="['/flota/unidades', f.equipo.id]" aria-label="Abrir ficha completa" title="Abrir ficha completa" [class]="botonIcono">
                    <ui-icon [icono]="iconos.completa" [tamano]="17" />
                  </a>
                }
                <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar()">
                  <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
                </button>
              </div>
            </div>

            @if (previa() && !editando()) {
              @let f = previa()!;
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + estado(f).tono">{{ estado(f).texto }}</span>
                @if (puede('flota.equipos.editar')) {
                  <button type="button" [class]="botonSecundario" (click)="editando.set(true)">
                    <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
                  </button>
                }
              </div>
              @if (puede('flota.equipos.editar') && f.equipo.activo) {
                <div class="mt-3" role="group" aria-label="Cambiar el estado">
                  <p class="text-xs font-bold tracking-wide text-texto-suave uppercase">Cambiar estado</p>
                  <div class="mt-1 flex flex-wrap gap-2">
                    @for (e of estados; track e) {
                      <button type="button" [class]="botonChico" [attr.aria-pressed]="f.equipo.estado === e" [disabled]="ocupado() || f.equipo.estado === e" (click)="cambiarEstado([f.equipo.id], e)">
                        {{ nombreEstadoUnidad[e] }}
                      </button>
                    }
                  </div>
                </div>
              }
              <dl class="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-texto-suave">Plantas</dt>
                <dd>{{ plantasDe(f) }}</dd>
                <dt class="text-texto-suave">Capacidad</dt>
                <dd>{{ capacidad(f.equipo) }}</dd>
                <dt class="text-texto-suave">Operador</dt>
                <dd>{{ operadorDe(f) }}</dd>
                <dt class="text-texto-suave">Marca y modelo</dt>
                <dd>{{ subtitulo(f.equipo) || '—' }}</dd>
                @if (f.viaje; as v) {
                  <dt class="text-texto-suave">Va en</dt>
                  <dd>
                    <a [routerLink]="['/ventas/ordenes', v.pedidoFolio]" class="font-medium underline-offset-4 hover:text-epico hover:underline">{{ v.pedidoFolio }}</a>
                  </dd>
                }
                <dt class="text-texto-suave">Ubicación</dt>
                <dd>{{ textoPosicion(f) }}</dd>
                @if (f.equipo.notas) {
                  <dt class="text-texto-suave">Notas</dt>
                  <dd>{{ f.equipo.notas }}</dd>
                }
              </dl>
              <app-recorridos-unidad class="mt-4 border-t border-acero/60 pt-4" [equipoId]="f.equipo.id" />
            } @else {
              <!-- Una instancia por unidad: el formulario se vuelve a llenar al cambiar de fila -->
              @for (u of [previa()?.equipo ?? null]; track u?.id ?? 'nueva') {
                <app-form-unidad
                  class="mt-4 block border-t border-acero/60 pt-4"
                  [unidad]="u"
                  [plantas]="plantas.lista()"
                  [dispositivos]="dispositivos()"
                  [gpsConfigurado]="gpsConectado()"
                  [guardando]="ocupado()"
                  [ocupados]="numerosOcupados(u)"
                  [operadores]="operadores()"
                  (listo)="guardar($event)"
                  (descartar)="u ? editando.set(false) : cerrar()"
                />
              }
            }
            <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
            <p class="mt-3 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorGuardar() }}</p>
          </aside>
        }
      </div>
    }
  `,
})
export default class Flota {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly router = inject(Router);
  protected readonly conBackend = inject(VentasService).conBackend;
  protected readonly plantas = plantasFlota();

  protected readonly tablero = resource({ loader: () => (this.conBackend ? this.api.tablero() : Promise.resolve(null)) });
  private readonly gps = resource({ loader: () => (this.conBackend ? this.api.gps().catch(() => null) : Promise.resolve(null)) });
  protected readonly todas = computed(() => (this.tablero.hasValue() ? (this.tablero.value()?.equipos ?? []) : []));
  protected readonly error = computed(() => (this.tablero.error() ? mensajeDe(this.tablero.error()) : ''));
  protected readonly gpsConectado = computed(() => this.tablero.hasValue() && !!this.tablero.value()?.gps.configurado);
  protected readonly dispositivos = computed(() => (this.gps.hasValue() ? (this.gps.value()?.dispositivos ?? []) : []));
  private readonly catalogoOperadores = resource({
    loader: () => (this.conBackend ? this.api.lista<Operador>('operadores').catch(() => [] as Operador[]) : Promise.resolve([] as Operador[])),
  });
  protected readonly operadores = computed(() => (this.catalogoOperadores.hasValue() ? this.catalogoOperadores.value() : []));

  protected readonly iconos = { cerrar: X, completa: Maximize2, editar: PencilLine };
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly estados = ESTADOS;
  protected readonly nombreEstadoUnidad = ESTADO_UNIDAD;
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon disabled:opacity-50 aria-pressed:border-epico aria-pressed:bg-epico/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly estado = estadoFila;
  protected readonly tipo = (u: Unidad) => nombreTipo(u.tipo);
  protected readonly categoria = (u: Unidad) => CATEGORIAS_UNIDAD[categoriaDe(u.tipo)];
  protected readonly capacidad = textoCapacidad;
  protected subtitulo(u: Unidad): string {
    return [u.marca, u.modelo, u.anio, u.placas].filter(Boolean).join(' · ') || u.descripcion || '';
  }
  protected plantasDe(f: FilaTablero): string {
    return (f.plantaNombres?.length ? f.plantaNombres : [f.plantaNombre]).join(', ');
  }
  protected operadorDe(f: FilaTablero): string {
    return f.operador?.nombre ?? this.operadores().find((o) => o.id === f.equipo.operadorId)?.nombre ?? f.equipo.operadorNombre ?? '—';
  }
  protected textoGps(f: FilaTablero): string {
    if (!f.equipo.gpsId) return 'Sin GPS';
    return f.posicion ? `Hace ${this.minutos(f.posicion.fecha)} min` : 'Vinculado, sin posición';
  }
  protected textoPosicion(f: FilaTablero): string {
    if (!f.equipo.gpsId) return 'Sin GPS: se sigue por los horarios de sus viajes.';
    if (!f.posicion) return 'Vinculado a Traccar, aún sin posición.';
    const vel = f.posicion.velocidadKmh != null ? ` · ${Math.round(f.posicion.velocidadKmh)} km/h` : '';
    return `${f.posicion.lat.toFixed(5)}, ${f.posicion.lng.toFixed(5)} · hace ${this.minutos(f.posicion.fecha)} min${vel}`;
  }
  private minutos(iso: string): number {
    return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  }

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  /** Las de las plantas elegidas en el encabezado (una unidad de varias plantas se ve en cualquiera de ellas). */
  private readonly base = computed(() => this.todas().filter((x) => this.plantas.visible(x.equipo.sucursalIds?.length ? x.equipo.sucursalIds : [x.equipo.sucursalId])));
  protected readonly filas = computed(() => {
    const q = normalizar(this.texto().trim());
    const f = this.filtros();
    return this.base()
      .filter(
        (x) =>
          !q ||
          normalizar([x.equipo.numeroEconomico, x.equipo.placas, x.equipo.marca, x.equipo.modelo, this.operadorDe(x), x.equipo.descripcion, this.tipo(x.equipo)].join(' ')).includes(q),
      )
      .filter(
        (x) =>
          pasaFiltro(f, 'categoria', categoriaDe(x.equipo.tipo)) &&
          pasaFiltro(f, 'tipo', x.equipo.tipo) &&
          pasaFiltro(f, 'estado', estadoFila(x).id) &&
          pasaFiltro(f, 'gps', x.equipo.gpsId ? 'con' : 'sin'),
      )
      .sort((a, b) => a.equipo.numeroEconomico.localeCompare(b.equipo.numeroEconomico, 'es', { numeric: true }));
  });
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const t = this.base();
    return [
      { id: 'categoria', titulo: 'Categoría', opciones: opcionesDe(t, (x) => categoriaDe(x.equipo.tipo), (c) => CATEGORIAS_UNIDAD[c as keyof typeof CATEGORIAS_UNIDAD]) },
      { id: 'tipo', titulo: 'Tipo', opciones: opcionesDe(t, (x) => x.equipo.tipo, (id) => nombreTipo(id as Unidad['tipo'])) },
      { id: 'estado', titulo: 'Estado', opciones: opcionesDe(t, (x) => estadoFila(x).id, (id) => this.nombreEstado(id)) },
      { id: 'gps', titulo: 'GPS', opciones: opcionesDe(t, (x) => (x.equipo.gpsId ? 'con' : 'sin'), (id) => (id === 'con' ? 'Con GPS' : 'Sin GPS')) },
    ];
  });
  private nombreEstado(id: string): string {
    return { disponible: 'Disponible', en_viaje: 'En viaje', mantenimiento: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio', baja: 'Dada de baja' }[id] ?? id;
  }
  protected readonly resumen = computed(() => {
    const ids = this.base().filter((x) => x.equipo.activo).map((x) => estadoFila(x).id);
    return {
      disponibles: ids.filter((i) => i === 'disponible').length,
      enViaje: ids.filter((i) => i === 'en_viaje').length,
      taller: ids.filter((i) => i === 'mantenimiento' || i === 'fuera_de_servicio').length,
    };
  });

  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((f) => ({ id: f.equipo.id }))));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}`;
    return n === 1 ? '1 unidad' : `${n} unidades`;
  });

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.todas().find((x) => x.equipo.id === this.vista.abiertaId()) ?? null);
  /** Al abrir otra unidad se sale de la edición: por omisión solo se ve. */
  protected readonly editando = linkedSignal({ source: this.vista.abiertaId, computation: () => false });
  protected readonly aviso = signal('');
  protected readonly avisoLista = signal('');
  protected readonly errorGuardar = signal('');
  protected readonly ocupado = signal(false);

  protected abrir(id: string): void {
    this.aviso.set('');
    this.errorGuardar.set('');
    this.vista.abrir(id);
  }
  protected cerrar(): void {
    this.vista.cerrar();
  }
  protected completa(id: string): void {
    void this.router.navigate(['/flota/unidades', id]);
  }
  protected nueva(): void {
    this.abrir('nueva');
  }
  protected numerosOcupados(u: Unidad | null): string[] {
    return this.todas().filter((x) => x.equipo.id !== u?.id).map((x) => x.equipo.numeroEconomico);
  }

  protected async guardar(u: Omit<Unidad, 'id'> & { id?: string }): Promise<void> {
    await this.hacer(async () => {
      // PUT manda el registro completo: lo que trae la API más lo editado
      const r = await this.api.guardar(u.id ? { ...this.previa()!.equipo, ...u } : u);
      this.aviso.set(u.id ? `${r.numeroEconomico} actualizada.` : `${r.numeroEconomico} dada de alta.`);
      this.editando.set(false);
      if (!u.id) this.vista.abrir(r.id);
    });
  }

  /** Cambiar el estado de una o varias (sin entrar a editar). */
  protected async cambiarEstado(ids: string[], estado: EstadoUnidad): Promise<void> {
    const unidades = this.todas().filter((x) => ids.includes(x.equipo.id) && x.equipo.estado !== estado).map((x) => x.equipo);
    await this.hacer(async () => {
      await Promise.all(unidades.map((u) => this.api.guardar({ ...u, estado })));
      this.mensaje(ids.length, `${unidades.length === 1 ? unidades[0]?.numeroEconomico + ': ' : unidades.length + ' unidades: '}${ESTADO_UNIDAD[estado]}.`);
    });
  }

  protected async darDeBaja(ids: string[]): Promise<void> {
    const unidades = this.todas().filter((x) => ids.includes(x.equipo.id) && x.equipo.activo).map((x) => x.equipo);
    if (!unidades.length || !confirm(`¿Dar de baja ${unidades.map((u) => u.numeroEconomico).join(', ')}? Ya no se asignarán.`)) return;
    await this.hacer(async () => {
      await Promise.all(unidades.map((u) => this.api.guardar({ ...u, activo: false })));
      this.mensaje(ids.length, `${unidades.length === 1 ? unidades[0].numeroEconomico + ' dada' : unidades.length + ' unidades dadas'} de baja.`);
      this.casillas.marcarTodas(false);
    });
  }

  /** El aviso va en la vista previa si se hizo desde ahí; si no, arriba de la tabla. */
  private mensaje(n: number, texto: string): void {
    (n === 1 && this.vista.abiertaId() ? this.aviso : this.avisoLista).set(texto);
  }

  private async hacer(f: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    this.avisoLista.set('');
    this.errorGuardar.set('');
    try {
      await f();
      this.tablero.reload();
    } catch (e) {
      (this.vista.abiertaId() ? this.errorGuardar : this.avisoLista).set(mensajeDe(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
