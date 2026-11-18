import { Component, OnInit, computed, effect, inject, input, resource, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { X } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { FlotaApi, Inspeccion, Operador, PuntoChecklist, RESULTADO_INSPECCION, ResultadoInspeccion, Unidad, resultadoDe } from './flota-api';
import { Firma } from './firma';
import { plantasFlota } from './plantas-flota';

const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Logística → Control → Inspecciones (/flota/inspecciones), como la de Loop4: el checklist antes de salir (llantas,
 * frenos, tambor, luces…, según el tipo de unidad), con odómetro, fotos y firma. Si falla un punto crítico queda
 * rechazada y la unidad no se asigna hasta un mantenimiento. Las inspecciones no se editan: son el registro de ese
 * momento. ?unidad=ID llega filtrado y con esa unidad para la nueva.
 */
@Component({
  selector: 'app-inspecciones',
  imports: [Buscador, EnEncabezado, Firma, Icon, PanelLateral, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('flota.inspecciones.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="nueva()">Nueva inspección</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Inspecciones</h1>
        </div>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-inspeccion" etiqueta="Buscar por unidad o inspector" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">Las inspecciones necesitan el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            <div tabindex="0" role="region" aria-label="Tabla de inspecciones" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-200]="!vista.abiertaId()">
                <caption class="sr-only">Inspecciones de unidades, la más reciente primero. Clic o Enter abre su vista previa. La casilla solo marca.</caption>
                <thead [class]="cajas.titulos">
                  <tr>
                    <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                      <input type="checkbox" class="casilla block" aria-label="Marcar todas" [checked]="casillas.todas()" [indeterminate]="casillas.algunas()" [disabled]="!filas().length" (change)="casillas.marcarTodas($any($event.target).checked)" />
                    </th>
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Fecha</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Unidad</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Resultado</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Inspector</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="vista.abiertaId()">Fallas</th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of filas(); track i.id) {
                    <tr
                      [id]="'fila-' + i.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="i.id === vista.abiertaId() ? 'true' : null"
                      (click)="vista.abrir(i.id!)"
                      (keydown.enter)="$event.target === $event.currentTarget && vista.abrir(i.id!)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input type="checkbox" class="casilla block" [attr.aria-label]="'Marcar inspección de ' + numero(i.equipoId) + ' del ' + fecha(i.fecha)" [checked]="casillas.marcadas().includes(i.id!)" (change)="casillas.alternar(i.id!)" />
                      </td>
                      <td class="py-2.5 pr-3 pl-1 whitespace-nowrap tabular-nums">{{ fecha(i.fecha) }}</td>
                      <td class="px-3 py-2.5 font-semibold">{{ numero(i.equipoId) }}</td>
                      <td class="px-3 py-2.5"><span [class]="'rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap ' + resultado(i).tono">{{ resultado(i).texto }}</span></td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ i.inspectorNombre }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="vista.abiertaId()">{{ fallas(i) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="px-3 py-12 text-center text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : 'Sin inspecciones con esta búsqueda.' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        @if (vista.abiertaId()) {
          <aside appPanelLateral (cerrar)="cerrar()">
            <div class="flex items-start justify-between gap-3">
              <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ previa() ? 'Inspección de ' + numero(previa()!.equipoId) : 'Nueva inspección' }}</h2>
              <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar()"><ui-icon [icono]="iconoCerrar" [tamano]="18" /></button>
            </div>

            @if (previa(); as i) {
              <p class="mt-1 text-sm">
                <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + resultado(i).tono">{{ resultado(i).texto }}</span>
                <span class="text-texto-suave"> · {{ fecha(i.fecha) }} · {{ i.inspectorNombre }}{{ i.odometroKm != null ? ' · ' + i.odometroKm.toLocaleString('es-MX') + ' km' : '' }}</span>
              </p>
              <p class="mt-1 text-sm"><a [routerLink]="['/flota/unidades', i.equipoId]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">Ver ficha de {{ numero(i.equipoId) }}</a></p>
              <ul class="mt-3 grid gap-1 text-sm" aria-label="Puntos revisados">
                @for (p of i.puntos; track p.clave) {
                  <li class="flex gap-2 rounded-lg bg-white/85 px-3 py-1.5">
                    <span [class]="p.ok ? 'font-bold text-[#2E5E4A]' : 'font-bold text-[#8E332C]'">{{ p.ok ? 'Bien' : 'Falla' }}</span>
                    <span>{{ p.texto }}{{ p.nota ? ': ' + p.nota : '' }}</span>
                  </li>
                }
              </ul>
              @if (i.notas) {
                <p class="mt-2 text-sm">Notas: {{ i.notas }}</p>
              }
              @if (imagenes().length) {
                <div class="mt-3 grid grid-cols-3 gap-2">
                  @for (img of imagenes(); track img.url) {
                    <img [src]="img.url" [alt]="img.alt" class="aspect-square w-full rounded-lg object-cover" />
                  }
                </div>
              }
            } @else {
              <form novalidate class="mt-4 grid gap-4" (submit)="guardar($event)">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label for="insp-unidad" [class]="etiqueta">Unidad</label>
                    <select id="insp-unidad" class="campo mt-1 h-10 px-2" [attr.aria-invalid]="intento() && !equipoId()" aria-describedby="insp-unidad-error" (change)="equipoId.set($any($event.target).value)">
                      <option value="" [selected]="!equipoId()" disabled>Elige la unidad</option>
                      @for (u of unidades(); track u.id) {
                        <option [value]="u.id" [selected]="u.id === equipoId()">{{ u.numeroEconomico }}</option>
                      }
                    </select>
                    <p id="insp-unidad-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !equipoId() ? 'Elige la unidad.' : '' }}</p>
                  </div>
                  <div>
                    <label for="insp-fecha" [class]="etiqueta">Fecha y hora</label>
                    <input id="insp-fecha" type="datetime-local" class="campo mt-1 h-10 px-3" [value]="fechaLocal()" (input)="fechaLocal.set($any($event.target).value)" />
                  </div>
                  <div>
                    <label for="insp-inspector" [class]="etiqueta">Inspector</label>
                    <input id="insp-inspector" class="campo mt-1 h-10 px-3" autocomplete="name" [attr.aria-invalid]="intento() && !inspector().trim()" aria-describedby="insp-inspector-error" [value]="inspector()" (input)="inspector.set($any($event.target).value)" />
                    <p id="insp-inspector-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !inspector().trim() ? 'Escribe quién inspecciona.' : '' }}</p>
                  </div>
                  <div>
                    <label for="insp-operador" [class]="etiqueta">Operador</label>
                    <select id="insp-operador" class="campo mt-1 h-10 px-2" (change)="operadorId.set($any($event.target).value)">
                      <option value="">Sin dato</option>
                      @for (o of operadores(); track o.id) {
                        <option [value]="o.id">{{ o.nombre }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label for="insp-odometro" [class]="etiqueta">Odómetro (km)</label>
                    <input id="insp-odometro" type="number" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="odometro() ?? ''" (input)="odometro.set($any($event.target).valueAsNumber || null)" />
                  </div>
                </div>

                @if (equipoId()) {
                  <fieldset>
                    <legend class="text-sm font-bold">Puntos a revisar</legend>
                    @if (checklist.isLoading()) {
                      <p class="mt-1 text-sm text-texto-suave">Cargando el checklist…</p>
                    }
                    <ul class="mt-2 grid gap-2">
                      @for (c of puntosChecklist(); track c.clave) {
                        <li class="rounded-lg bg-white/85 px-3 py-2 text-sm">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <span [id]="'insp-p-' + c.clave">{{ c.texto }}@if (c.critico) {<span class="ml-1 rounded bg-[#F6E3E1] px-1.5 text-[11px] font-bold text-[#8E332C]">Crítico</span>}</span>
                            <span class="flex gap-1" role="radiogroup" [attr.aria-labelledby]="'insp-p-' + c.clave">
                              <label [class]="opcion + ' has-checked:border-[#2E5E4A] has-checked:bg-[#E3EFE9] has-checked:text-[#2E5E4A]'"><input type="radio" class="sr-only" [name]="'insp-' + c.clave" [checked]="ok(c.clave)" (change)="marcar(c.clave, true)" />Bien</label>
                              <label [class]="opcion + ' has-checked:border-[#8E332C] has-checked:bg-[#F6E3E1] has-checked:text-[#8E332C]'"><input type="radio" class="sr-only" [name]="'insp-' + c.clave" [checked]="!ok(c.clave)" (change)="marcar(c.clave, false)" />Falla</label>
                            </span>
                          </div>
                          @if (!ok(c.clave)) {
                            <label [for]="'insp-nota-' + c.clave" class="sr-only">Qué falla en {{ c.texto }}</label>
                            <input [id]="'insp-nota-' + c.clave" class="campo mt-2 h-9 px-3" placeholder="¿Qué falla?" [value]="nota(c.clave)" (input)="anotar(c.clave, $any($event.target).value)" />
                          }
                        </li>
                      }
                    </ul>
                    @if (puntosChecklist().length) {
                      <p class="mt-2 text-sm" aria-live="polite">
                        Resultado: <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + estimado().tono">{{ estimado().texto }}</span>
                        @if (estimado().texto === 'Rechazada') {
                          <span class="text-[#8E332C]"> · la unidad no se asignará hasta un mantenimiento.</span>
                        }
                      </p>
                    }
                  </fieldset>
                }

                <div>
                  <label for="insp-notas" [class]="etiqueta">Notas</label>
                  <textarea id="insp-notas" rows="2" class="campo mt-1 px-3 py-2" [value]="notas()" (input)="notas.set($any($event.target).value)"></textarea>
                </div>
                <div>
                  <label for="insp-fotos" [class]="etiqueta">Fotos (opcional)</label>
                  <input id="insp-fotos" type="file" accept="image/*" multiple capture="environment" class="mt-1 block w-full text-sm" (change)="elegirFotos($any($event.target).files)" />
                  @if (fotos().length) {
                    <p class="mt-1 text-xs text-texto-suave">{{ fotos().length }} {{ fotos().length === 1 ? 'foto' : 'fotos' }}</p>
                  }
                </div>
                <div>
                  <p [class]="etiqueta">Firma del inspector</p>
                  <app-firma class="mt-1" etiqueta="Firma del inspector" />
                </div>
                <p class="text-sm font-medium text-critico empty:hidden" role="alert">{{ errorGuardar() }}</p>
                <div class="flex flex-wrap gap-2">
                  <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar inspección' }}</button>
                  <button type="button" [class]="botonSecundario" (click)="cerrar()">Descartar</button>
                </div>
              </form>
            }
            <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
          </aside>
        }
      </div>
    }
  `,
})
export default class Inspecciones implements OnInit {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  private readonly plantas = plantasFlota();
  /** ?unidad=ID */
  readonly unidad = input<string>();

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly iconoCerrar = X;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly opcion =
    'inline-flex h-8 cursor-pointer items-center rounded-lg border border-acero-oscuro bg-white px-3 text-xs font-semibold has-focus-visible:outline-2 has-focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.lista<Inspeccion>('inspecciones') : Promise.resolve([] as Inspeccion[])) });
  private readonly todas = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  private readonly unidadesRes = resource({ loader: () => (this.conBackend ? this.api.tablero().then((t) => t.equipos.map((f) => f.equipo)) : Promise.resolve([] as Unidad[])) });
  protected readonly unidades = computed(() =>
    (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).filter((u) => u.activo).sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', { numeric: true })),
  );
  private readonly operadoresRes = resource({ loader: () => (this.conBackend ? this.api.lista<Operador>('operadores').catch(() => [] as Operador[]) : Promise.resolve([] as Operador[])) });
  protected readonly operadores = computed(() => (this.operadoresRes.hasValue() ? this.operadoresRes.value().filter((o) => o.activo) : []));

  private unidadDe(id: string): Unidad | undefined {
    return (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).find((u) => u.id === id);
  }
  protected numero(id: string): string {
    return this.unidadDe(id)?.numeroEconomico ?? '—';
  }
  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }
  protected resultado(i: Inspeccion) {
    return RESULTADO_INSPECCION[i.resultado ?? 'aprobada'];
  }
  protected fallas(i: Inspeccion): number {
    return i.puntos.filter((p) => !p.ok).length;
  }

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  ngOnInit(): void {
    const u = this.unidad();
    if (u) this.filtros.set({ unidad: [u] });
  }
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'resultado', titulo: 'Resultado', opciones: opcionesDe(this.todas(), (i) => i.resultado ?? 'aprobada', (id) => RESULTADO_INSPECCION[id as ResultadoInspeccion].texto) },
    { id: 'unidad', titulo: 'Unidad', opciones: opcionesDe(this.todas(), (i) => i.equipoId, (id) => this.numero(id)) },
  ]);
  protected readonly filas = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const f = this.filtros();
    return this.todas()
      .filter((i) => {
        const u = this.unidadDe(i.equipoId);
        return !u || this.plantas.visible(u.sucursalIds?.length ? u.sucursalIds : [u.sucursalId]);
      })
      .filter((i) => (!q || `${this.numero(i.equipoId)} ${i.inspectorNombre}`.toLowerCase().includes(q)) && pasaFiltro(f, 'resultado', i.resultado ?? 'aprobada') && pasaFiltro(f, 'unidad', i.equipoId))
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  });
  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((i) => ({ id: i.id! }))));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    return m ? `${m} de ${n} seleccionadas` : `${n} ${n === 1 ? 'inspección' : 'inspecciones'}`;
  });

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.todas().find((i) => i.id === this.vista.abiertaId()) ?? null);
  /** Fotos y firma de la abierta (las imágenes piden el token: se bajan y se muestran como URL local). */
  protected readonly imagenes = signal<{ url: string; alt: string }[]>([]);
  constructor() {
    effect(async () => {
      const i = this.previa();
      untracked(() => this.imagenes()).forEach((x) => URL.revokeObjectURL(x.url));
      if (!i) return this.imagenes.set([]);
      const ids = [...i.fotoArchivoIds.map((id, n) => ({ id, alt: `Foto ${n + 1} de la inspección` })), ...(i.firmaArchivoId ? [{ id: i.firmaArchivoId, alt: `Firma de ${i.inspectorNombre}` }] : [])];
      const urls = await Promise.all(ids.map(async (x) => ({ url: await this.api.urlArchivo(x.id).catch(() => ''), alt: x.alt })));
      this.imagenes.set(urls.filter((x) => x.url));
    });
  }

  // ---------- Nueva ----------
  private readonly firma = viewChild(Firma);
  protected readonly equipoId = signal('');
  protected readonly fechaLocal = signal(aLocal(new Date()));
  protected readonly inspector = signal('');
  protected readonly operadorId = signal('');
  protected readonly odometro = signal<number | null>(null);
  protected readonly notas = signal('');
  protected readonly fotos = signal<File[]>([]);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal('');
  protected readonly errorGuardar = signal('');
  private readonly marcas = signal<Record<string, { ok: boolean; nota: string }>>({});

  protected readonly checklist = resource({
    params: () => {
      const u = this.unidadDe(this.equipoId());
      return u ? u.tipo : undefined;
    },
    loader: ({ params }) => this.api.checklist(params),
  });
  protected readonly puntosChecklist = computed<PuntoChecklist[]>(() => (this.checklist.hasValue() ? this.checklist.value() : []));
  protected ok(clave: string): boolean {
    return this.marcas()[clave]?.ok ?? true;
  }
  protected nota(clave: string): string {
    return this.marcas()[clave]?.nota ?? '';
  }
  protected marcar(clave: string, ok: boolean): void {
    this.marcas.update((m) => ({ ...m, [clave]: { ok, nota: m[clave]?.nota ?? '' } }));
  }
  protected anotar(clave: string, nota: string): void {
    this.marcas.update((m) => ({ ...m, [clave]: { ok: m[clave]?.ok ?? false, nota } }));
  }
  private readonly puntos = computed(() => this.puntosChecklist().map((c) => ({ clave: c.clave, texto: c.texto, ok: this.ok(c.clave), nota: this.ok(c.clave) ? null : this.nota(c.clave).trim() || null })));
  protected readonly estimado = computed(() => RESULTADO_INSPECCION[resultadoDe(this.puntos(), this.puntosChecklist())]);
  protected elegirFotos(lista: FileList | null): void {
    this.fotos.set(lista ? [...lista] : []);
  }

  protected nueva(): void {
    this.equipoId.set(this.unidad() ?? '');
    this.fechaLocal.set(aLocal(new Date()));
    this.operadorId.set('');
    this.odometro.set(null);
    this.notas.set('');
    this.fotos.set([]);
    this.marcas.set({});
    this.intento.set(false);
    this.aviso.set('');
    this.errorGuardar.set('');
    this.vista.abrir('nueva');
  }
  protected cerrar(): void {
    this.vista.cerrar();
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    this.intento.set(true);
    if (!this.equipoId()) return document.getElementById('insp-unidad')?.focus();
    if (!this.inspector().trim()) return document.getElementById('insp-inspector')?.focus();
    this.guardando.set(true);
    this.errorGuardar.set('');
    try {
      const fotoArchivoIds = await Promise.all(this.fotos().map((f) => this.api.subirArchivo(f, f.name, 'inspeccion')));
      const firma = await this.firma()?.png();
      const firmaArchivoId = firma ? await this.api.subirArchivo(firma, 'firma-inspeccion.png', 'firma') : null;
      const r = await this.api.guardarRegistro<Inspeccion>('inspecciones', {
        equipoId: this.equipoId(),
        // Sin cambiar la hora propuesta, la exacta (con segundos): dos inspecciones seguidas no empatan
        fecha: this.fechaLocal() === aLocal(new Date()) ? new Date().toISOString() : new Date(this.fechaLocal()).toISOString(),
        operadorId: this.operadorId() || null,
        inspectorNombre: this.inspector().trim(),
        puntos: this.puntos(),
        odometroKm: this.odometro(),
        firmaArchivoId,
        fotoArchivoIds,
        notas: this.notas().trim() || null,
      });
      this.datos.reload();
      this.aviso.set(`Inspección de ${this.numero(r.equipoId)} guardada: ${RESULTADO_INSPECCION[r.resultado ?? 'aprobada'].texto.toLowerCase()}.`);
      if (r.id) this.vista.abrir(r.id);
    } catch (err) {
      this.errorGuardar.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
