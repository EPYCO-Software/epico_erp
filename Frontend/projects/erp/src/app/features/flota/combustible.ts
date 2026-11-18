import { Component, OnInit, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormField, form, min, required, submit, validate } from '@angular/forms/signals';
import { PencilLine, X } from 'lucide';
import { Buscador, FieldError, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { plantasFlota } from './plantas-flota';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { CargaCombustible, FlotaApi, Operador, Unidad, rendimientos } from './flota-api';

/** "2026-11-18T09:30" (hora local del navegador) ↔ ISO UTC. */
const aLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

interface Modelo {
  equipoId: string;
  fecha: string;
  litros: number | null;
  costoTotal: number | null;
  odometroKm: number | null;
  horometro: number | null;
  operadorId: string;
  notas: string;
}

/**
 * Logística → Combustible (/flota/combustible): cargas de diésel por unidad (litros, costo, odómetro u horómetro) con su
 * rendimiento (km/L u L/h desde la carga anterior), totales del periodo y alta/edición en la ficha lateral.
 * ?unidad=ID llega filtrado (desde la ficha de la unidad).
 */
@Component({
  selector: 'app-combustible',
  imports: [Buscador, DecimalPipe, EnEncabezado, PanelLateral, Icon, FormField, FieldError, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('flota.combustible.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="abrir(null)">Nueva carga</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Combustible</h1>
        </div>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-carga" etiqueta="Buscar cargas por unidad u operador" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">El combustible necesita el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            <p class="flex flex-wrap gap-x-5 gap-y-1 border-b border-acero/50 px-4 py-2.5 text-sm text-texto-suave">
              <span><strong class="text-carbon tabular-nums">{{ totales().litros | number: '1.0-0' }}</strong> litros</span>
              <span><strong class="text-carbon tabular-nums">\${{ pesos(totales().costo) }}</strong> en diésel</span>
              <span><strong class="text-carbon tabular-nums">{{ totales().precio ? '$' + pesos(totales().precio!) : '—' }}</strong> por litro en promedio</span>
            </p>
            <div tabindex="0" role="region" aria-label="Tabla de cargas de combustible" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-220]="!vista.abiertaId()">
                <caption class="sr-only">Cargas de combustible, la más reciente primero. Clic o Enter abre su vista previa. La casilla solo marca.</caption>
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
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Fecha</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Unidad</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold">Litros</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold">Costo</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="vista.abiertaId()">Odómetro / horómetro</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold">Rendimiento</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Operador</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of filas(); track c.id) {
                    <tr
                      [id]="'fila-' + c.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="c.id === vista.abiertaId() ? 'true' : null"
                      (click)="abrir(c)"
                      (keydown.enter)="$event.target === $event.currentTarget && abrir(c)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          class="casilla block"
                          [attr.aria-label]="'Marcar ' + numero(c.equipoId) + ' ' + fecha(c.fecha)"
                          [checked]="casillas.marcadas().includes(c.id!)"
                          (change)="casillas.alternar(c.id!)"
                        />
                      </td>
                      <td class="py-2.5 pr-3 pl-1 whitespace-nowrap tabular-nums">{{ fecha(c.fecha) }}</td>
                      <td class="px-3 py-2.5 font-semibold">{{ numero(c.equipoId) }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums">{{ c.litros | number: '1.0-1' }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums">\${{ pesos(c.costoTotal) }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="vista.abiertaId()">
                        {{ c.odometroKm != null ? (c.odometroKm | number) + ' km' : c.horometro != null ? (c.horometro | number) + ' h' : '—' }}
                      </td>
                      <td class="px-3 py-2.5 text-right tabular-nums">{{ rendimiento(c) }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ operador(c.operadorId) }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="px-3 py-12 text-center text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : 'Sin cargas con esta búsqueda.' }}</td>
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
              <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ editando() ? 'Carga de ' + numero(editando()!.equipoId) : 'Nueva carga' }}</h2>
              <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="vista.cerrar()">
                <ui-icon [icono]="iconoCerrar" [tamano]="18" />
              </button>
            </div>
            @if (editando() && !modoEdicion()) {
              @let c = editando()!;
              @if (puede('flota.combustible.editar')) {
                <button type="button" [class]="botonSecundario + ' mt-3 gap-2'" (click)="modoEdicion.set(true)"><ui-icon [icono]="iconoEditar" [tamano]="16" />Editar</button>
              }
              <dl class="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-texto-suave">Fecha</dt>
                <dd>{{ fecha(c.fecha) }}</dd>
                <dt class="text-texto-suave">Litros</dt>
                <dd class="tabular-nums">{{ c.litros | number: '1.0-1' }} L</dd>
                <dt class="text-texto-suave">Costo</dt>
                <dd class="tabular-nums">\${{ pesos(c.costoTotal) }}{{ c.litros ? ' · $' + pesos(c.costoTotal / c.litros) + ' por litro' : '' }}</dd>
                <dt class="text-texto-suave">Odómetro</dt>
                <dd class="tabular-nums">{{ c.odometroKm != null ? (c.odometroKm | number) + ' km' : '—' }}</dd>
                <dt class="text-texto-suave">Horómetro</dt>
                <dd class="tabular-nums">{{ c.horometro != null ? (c.horometro | number) + ' h' : '—' }}</dd>
                <dt class="text-texto-suave">Rendimiento</dt>
                <dd class="tabular-nums">{{ rendimiento(c) }}</dd>
                <dt class="text-texto-suave">Operador</dt>
                <dd>{{ operador(c.operadorId) }}</dd>
                @if (c.notas) {
                  <dt class="text-texto-suave">Notas</dt>
                  <dd>{{ c.notas }}</dd>
                }
              </dl>
            } @else {
            <form novalidate class="mt-4 grid gap-4 sm:grid-cols-2" (submit)="guardar($event)">
              <fieldset class="contents" [disabled]="!puede(editando() ? 'flota.combustible.editar' : 'flota.combustible.crear')">
                <div class="sm:col-span-2">
                  <label for="carga-unidad" [class]="etiqueta">Unidad</label>
                  <select id="carga-unidad" class="campo mt-1 h-10 px-2" aria-describedby="carga-unidad-error" [formField]="f.equipoId">
                    <option value="" disabled>Elige la unidad</option>
                    @for (u of unidades(); track u.id) {
                      <option [value]="u.id">{{ u.numeroEconomico }}</option>
                    }
                  </select>
                  <ui-field-error [campo]="f.equipoId" errorId="carga-unidad-error" />
                </div>
                <div class="sm:col-span-2">
                  <label for="carga-fecha" [class]="etiqueta">Fecha y hora</label>
                  <input id="carga-fecha" type="datetime-local" class="campo mt-1 h-10 px-3" aria-describedby="carga-fecha-error" [formField]="f.fecha" />
                  <ui-field-error [campo]="f.fecha" errorId="carga-fecha-error" />
                </div>
                <div>
                  <label for="carga-litros" [class]="etiqueta">Litros</label>
                  <input id="carga-litros" type="number" step="0.1" class="campo mt-1 h-10 px-3 text-right tabular-nums" aria-describedby="carga-litros-error" [formField]="f.litros" />
                  <ui-field-error [campo]="f.litros" errorId="carga-litros-error" />
                </div>
                <div>
                  <label for="carga-costo" [class]="etiqueta">Costo total ($)</label>
                  <input id="carga-costo" type="number" step="0.01" class="campo mt-1 h-10 px-3 text-right tabular-nums" aria-describedby="carga-costo-error" [formField]="f.costoTotal" />
                  <ui-field-error [campo]="f.costoTotal" errorId="carga-costo-error" />
                </div>
                <div>
                  <label for="carga-odometro" [class]="etiqueta">Odómetro (km)</label>
                  <input id="carga-odometro" type="number" class="campo mt-1 h-10 px-3 text-right tabular-nums" aria-describedby="carga-odometro-error" [formField]="f.odometroKm" />
                  <ui-field-error [campo]="f.odometroKm" errorId="carga-odometro-error" />
                </div>
                <div>
                  <label for="carga-horometro" [class]="etiqueta">Horómetro (h)</label>
                  <input id="carga-horometro" type="number" step="0.1" class="campo mt-1 h-10 px-3 text-right tabular-nums" [formField]="f.horometro" />
                </div>
                <div class="sm:col-span-2">
                  <label for="carga-operador" [class]="etiqueta">Operador</label>
                  <select id="carga-operador" class="campo mt-1 h-10 px-2" [formField]="f.operadorId">
                    <option value="">Sin dato</option>
                    @for (o of operadores(); track o.id) {
                      <option [value]="o.id">{{ o.nombre }}</option>
                    }
                  </select>
                </div>
                <div class="sm:col-span-2">
                  <label for="carga-notas" [class]="etiqueta">Notas</label>
                  <input id="carga-notas" class="campo mt-1 h-10 px-3" [formField]="f.notas" />
                </div>
                @if (puede(editando() ? 'flota.combustible.editar' : 'flota.combustible.crear')) {
                  <div class="flex flex-wrap gap-2 sm:col-span-2">
                    <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()">{{ editando() ? 'Guardar cambios' : 'Registrar carga' }}</button>
                    <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
                  </div>
                }
              </fieldset>
            </form>
            }
            @if (editando(); as c) {
              <p class="mt-3 text-sm">
                <a [routerLink]="['/flota/unidades', c.equipoId]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">Ver ficha de {{ numero(c.equipoId) }}</a>
              </p>
            }
            <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
            <p class="mt-3 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorGuardar() }}</p>
          </aside>
        }
      </div>
    }
  `,
})
export default class Combustible implements OnInit {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  /** ?unidad=ID: llega filtrado por esa unidad. */
  readonly unidad = input<string>();

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly pesos = pesos;
  protected readonly iconoCerrar = X;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  private readonly plantas = plantasFlota();
  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.lista<CargaCombustible>('cargas-combustible') : Promise.resolve([] as CargaCombustible[])) });
  private readonly todas = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  private readonly unidadesRes = resource({ loader: () => (this.conBackend ? this.api.tablero().then((t) => t.equipos.map((f) => f.equipo)) : Promise.resolve([] as Unidad[])) });
  protected readonly unidades = computed(() =>
    (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).filter((u) => u.activo).sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, 'es', { numeric: true })),
  );
  private readonly operadoresRes = resource({ loader: () => (this.conBackend ? this.api.lista<Operador>('operadores').catch(() => [] as Operador[]) : Promise.resolve([] as Operador[])) });
  protected readonly operadores = computed(() => (this.operadoresRes.hasValue() ? this.operadoresRes.value() : []));

  protected numero(id: string): string {
    return (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).find((u) => u.id === id)?.numeroEconomico ?? '—';
  }
  protected operador(id: string | null): string {
    return id ? (this.operadores().find((o) => o.id === id)?.nombre ?? '—') : '—';
  }
  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }
  private readonly rend = computed(() => rendimientos(this.todas()));
  protected rendimiento(c: CargaCombustible): string {
    const r = this.rend().get(c.id ?? '');
    return r?.kmL != null ? `${r.kmL} km/L` : r?.lh != null ? `${r.lh} L/h` : '—';
  }

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  ngOnInit(): void {
    const u = this.unidad();
    if (u) this.filtros.set({ unidad: [u] });
  }
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'unidad', titulo: 'Unidad', opciones: opcionesDe(this.todas(), (c) => c.equipoId, (id) => this.numero(id)) },
  ]);
  protected readonly filas = computed(() => {
    const q = this.texto().trim().toLowerCase();
    return this.todas()
      .filter((c) => this.plantas.visible([c.sucursalId]))
      .filter((c) => (!q || `${this.numero(c.equipoId)} ${this.operador(c.operadorId)}`.toLowerCase().includes(q)) && pasaFiltro(this.filtros(), 'unidad', c.equipoId))
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  });
  protected readonly totales = computed(() => {
    const litros = this.filas().reduce((t, c) => t + c.litros, 0);
    const costo = this.filas().reduce((t, c) => t + c.costoTotal, 0);
    return { litros, costo, precio: litros ? costo / litros : null };
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
    const c = this.editando();
    if (c) {
      this.abrir(c);
      this.modoEdicion.set(false);
    } else this.vista.cerrar();
  }
  protected readonly editando = signal<CargaCombustible | null>(null);
  protected readonly modelo = signal<Modelo>(this.vacio());
  protected readonly f = form(this.modelo, (m) => {
    required(m.equipoId, { message: 'Elige la unidad.' });
    required(m.fecha, { message: 'Indica cuándo se cargó.' });
    required(m.litros, { message: 'Escribe los litros.' });
    min(m.litros, 0.1, { message: 'Debe ser mayor a cero.' });
    required(m.costoTotal, { message: 'Escribe el costo.' });
    min(m.costoTotal, 0, { message: 'No puede ser negativo.' });
    min(m.odometroKm, 0, { message: 'No puede ser negativo.' });
    // Entre la carga anterior y la siguiente de esa unidad (una carga con fecha atrasada no puede pasar a la siguiente)
    validate(m.odometroKm, ({ value, valueOf }) => {
      const v = value();
      if (v == null) return undefined;
      const { antes, despues } = this.vecinas(valueOf(m.equipoId), valueOf(m.fecha));
      if (antes != null && v < antes) return { kind: 'odometro', message: `No puede ser menor al de la carga anterior (${antes.toLocaleString('es-MX')} km).` };
      if (despues != null && v > despues) return { kind: 'odometro', message: `No puede ser mayor al de la carga siguiente (${despues.toLocaleString('es-MX')} km).` };
      return undefined;
    });
  });
  /** El odómetro más alto antes de esa fecha y el más bajo después, de esa unidad (sin contar la que se edita). */
  private vecinas(equipoId: string, fechaLocal: string): { antes: number | null; despues: number | null } {
    const t = fechaLocal ? new Date(fechaLocal).getTime() : Date.now();
    const km = this.todas().filter((c) => c.equipoId === equipoId && c.id !== this.editando()?.id && c.odometroKm != null);
    const antes = km.filter((c) => Date.parse(c.fecha) <= t).map((c) => c.odometroKm!);
    const despues = km.filter((c) => Date.parse(c.fecha) > t).map((c) => c.odometroKm!);
    return { antes: antes.length ? Math.max(...antes) : null, despues: despues.length ? Math.min(...despues) : null };
  }
  private vacio(): Modelo {
    return { equipoId: this.unidad() ?? '', fecha: aLocal(new Date().toISOString()), litros: null, costoTotal: null, odometroKm: null, horometro: null, operadorId: '', notas: '' };
  }
  protected readonly guardando = signal(false);
  protected readonly aviso = signal('');
  protected readonly errorGuardar = signal('');

  protected abrir(c: CargaCombustible | null): void {
    this.aviso.set('');
    this.errorGuardar.set('');
    this.editando.set(c);
    this.modelo.set(
      c
        ? {
            equipoId: c.equipoId,
            fecha: aLocal(c.fecha),
            litros: c.litros,
            costoTotal: c.costoTotal,
            odometroKm: c.odometroKm,
            horometro: c.horometro,
            operadorId: c.operadorId ?? '',
            notas: c.notas ?? '',
          }
        : this.vacio(),
    );
    this.vista.abrir(c?.id ?? 'nueva');
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.guardando.set(true);
      this.errorGuardar.set('');
      try {
        const r = await this.api.guardarRegistro<CargaCombustible>('cargas-combustible', {
          ...(this.editando() ?? { sucursalId: (this.unidadesRes.hasValue() ? this.unidadesRes.value() : []).find((u) => u.id === m.equipoId)?.sucursalId ?? null }),
          equipoId: m.equipoId,
          fecha: new Date(m.fecha).toISOString(),
          litros: m.litros!,
          costoTotal: m.costoTotal!,
          odometroKm: m.odometroKm,
          horometro: m.horometro,
          operadorId: m.operadorId || null,
          notas: m.notas.trim() || null,
        });
        this.datos.reload();
        this.aviso.set(this.editando() ? 'Cambios guardados.' : `Carga de ${this.numero(r.equipoId)} registrada.`);
        this.editando.set(r);
        this.modoEdicion.set(false);
        if (r.id) this.vista.abrir(r.id);
      } catch (err) {
        this.errorGuardar.set(mensajeDe(err));
      } finally {
        this.guardando.set(false);
      }
      return undefined;
    });
    if (valido) return;
    const f = this.f;
    const primero = ([
      [f.equipoId, 'carga-unidad'],
      [f.fecha, 'carga-fecha'],
      [f.litros, 'carga-litros'],
      [f.costoTotal, 'carga-costo'],
      [f.odometroKm, 'carga-odometro'],
    ] as const).find(([c]) => c().invalid());
    if (primero) document.getElementById(primero[1])?.focus();
  }
}
