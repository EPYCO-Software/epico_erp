import { Component, OnInit, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, min, required, submit } from '@angular/forms/signals';
import { PencilLine, X } from 'lucide';
import { Buscador, FieldError, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { plantasFlota } from './plantas-flota';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import {
  ACCIONES_MANTENIMIENTO,
  ESTADO_MANTENIMIENTO,
  EstadoMantenimiento,
  FlotaApi,
  Mantenimiento as Servicio,
  TONO_MANTENIMIENTO,
  Unidad,
  fechaCorta,
  textoVence,
} from './flota-api';

interface Modelo {
  equipoId: string;
  tipo: 'preventivo' | 'correctivo';
  descripcion: string;
  programadoPara: string;
  programadoKm: number | null;
  costo: number | null;
  taller: string;
  notas: string;
}

/**
 * Logística → Mantenimiento (/flota/mantenimiento): servicios preventivos y correctivos de cada unidad. Programado ›
 * En proceso (la unidad pasa a "En mantenimiento" y sale de las disponibles) › Terminado (vuelve a disponible), o
 * Cancelado. ?unidad=ID llega filtrado (desde la ficha de la unidad).
 */
@Component({
  selector: 'app-mantenimiento-flota',
  imports: [Buscador, EnEncabezado, PanelLateral, Icon, FormField, FieldError, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('flota.mantenimiento.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="abrir(null)">Programar servicio</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Mantenimiento</h1>
        </div>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-servicio" etiqueta="Buscar servicios por unidad, descripción o taller" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ casillas.marcadas().length ? conteo() : enTaller() + ' en taller · ' + programados() + ' programados' }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">El mantenimiento necesita el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            <div tabindex="0" role="region" aria-label="Tabla de servicios de mantenimiento" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-220]="!vista.abiertaId()">
                <caption class="sr-only">Servicios de mantenimiento. Clic o Enter abre su vista previa. La casilla solo marca.</caption>
                <thead [class]="cajas.titulos">
                  <tr>
                    <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                      <input
                        type="checkbox"
                        class="casilla block"
                        aria-label="Marcar todos"
                        [checked]="casillas.todas()"
                        [indeterminate]="casillas.algunas()"
                        [disabled]="!filas().length"
                        (change)="casillas.marcarTodas($any($event.target).checked)"
                      />
                    </th>
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Unidad</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Servicio</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Tipo</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Programado</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="vista.abiertaId()">Costo</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Taller</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of filas(); track m.id) {
                    <tr
                      [id]="'fila-' + m.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="m.id === vista.abiertaId() ? 'true' : null"
                      (click)="abrir(m)"
                      (keydown.enter)="$event.target === $event.currentTarget && abrir(m)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          class="casilla block"
                          [attr.aria-label]="'Marcar ' + m.descripcion + ' de ' + numero(m.equipoId)"
                          [checked]="casillas.marcadas().includes(m.id!)"
                          (change)="casillas.alternar(m.id!)"
                        />
                      </td>
                      <td class="py-2.5 pr-3 pl-1 font-semibold">{{ numero(m.equipoId) }}</td>
                      <td class="px-3 py-2.5">{{ m.descripcion }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ m.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo' }}</td>
                      <td class="px-3 py-2.5">
                        <span class="block">{{ programado(m) }}</span>
                        @if (m.estado === 'programado' && m.programadoPara) {
                          <span [class]="'block text-xs ' + vence(m).tono">{{ vence(m).texto }}</span>
                        }
                      </td>
                      <td class="px-3 py-2.5">
                        <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap ' + tono[m.estado]">{{ estados[m.estado] }}</span>
                      </td>
                      <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="vista.abiertaId()">{{ m.costo != null ? '$' + pesos(m.costo) : '—' }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ m.taller || '—' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="px-3 py-12 text-center text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : 'Sin servicios con esta búsqueda.' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        @if (vista.abiertaId()) {
          <aside appPanelLateral (cerrar)="vista.cerrar()">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ editando() ? editando()!.descripcion : 'Programar servicio' }}</h2>
                @if (editando(); as m) {
                  <p class="text-sm text-texto-suave">
                    <a [routerLink]="['/flota/unidades', m.equipoId]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ numero(m.equipoId) }}</a>
                    · <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + tono[m.estado]">{{ estados[m.estado] }}</span>
                  </p>
                }
              </div>
              <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="vista.cerrar()">
                <ui-icon [icono]="iconoCerrar" [tamano]="18" />
              </button>
            </div>

            @if (editando(); as m) {
              @if (acciones(m).length && puede('flota.mantenimiento.editar')) {
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (a of acciones(m); track a.estado) {
                    <button type="button" [class]="a.estado === 'cancelado' ? botonSecundario : 'boton-primario h-10 w-auto px-4 text-sm'" [disabled]="guardando()" (click)="cambiarEstado(m, a.estado)">
                      {{ a.texto }}
                    </button>
                  }
                </div>
              }
              @if (m.inicioEn || m.finEn) {
                <p class="mt-2 text-sm text-texto-suave">
                  {{ m.inicioEn ? 'Entró a taller el ' + fecha(m.inicioEn) : '' }}{{ m.finEn ? ' · terminó el ' + fecha(m.finEn) : '' }}
                </p>
              }
            }

            @if (editando() && !modoEdicion()) {
              @let m = editando()!;
              @if (editable()) {
                <button type="button" [class]="botonSecundario + ' mt-3 gap-2'" (click)="modoEdicion.set(true)"><ui-icon [icono]="iconoEditar" [tamano]="16" />Editar</button>
              }
              <dl class="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-texto-suave">Tipo</dt>
                <dd>{{ m.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo' }}</dd>
                <dt class="text-texto-suave">Programado</dt>
                <dd>{{ programado(m) }}</dd>
                <dt class="text-texto-suave">Costo</dt>
                <dd class="tabular-nums">{{ m.costo != null ? '$' + pesos(m.costo) : '—' }}</dd>
                <dt class="text-texto-suave">Taller</dt>
                <dd>{{ m.taller || '—' }}</dd>
                @if (m.notas) {
                  <dt class="text-texto-suave">Notas</dt>
                  <dd>{{ m.notas }}</dd>
                }
              </dl>
            } @else {
            <form novalidate class="mt-4 grid gap-4 sm:grid-cols-2" (submit)="guardar($event)">
              <fieldset class="contents" [disabled]="!editable()">
                <div class="sm:col-span-2">
                  <label for="serv-unidad" [class]="etiqueta">Unidad</label>
                  <select id="serv-unidad" class="campo mt-1 h-10 px-2" aria-describedby="serv-unidad-error" [formField]="f.equipoId">
                    <option value="" disabled>Elige la unidad</option>
                    @for (u of unidades(); track u.id) {
                      <option [value]="u.id">{{ u.numeroEconomico }}</option>
                    }
                  </select>
                  <ui-field-error [campo]="f.equipoId" errorId="serv-unidad-error" />
                </div>
                <div class="sm:col-span-2">
                  <label for="serv-descripcion" [class]="etiqueta">Servicio</label>
                  <input id="serv-descripcion" class="campo mt-1 h-10 px-3" placeholder="Cambio de aceite, frenos, servicio 10,000 km…" aria-describedby="serv-descripcion-error" [formField]="f.descripcion" />
                  <ui-field-error [campo]="f.descripcion" errorId="serv-descripcion-error" />
                </div>
                <div>
                  <label for="serv-tipo" [class]="etiqueta">Tipo</label>
                  <select id="serv-tipo" class="campo mt-1 h-10 px-2" [formField]="f.tipo">
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                  </select>
                </div>
                <div>
                  <label for="serv-fecha" [class]="etiqueta">Programado para</label>
                  <input id="serv-fecha" type="date" class="campo mt-1 h-10 px-3" [formField]="f.programadoPara" />
                </div>
                <div>
                  <label for="serv-km" [class]="etiqueta">O a los (km)</label>
                  <input id="serv-km" type="number" class="campo mt-1 h-10 px-3 text-right tabular-nums" aria-describedby="serv-km-error" [formField]="f.programadoKm" />
                  <ui-field-error [campo]="f.programadoKm" errorId="serv-km-error" />
                </div>
                <div>
                  <label for="serv-costo" [class]="etiqueta">Costo ($)</label>
                  <input id="serv-costo" type="number" step="0.01" class="campo mt-1 h-10 px-3 text-right tabular-nums" aria-describedby="serv-costo-error" [formField]="f.costo" />
                  <ui-field-error [campo]="f.costo" errorId="serv-costo-error" />
                </div>
                <div class="sm:col-span-2">
                  <label for="serv-taller" [class]="etiqueta">Taller</label>
                  <input id="serv-taller" class="campo mt-1 h-10 px-3" [formField]="f.taller" />
                </div>
                <div class="sm:col-span-2">
                  <label for="serv-notas" [class]="etiqueta">Notas</label>
                  <textarea id="serv-notas" rows="2" class="campo mt-1 px-3 py-2" [formField]="f.notas"></textarea>
                </div>
                @if (editable()) {
                  <div class="flex flex-wrap gap-2 sm:col-span-2">
                    <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()">{{ editando() ? 'Guardar cambios' : 'Programar' }}</button>
                    <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
                  </div>
                }
              </fieldset>
            </form>
            }
            <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
            <p class="mt-3 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorGuardar() }}</p>
          </aside>
        }
      </div>
    }
  `,
})
export default class MantenimientoFlota implements OnInit {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  /** ?unidad=ID: llega filtrado por esa unidad. */
  readonly unidad = input<string>();

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly pesos = pesos;
  protected readonly estados = ESTADO_MANTENIMIENTO;
  protected readonly tono = TONO_MANTENIMIENTO;
  protected readonly iconoCerrar = X;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  private readonly plantas = plantasFlota();
  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.lista<Servicio>('mantenimientos') : Promise.resolve([] as Servicio[])) });
  private readonly todos = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  private readonly unidadesRes = resource({ loader: () => (this.conBackend ? this.api.tablero().then((t) => t.equipos.map((f) => f.equipo)) : Promise.resolve([] as Unidad[])) });
  protected readonly unidades = computed(() =>
    (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).filter((u) => u.activo).sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', { numeric: true })),
  );
  private plantasDe(equipoId: string): string[] {
    const u = (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).find((x) => x.id === equipoId);
    return u ? (u.sucursalIds?.length ? u.sucursalIds : [u.sucursalId]) : [];
  }
  protected numero(id: string): string {
    return (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).find((u) => u.id === id)?.numeroEconomico ?? '—';
  }
  protected programado(m: Servicio): string {
    return [m.programadoPara && fechaCorta(m.programadoPara), m.programadoKm != null && `${m.programadoKm.toLocaleString('es-MX')} km`].filter(Boolean).join(' · ') || '—';
  }
  protected vence(m: Servicio) {
    return textoVence(m.programadoPara);
  }
  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso));
  }
  protected acciones(m: Servicio) {
    return ACCIONES_MANTENIMIENTO[m.estado];
  }
  protected readonly enTaller = computed(() => this.todos().filter((m) => m.estado === 'en_proceso').length);
  protected readonly programados = computed(() => this.todos().filter((m) => m.estado === 'programado').length);

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  ngOnInit(): void {
    const u = this.unidad();
    if (u) this.filtros.set({ unidad: [u] });
  }
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'estado', titulo: 'Estado', opciones: opcionesDe(this.todos(), (m) => m.estado, (id) => ESTADO_MANTENIMIENTO[id as EstadoMantenimiento]) },
    { id: 'tipo', titulo: 'Tipo', opciones: opcionesDe(this.todos(), (m) => m.tipo, (id) => (id === 'preventivo' ? 'Preventivo' : 'Correctivo')) },
    { id: 'unidad', titulo: 'Unidad', opciones: opcionesDe(this.todos(), (m) => m.equipoId, (id) => this.numero(id)) },
  ]);
  /** En taller primero, luego programados por fecha, luego el resto. */
  private readonly ordenEstado: Record<EstadoMantenimiento, number> = { en_proceso: 0, programado: 1, terminado: 2, cancelado: 3 };
  protected readonly filas = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const f = this.filtros();
    return this.todos()
      .filter((m) => this.plantas.visible(this.plantasDe(m.equipoId)))
      .filter((m) => !q || `${this.numero(m.equipoId)} ${m.descripcion} ${m.taller ?? ''}`.toLowerCase().includes(q))
      .filter((m) => pasaFiltro(f, 'estado', m.estado) && pasaFiltro(f, 'tipo', m.tipo) && pasaFiltro(f, 'unidad', m.equipoId))
      .sort((a, b) => this.ordenEstado[a.estado] - this.ordenEstado[b.estado] || (a.programadoPara ?? '9999').localeCompare(b.programadoPara ?? '9999'));
  });

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((x) => ({ id: x.id! }))));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    return m ? `${m} de ${n} seleccionados` : `${n} ${n === 1 ? 'registro' : 'registros'}`;
  });
  /** Por omisión solo se ve; el alta entra directo a editar. */
  protected readonly modoEdicion = linkedSignal({ source: this.vista.abiertaId, computation: (id) => id === 'nueva' || id === 'nuevo' });
  protected readonly iconoEditar = PencilLine;
  protected descartar(): void {
    const m = this.editando();
    if (m) {
      this.abrir(m);
      this.modoEdicion.set(false);
    } else this.vista.cerrar();
  }
  protected readonly editando = signal<Servicio | null>(null);
  /** Terminados y cancelados quedan de solo lectura. */
  protected readonly editable = computed(() => {
    const m = this.editando();
    return m ? this.puede('flota.mantenimiento.editar') && !['terminado', 'cancelado'].includes(m.estado) : this.puede('flota.mantenimiento.crear');
  });
  protected readonly modelo = signal<Modelo>(this.vacio());
  protected readonly f = form(this.modelo, (m) => {
    required(m.equipoId, { message: 'Elige la unidad.' });
    required(m.descripcion, { message: 'Describe el servicio.' });
    min(m.programadoKm, 0, { message: 'No puede ser negativo.' });
    min(m.costo, 0, { message: 'No puede ser negativo.' });
  });
  private vacio(): Modelo {
    return { equipoId: this.unidad() ?? '', tipo: 'preventivo', descripcion: '', programadoPara: '', programadoKm: null, costo: null, taller: '', notas: '' };
  }
  protected readonly guardando = signal(false);
  protected readonly aviso = signal('');
  protected readonly errorGuardar = signal('');

  protected abrir(m: Servicio | null): void {
    this.aviso.set('');
    this.errorGuardar.set('');
    this.editando.set(m);
    this.modelo.set(
      m
        ? {
            equipoId: m.equipoId,
            tipo: m.tipo,
            descripcion: m.descripcion,
            programadoPara: m.programadoPara?.slice(0, 10) ?? '',
            programadoKm: m.programadoKm,
            costo: m.costo,
            taller: m.taller ?? '',
            notas: m.notas ?? '',
          }
        : this.vacio(),
    );
    this.vista.abrir(m?.id ?? 'nuevo');
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      await this.hacer(async () => {
        const r = await this.api.guardarRegistro<Servicio>('mantenimientos', {
          ...(this.editando() ?? { estado: 'programado' as const, inicioEn: null, finEn: null }),
          equipoId: m.equipoId,
          tipo: m.tipo,
          descripcion: m.descripcion.trim(),
          programadoPara: m.programadoPara || null,
          programadoKm: m.programadoKm,
          costo: m.costo,
          taller: m.taller.trim() || null,
          notas: m.notas.trim() || null,
        });
        this.aviso.set(this.editando() ? 'Cambios guardados.' : `Servicio programado para ${this.numero(r.equipoId)}.`);
        this.editando.set(r);
        this.modoEdicion.set(false);
        if (r.id) this.vista.abrir(r.id);
      });
      return undefined;
    });
    if (valido) return;
    if (this.f.equipoId().invalid()) document.getElementById('serv-unidad')?.focus();
    else if (this.f.descripcion().invalid()) document.getElementById('serv-descripcion')?.focus();
  }

  protected async cambiarEstado(m: Servicio, estado: EstadoMantenimiento): Promise<void> {
    if (estado === 'cancelado' && !confirm(`¿Cancelar "${m.descripcion}"?`)) return;
    await this.hacer(async () => {
      const r = await this.api.estadoMantenimiento(m.id!, estado);
      this.editando.set(r);
      this.aviso.set(`${this.numero(m.equipoId)}: ${ESTADO_MANTENIMIENTO[estado]}.`);
      this.unidadesRes.reload();
    });
  }

  private async hacer(f: () => Promise<void>): Promise<void> {
    this.guardando.set(true);
    this.errorGuardar.set('');
    this.aviso.set('');
    try {
      await f();
      this.datos.reload();
    } catch (err) {
      this.errorGuardar.set(mensajeDe(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
