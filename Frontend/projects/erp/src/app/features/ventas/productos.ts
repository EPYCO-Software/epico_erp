import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Buscador, CATEGORIAS_PRODUCTO, FiltrosElegidos, GrupoFiltro, ProductoTarifa, pasaFiltro, enRango, opcionesDe, TIPOS_PRODUCTO, TIPO_DE_CATEGORIA, TipoProducto, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, existenciasBajas, filtrarProductos } from './datos';
import { DetalleProducto } from './detalle-producto';
import { permisosSesion } from '../../core/permisos';

/**
 * Ventas → Productos → Productos: el tarifario (concretos f´c y MR, ajustes, servicios y renta de maquinaria) y los que se
 * dan de alta con "Nuevo" (Concreto, Servicio o Producto general), filtrables por tipo, con lo mismo que las demás listas: casillas (una, varias o todas), clic o Enter abre la vista previa a la derecha y doble
 * clic la vista completa. Los precios son los mismos con que se cotiza (PRODUCTOS de ui).
 */
@Component({
  selector: 'app-productos',
  imports: [Buscador, RouterLink, EnEncabezado, PanelLateral, DetalleProducto],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          @if (puede('ventas.productos.crear')) {
            <a routerLink="/ventas/productos/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Productos</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-producto"
          etiqueta="Buscar productos por código, nombre o categoría"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
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
                    (click)="abrir(p)"
                    (dblclick)="verCompleto(p)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(p)"
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
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-producto [p]="p" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Productos {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly categorias = CATEGORIAS_PRODUCTO;
  protected readonly pesos = pesos;
  protected readonly texto = signal('');
  /** Filtro por tipo (Concreto, Aditivo, Servicio, Producto general), en el botón de filtros del buscador. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    {
      id: 'tipo',
      titulo: 'Tipo de producto',
      opciones: (Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((id) => ({
        id,
        nombre: TIPOS_PRODUCTO[id],
        n: this.ventas.productos().filter((p) => TIPO_DE_CATEGORIA[p.categoria] === id).length,
      })),
    },
    { id: 'categoria', titulo: 'Categoría', opciones: opcionesDe(this.ventas.productos(), (p) => p.categoria, (c) => CATEGORIAS_PRODUCTO[c as keyof typeof CATEGORIAS_PRODUCTO] ?? c) },
    { id: 'unidad', titulo: 'Unidad', opciones: opcionesDe(this.ventas.productos(), (p) => p.unidad) },
    { id: 'precio', titulo: 'Precio de lista', rango: 'numero', prefijo: '$' },
    {
      id: 'uso',
      titulo: 'Cotizaciones',
      opciones: [
        { id: 'si', nombre: 'En cotizaciones', n: this.ventas.productos().filter((p) => this.usos().get(p.id)).length },
        { id: 'no', nombre: 'Sin usar', n: this.ventas.productos().filter((p) => !this.usos().get(p.id)).length },
      ],
    },
  ]);
  protected readonly filas = computed(() => {
    const f = this.filtros();
    return filtrarProductos(this.ventas.productos(), this.texto()).filter(
      (p) =>
        pasaFiltro(f, 'tipo', TIPO_DE_CATEGORIA[p.categoria]) &&
        pasaFiltro(f, 'categoria', p.categoria) &&
        pasaFiltro(f, 'unidad', p.unidad) &&
        enRango(f, 'precio', p.precio) &&
        pasaFiltro(f, 'uso', this.usos().get(p.id) ? 'si' : 'no'),
    );
  });
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

  private readonly detalle = viewChild(DetalleProducto);

  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en este producto. ¿Descartarlos?');
  }

  protected abrir(p: ProductoTarifa): void {
    if (p.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(p.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleto(p: ProductoTarifa): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/productos', p.id]);
  }
}
