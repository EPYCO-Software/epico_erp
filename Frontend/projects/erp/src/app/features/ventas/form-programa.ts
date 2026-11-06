import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { CATEGORIAS_PRODUCTO, CategoriaProducto, FieldError, Icon } from 'ui';
import { VentasService } from './datos';
import { Programa, ProgramasService, RECOMPENSAS, TipoPrograma, TipoRecompensa, desdePlantilla, plantilla, textoPrograma } from './lealtad';

/** Lo que se captura; "aplica" junta producto y categoría: '' todos, 'cat:…' o 'prod:…'. */
interface Captura {
  nombre: string;
  activo: boolean;
  inicio: string;
  fin: string;
  aplica: string;
  compraMinima: number | null;
  codigo: string;
  cantidadX: number | null;
  cantidadY: number | null;
  recompensa: TipoRecompensa;
  valor: number | null;
  pesosPorPunto: number | null;
  puntosCanje: number | null;
  meta: number | null;
}

export type DatosPrograma = Omit<Programa, 'id' | 'cupones'>;

const captura = (p: Omit<Programa, 'id'>): Captura => ({
  ...p,
  aplica: p.productoId ? 'prod:' + p.productoId : p.categoria ? 'cat:' + p.categoria : '',
});

/**
 * Formulario de un programa de descuento o lealtad, el mismo para el alta (desde su plantilla) y la edición. Cada tipo
 * muestra solo lo suyo (ver Programa en lealtad.ts); a la derecha, la regla como quedará.
 */
@Component({
  selector: 'app-form-programa',
  imports: [FieldError, FormField, Icon],
  host: { class: 'block @container' },
  template: `
    <form [id]="formId()" novalidate [attr.aria-labelledby]="formId() + '-titulo'" (submit)="guardar($event)">
      <div class="flex flex-wrap items-center gap-3">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-epico/8 text-epico-oscuro" aria-hidden="true">
          <ui-icon [icono]="tipoInfo().icono" [tamano]="22" />
        </span>
        <div>
          @if (programa()) {
            <p [id]="formId() + '-titulo'" class="font-bold">Editar programa</p>
          } @else {
            <h1 [id]="formId() + '-titulo'" class="text-2xl font-bold tracking-[-0.02em]">{{ tipoInfo().nombre }}</h1>
          }
          <p class="text-sm text-texto-suave">{{ tipoInfo().descripcion }}</p>
        </div>
      </div>

      <div class="mt-6 grid gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div class="grid min-w-0 content-start gap-5">
          <div>
            <label for="programa-nombre" [class]="etiqueta">Nombre del programa</label>
            <input id="programa-nombre" class="campo mt-1 h-10 px-3" aria-describedby="programa-nombre-error" [formField]="f.nombre" />
            <ui-field-error [campo]="f.nombre" errorId="programa-nombre-error" />
          </div>

          @if (tipo() === 'codigo') {
            <div class="max-w-xs">
              <label for="programa-codigo" [class]="etiqueta">Código</label>
              <input id="programa-codigo" class="campo mt-1 h-10 px-3 font-semibold tracking-wide uppercase" aria-describedby="programa-codigo-error" [formField]="f.codigo" />
              <ui-field-error [campo]="f.codigo" errorId="programa-codigo-error" />
            </div>
          }

          @if (tipo() !== 'lealtad') {
            <div>
              <label for="programa-aplica" [class]="etiqueta">{{ tipo() === 'sellos' ? 'Da sellos' : tipo() === 'compra-x' ? 'Al comprar' : 'Aplica a' }}</label>
              <select id="programa-aplica" class="campo mt-1 h-10 px-2" [formField]="f.aplica">
                <option value="">Todos los productos</option>
                <optgroup label="Categorías">
                  @for (c of categorias; track c.id) {
                    <option [value]="'cat:' + c.id">{{ c.nombre }}</option>
                  }
                </optgroup>
                <optgroup label="Productos">
                  @for (p of productos(); track p.id) {
                    <option [value]="'prod:' + p.id">[{{ p.codigo }}] {{ p.nombre }}</option>
                  }
                </optgroup>
              </select>
            </div>
          }

          @if (tipo() === 'promocion' || tipo() === 'codigo' || tipo() === 'proxima-orden') {
            <div class="max-w-xs">
              <label for="programa-minima" [class]="etiqueta">Compra mínima de la orden</label>
              <div class="relative mt-1">
                <span [class]="signo" aria-hidden="true">$</span>
                <input id="programa-minima" type="number" step="1" [class]="numero + ' pl-7'" aria-describedby="programa-minima-error programa-minima-ayuda" [formField]="f.compraMinima" />
              </div>
              <p id="programa-minima-ayuda" class="mt-1 text-xs text-texto-suave">Antes de IVA; 0, sin mínimo.</p>
              <ui-field-error [campo]="f.compraMinima" errorId="programa-minima-error" />
            </div>
          }

          @if (tipo() === 'compra-x') {
            <div class="flex flex-wrap items-end gap-3">
              <div class="w-32">
                <label for="programa-x" [class]="etiqueta">Compra</label>
                <input id="programa-x" type="number" step="1" [class]="numero + ' mt-1'" aria-describedby="programa-x-error" [formField]="f.cantidadX" />
              </div>
              <div class="w-32">
                <label for="programa-y" [class]="etiqueta">Recibe gratis</label>
                <input id="programa-y" type="number" step="1" [class]="numero + ' mt-1'" aria-describedby="programa-y-error" [formField]="f.cantidadY" />
              </div>
              <p class="pb-2.5 text-sm text-texto-suave">unidades (gratis, las más baratas)</p>
            </div>
            <ui-field-error [campo]="f.cantidadX" errorId="programa-x-error" />
            <ui-field-error [campo]="f.cantidadY" errorId="programa-y-error" />
          }

          @if (tipo() === 'lealtad') {
            <div class="flex flex-wrap gap-3">
              <div class="w-48">
                <label for="programa-pesos" [class]="etiqueta">1 punto por cada</label>
                <div class="relative mt-1">
                  <span [class]="signo" aria-hidden="true">$</span>
                  <input id="programa-pesos" type="number" step="1" [class]="numero + ' pl-7'" aria-describedby="programa-pesos-error" [formField]="f.pesosPorPunto" />
                </div>
                <ui-field-error [campo]="f.pesosPorPunto" errorId="programa-pesos-error" />
              </div>
              <div class="w-48">
                <label for="programa-canje" [class]="etiqueta">Se canjea con</label>
                <div class="mt-1 flex items-center gap-2">
                  <input id="programa-canje" type="number" step="1" [class]="numero" aria-describedby="programa-canje-error" [formField]="f.puntosCanje" />
                  <span class="text-sm">puntos</span>
                </div>
                <ui-field-error [campo]="f.puntosCanje" errorId="programa-canje-error" />
              </div>
            </div>
          }

          @if (tipo() === 'sellos') {
            <div class="w-48">
              <label for="programa-meta" [class]="etiqueta">Sellos para la recompensa</label>
              <input id="programa-meta" type="number" step="1" [class]="numero + ' mt-1'" aria-describedby="programa-meta-error programa-meta-ayuda" [formField]="f.meta" />
              <p id="programa-meta-ayuda" class="mt-1 text-xs text-texto-suave">1 sello por unidad comprada.</p>
              <ui-field-error [campo]="f.meta" errorId="programa-meta-error" />
            </div>
          }

          @if (tipo() !== 'compra-x') {
            <div>
              <p id="programa-recompensa" [class]="etiqueta">Recompensa</p>
              <div role="radiogroup" aria-labelledby="programa-recompensa" class="mt-2 flex flex-wrap gap-1.5">
                @for (r of recompensas(); track r.id) {
                  <label [class]="chip"><input type="radio" class="sr-only" [value]="r.id" [formField]="f.recompensa" />{{ r.nombre }}</label>
                }
              </div>
            </div>
            @if (modelo().recompensa !== 'traslado') {
              <div class="max-w-xs">
                <label for="programa-valor" [class]="etiqueta">{{ modelo().recompensa === 'porcentaje' ? 'Descuento (%)' : 'Descuento ($)' }}</label>
                <input id="programa-valor" type="number" step="0.01" [class]="numero + ' mt-1'" aria-describedby="programa-valor-error" [formField]="f.valor" />
                <ui-field-error [campo]="f.valor" errorId="programa-valor-error" />
              </div>
            }
          }

          <fieldset>
            <legend [class]="etiqueta">Vigencia</legend>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <label for="programa-inicio" class="sr-only">Desde</label>
              <input id="programa-inicio" type="date" class="campo h-10 w-auto px-2" [formField]="f.inicio" />
              <span aria-hidden="true">→</span>
              <label for="programa-fin" class="sr-only">Hasta</label>
              <input id="programa-fin" type="date" class="campo h-10 w-auto px-2" aria-describedby="programa-fin-error" [formField]="f.fin" />
            </div>
            <p class="mt-1 text-xs text-texto-suave">Sin fechas, siempre.</p>
            <ui-field-error [campo]="f.fin" errorId="programa-fin-error" />
          </fieldset>

          <label class="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" class="casilla" [formField]="f.activo" />Activo (sin marcar, queda archivado y no se aplica)
          </label>

          @if (programa()) {
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
              <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
            </div>
          }
        </div>

        <aside aria-labelledby="programa-resumen" class="self-start rounded-2xl border border-acero/60 bg-white/80 p-4 text-sm @3xl:sticky @3xl:top-2">
          <h2 id="programa-resumen" [class]="etiqueta">Así quedará</h2>
          <p class="mt-2 font-semibold">{{ modelo().nombre || '—' }}</p>
          <p class="mt-1">{{ regla() }}</p>
          @if (tipo() === 'cupones' || tipo() === 'proxima-orden') {
            <p class="mt-2 text-texto-suave">Los cupones se generan en el programa, después de guardarlo.</p>
          }
        </aside>
      </div>
    </form>
  `,
})
export class FormPrograma implements OnInit {
  private readonly ventas = inject(VentasService);
  private readonly servicio = inject(ProgramasService);

  /** Para editar; sin él, un alta de la plantilla "nuevoTipo". */
  readonly programa = input<Programa | null>(null);
  readonly nuevoTipo = input<TipoPrograma>('promocion');
  readonly formId = input('form-programa');
  readonly listo = output<DatosPrograma>();
  readonly descartar = output();

  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly numero = 'campo h-10 px-3 text-right tabular-nums';
  protected readonly signo = 'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave';
  protected readonly chip =
    'inline-flex h-9 cursor-pointer items-center rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-carbon/40 has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly categorias = (Object.keys(CATEGORIAS_PRODUCTO) as CategoriaProducto[]).map((id) => ({ id, nombre: CATEGORIAS_PRODUCTO[id] }));
  protected readonly productos = this.ventas.productos;

  protected readonly tipo = computed(() => this.programa()?.tipo ?? this.nuevoTipo());
  protected readonly tipoInfo = computed(() => plantilla(this.tipo()));
  /** El traslado gratis solo en las que se aplican a la orden misma (promoción y código). */
  protected readonly recompensas = computed(() =>
    (Object.keys(RECOMPENSAS) as TipoRecompensa[])
      .filter((id) => id !== 'traslado' || this.tipo() === 'promocion' || this.tipo() === 'codigo')
      .map((id) => ({ id, nombre: RECOMPENSAS[id] })),
  );

  protected readonly modelo = signal<Captura>(captura(desdePlantilla('promocion')));
  protected readonly f = form(this.modelo, (m) => {
    validate(m.nombre, ({ value }) => (value().trim() ? undefined : { kind: 'required', message: 'Escribe el nombre del programa.' }));
    validate(m.codigo, ({ value }) => {
      if (this.tipo() !== 'codigo') return undefined;
      const c = value().trim().toUpperCase();
      if (!/^[A-Z0-9-]{4,20}$/.test(c)) return { kind: 'formato', message: 'De 4 a 20 letras, números o guiones.' };
      const usado = this.servicio.programas().some((p) => p.id !== this.programa()?.id && (p.codigo === c || p.cupones.some((x) => x.codigo === c)));
      return usado ? { kind: 'repetido', message: 'Ese código ya lo usa otro programa.' } : undefined;
    });
    const positivo = (campo: typeof m.valor, tipos: TipoPrograma[], message: string) =>
      validate(campo, ({ value }) => (tipos.includes(this.tipo()) && !((value() ?? 0) > 0) ? { kind: 'min', message } : undefined));
    positivo(m.cantidadX, ['compra-x'], 'Escribe cuántas compra, 1 o más.');
    positivo(m.cantidadY, ['compra-x'], 'Escribe cuántas recibe gratis, 1 o más.');
    positivo(m.pesosPorPunto, ['lealtad'], 'Escribe cada cuántos pesos da un punto.');
    positivo(m.puntosCanje, ['lealtad'], 'Escribe cuántos puntos se necesitan.');
    positivo(m.meta, ['sellos'], 'Escribe cuántos sellos se necesitan.');
    validate(m.compraMinima, ({ value }) => ((value() ?? 0) < 0 ? { kind: 'min', message: 'No puede ser negativa.' } : undefined));
    validate(m.valor, ({ value, valueOf }) => {
      if (this.tipo() === 'compra-x' || valueOf(m.recompensa) === 'traslado') return undefined;
      const v = value() ?? 0;
      if (valueOf(m.recompensa) === 'porcentaje') return v > 0 && v <= 100 ? undefined : { kind: 'rango', message: 'Escribe un % de más de 0 hasta 100.' };
      return v > 0 ? undefined : { kind: 'min', message: 'Escribe el monto, mayor a cero.' };
    });
    validate(m.fin, ({ value, valueOf }) =>
      value() && valueOf(m.inicio) && value() < valueOf(m.inicio) ? { kind: 'orden', message: 'La fecha final va después de la inicial.' } : undefined,
    );
  });

  /** Lo capturado como programa (para el resumen y para guardar). */
  private readonly datos = computed<DatosPrograma>(() => {
    const m = this.modelo();
    const [clase, id] = m.aplica.split(':');
    return {
      tipo: this.tipo(),
      nombre: m.nombre,
      activo: m.activo,
      inicio: m.inicio,
      fin: m.fin,
      productoId: clase === 'prod' ? id : '',
      categoria: clase === 'cat' ? (id as CategoriaProducto) : '',
      compraMinima: m.compraMinima ?? 0,
      codigo: m.codigo.trim().toUpperCase(),
      cantidadX: m.cantidadX ?? 0,
      cantidadY: m.cantidadY ?? 0,
      recompensa: m.recompensa,
      valor: m.valor ?? 0,
      pesosPorPunto: m.pesosPorPunto ?? 0,
      puntosCanje: m.puntosCanje ?? 0,
      meta: m.meta ?? 0,
    };
  });
  protected readonly regla = computed(() =>
    textoPrograma({ ...this.datos(), id: '', cupones: this.programa()?.cupones ?? [] }, this.ventas.productos()),
  );

  private inicial = '';
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  ngOnInit(): void {
    this.modelo.set(captura(this.programa() ?? desdePlantilla(this.nuevoTipo())));
    this.inicial = JSON.stringify(this.modelo());
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      this.inicial = JSON.stringify(this.modelo());
      this.listo.emit(this.datos());
      return undefined;
    });
    if (valido) return;
    const f = this.f;
    const orden: [boolean, string][] = [
      [f.nombre().invalid(), 'programa-nombre'],
      [f.codigo().invalid(), 'programa-codigo'],
      [f.compraMinima().invalid(), 'programa-minima'],
      [f.cantidadX().invalid(), 'programa-x'],
      [f.cantidadY().invalid(), 'programa-y'],
      [f.pesosPorPunto().invalid(), 'programa-pesos'],
      [f.puntosCanje().invalid(), 'programa-canje'],
      [f.meta().invalid(), 'programa-meta'],
      [f.valor().invalid(), 'programa-valor'],
      [f.fin().invalid(), 'programa-fin'],
    ];
    const id = orden.find(([invalido]) => invalido)?.[1];
    if (id) document.getElementById(id)?.focus();
  }
}
