import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { CATEGORIAS_PRODUCTO, Icon, ProductoTarifa, TIPOS_PRODUCTO, TIPO_DE_CATEGORIA, TipoProducto, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, existenciasBajas, filtrarProductos } from './datos';
import { DetalleProducto } from './detalle-producto';

/**
 * Ventas → Productos → Productos: el tarifario (concretos f´c y MR, ajustes, servicios y renta de maquinaria) y los que se
 * dan de alta con "Nuevo" (Concreto, Servicio o Producto general), filtrables por tipo, con lo mismo que las demás listas: casillas (una, varias o todas), clic o Enter abre la vista previa a la derecha y doble
 * clic la vista completa. Los precios son los mismos con que se cotiza (PRODUCTOS de ui).
 */
@Component({
  selector: 'app-productos',
  imports: [Icon, RouterLink, EnEncabezado, PanelLateral, DetalleProducto],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          <a routerLink="/ventas/productos/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Productos</h1>
        </div>
        <form role="search" class="relative min-w-0 flex-1" (submit)="$event.preventDefault()">
          <label for="buscar-producto" class="sr-only">Buscar productos por código, nombre o categoría</label>
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="17"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave max-sm:hidden"
          />
          <input
            id="buscar-producto"
            type="search"
            autocomplete="off"
            placeholder="Buscar…"
            class="campo h-9 rounded-lg bg-white/65! pr-3 pl-3 text-[15px] sm:pl-9"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
            (keydown.escape)="texto.set('')"
          />
        </form>
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <!-- Por tipo: lo principal (concreto), servicios y productos generales -->
          <fieldset class="px-1 pt-3 pb-2">
            <legend class="sr-only">Tipo de producto</legend>
            <div class="inline-flex flex-wrap gap-1 rounded-xl bg-carbon/5 p-1 text-sm">
              @for (t of tipos(); track t.id) {
                <label
                  class="cursor-pointer rounded-lg px-3 py-1.5 font-semibold text-texto-suave has-checked:bg-white has-checked:text-carbon has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-epico"
                >
                  <input type="radio" name="tipo-producto" class="sr-only" [checked]="tipo() === t.id" (change)="tipo.set(t.id)" />
                  {{ t.nombre }} <span class="font-normal">({{ t.n }})</span>
                </label>
              }
            </div>
          </fieldset>
          <div tabindex="0" role="region" aria-label="Tabla de productos" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-240]="!previa()">
              <caption class="sr-only">
                Productos del tarifario. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa. La
                casilla solo marca.
              </caption>
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Código</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Producto</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Categoría</th>
                  <!-- Con la vista previa abierta, unidad y uso se ven en ella -->
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Unidad</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Precio de lista</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="previa()">Cotizaciones</th>
                </tr>
              </thead>
              <tbody>
                @for (p of filas(); track p.id) {
                  <tr
                    [id]="'fila-' + p.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [attr.aria-current]="p.id === vista.abiertaId() ? 'true' : null"
                    (click)="vista.abrir(p.id)"
                    (dblclick)="verCompleto(p)"
                    (keydown.enter)="$event.target === $event.currentTarget && vista.abrir(p.id)"
                  >
                    <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + p.nombre"
                        [checked]="casillas.marcadas().includes(p.id)"
                        (change)="casillas.alternar(p.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 tabular-nums">{{ p.codigo }}</td>
                    <td class="px-3 py-2.5 font-semibold">
                      {{ p.nombre }}
                      @if (bajas(p)) {
                        <span class="ml-1.5 rounded-md bg-[#F6E3E1] px-1.5 py-0.5 text-xs font-bold text-[#8E332C]">Pocas existencias</span>
                      }
                    </td>
                    <td class="px-3 py-2.5">{{ categorias[p.categoria] }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ p.unidad }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">\${{ pesos(p.precio) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="previa()">{{ usos().get(p.id) ?? 0 }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="px-3 py-12 text-center text-texto-suave">Ningún producto coincide con la búsqueda.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as p) {
        <aside appPanelLateral (cerrar)="vista.cerrar()">
          <app-detalle-producto [p]="p" (cerrar)="vista.cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Productos {
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly categorias = CATEGORIAS_PRODUCTO;
  protected readonly pesos = pesos;
  protected readonly texto = signal('');
  /** Todos o solo un tipo (Concreto, Servicio, Producto general). */
  protected readonly tipo = signal<TipoProducto | 'todos'>('todos');
  protected readonly tipos = computed(() =>
    [{ id: 'todos' as const, nombre: 'Todos' }, ...(Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((id) => ({ id, nombre: TIPOS_PRODUCTO[id] }))].map(
      (t) => ({ ...t, n: this.ventas.productos().filter((p) => t.id === 'todos' || TIPO_DE_CATEGORIA[p.categoria] === t.id).length }),
    ),
  );
  protected readonly filas = computed(() =>
    filtrarProductos(this.ventas.productos(), this.texto()).filter((p) => this.tipo() === 'todos' || TIPO_DE_CATEGORIA[p.categoria] === this.tipo()),
  );
  /** En cuántas cotizaciones va cada producto. */
  protected readonly usos = computed(() => new Map(this.ventas.productos().map((p) => [p.id, this.ventas.usoDe(p.id).cotizaciones.length])));
  protected readonly bajas = existenciasBajas;

  /** Los marcados; se desmarcan al cambiar la búsqueda, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`;
    return n === 1 ? '1 producto' : `${n} productos`;
  });

  protected readonly vista = vistaPrevia();
  /** Contra la lista filtrada: si la búsqueda lo oculta, la vista previa se cierra. */
  protected readonly previa = computed(() => this.filas().find((p) => p.id === this.vista.abiertaId()) ?? null);

  protected verCompleto(p: ProductoTarifa): void {
    void this.router.navigate(['/ventas/productos', p.id]);
  }
}
