import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, min, required, submit, validate } from '@angular/forms/signals';
import { FieldError, TIPOS_PRODUCTO, TipoProducto, UNIDADES_PRODUCTO } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { VentasService, codigoSugerido } from './datos';

interface Alta {
  tipo: TipoProducto;
  nombre: string;
  codigo: string;
  unidad: string;
  precio: number | null;
  descripcion: string;
  existencias: number | null;
  minimoExistencias: number | null;
}

const PARA: Record<TipoProducto, string> = {
  concreto: 'Lo principal: concretos que no están en el tarifario (relleno fluido, autocompactable…).',
  servicio: 'Bombeo, renta de maquinaria, fletes, laboratorio…',
  general: 'Extras que se venden aparte: sacos de cemento, aditivos sueltos, varilla… Con control de existencias.',
};

/**
 * Ventas → Productos → Nuevo (/ventas/productos/nuevo): alta de un producto de tipo Concreto, Servicio o Producto general.
 * El código se sugiere con el tipo y el nombre (se puede cambiar; no se repite); la unidad, según el tipo; los productos
 * generales llevan existencias iniciales y un mínimo para avisar cuando hay pocas. Guardar → su vista completa.
 */
@Component({
  selector: 'app-nuevo-producto',
  imports: [EnEncabezado, FieldError, FormField, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion lista="Productos" ruta="/ventas/productos" actual="Nuevo producto" />
        <div class="ml-auto flex gap-2">
          <button type="submit" form="nuevo-producto" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Guardar</button>
          <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <form id="nuevo-producto" novalidate aria-labelledby="nuevo-producto-titulo" [class]="cajas.hoja + ' max-w-3xl'" (submit)="guardar($event)">
          <h1 id="nuevo-producto-titulo" class="text-2xl font-bold tracking-[-0.02em]">Nuevo producto</h1>

          <fieldset class="mt-5">
            <legend [class]="etiqueta">Tipo</legend>
            <div class="mt-2 grid gap-2 sm:grid-cols-3">
              @for (t of tipos; track t.id) {
                <label
                  class="flex cursor-pointer flex-col gap-1 rounded-xl border border-acero/70 bg-white/70 p-3 text-sm has-checked:border-epico has-checked:bg-epico/5 has-focus-visible:outline-2 has-focus-visible:outline-epico"
                >
                  <span class="flex items-center gap-2 font-semibold">
                    <input type="radio" class="casilla rounded-full" [value]="t.id" [formField]="f.tipo" (change)="tipoElegido(t.id)" />{{
                      t.nombre
                    }}
                  </span>
                  <span class="text-texto-suave">{{ t.para }}</span>
                </label>
              }
            </div>
          </fieldset>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label for="producto-nombre" [class]="etiqueta">Nombre</label>
              <input id="producto-nombre" class="campo mt-1 h-10 px-3" aria-describedby="producto-nombre-error" [formField]="f.nombre" />
              <ui-field-error [campo]="f.nombre" errorId="producto-nombre-error" />
            </div>
            <div>
              <label for="producto-codigo" [class]="etiqueta">Código</label>
              <input
                id="producto-codigo"
                class="campo mt-1 h-10 px-3 uppercase"
                aria-describedby="producto-codigo-error producto-codigo-nota"
                [placeholder]="sugerido()"
                [formField]="f.codigo"
              />
              <p id="producto-codigo-nota" class="mt-1 text-xs text-texto-suave">Vacío, {{ sugerido() }}.</p>
              <ui-field-error [campo]="f.codigo" errorId="producto-codigo-error" />
            </div>
            <div>
              <label for="producto-unidad" [class]="etiqueta">Unidad</label>
              <select id="producto-unidad" class="campo mt-1 h-10 px-2" [formField]="f.unidad">
                @for (u of unidades(); track u) {
                  <option [value]="u">{{ u }}</option>
                }
              </select>
            </div>
            <div>
              <label for="producto-precio" [class]="etiqueta">Precio de lista (antes de IVA)</label>
              <span class="mt-1 flex items-center gap-1.5">
                $
                <input
                  id="producto-precio"
                  type="number"
                  step="0.01"
                  class="campo h-10 px-3 text-right tabular-nums"
                  aria-describedby="producto-precio-error"
                  [formField]="f.precio"
                />
                <span class="shrink-0 text-sm text-texto-suave">por {{ modelo().unidad.toLowerCase() }}</span>
              </span>
              <ui-field-error [campo]="f.precio" errorId="producto-precio-error" />
            </div>
            <div class="sm:col-span-2">
              <label for="producto-descripcion" [class]="etiqueta">Descripción</label>
              <textarea id="producto-descripcion" rows="2" class="campo mt-1 resize-y px-3 py-2" [formField]="f.descripcion"></textarea>
            </div>
          </div>

          @if (modelo().tipo === 'general') {
            <fieldset class="mt-5 rounded-xl border border-acero/60 bg-white/70 p-4">
              <legend class="px-1 font-bold">Control de existencias</legend>
              <div class="grid gap-4 sm:grid-cols-2">
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
              </div>
            </fieldset>
          }
        </form>
      </div>
    </div>
  `,
})
export default class NuevoProductoPagina {
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly tipos = (Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((id) => ({ id, nombre: TIPOS_PRODUCTO[id], para: PARA[id] }));

  protected readonly modelo = signal<Alta>({
    tipo: 'general',
    nombre: '',
    codigo: '',
    unidad: UNIDADES_PRODUCTO.general[0],
    precio: null,
    descripcion: '',
    existencias: 0,
    minimoExistencias: 0,
  });
  private readonly usados = computed(() => this.ventas.productos().map((p) => p.codigo));
  protected readonly sugerido = computed(() => codigoSugerido(this.modelo().tipo, this.modelo().nombre, this.usados()));
  protected readonly unidades = computed(() => UNIDADES_PRODUCTO[this.modelo().tipo]);

  protected readonly f = form(this.modelo, (m) => {
    required(m.nombre, { message: 'Escribe el nombre del producto.' });
    validate(m.codigo, ({ value }) =>
      value().trim() && this.usados().includes(value().trim().toUpperCase())
        ? { kind: 'repetido', message: 'Ya hay un producto con ese código.' }
        : undefined,
    );
    required(m.precio, { message: 'Escribe el precio.' });
    min(m.precio, 0.01, { message: 'El precio debe ser mayor a cero.' });
    min(m.existencias, 0, { message: 'No pueden ser negativas.' });
    min(m.minimoExistencias, 0, { message: 'No puede ser negativo.' });
  });

  private inicial = '';
  private guardado = false;

  constructor() {
    this.inicial = JSON.stringify(this.modelo());
  }

  /** Al cambiar de tipo, la unidad pasa a la primera de ese tipo si la que había no le corresponde. */
  protected tipoElegido(tipo: TipoProducto): void {
    const unidades = UNIDADES_PRODUCTO[tipo];
    this.modelo.update((m) => (unidades.includes(m.unidad) ? m : { ...m, unidad: unidades[0] }));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      const p = this.ventas.crearProducto({
        tipo: m.tipo,
        codigo: m.codigo.trim() || this.sugerido(),
        nombre: m.nombre,
        unidad: m.unidad,
        precio: m.precio!,
        descripcion: m.descripcion,
        ...(m.tipo === 'general' ? { existencias: m.existencias ?? 0, minimoExistencias: m.minimoExistencias ?? 0 } : {}),
      });
      this.guardado = true;
      await this.router.navigate(['/ventas/productos', p.id]);
      return undefined;
    });
    if (valido) return;
    const id = this.f.nombre().invalid()
      ? 'producto-nombre'
      : this.f.codigo().invalid()
        ? 'producto-codigo'
        : this.f.precio().invalid()
          ? 'producto-precio'
          : this.f.existencias().invalid()
            ? 'producto-existencias'
            : 'producto-minimo';
    document.getElementById(id)?.focus();
  }

  protected descartar(): void {
    void this.router.navigate(['/ventas/productos']);
  }

  /** canDeactivate de la ruta: con cambios sin guardar, pregunta antes de salir. */
  puedeSalir(): boolean {
    return this.guardado || JSON.stringify(this.modelo()) === this.inicial || confirm('Hay cambios sin guardar en el producto. ¿Descartarlos?');
  }
}
