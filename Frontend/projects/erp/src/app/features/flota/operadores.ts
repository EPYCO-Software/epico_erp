import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { PencilLine, X } from 'lucide';
import { Buscador, FieldError, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { plantasFlota } from './plantas-flota';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { FlotaApi, Operador, diasPara, textoVence } from './flota-api';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const texto = (s: string) => s.trim() || null;

interface Modelo {
  nombre: string;
  telefono: string;
  sucursalId: string;
  licenciaNumero: string;
  licenciaTipo: string;
  licenciaVence: string;
  notas: string;
  activo: boolean;
}
const VACIO: Modelo = { nombre: '', telefono: '', sucursalId: '', licenciaNumero: '', licenciaTipo: '', licenciaVence: '', notas: '', activo: true };

/** Situación de la licencia para filtrar y etiquetar. */
export function estadoLicencia(o: Pick<Operador, 'licenciaVence'>, hoy = new Date()): 'vigente' | 'por_vencer' | 'vencida' | 'sin_dato' {
  if (!o.licenciaVence) return 'sin_dato';
  const n = diasPara(o.licenciaVence, hoy);
  return n < 0 ? 'vencida' : n <= 30 ? 'por_vencer' : 'vigente';
}
const NOMBRE_LICENCIA = { vigente: 'Vigente', por_vencer: 'Vence en 30 días', vencida: 'Vencida', sin_dato: 'Sin fecha' };

/**
 * Logística → Operadores (/flota/operadores): quién maneja las unidades, con su licencia (tipo, número y vencimiento).
 * Con la licencia vencida al día de una entrega no se le asigna (lo valida el backend y lo avisa el diálogo).
 */
@Component({
  selector: 'app-operadores',
  imports: [Buscador, EnEncabezado, PanelLateral, Icon, FormField, FieldError],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('flota.operadores.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="abrir(null)">Nuevo operador</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Operadores</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-operador"
          etiqueta="Buscar operadores por nombre, teléfono o licencia"
          [(texto)]="busqueda"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">Los operadores necesitan el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            @if (casillas.marcadas().length && puede('flota.operadores.editar')) {
              <div class="flex flex-wrap items-center gap-2 border-b border-acero/50 bg-[#FDF2F2] px-4 py-2 text-sm" role="group" aria-label="Acciones para los operadores marcados">
                <span class="font-semibold">{{ casillas.marcadas().length }} marcados:</span>
                <button type="button" [class]="botonChico" [disabled]="guardando()" (click)="activar(casillas.marcadas(), true)">Activar</button>
                <button type="button" [class]="botonChico" [disabled]="guardando()" (click)="activar(casillas.marcadas(), false)">Desactivar</button>
              </div>
            }
            <p class="border-b border-acero/50 px-4 py-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ avisoLista() }}</p>
            <div tabindex="0" role="region" aria-label="Tabla de operadores" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-200]="!vista.abiertaId()">
                <caption class="sr-only">Operadores. Clic o Enter en una fila abre su vista previa. La casilla solo marca.</caption>
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
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Operador</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Teléfono</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Licencia</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Vencimiento</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Planta</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of filas(); track o.id) {
                    <tr
                      [id]="'fila-' + o.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="o.id === vista.abiertaId() ? 'true' : null"
                      (click)="abrir(o)"
                      (keydown.enter)="$event.target === $event.currentTarget && abrir(o)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          class="casilla block"
                          [attr.aria-label]="'Marcar ' + o.nombre"
                          [checked]="casillas.marcadas().includes(o.id!)"
                          (change)="casillas.alternar(o.id!)"
                        />
                      </td>
                      <td class="py-2.5 pr-3 pl-1 font-semibold">{{ o.nombre }}</td>
                      <td class="px-3 py-2.5 tabular-nums" [class.hidden]="vista.abiertaId()">{{ o.telefono || '—' }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ licencia(o) }}</td>
                      <td [class]="'px-3 py-2.5 ' + vence(o).tono">{{ vence(o).texto }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ planta(o.sucursalId) }}</td>
                      <td class="px-3 py-2.5">
                        <span class="rounded-md px-2 py-0.5 text-xs font-bold" [class]="o.activo ? 'bg-[#E3EFE9] text-[#2E5E4A]' : 'bg-carbon/8 text-texto-suave'">
                          {{ o.activo ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="px-3 py-12 text-center text-texto-suave">
                        {{ datos.isLoading() ? 'Cargando…' : todos().length ? 'Ningún operador coincide con la búsqueda.' : 'Aún no hay operadores: da de alta el primero.' }}
                      </td>
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
              <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ editando()?.nombre || 'Nuevo operador' }}</h2>
              <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="vista.cerrar()">
                <ui-icon [icono]="iconoCerrar" [tamano]="18" />
              </button>
            </div>
            @if (editando() && !modoEdicion()) {
              @let o = editando()!;
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <span class="rounded-md px-2 py-0.5 text-xs font-bold" [class]="o.activo ? 'bg-[#E3EFE9] text-[#2E5E4A]' : 'bg-carbon/8 text-texto-suave'">{{ o.activo ? 'Activo' : 'Inactivo' }}</span>
                @if (puede('flota.operadores.editar')) {
                  <button type="button" [class]="botonSecundario + ' gap-2'" (click)="modoEdicion.set(true)"><ui-icon [icono]="iconoEditar" [tamano]="16" />Editar</button>
                  <button type="button" [class]="botonSecundario" [disabled]="guardando()" (click)="activar([o.id!], !o.activo)">{{ o.activo ? 'Desactivar' : 'Activar' }}</button>
                }
              </div>
              <dl class="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt class="text-texto-suave">Teléfono</dt>
                <dd>{{ o.telefono || '—' }}</dd>
                <dt class="text-texto-suave">Planta</dt>
                <dd>{{ planta(o.sucursalId) }}</dd>
                <dt class="text-texto-suave">Licencia</dt>
                <dd>{{ licencia(o) }}</dd>
                <dt class="text-texto-suave">Vencimiento</dt>
                <dd [class]="vence(o).tono">{{ vence(o).texto }}</dd>
                @if (o.notas) {
                  <dt class="text-texto-suave">Notas</dt>
                  <dd>{{ o.notas }}</dd>
                }
              </dl>
            } @else {
            <form novalidate class="mt-4 grid gap-4" (submit)="guardar($event)">
              <fieldset class="contents" [disabled]="!puede(editando()?.id ? 'flota.operadores.editar' : 'flota.operadores.crear')">
                <div>
                  <label for="op-nombre" [class]="etiqueta">Nombre completo</label>
                  <input id="op-nombre" class="campo mt-1 h-10 px-3" autocomplete="off" aria-describedby="op-nombre-error" [formField]="f.nombre" />
                  <ui-field-error [campo]="f.nombre" errorId="op-nombre-error" />
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label for="op-telefono" [class]="etiqueta">Teléfono</label>
                    <input id="op-telefono" type="tel" class="campo mt-1 h-10 px-3" autocomplete="off" [formField]="f.telefono" />
                  </div>
                  <div>
                    <label for="op-planta" [class]="etiqueta">Planta</label>
                    <select id="op-planta" class="campo mt-1 h-10 px-2" [formField]="f.sucursalId">
                      <option value="">Todas</option>
                      @for (p of plantas(); track p.id) {
                        <option [value]="p.id">{{ p.nombre }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label for="op-lic-tipo" [class]="etiqueta">Tipo de licencia</label>
                    <input id="op-lic-tipo" class="campo mt-1 h-10 px-3 uppercase" placeholder="B, E…" aria-describedby="op-lic-tipo-error" [formField]="f.licenciaTipo" />
                    <ui-field-error [campo]="f.licenciaTipo" errorId="op-lic-tipo-error" />
                  </div>
                  <div>
                    <label for="op-lic-numero" [class]="etiqueta">Número de licencia</label>
                    <input id="op-lic-numero" class="campo mt-1 h-10 px-3 uppercase" autocomplete="off" [formField]="f.licenciaNumero" />
                  </div>
                  <div>
                    <label for="op-lic-vence" [class]="etiqueta">Licencia vence</label>
                    <input id="op-lic-vence" type="date" class="campo mt-1 h-10 px-3" [formField]="f.licenciaVence" />
                  </div>
                </div>
                <div>
                  <label for="op-notas" [class]="etiqueta">Notas</label>
                  <textarea id="op-notas" rows="2" class="campo mt-1 px-3 py-2" [formField]="f.notas"></textarea>
                </div>
                <label class="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" class="casilla" [formField]="f.activo" />
                  Activo (se le pueden asignar viajes)
                </label>
                @if (puede(editando()?.id ? 'flota.operadores.editar' : 'flota.operadores.crear')) {
                  <div class="flex flex-wrap gap-2">
                    <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()">{{ editando()?.id ? 'Guardar cambios' : 'Dar de alta' }}</button>
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
export default class Operadores {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly plantasF = plantasFlota();
  protected readonly conBackend = inject(VentasService).conBackend;

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly iconoCerrar = X;
  protected readonly iconoEditar = PencilLine;
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.lista<Operador>('operadores') : Promise.resolve([] as Operador[])) });
  protected readonly todos = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  protected readonly plantas = this.plantasF.lista;
  protected planta(id: string | null): string {
    return id ? (this.plantas().find((p) => p.id === id)?.nombre ?? '—') : 'Todas';
  }
  protected licencia(o: Operador): string {
    return [o.licenciaTipo && `Tipo ${o.licenciaTipo}`, o.licenciaNumero].filter(Boolean).join(' · ') || '—';
  }
  protected vence(o: Operador) {
    return o.licenciaVence ? textoVence(o.licenciaVence) : { texto: 'Sin fecha', tono: 'text-texto-suave' };
  }

  protected readonly busqueda = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'licencia', titulo: 'Licencia', opciones: opcionesDe(this.todos(), (o) => estadoLicencia(o), (id) => NOMBRE_LICENCIA[id as keyof typeof NOMBRE_LICENCIA]) },
    { id: 'estado', titulo: 'Estado', opciones: opcionesDe(this.todos(), (o) => (o.activo ? 'activo' : 'inactivo'), (id) => (id === 'activo' ? 'Activo' : 'Inactivo')) },
    { id: 'planta', titulo: 'Planta', opciones: opcionesDe(this.todos(), (o) => this.planta(o.sucursalId)) },
  ]);
  protected readonly filas = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const f = this.filtros();
    return this.todos()
      .filter((o) => this.plantasF.visible([o.sucursalId]))
      .filter((o) => !q || normalizar([o.nombre, o.telefono, o.licenciaNumero].join(' ')).includes(q))
      .filter((o) => pasaFiltro(f, 'licencia', estadoLicencia(o)) && pasaFiltro(f, 'estado', o.activo ? 'activo' : 'inactivo') && pasaFiltro(f, 'planta', this.planta(o.sucursalId)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((o) => ({ id: o.id! }))));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`;
    return n === 1 ? '1 operador' : `${n} operadores`;
  });

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly editando = signal<Operador | null>(null);
  /** Por omisión solo se ve; el alta entra directo a editar. */
  protected readonly modoEdicion = linkedSignal({ source: this.vista.abiertaId, computation: (id) => id === 'nuevo' });
  protected readonly avisoLista = signal('');
  protected descartar(): void {
    if (this.editando()) {
      this.abrir(this.editando());
      this.modoEdicion.set(false);
    }
    else this.vista.cerrar();
  }
  /** Activar o desactivar uno o varios sin entrar a editar. */
  protected async activar(ids: string[], activo: boolean): Promise<void> {
    const ops = this.todos().filter((o) => ids.includes(o.id!) && o.activo !== activo);
    this.guardando.set(true);
    this.avisoLista.set('');
    this.aviso.set('');
    try {
      const r = await Promise.all(ops.map((o) => this.api.guardarRegistro<Operador>('operadores', { ...o, activo })));
      const texto = `${ops.length === 1 ? ops[0].nombre : ops.length + ' operadores'}: ${activo ? 'activo' : 'inactivo'}.`;
      if (ids.length === 1 && this.vista.abiertaId()) {
        this.editando.set(r[0] ?? this.editando());
        this.aviso.set(texto);
      } else this.avisoLista.set(texto);
      this.datos.reload();
    } catch (e) {
      this.avisoLista.set(mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }
  protected readonly modelo = signal<Modelo>(VACIO);
  protected readonly f = form(this.modelo, (m) => {
    required(m.nombre, { message: 'Escribe el nombre.' });
    maxLength(m.licenciaTipo, 5, { message: 'Máximo 5 caracteres.' });
  });
  protected readonly guardando = signal(false);
  protected readonly aviso = signal('');
  protected readonly errorGuardar = signal('');

  protected abrir(o: Operador | null): void {
    this.aviso.set('');
    this.errorGuardar.set('');
    this.editando.set(o);
    this.modelo.set(
      o
        ? {
            nombre: o.nombre,
            telefono: o.telefono ?? '',
            sucursalId: o.sucursalId ?? '',
            licenciaNumero: o.licenciaNumero ?? '',
            licenciaTipo: o.licenciaTipo ?? '',
            licenciaVence: o.licenciaVence?.slice(0, 10) ?? '',
            notas: o.notas ?? '',
            activo: o.activo,
          }
        : VACIO,
    );
    this.vista.abrir(o?.id ?? 'nuevo');
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.guardando.set(true);
      this.errorGuardar.set('');
      try {
        const r = await this.api.guardarRegistro<Operador>('operadores', {
          ...(this.editando() ?? {}),
          nombre: m.nombre.trim(),
          telefono: texto(m.telefono),
          sucursalId: m.sucursalId || null,
          licenciaNumero: texto(m.licenciaNumero.toUpperCase()),
          licenciaTipo: texto(m.licenciaTipo.toUpperCase()),
          licenciaVence: m.licenciaVence || null,
          notas: texto(m.notas),
          activo: m.activo,
        });
        this.datos.reload();
        this.editando.set(r);
        this.modoEdicion.set(false);
        this.aviso.set(this.vista.abiertaId() === 'nuevo' ? `${r.nombre} dado de alta.` : 'Cambios guardados.');
        if (this.vista.abiertaId() === 'nuevo' && r.id) this.vista.abrir(r.id);
      } catch (err) {
        this.errorGuardar.set(mensajeDe(err));
      } finally {
        this.guardando.set(false);
      }
      return undefined;
    });
    if (!valido && this.f.nombre().invalid()) document.getElementById('op-nombre')?.focus();
  }
}
