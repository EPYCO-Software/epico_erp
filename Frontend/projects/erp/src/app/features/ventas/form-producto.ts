import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormField, form, min, submit, validate } from '@angular/forms/signals';
import { ConfigConcreto, FieldError, ProductoTarifa, TIPOS_PRODUCTO, TIPO_DE_CATEGORIA, TipoProducto, UNIDADES_PRODUCTO, pesos } from 'ui';
import {
  EQUIPOS,
  NuevoProducto,
  OPCIONES_CONCRETO,
  TIPOS_EQUIPO,
  TipoEquipo,
  VentasService,
  codigoConcreto,
  codigoSugerido,
  codigoVariante,
  delTarifario,
  nombreConcreto,
} from './datos';

/** "otro" en una opción del concreto o en el equipo = Personalizado / no está en la lista. */
interface Datos {
  tipo: TipoProducto;
  fc: string;
  fcOtro: string;
  edad: string;
  edadOtro: number | null;
  rev: string;
  revOtro: number | null;
  suministro: string;
  suministroOtro: string;
  variante: boolean;
  nombre: string;
  unidad: string;
  precio: number | null;
  descripcion: string;
  existencias: number | null;
  minimoExistencias: number | null;
  renta: 'no' | 'si';
  tipoEquipo: TipoEquipo | 'otro' | '';
  unidades: string[];
  sinConectar: boolean;
}

const PARA: Record<TipoProducto, string> = {
  concreto: 'Elige su configuración y el código interno se arma solo, como en la lista de planta.',
  servicio: 'Bombeo, renta de equipo, fletes, laboratorio…',
  general: 'Extras que se venden aparte: sacos de cemento, aditivos sueltos, varilla… Con control de existencias.',
};

/** De la configuración guardada a las opciones: lo que no está en la lista va como Personalizado. */
const opcion = (lista: readonly string[], valor: string) => (lista.includes(valor) ? { v: valor, otro: '' } : { v: 'otro', otro: valor });

/**
 * Formulario de un producto, el mismo para darlo de alta (nuevo-producto.ts) y para editarlo (vista previa y completa,
 * con [producto]). El código no se escribe: se arma solo (concreto: con su configuración, "200 - N28 - 14 - BP", y si
 * otro producto ya la tiene, solo como variante "… - 2"; servicio y general: con el nombre). Descripción y unidad
 * obligatorias. Servicios: si son renta de un equipo, de qué tipo y qué unidades lo atienden (o sin conectar por ahora).
 * Del tarifario solo se editan nombre, descripción y equipo: su código, unidad y precio los usa el cotizador.
 */
@Component({
  selector: 'app-form-producto',
  imports: [FieldError, FormField, NgTemplateOutlet],
  host: { class: 'block @container' },
  template: `
    <!-- Un grupo de opciones fijas del concreto, en botones, con Personalizado al final -->
    <ng-template #grupo let-id="id" let-titulo="titulo" let-campo="campo" let-otro="otro" let-opciones="opciones" let-tipoOtro="tipoOtro" let-ayuda="ayuda">
      <div>
        <p [id]="id + '-etiqueta'" [class]="etiqueta">{{ titulo }}</p>
        <div role="radiogroup" [attr.aria-labelledby]="id + '-etiqueta'" [attr.aria-describedby]="id + '-error'" class="mt-2 flex flex-wrap gap-1.5">
          @for (o of opciones; track o.id) {
            <label [class]="chip">
              <input type="radio" class="sr-only" [value]="o.id" [formField]="campo" />{{ o.nombre }}
              @if (o.codigo) {
                <span class="font-normal text-texto-suave">{{ o.codigo }}</span>
              }
            </label>
          }
          <label [class]="chip"><input type="radio" class="sr-only" value="otro" [formField]="campo" />Personalizado</label>
        </div>
        <ui-field-error [campo]="campo" [errorId]="id + '-error'" />
        @if (campo().value() === 'otro') {
          <div class="mt-2 max-w-60">
            <label [for]="id + '-otro'" class="sr-only">{{ titulo }} personalizado</label>
            <input
              [id]="id + '-otro'"
              [type]="tipoOtro"
              class="campo h-9 px-3 uppercase"
              [placeholder]="ayuda"
              [attr.aria-describedby]="id + '-otro-error'"
              [formField]="otro"
            />
            <ui-field-error [campo]="otro" [errorId]="id + '-otro-error'" />
          </div>
        }
      </div>
    </ng-template>

    <form [id]="formId()" novalidate [attr.aria-labelledby]="formId() + '-titulo'" (submit)="guardar($event)">
      @if (producto(); as p) {
        <p [id]="formId() + '-titulo'" class="font-bold">Editar producto</p>
        <p class="text-sm text-texto-suave">
          {{ tipos[modelo().tipo] }}
          @if (tarifario()) {
            · del tarifario: su código, unidad y precio los usa el cotizador, así que aquí no se cambian.
          }
        </p>
      } @else {
        <!-- Tipo al lado opuesto del título: segmentado si cabe (container query), si no, desplegable -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 [id]="formId() + '-titulo'" class="text-2xl font-bold tracking-[-0.02em]">Nuevo producto</h1>
          <div class="flex items-center gap-3">
            <span id="producto-tipo-etiqueta" [class]="etiqueta" aria-hidden="true">Tipo</span>
            <div role="radiogroup" aria-labelledby="producto-tipo-etiqueta" class="relative hidden grid-cols-3 rounded-xl bg-carbon/5 p-1 text-sm @xl:grid">
              <!-- El indicador se desliza a la opción elegida -->
              <span
                aria-hidden="true"
                class="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
                [style.transform]="'translateX(' + indice() * 100 + '%)'"
              ></span>
              @for (t of listaTipos; track t.id) {
                <label
                  class="relative cursor-pointer rounded-lg px-3 py-1.5 text-center font-semibold whitespace-nowrap text-texto-suave transition-colors has-checked:text-carbon has-focus-visible:outline-2 has-focus-visible:outline-epico"
                >
                  <input type="radio" class="sr-only" [value]="t.id" [formField]="f.tipo" (change)="tipoElegido(t.id)" />{{ t.nombre }}
                </label>
              }
            </div>
            <label for="producto-tipo" class="sr-only">Tipo</label>
            <select id="producto-tipo" class="campo h-9 w-auto px-2 text-sm font-semibold @xl:hidden" [formField]="f.tipo" (change)="tipoElegido($any($event.target).value)">
              @for (t of listaTipos; track t.id) {
                <option [value]="t.id">{{ t.nombre }}</option>
              }
            </select>
          </div>
        </div>
        <p class="mt-1 text-sm text-texto-suave">{{ para() }}</p>
      }

      <div class="mt-6 grid gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div class="min-w-0 divide-y divide-acero/60">
          @if (conConfig()) {
            <section aria-labelledby="conf-titulo" class="grid gap-5 pb-6">
              <h2 id="conf-titulo" [class]="seccion">Configuración</h2>
              <ng-container
                *ngTemplateOutlet="grupo; context: { id: 'conf-fc', titulo: 'F´c (kg/cm²)', campo: f.fc, otro: f.fcOtro, opciones: opciones.fc, tipoOtro: 'text', ayuda: 'p. ej. 400 o MR50' }"
              />
              <ng-container
                *ngTemplateOutlet="grupo; context: { id: 'conf-edad', titulo: 'Edad', campo: f.edad, otro: f.edadOtro, opciones: opciones.edad, tipoOtro: 'number', ayuda: 'Días, p. ej. 21' }"
              />
              <ng-container
                *ngTemplateOutlet="grupo; context: { id: 'conf-rev', titulo: 'Revenimiento (cm)', campo: f.rev, otro: f.revOtro, opciones: opciones.rev, tipoOtro: 'number', ayuda: 'cm, p. ej. 20' }"
              />
              <ng-container
                *ngTemplateOutlet="grupo; context: { id: 'conf-suministro', titulo: 'Tipo de suministro', campo: f.suministro, otro: f.suministroOtro, opciones: opciones.suministro, tipoOtro: 'text', ayuda: '2 o 3 letras, p. ej. BA' }"
              />

              <!-- Misma configuración que otro producto: solo como variante -->
              <div aria-live="polite">
                @if (duplicado(); as d) {
                  <div class="rounded-xl border border-[#E6C9A8] bg-[#FBF2E7] p-4 text-sm">
                    <p class="font-bold text-[#7A4210]">Ya existe un concreto con la misma configuración</p>
                    <p class="mt-0.5">{{ d.nombre }} · {{ d.codigo }}</p>
                    <label class="mt-3 flex items-center gap-2 font-semibold">
                      <input id="producto-variante" type="checkbox" class="casilla" aria-describedby="producto-variante-error" [formField]="f.variante" />
                      Crear como variante: <span class="tabular-nums">{{ variante() }}</span>
                    </label>
                    <ui-field-error [campo]="f.variante" errorId="producto-variante-error" />
                  </div>
                }
              </div>
            </section>
          }

          <section aria-labelledby="datos-titulo" class="grid gap-4 py-6 first:pt-0">
            <h2 id="datos-titulo" [class]="seccion">Datos</h2>
            <div>
              <label for="producto-nombre" [class]="etiqueta">Nombre{{ conConfig() ? ' (opcional)' : '' }}</label>
              <input
                id="producto-nombre"
                class="campo mt-1 h-10 px-3"
                aria-describedby="producto-nombre-error"
                [placeholder]="conConfig() ? nombreSugerido() : ''"
                [formField]="f.nombre"
              />
              <ui-field-error [campo]="f.nombre" errorId="producto-nombre-error" />
            </div>
            <div>
              <label for="producto-descripcion" [class]="etiqueta">Descripción</label>
              <textarea
                id="producto-descripcion"
                rows="2"
                class="campo mt-1 resize-y px-3 py-2"
                aria-describedby="producto-descripcion-error"
                [formField]="f.descripcion"
              ></textarea>
              <ui-field-error [campo]="f.descripcion" errorId="producto-descripcion-error" />
            </div>
          </section>

          @if (!tarifario()) {
            <section aria-labelledby="precio-titulo" class="grid gap-4 py-6 @lg:grid-cols-2">
              <h2 id="precio-titulo" [class]="seccion + ' @lg:col-span-2'">Precio</h2>
              <div>
                <label for="producto-precio" [class]="etiqueta">Precio de lista (antes de IVA)</label>
                <div class="relative mt-1">
                  <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden="true">$</span>
                  <input
                    id="producto-precio"
                    type="number"
                    step="0.01"
                    class="campo h-10 pr-3 pl-7 text-right tabular-nums"
                    aria-describedby="producto-precio-error"
                    [formField]="f.precio"
                  />
                </div>
                <ui-field-error [campo]="f.precio" errorId="producto-precio-error" />
              </div>
              <div>
                @if (unidades().length > 1) {
                  <label for="producto-unidad" [class]="etiqueta">Unidad</label>
                  <select id="producto-unidad" class="campo mt-1 h-10 px-2" aria-describedby="producto-unidad-error" [formField]="f.unidad">
                    <option value="" disabled>Elige la unidad</option>
                    @for (u of unidades(); track u) {
                      <option [value]="u">{{ u }}</option>
                    }
                  </select>
                  <ui-field-error [campo]="f.unidad" errorId="producto-unidad-error" />
                } @else {
                  <p [class]="etiqueta">Unidad</p>
                  <p class="mt-1 flex h-10 items-center text-sm font-semibold">{{ modelo().unidad }}</p>
                }
              </div>
            </section>
          }

          @if (modelo().tipo === 'servicio') {
            <section aria-labelledby="renta-titulo" class="grid gap-4 py-6">
              <div>
                <h2 id="renta-titulo" [class]="seccion">Renta de equipo</h2>
                <p class="text-sm text-texto-suave">Si el servicio es rentar un equipo, conéctalo con las unidades que lo atienden (para logística).</p>
              </div>
              <div role="radiogroup" aria-labelledby="renta-titulo" class="flex flex-wrap gap-1.5">
                <label [class]="chip"><input id="producto-renta" type="radio" class="sr-only" value="no" [formField]="f.renta" />No es renta</label>
                <label [class]="chip"><input type="radio" class="sr-only" value="si" [formField]="f.renta" />Sí, renta de equipo</label>
              </div>
              @if (modelo().renta === 'si') {
                <div class="max-w-xs">
                  <label for="producto-equipo" [class]="etiqueta">Equipo</label>
                  <select id="producto-equipo" class="campo mt-1 h-10 px-2" aria-describedby="producto-equipo-error" [formField]="f.tipoEquipo" (change)="equipoElegido()">
                    <option value="" disabled>Elige el equipo</option>
                    @for (t of tiposEquipo; track t.id) {
                      <option [value]="t.id">{{ t.nombre }}</option>
                    }
                    <option value="otro">Otro (no está en la lista)</option>
                  </select>
                  <ui-field-error [campo]="f.tipoEquipo" errorId="producto-equipo-error" />
                </div>
                @if (modelo().tipoEquipo) {
                  @if (disponibles().length) {
                    <fieldset aria-describedby="producto-unidades-error">
                      <legend [class]="etiqueta">Unidades conectadas</legend>
                      <label class="mt-2 flex min-h-9 items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          class="casilla"
                          [checked]="modelo().unidades.length === disponibles().length"
                          [indeterminate]="modelo().unidades.length > 0 && modelo().unidades.length < disponibles().length"
                          [disabled]="modelo().sinConectar"
                          (change)="marcarTodas($any($event.target).checked)"
                        />
                        Todas ({{ disponibles().length }})
                      </label>
                      <div class="mt-1 grid gap-1.5 @md:grid-cols-2 @3xl:grid-cols-3">
                        @for (e of disponibles(); track e.id) {
                          <label
                            class="flex cursor-pointer items-center gap-2 rounded-lg border border-acero/80 bg-white/80 px-3 py-2 text-sm has-checked:border-epico has-checked:bg-epico/8 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                          >
                            <input
                              type="checkbox"
                              class="casilla"
                              [checked]="modelo().unidades.includes(e.id)"
                              [disabled]="modelo().sinConectar"
                              (change)="alternarUnidad(e.id)"
                            />
                            <span><span class="font-semibold tabular-nums">{{ e.numero }}</span><span class="text-texto-suave"> · {{ e.descripcion }}</span></span>
                          </label>
                        }
                      </div>
                      <label class="mt-3 flex min-h-9 items-center gap-2 text-sm">
                        <input id="producto-sin-conectar" type="checkbox" class="casilla" [formField]="f.sinConectar" (change)="sinConectarElegido()" />
                        No conectar a ninguna unidad por ahora
                      </label>
                      <ui-field-error [campo]="f.unidades" errorId="producto-unidades-error" />
                    </fieldset>
                  } @else {
                    <p class="text-sm text-texto-suave">No hay unidades registradas de este equipo: queda sin conectar por ahora.</p>
                  }
                }
              }
            </section>
          }

          @if (modelo().tipo === 'general' && (!producto() || producto()!.existencias != null)) {
            <section aria-labelledby="existencias-form-titulo" class="grid gap-4 py-6 @lg:grid-cols-2">
              <h2 id="existencias-form-titulo" [class]="seccion + ' @lg:col-span-2'">Control de existencias</h2>
              @if (!producto()) {
                <div>
                  <label for="producto-existencias" [class]="etiqueta">Existencias iniciales</label>
                  <input
                    id="producto-existencias"
                    type="number"
                    step="1"
                    class="campo mt-1 h-10 px-3 text-right tabular-nums"
                    aria-describedby="producto-existencias-error"
                    [formField]="f.existencias"
                  />
                  <ui-field-error [campo]="f.existencias" errorId="producto-existencias-error" />
                </div>
              }
              <div>
                <label for="producto-minimo" [class]="etiqueta">Avisar con estas o menos</label>
                <input
                  id="producto-minimo"
                  type="number"
                  step="1"
                  class="campo mt-1 h-10 px-3 text-right tabular-nums"
                  aria-describedby="producto-minimo-error"
                  [formField]="f.minimoExistencias"
                />
                <ui-field-error [campo]="f.minimoExistencias" errorId="producto-minimo-error" />
              </div>
            </section>
          }

          @if (producto()) {
            <div class="flex flex-wrap gap-2 pt-5">
              <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
              <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
            </div>
          }
        </div>

        <!-- Cómo quedará: fijo a la derecha si cabe, abajo si no -->
        <aside aria-labelledby="resumen-titulo" class="self-start rounded-2xl border border-acero/60 bg-white/80 p-4 text-sm @3xl:sticky @3xl:top-2">
          <h2 id="resumen-titulo" [class]="etiqueta">Así quedará</h2>
          <dl class="mt-3 grid gap-3">
            <div>
              <dt class="text-xs text-texto-suave">Código interno</dt>
              <dd class="text-lg font-bold wrap-break-word tabular-nums">{{ codigoFinal() || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-texto-suave">Nombre</dt>
              <dd class="font-semibold wrap-break-word">{{ nombreFinal() || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-texto-suave">Precio de lista</dt>
              <dd>
                <span class="text-lg font-bold tabular-nums">{{ modelo().precio ? '$' + pesos(modelo().precio!) : '—' }}</span>
                @if (modelo().unidad) {
                  <span class="text-texto-suave"> por {{ modelo().unidad === 'M³' ? 'm³' : modelo().unidad.toLowerCase() }} + IVA</span>
                }
              </dd>
            </div>
            @if (equipoFinal(); as e) {
              <div>
                <dt class="text-xs text-texto-suave">Renta de equipo</dt>
                <dd class="font-semibold">
                  {{ nombreEquipo(e.tipo) }} ·
                  {{ e.unidades.length ? e.unidades.length + (e.unidades.length === 1 ? ' unidad conectada' : ' unidades conectadas') : 'sin conectar' }}
                </dd>
              </div>
            }
            @if (modelo().tipo === 'general' && !producto()) {
              <div>
                <dt class="text-xs text-texto-suave">Existencias</dt>
                <dd class="font-semibold tabular-nums">{{ modelo().existencias ?? 0 }} · aviso con {{ modelo().minimoExistencias ?? 0 }}</dd>
              </div>
            }
          </dl>
        </aside>
      </div>
    </form>
  `,
})
export class FormProducto implements OnInit {
  private readonly ventas = inject(VentasService);

  /** Para editar; sin él, es un alta. */
  readonly producto = input<ProductoTarifa | null>(null);
  /** Id del form: la página de alta lo usa para su botón Guardar de la barra. */
  readonly formId = input('form-producto');
  readonly listo = output<NuevoProducto>();
  readonly descartar = output();

  protected readonly pesos = pesos;
  protected readonly tipos = TIPOS_PRODUCTO;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly seccion = 'text-base font-bold';
  protected readonly chip =
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-carbon/40 has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly listaTipos = (Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((id) => ({ id, nombre: TIPOS_PRODUCTO[id] }));
  protected readonly tiposEquipo = (Object.keys(TIPOS_EQUIPO) as TipoEquipo[]).map((id) => ({ id, nombre: TIPOS_EQUIPO[id] }));
  protected readonly opciones = {
    fc: OPCIONES_CONCRETO.fc.map((id) => ({ id, nombre: id, codigo: '' })),
    edad: OPCIONES_CONCRETO.edad.map((e) => ({ id: e.id, nombre: e.nombre, codigo: e.id === '28' ? 'N28' : 'RR' + e.id })),
    rev: OPCIONES_CONCRETO.rev.map((id) => ({ id, nombre: id, codigo: '' })),
    suministro: OPCIONES_CONCRETO.suministro.map((s) => ({ id: s.id, nombre: s.nombre, codigo: s.id })),
  };

  protected readonly modelo = signal<Datos>({
    tipo: 'concreto',
    fc: '',
    fcOtro: '',
    edad: '',
    edadOtro: null,
    rev: '',
    revOtro: null,
    suministro: '',
    suministroOtro: '',
    variante: false,
    nombre: '',
    unidad: UNIDADES_PRODUCTO.concreto[0],
    precio: null,
    descripcion: '',
    existencias: 0,
    minimoExistencias: 0,
    renta: 'no',
    tipoEquipo: '',
    unidades: [],
    sinConectar: false,
  });

  protected readonly tarifario = computed(() => !!this.producto() && delTarifario(this.producto()!));
  /** Concreto que se configura (los del tarifario no tienen configuración). */
  protected readonly conConfig = computed(() => this.modelo().tipo === 'concreto' && !this.tarifario());
  protected readonly indice = computed(() => this.listaTipos.findIndex((t) => t.id === this.modelo().tipo));
  protected readonly para = computed(() => PARA[this.modelo().tipo]);
  protected readonly unidades = computed(() => UNIDADES_PRODUCTO[this.modelo().tipo]);
  /** Los códigos de los demás productos (al editar, el propio no cuenta). */
  private readonly otros = computed(() => this.ventas.productos().filter((p) => p.id !== this.producto()?.id));
  private readonly usados = computed(() => this.otros().map((p) => p.codigo));
  protected readonly disponibles = computed(() => EQUIPOS.filter((e) => e.tipo === this.modelo().tipoEquipo));

  /** La configuración con lo personalizado ya puesto en su lugar. */
  private readonly config = computed<ConfigConcreto>(() => {
    const m = this.modelo();
    return {
      fc: (m.fc === 'otro' ? m.fcOtro : m.fc).trim().toUpperCase(),
      edad: m.edad === 'otro' ? String(m.edadOtro ?? '') : m.edad,
      rev: m.rev === 'otro' ? String(m.revOtro ?? '') : m.rev,
      suministro: (m.suministro === 'otro' ? m.suministroOtro : m.suministro).trim().toUpperCase(),
    };
  });
  private readonly codigoBase = computed(() => codigoConcreto(this.config()));
  /** Al editar sin cambiar la configuración, el producto conserva su código (con su variante, si la tiene). */
  private readonly mismaConfig = computed(() => {
    const c = this.producto()?.configuracion;
    return !!c && codigoConcreto(c) === this.codigoBase();
  });
  protected readonly duplicado = computed(
    () => (this.conConfig() && this.codigoBase() && !this.mismaConfig() && this.otros().find((p) => p.codigo === this.codigoBase())) || null,
  );
  protected readonly variante = computed(() => codigoVariante(this.codigoBase(), this.usados()));
  protected readonly nombreSugerido = computed(() => (this.codigoBase() ? nombreConcreto(this.config()) : 'Se arma con la configuración'));

  protected readonly codigoFinal = computed(() => {
    const p = this.producto();
    const m = this.modelo();
    if (this.tarifario()) return p!.codigo;
    if (this.conConfig()) {
      if (this.mismaConfig()) return p!.codigo;
      return this.duplicado() && m.variante ? this.variante() : this.codigoBase();
    }
    if (p && m.nombre.trim() === p.nombre) return p.codigo;
    return m.nombre.trim() ? codigoSugerido(m.tipo, m.nombre, this.usados()) : '';
  });
  protected readonly nombreFinal = computed(() => this.modelo().nombre.trim() || (this.conConfig() && this.codigoBase() ? this.nombreSugerido() : ''));
  protected readonly equipoFinal = computed(() => {
    const m = this.modelo();
    if (m.tipo !== 'servicio' || m.renta !== 'si' || !m.tipoEquipo) return null;
    return { tipo: m.tipoEquipo, unidades: m.sinConectar ? [] : m.unidades };
  });
  protected nombreEquipo(tipo: string): string {
    return TIPOS_EQUIPO[tipo as TipoEquipo] ?? 'Otro equipo';
  }

  protected readonly f = form(this.modelo, (m) => {
    const texto = (campo: typeof m.nombre, cuando: () => boolean, message: string) =>
      validate(campo, ({ value }) => (cuando() && !value().trim() ? { kind: 'required', message } : undefined));
    texto(m.nombre, () => !this.conConfig(), 'Escribe el nombre del producto.');
    texto(m.descripcion, () => true, 'Escribe la descripción.');
    // Configuración del concreto: cada opción elegida; lo personalizado, con su formato
    texto(m.fc, this.conConfig, 'Elige el f´c.');
    texto(m.edad, this.conConfig, 'Elige la edad.');
    texto(m.rev, this.conConfig, 'Elige el revenimiento.');
    texto(m.suministro, this.conConfig, 'Elige el tipo de suministro.');
    validate(m.fcOtro, ({ value, valueOf }) =>
      this.conConfig() && valueOf(m.fc) === 'otro' && !/^(MR)?\d{2,3}$/i.test(value().trim())
        ? { kind: 'formato', message: 'Escribe el f´c en kg/cm² (p. ej. 400) o MR y su valor (p. ej. MR50).' }
        : undefined,
    );
    validate(m.edadOtro, ({ value, valueOf }) =>
      this.conConfig() && valueOf(m.edad) === 'otro' && !(Number.isInteger(value()) && value()! >= 1 && value()! <= 90)
        ? { kind: 'formato', message: 'Escribe la edad en días, de 1 a 90.' }
        : undefined,
    );
    validate(m.revOtro, ({ value, valueOf }) =>
      this.conConfig() && valueOf(m.rev) === 'otro' && !(Number.isInteger(value()) && value()! >= 1 && value()! <= 30)
        ? { kind: 'formato', message: 'Escribe el revenimiento en cm, de 1 a 30.' }
        : undefined,
    );
    validate(m.suministroOtro, ({ value, valueOf }) =>
      this.conConfig() && valueOf(m.suministro) === 'otro' && !/^[A-Z]{2,3}$/i.test(value().trim())
        ? { kind: 'formato', message: 'Escribe 2 o 3 letras (p. ej. BA).' }
        : undefined,
    );
    validate(m.variante, ({ value }) =>
      this.duplicado() && !value() ? { kind: 'duplicado', message: 'Márcalo como variante o cambia la configuración.' } : undefined,
    );
    texto(m.unidad, () => !this.tarifario(), 'Elige la unidad.');
    validate(m.precio, ({ value }) => {
      if (this.tarifario()) return undefined;
      if (value() == null) return { kind: 'required', message: 'Escribe el precio.' };
      return value()! <= 0 ? { kind: 'min', message: 'El precio debe ser mayor a cero.' } : undefined;
    });
    min(m.existencias, 0, { message: 'No pueden ser negativas.' });
    min(m.minimoExistencias, 0, { message: 'No puede ser negativo.' });
    // Renta de equipo: el tipo, y unidades conectadas o "no conectar por ahora"
    validate(m.tipoEquipo, ({ value, valueOf }) =>
      valueOf(m.tipo) === 'servicio' && valueOf(m.renta) === 'si' && !value() ? { kind: 'required', message: 'Elige el equipo.' } : undefined,
    );
    validate(m.unidades, ({ value, valueOf }) =>
      valueOf(m.tipo) === 'servicio' && valueOf(m.renta) === 'si' && this.disponibles().length && !valueOf(m.sinConectar) && !value().length
        ? { kind: 'required', message: 'Marca las unidades o elige "No conectar a ninguna unidad por ahora".' }
        : undefined,
    );
  });

  private inicial = '';
  /** Hay algo distinto de como empezó (quien lo usa pregunta antes de tirarlo). */
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  ngOnInit(): void {
    const p = this.producto();
    if (p) {
      const c = p.configuracion;
      const fc = opcion(OPCIONES_CONCRETO.fc, c?.fc ?? '');
      const edad = opcion(OPCIONES_CONCRETO.edad.map((e) => e.id), c?.edad ?? '');
      const rev = opcion(OPCIONES_CONCRETO.rev, c?.rev ?? '');
      const sum = opcion(OPCIONES_CONCRETO.suministro.map((s) => s.id), c?.suministro ?? '');
      this.modelo.update((m) => ({
        ...m,
        tipo: TIPO_DE_CATEGORIA[p.categoria],
        ...(c
          ? {
              fc: fc.v,
              fcOtro: fc.otro,
              edad: edad.v,
              edadOtro: edad.otro ? Number(edad.otro) : null,
              rev: rev.v,
              revOtro: rev.otro ? Number(rev.otro) : null,
              suministro: sum.v,
              suministroOtro: sum.otro,
            }
          : {}),
        // Si el nombre es el que arma la configuración, se deja vacío para que la siga al cambiarla
        nombre: c && p.nombre === nombreConcreto(c) ? '' : p.nombre,
        unidad: p.unidad,
        precio: p.precio,
        descripcion: p.descripcion,
        minimoExistencias: p.minimoExistencias ?? null,
        renta: p.equipo ? 'si' : 'no',
        tipoEquipo: (p.equipo?.tipo as TipoEquipo | 'otro') ?? '',
        unidades: p.equipo?.unidades ?? [],
        sinConectar: !!p.equipo && !p.equipo.unidades.length,
      }));
    }
    this.inicial = JSON.stringify(this.modelo());
  }

  /** Al cambiar de tipo: concreto va en m³; en los demás la unidad es obligatoria, así que queda por elegir. */
  protected tipoElegido(tipo: TipoProducto): void {
    const unidades = UNIDADES_PRODUCTO[tipo];
    this.modelo.update((m) => ({ ...m, unidad: unidades.length === 1 ? unidades[0] : '' }));
  }

  protected equipoElegido(): void {
    this.modelo.update((m) => ({ ...m, unidades: [], sinConectar: false }));
  }

  protected alternarUnidad(id: string): void {
    this.modelo.update((m) => ({ ...m, unidades: m.unidades.includes(id) ? m.unidades.filter((x) => x !== id) : [...m.unidades, id] }));
  }

  protected marcarTodas(todas: boolean): void {
    this.modelo.update((m) => ({ ...m, unidades: todas ? this.disponibles().map((e) => e.id) : [] }));
  }

  protected sinConectarElegido(): void {
    if (this.modelo().sinConectar) this.modelo.update((m) => ({ ...m, unidades: [] }));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      const equipo = this.equipoFinal();
      this.listo.emit({
        tipo: m.tipo,
        codigo: this.codigoFinal(),
        nombre: this.nombreFinal(),
        unidad: m.unidad,
        precio: m.precio ?? 0,
        descripcion: m.descripcion,
        ...(m.tipo === 'general' ? { existencias: m.existencias ?? 0, minimoExistencias: m.minimoExistencias ?? 0 } : {}),
        ...(this.conConfig() ? { configuracion: this.config() } : {}),
        ...(equipo ? { equipo } : {}),
      });
      this.inicial = JSON.stringify(m);
      return undefined;
    });
    if (valido) return;
    // Al primer campo con error, en el orden en que se ven
    const f = this.f;
    const orden: [boolean, string][] = [
      [f.fc().invalid(), '[aria-labelledby=conf-fc-etiqueta] input'],
      [f.fcOtro().invalid(), '#conf-fc-otro'],
      [f.edad().invalid(), '[aria-labelledby=conf-edad-etiqueta] input'],
      [f.edadOtro().invalid(), '#conf-edad-otro'],
      [f.rev().invalid(), '[aria-labelledby=conf-rev-etiqueta] input'],
      [f.revOtro().invalid(), '#conf-rev-otro'],
      [f.suministro().invalid(), '[aria-labelledby=conf-suministro-etiqueta] input'],
      [f.suministroOtro().invalid(), '#conf-suministro-otro'],
      [f.variante().invalid(), '#producto-variante'],
      [f.nombre().invalid(), '#producto-nombre'],
      [f.descripcion().invalid(), '#producto-descripcion'],
      [f.precio().invalid(), '#producto-precio'],
      [f.unidad().invalid(), '#producto-unidad'],
      [f.tipoEquipo().invalid(), '#producto-equipo'],
      [f.unidades().invalid(), '#producto-sin-conectar'],
      [f.existencias().invalid(), '#producto-existencias'],
      [f.minimoExistencias().invalid(), '#producto-minimo'],
    ];
    const selector = orden.find(([invalido]) => invalido)?.[1];
    if (selector) document.querySelector<HTMLElement>(selector)?.focus();
  }
}
