import { Component, ElementRef, computed, effect, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { FormField, form, min, submit, validate } from '@angular/forms/signals';
import { Info, X } from 'lucide';
import { CATEGORIAS_PRODUCTO, CategoriaProducto, FieldError, Icon } from 'ui';
import { VentasService } from './datos';
import { ListasPreciosService, Moneda, REGLA_VACIA, ReglaPrecio, TIPOS_REGLA, TipoRegla } from './precios';

interface Captura {
  aplicarA: 'producto' | 'categoria';
  productoId: string;
  categoria: CategoriaProducto | '';
  tipo: TipoRegla;
  precioFijo: number | null;
  descuento: number | null;
  recargo: number | null;
  cantidadMinima: number | null;
  inicio: string;
  fin: string;
}

const desde = (r: Omit<ReglaPrecio, 'id'>): Captura => ({ ...r, precioFijo: r.precioFijo || null });

/**
 * Diálogo de una línea de la lista de precios, como "Crear reglas de lista de precios" de Odoo: aplicar a un producto
 * (o todos) o a una categoría; tipo de precio (descuento, fórmula o precio fijo); cantidad mínima y periodo de
 * validez. Guardar y cerrar, Guardar y crear nuevo (deja el diálogo listo para otra) o Descartar.
 */
@Component({
  selector: 'app-regla-precio',
  imports: [FieldError, FormField, Icon],
  host: { class: 'contents' },
  template: `
    <!-- Esc cierra el diálogo; que no llegue al panel de la lista, que también se cierra con Esc. -->
    <dialog
      #dialogo
      aria-labelledby="regla-titulo"
      class="glass-strong m-auto w-[min(56rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate class="@container" (submit)="$event.preventDefault(); guardar(false)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="regla-titulo" class="text-lg font-bold">{{ regla() ? 'Editar línea' : 'Agregar una línea' }}</h2>
          <button type="button" aria-label="Cerrar sin guardar" [class]="botonIcono" (click)="abierto.set(false)">
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>

        <div class="grid gap-x-10 gap-y-5 px-6 py-5 @2xl:grid-cols-2">
          <div class="grid content-start gap-5">
            <div>
              <p id="regla-aplicar" [class]="etiqueta">Aplicar a</p>
              <div role="radiogroup" aria-labelledby="regla-aplicar" class="mt-2 flex flex-wrap gap-1.5">
                <label [class]="chip"><input id="regla-aplicar-producto" type="radio" class="sr-only" value="producto" [formField]="f.aplicarA" />Producto</label>
                <label [class]="chip"><input type="radio" class="sr-only" value="categoria" [formField]="f.aplicarA" />Categoría</label>
              </div>
            </div>

            @if (modelo().aplicarA === 'producto') {
              <div>
                <label for="regla-producto" [class]="etiqueta">Producto</label>
                <select id="regla-producto" class="campo mt-1 h-10 px-2" [formField]="f.productoId">
                  <option value="">Todos los productos</option>
                  @for (g of grupos(); track g.categoria) {
                    <optgroup [label]="g.nombre">
                      @for (p of g.productos; track p.id) {
                        <option [value]="p.id">[{{ p.codigo }}] {{ p.nombre }}</option>
                      }
                    </optgroup>
                  }
                </select>
              </div>
            } @else {
              <div>
                <label for="regla-categoria" [class]="etiqueta">Categoría</label>
                <select id="regla-categoria" class="campo mt-1 h-10 px-2" aria-describedby="regla-categoria-error" [formField]="f.categoria">
                  <option value="" disabled>Elige la categoría</option>
                  @for (c of categorias; track c.id) {
                    <option [value]="c.id">{{ c.nombre }}</option>
                  }
                </select>
                <ui-field-error [campo]="f.categoria" errorId="regla-categoria-error" />
              </div>
            }

            <div>
              <p id="regla-tipo" [class]="etiqueta">Tipo de precio</p>
              <div role="radiogroup" aria-labelledby="regla-tipo" class="mt-2 flex flex-wrap gap-1.5">
                @for (t of tipos; track t.id) {
                  <label [class]="chip"><input type="radio" class="sr-only" [value]="t.id" [formField]="f.tipo" />{{ t.nombre }}</label>
                }
              </div>
            </div>

            @switch (modelo().tipo) {
              @case ('fijo') {
                <div>
                  <label for="regla-precio" [class]="etiqueta">Precio fijo ({{ moneda() }})</label>
                  <div class="relative mt-1 max-w-60">
                    <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden="true">$</span>
                    <input id="regla-precio" type="number" step="0.01" [class]="numero + ' pl-7'" aria-describedby="regla-precio-error" [formField]="f.precioFijo" />
                  </div>
                  <ui-field-error [campo]="f.precioFijo" errorId="regla-precio-error" />
                </div>
              }
              @case ('descuento') {
                <div>
                  <label for="regla-descuento" [class]="etiqueta">Descuento sobre el precio de lista</label>
                  <div class="mt-1 flex max-w-60 items-center gap-2">
                    <input id="regla-descuento" type="number" step="0.1" [class]="numero" aria-describedby="regla-descuento-error" [formField]="f.descuento" />
                    <span aria-hidden="true">%</span>
                  </div>
                  <ui-field-error [campo]="f.descuento" errorId="regla-descuento-error" />
                </div>
              }
              @case ('formula') {
                <div class="grid gap-3 @md:grid-cols-2">
                  <p class="text-sm text-texto-suave @md:col-span-2">Precio de lista − descuento + recargo.</p>
                  <div>
                    <label for="regla-descuento" [class]="etiqueta">Descuento</label>
                    <div class="mt-1 flex items-center gap-2">
                      <input
                        id="regla-descuento"
                        type="number"
                        step="0.1"
                        [class]="numero"
                        aria-describedby="regla-descuento-error regla-descuento-ayuda"
                        [formField]="f.descuento"
                      />
                      <span aria-hidden="true">%</span>
                    </div>
                    <p id="regla-descuento-ayuda" class="mt-1 text-xs text-texto-suave">Negativo para aumentar.</p>
                    <ui-field-error [campo]="f.descuento" errorId="regla-descuento-error" />
                  </div>
                  <div>
                    <label for="regla-recargo" [class]="etiqueta">Recargo ({{ moneda() }})</label>
                    <div class="relative mt-1">
                      <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden="true">$</span>
                      <input id="regla-recargo" type="number" step="0.01" [class]="numero + ' pl-7'" aria-describedby="regla-recargo-ayuda" [formField]="f.recargo" />
                    </div>
                    <p id="regla-recargo-ayuda" class="mt-1 text-xs text-texto-suave">Negativo para restar.</p>
                  </div>
                </div>
              }
            }
          </div>

          <div class="grid content-start gap-5">
            <div>
              <label for="regla-minima" [class]="etiqueta">Cantidad mínima</label>
              <input
                id="regla-minima"
                type="number"
                step="0.5"
                [class]="numero + ' mt-1 max-w-40'"
                aria-describedby="regla-minima-ayuda regla-minima-error"
                [formField]="f.cantidadMinima"
              />
              <p id="regla-minima-ayuda" class="mt-1 text-xs text-texto-suave">Aplica desde esta cantidad (en m³ para el concreto); 0, siempre.</p>
              <ui-field-error [campo]="f.cantidadMinima" errorId="regla-minima-error" />
            </div>
            <fieldset>
              <legend [class]="etiqueta">Periodo de validez</legend>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <label for="regla-inicio" class="sr-only">Fecha de inicio</label>
                <input id="regla-inicio" type="date" class="campo h-10 w-auto px-2" [formField]="f.inicio" />
                <span aria-hidden="true">→</span>
                <label for="regla-fin" class="sr-only">Fecha de finalización</label>
                <input id="regla-fin" type="date" class="campo h-10 w-auto px-2" aria-describedby="regla-fin-error" [formField]="f.fin" />
              </div>
              <p class="mt-1 text-xs text-texto-suave">Sin fechas, aplica siempre.</p>
              <ui-field-error [campo]="f.fin" errorId="regla-fin-error" />
            </fieldset>
            @if (modelo().tipo !== 'descuento') {
              <p class="flex gap-2 rounded-xl bg-[#E4EEF3] px-4 py-3 text-sm text-[#24485A]">
                <ui-icon [icono]="iconos.info" [tamano]="18" class="mt-0.5 shrink-0" />
                Con precio fijo o fórmula, en la cotización solo aparece el precio resultante, no el de lista.
              </p>
            }
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto px-5">Guardar y cerrar</button>
          @if (!regla()) {
            <button type="button" class="boton-primario h-11 w-auto px-5" (click)="guardar(true)">Guardar y crear nuevo</button>
          }
          <button type="button" [class]="botonSecundario" (click)="abierto.set(false)">Descartar</button>
          <p class="text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
        </div>
      </form>
    </dialog>
  `,
})
export class ReglaPrecioDialogo {
  private readonly ventas = inject(VentasService);
  private readonly listas = inject(ListasPreciosService);

  readonly listaId = input.required<string>();
  readonly moneda = input.required<Moneda>();
  /** La que se edita; sin ella, una nueva. */
  readonly regla = input<ReglaPrecio | null>(null);
  readonly abierto = model(false);

  protected readonly iconos = { cerrar: X, info: Info };
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly numero = 'campo h-10 px-3 text-right tabular-nums';
  protected readonly chip =
    'inline-flex h-9 cursor-pointer items-center rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-carbon/40 has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly tipos = (Object.keys(TIPOS_REGLA) as TipoRegla[]).map((id) => ({ id, nombre: TIPOS_REGLA[id] }));
  protected readonly categorias = (Object.keys(CATEGORIAS_PRODUCTO) as CategoriaProducto[]).map((id) => ({ id, nombre: CATEGORIAS_PRODUCTO[id] }));
  /** Los productos por categoría, para el desplegable. */
  protected readonly grupos = computed(() =>
    this.categorias
      .map((c) => ({ categoria: c.id, nombre: c.nombre, productos: this.ventas.productos().filter((p) => p.categoria === c.id) }))
      .filter((g) => g.productos.length),
  );
  protected readonly aviso = signal('');

  protected readonly modelo = signal<Captura>(desde(REGLA_VACIA));
  protected readonly f = form(this.modelo, (m) => {
    validate(m.categoria, ({ value, valueOf }) =>
      valueOf(m.aplicarA) === 'categoria' && !value() ? { kind: 'required', message: 'Elige la categoría.' } : undefined,
    );
    validate(m.precioFijo, ({ value, valueOf }) =>
      valueOf(m.tipo) === 'fijo' && !((value() ?? 0) > 0) ? { kind: 'min', message: 'Escribe el precio, mayor a cero.' } : undefined,
    );
    validate(m.descuento, ({ value, valueOf }) => {
      const tipo = valueOf(m.tipo);
      const v = value();
      if (tipo === 'descuento' && !(v != null && v > 0 && v <= 100)) return { kind: 'rango', message: 'Escribe un descuento de más de 0 hasta 100 %.' };
      if (tipo === 'formula' && v != null && (v < -100 || v > 100)) return { kind: 'rango', message: 'Entre −100 y 100 %.' };
      return undefined;
    });
    min(m.cantidadMinima, 0, { message: 'No puede ser negativa.' });
    validate(m.fin, ({ value, valueOf }) =>
      value() && valueOf(m.inicio) && value() < valueOf(m.inicio) ? { kind: 'orden', message: 'La fecha de finalización va después de la de inicio.' } : undefined,
    );
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        untracked(() => this.reiniciar(this.regla() ?? REGLA_VACIA));
        d.showModal();
      } else if (!this.abierto() && d.open) {
        d.close();
      }
    });
  }

  private reiniciar(r: Omit<ReglaPrecio, 'id'>): void {
    this.f().reset(desde(r));
    this.aviso.set('');
  }

  protected async guardar(otra: boolean): Promise<void> {
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      const tipo = m.tipo;
      this.listas.guardarRegla(this.listaId(), {
        id: this.regla()?.id ?? 'r-' + crypto.randomUUID().slice(0, 8),
        aplicarA: m.aplicarA,
        productoId: m.aplicarA === 'producto' ? m.productoId : '',
        categoria: m.aplicarA === 'categoria' ? m.categoria : '',
        tipo,
        // Solo lo que usa su tipo; lo demás en cero
        precioFijo: tipo === 'fijo' ? m.precioFijo! : 0,
        descuento: tipo === 'fijo' ? 0 : (m.descuento ?? 0),
        recargo: tipo === 'formula' ? (m.recargo ?? 0) : 0,
        cantidadMinima: m.cantidadMinima ?? 0,
        inicio: m.inicio,
        fin: m.fin,
      });
      return undefined;
    });
    if (valido) {
      if (!otra) return this.abierto.set(false);
      this.reiniciar(REGLA_VACIA);
      this.aviso.set('Línea guardada. Agrega la siguiente.');
      document.getElementById('regla-aplicar-producto')?.focus();
      return;
    }
    const f = this.f;
    const id = f.categoria().invalid()
      ? 'regla-categoria'
      : f.precioFijo().invalid()
        ? 'regla-precio'
        : f.descuento().invalid()
          ? 'regla-descuento'
          : f.cantidadMinima().invalid()
            ? 'regla-minima'
            : 'regla-fin';
    document.getElementById(id)?.focus();
  }
}
