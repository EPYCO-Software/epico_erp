import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit, validate } from '@angular/forms/signals';
import { FieldError } from 'ui';
import {
  CATEGORIAS_UNIDAD,
  CategoriaUnidad,
  DispositivoGps,
  ESTADO_UNIDAD,
  EstadoUnidad,
  TIPOS_UNIDAD,
  TipoUnidad,
  UNIDADES_CAPACIDAD,
  Operador,
  Unidad,
} from './flota-api';

interface Modelo {
  numeroEconomico: string;
  tipo: TipoUnidad | '';
  sucursalId: string;
  /** Además de la principal. */
  otrasPlantas: string[];
  estado: EstadoUnidad;
  marca: string;
  modelo: string;
  anio: number | null;
  placas: string;
  capacidad: number | null;
  unidadCapacidad: string;
  operadorNombre: string;
  operadorId: string;
  gpsId: string;
  descripcion: string;
  notas: string;
  baja: boolean;
}

/** La unidad de capacidad que suele llevar cada categoría. */
const CAPACIDAD_SUGERIDA: Record<CategoriaUnidad, string> = { concreto: 'm³', bombeo: 'm³', carga: 't', maquinaria: 't', otro: 'm³' };
const texto = (s: string) => s.trim() || null;

/**
 * Alta o edición de una unidad de la flota (camión, bomba, maquinaria…). Sirve para cualquier equipo de una empresa de
 * construcción: el tipo dice su categoría y la capacidad lleva su unidad (m³, t, L o m). El GPS es el identificador del
 * dispositivo en Traccar; con él se ve su posición en los viajes.
 */
@Component({
  selector: 'app-form-unidad',
  imports: [FormField, FieldError],
  template: `
    <form novalidate class="grid gap-4 @container" (submit)="guardar($event)">
      <fieldset class="contents" [disabled]="soloLectura()">
        <div class="grid gap-4 @md:grid-cols-2">
          <div>
            <label for="unidad-numero" [class]="etiqueta">Número económico</label>
            <input id="unidad-numero" class="campo mt-1 h-10 px-3 uppercase" autocomplete="off" aria-describedby="unidad-numero-error" [formField]="f.numeroEconomico" />
            <ui-field-error [campo]="f.numeroEconomico" errorId="unidad-numero-error" />
          </div>
          <div>
            <label for="unidad-tipo" [class]="etiqueta">Tipo</label>
            <select id="unidad-tipo" class="campo mt-1 h-10 px-2" aria-describedby="unidad-tipo-error" [formField]="f.tipo" (change)="tipoElegido()">
              <option value="" disabled>Elige el tipo</option>
              @for (g of grupos; track g.id) {
                <optgroup [label]="g.nombre">
                  @for (t of g.tipos; track t.id) {
                    <option [value]="t.id">{{ t.nombre }}</option>
                  }
                </optgroup>
              }
            </select>
            <ui-field-error [campo]="f.tipo" errorId="unidad-tipo-error" />
          </div>
          <div>
            <label for="unidad-planta" [class]="etiqueta">Planta</label>
            <select id="unidad-planta" class="campo mt-1 h-10 px-2" aria-describedby="unidad-planta-error" [formField]="f.sucursalId">
              <option value="" disabled>Elige la planta</option>
              @for (p of plantas(); track p.id) {
                <option [value]="p.id">{{ p.nombre }}</option>
              }
            </select>
            <ui-field-error [campo]="f.sucursalId" errorId="unidad-planta-error" />
          </div>
          @if (plantas().length > 1) {
            <fieldset class="@md:col-span-2">
              <legend [class]="etiqueta">También opera en</legend>
              <div class="mt-1 flex flex-wrap gap-2">
                @for (p of plantas(); track p.id) {
                  @if (p.id !== modelo().sucursalId) {
                    <label
                      class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold has-checked:border-epico has-checked:bg-epico/8 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                    >
                      <input type="checkbox" class="casilla" [checked]="modelo().otrasPlantas.includes(p.id)" (change)="alternarPlanta(p.id)" />{{ p.nombre }}
                    </label>
                  }
                }
              </div>
              <p class="mt-1 text-xs text-texto-suave">Solo se le asignan órdenes de sus plantas.</p>
            </fieldset>
          }
          <div>
            <label for="unidad-estado" [class]="etiqueta">Estado</label>
            <select id="unidad-estado" class="campo mt-1 h-10 px-2" [formField]="f.estado">
              @for (e of estados; track e.id) {
                <option [value]="e.id">{{ e.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label for="unidad-marca" [class]="etiqueta">Marca</label>
            <input id="unidad-marca" class="campo mt-1 h-10 px-3" [formField]="f.marca" />
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <div>
              <label for="unidad-modelo" [class]="etiqueta">Modelo</label>
              <input id="unidad-modelo" class="campo mt-1 h-10 px-3" [formField]="f.modelo" />
            </div>
            <div>
              <label for="unidad-anio" [class]="etiqueta">Año</label>
              <input id="unidad-anio" type="number" class="campo mt-1 h-10 px-3 tabular-nums" aria-describedby="unidad-anio-error" [formField]="f.anio" />
            </div>
            <ui-field-error class="col-span-2" [campo]="f.anio" errorId="unidad-anio-error" />
          </div>
          <div>
            <label for="unidad-placas" [class]="etiqueta">Placas</label>
            <input id="unidad-placas" class="campo mt-1 h-10 px-3 uppercase" autocomplete="off" aria-describedby="unidad-placas-error" [formField]="f.placas" />
            <ui-field-error [campo]="f.placas" errorId="unidad-placas-error" />
          </div>
          <div>
            <label for="unidad-capacidad" [class]="etiqueta">Capacidad</label>
            <div class="mt-1 flex">
              <input
                id="unidad-capacidad"
                type="number"
                step="0.5"
                class="campo h-10 rounded-r-none px-3 text-right tabular-nums"
                aria-describedby="unidad-capacidad-error"
                [formField]="f.capacidad"
              />
              <select aria-label="Unidad de la capacidad" class="campo h-10 w-20 rounded-l-none border-l-0 px-2" [formField]="f.unidadCapacidad">
                @for (u of unidadesCapacidad; track u) {
                  <option [value]="u">{{ u }}</option>
                }
              </select>
            </div>
            <ui-field-error [campo]="f.capacidad" errorId="unidad-capacidad-error" />
          </div>
          <div>
            <label for="unidad-operador" [class]="etiqueta">Operador habitual</label>
            @if (operadores().length) {
              <select id="unidad-operador" class="campo mt-1 h-10 px-2" aria-describedby="unidad-operador-nota" [formField]="f.operadorId">
                <option value="">Sin operador habitual</option>
                @for (o of operadores(); track o.id) {
                  <option [value]="o.id">{{ o.nombre }}{{ o.activo ? '' : ' (inactivo)' }}</option>
                }
              </select>
            } @else {
              <input id="unidad-operador" class="campo mt-1 h-10 px-3" autocomplete="off" aria-describedby="unidad-operador-nota" [formField]="f.operadorNombre" />
            }
            <p id="unidad-operador-nota" class="mt-1 text-xs text-texto-suave">Se propone al asignarla a una orden.</p>
          </div>
          <div>
            <label for="unidad-gps" [class]="etiqueta">GPS (Traccar)</label>
            <input
              id="unidad-gps"
              class="campo mt-1 h-10 px-3"
              autocomplete="off"
              list="unidad-gps-dispositivos"
              aria-describedby="unidad-gps-nota"
              [formField]="f.gpsId"
            />
            <datalist id="unidad-gps-dispositivos">
              @for (d of dispositivos(); track d.uniqueId) {
                <option [value]="d.uniqueId">{{ d.nombre }}{{ d.equipoId && d.equipoId !== unidad()?.id ? ' (ya vinculado)' : '' }}</option>
              }
            </datalist>
            <p id="unidad-gps-nota" class="mt-1 text-xs text-texto-suave">
              {{ gpsConfigurado() ? 'El identificador del dispositivo en Traccar. Vacío: sin GPS.' : 'Traccar aún no está conectado; puedes dejar el identificador listo.' }}
            </p>
          </div>
        </div>
        <div>
          <label for="unidad-descripcion" [class]="etiqueta">Descripción</label>
          <input id="unidad-descripcion" class="campo mt-1 h-10 px-3" placeholder="Olla de 7 m³, pluma de 36 m…" [formField]="f.descripcion" />
        </div>
        <div>
          <label for="unidad-notas" [class]="etiqueta">Notas</label>
          <textarea id="unidad-notas" rows="2" class="campo mt-1 px-3 py-2" [formField]="f.notas"></textarea>
        </div>
        @if (unidad()) {
          <label class="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" class="casilla" [formField]="f.baja" />
            Dada de baja (ya no se asigna ni se cuenta en la flota)
          </label>
        }
      </fieldset>
      @if (!soloLectura()) {
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()">
            {{ unidad() ? 'Guardar cambios' : 'Dar de alta' }}
          </button>
          <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
        </div>
      }
    </form>
  `,
})
export class FormUnidad implements OnInit {
  /** null = alta. */
  readonly unidad = input<Unidad | null>(null);
  readonly plantas = input.required<{ id: string; nombre: string }[]>();
  readonly dispositivos = input<DispositivoGps[]>([]);
  readonly gpsConfigurado = input(false);
  readonly soloLectura = input(false);
  readonly guardando = input(false);
  /** Los números económicos de las demás (no se repiten). */
  readonly ocupados = input<string[]>([]);
  /** Catálogo de operadores (Logística → Operadores); sin él, el nombre se escribe. */
  readonly operadores = input<Operador[]>([]);
  readonly listo = output<Omit<Unidad, 'id'> & { id?: string }>();
  readonly descartar = output();

  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly unidadesCapacidad = UNIDADES_CAPACIDAD;
  protected readonly estados = (Object.keys(ESTADO_UNIDAD) as EstadoUnidad[]).map((id) => ({ id, nombre: ESTADO_UNIDAD[id] }));
  protected readonly grupos = (Object.keys(CATEGORIAS_UNIDAD) as CategoriaUnidad[]).map((id) => ({
    id,
    nombre: CATEGORIAS_UNIDAD[id],
    tipos: TIPOS_UNIDAD.filter((t) => t.categoria === id),
  }));

  protected readonly modelo = signal<Modelo>({
    numeroEconomico: '',
    tipo: '',
    sucursalId: '',
    otrasPlantas: [],
    estado: 'disponible',
    marca: '',
    modelo: '',
    anio: null,
    placas: '',
    capacidad: null,
    unidadCapacidad: 'm³',
    operadorNombre: '',
    operadorId: '',
    gpsId: '',
    descripcion: '',
    notas: '',
    baja: false,
  });
  private readonly numeros = computed(() => new Set(this.ocupados().map((n) => n.trim().toUpperCase())));
  protected readonly f = form(this.modelo, (m) => {
    required(m.numeroEconomico, { message: 'Escribe el número económico.' });
    maxLength(m.numeroEconomico, 20, { message: 'Máximo 20 caracteres.' });
    validate(m.numeroEconomico, ({ value }) =>
      this.numeros().has(value().trim().toUpperCase()) ? { kind: 'repetido', message: 'Ya hay una unidad con ese número.' } : undefined,
    );
    required(m.tipo, { message: 'Elige el tipo.' });
    required(m.sucursalId, { message: 'Elige la planta.' });
    maxLength(m.placas, 15, { message: 'Máximo 15 caracteres.' });
    min(m.anio, 1950, { message: 'Revisa el año.' });
    max(m.anio, new Date().getFullYear() + 1, { message: 'Revisa el año.' });
    min(m.capacidad, 0, { message: 'No puede ser negativa.' });
  });

  ngOnInit(): void {
    const u = this.unidad();
    if (!u) {
      if (this.plantas().length === 1) this.modelo.update((m) => ({ ...m, sucursalId: this.plantas()[0].id }));
      return;
    }
    this.modelo.set({
      numeroEconomico: u.numeroEconomico,
      tipo: u.tipo,
      sucursalId: u.sucursalId,
      otrasPlantas: (u.sucursalIds ?? []).filter((id) => id !== u.sucursalId),
      estado: u.estado,
      marca: u.marca ?? '',
      modelo: u.modelo ?? '',
      anio: u.anio,
      placas: u.placas ?? '',
      capacidad: u.capacidad,
      unidadCapacidad: u.unidadCapacidad ?? 'm³',
      operadorNombre: u.operadorNombre ?? '',
      operadorId: u.operadorId ?? '',
      gpsId: u.gpsId ?? '',
      descripcion: u.descripcion ?? '',
      notas: u.notas ?? '',
      baja: !u.activo,
    });
  }

  protected alternarPlanta(id: string): void {
    this.modelo.update((m) => ({ ...m, otrasPlantas: m.otrasPlantas.includes(id) ? m.otrasPlantas.filter((x) => x !== id) : [...m.otrasPlantas, id] }));
  }

  /** Al elegir el tipo, la unidad de capacidad que le corresponde (si aún no hay capacidad escrita). */
  protected tipoElegido(): void {
    const t = TIPOS_UNIDAD.find((x) => x.id === this.modelo().tipo);
    if (t && this.modelo().capacidad == null) this.modelo.update((m) => ({ ...m, unidadCapacidad: CAPACIDAD_SUGERIDA[t.categoria] }));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.listo.emit({
        ...(this.unidad() ? { id: this.unidad()!.id } : {}),
        numeroEconomico: m.numeroEconomico.trim().toUpperCase(),
        tipo: m.tipo as TipoUnidad,
        sucursalId: m.sucursalId,
        sucursalIds: [m.sucursalId, ...m.otrasPlantas.filter((id) => id !== m.sucursalId)],
        estado: m.estado,
        marca: texto(m.marca),
        modelo: texto(m.modelo),
        anio: m.anio,
        placas: texto(m.placas.toUpperCase()),
        capacidad: m.capacidad || null,
        unidadCapacidad: m.capacidad ? m.unidadCapacidad : null,
        // Del catálogo: su id y su nombre (respaldo); sin catálogo, el nombre escrito
        operadorId: m.operadorId || null,
        operadorNombre: m.operadorId ? (this.operadores().find((o) => o.id === m.operadorId)?.nombre ?? null) : texto(m.operadorNombre),
        gpsId: texto(m.gpsId),
        descripcion: texto(m.descripcion),
        notas: texto(m.notas),
        activo: !m.baja,
      });
      return undefined;
    });
    if (valido) return;
    const f = this.f;
    const primero = (
      [
        [f.numeroEconomico, 'unidad-numero'],
        [f.tipo, 'unidad-tipo'],
        [f.sucursalId, 'unidad-planta'],
        [f.anio, 'unidad-anio'],
        [f.placas, 'unidad-placas'],
        [f.capacidad, 'unidad-capacidad'],
      ] as const
    ).find(([c]) => c().invalid());
    if (primero) document.getElementById(primero[1])?.focus();
  }
}
