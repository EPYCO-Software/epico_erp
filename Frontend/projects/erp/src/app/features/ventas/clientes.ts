import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MonitorCheck, Search } from 'lucide';
import { AuthService, Cliente, Icon, Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { TODOS, tiene } from '../../core/permisos';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService, filtrarClientes, telefono } from './datos';
import { DetalleCliente } from './detalle-cliente';

/**
 * Ventas → Órdenes → Clientes: los clientes con los mismos datos que capturan en el portal, como la lista de Odoo y con
 * lo mismo que Cotizaciones: clic o Enter abre la vista previa a la derecha (con botón de vista completa) y doble clic
 * la vista completa.
 */
@Component({
  selector: 'app-clientes-ventas',
  imports: [Buscador, Icon, EnEncabezado, PanelLateral, DetalleCliente, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          @if (puedeCrear()) {
            <a routerLink="/ventas/clientes/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Clientes</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-cliente"
          etiqueta="Buscar clientes por nombre, razón social, RFC o contacto"
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
          <div
            tabindex="0"
            role="region"
            aria-label="Tabla de clientes"
            [class]="cajas.region"
          >
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-240]="!previa()">
              <caption class="sr-only">
                Clientes. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa. La casilla solo
                marca.
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Cliente</th>
                  <!-- Con la vista previa abierta, razón social y teléfono se ven en ella -->
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Razón social</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">RFC</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Contacto</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Teléfono</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Obras</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Portal</th>
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
                    (dblclick)="verCompleta(c)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(c)"
                  >
                    <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + c.nombre"
                        [checked]="casillas.marcadas().includes(c.id)"
                        (change)="casillas.alternar(c.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 font-semibold">{{ c.nombre }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ c.empresa.razonSocial }}</td>
                    <td class="px-3 py-2.5 tabular-nums">{{ c.empresa.rfc }}</td>
                    <td class="px-3 py-2.5">
                      @if (c.contacto.nombre) {
                        {{ c.contacto.nombre }} {{ c.contacto.apellidos }}
                      } @else {
                        <span class="text-texto-suave">Sin contacto</span>
                      }
                    </td>
                    <td class="px-3 py-2.5 tabular-nums" [class.hidden]="previa()">{{ telefono(c.contacto.telefono) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ obras().get(c.id) ?? 0 }}</td>
                    <td class="px-3 py-2">
                      @if (c.portal) {
                        <span class="inline-flex items-center gap-1.5 rounded-md bg-[#E5F0EA] px-2 py-0.5 text-xs font-bold text-[#2E5E4A]">
                          <ui-icon [icono]="iconos.portal" [tamano]="14" />Conectado
                        </span>
                      } @else {
                        <span class="text-texto-suave">Sin cuenta</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="px-3 py-12 text-center text-texto-suave">Ningún cliente coincide con la búsqueda.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as c) {
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-cliente [c]="c" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class ClientesVentas {
  private readonly router = inject(Router);
  private readonly ventas = inject(VentasService);

  protected readonly iconos = { buscar: Search, portal: MonitorCheck };
  /** Sin permiso de crear clientes no se ofrece "Nuevo" (el backend lo rechazaría). */
  private readonly auth = inject(AuthService);
  protected readonly puedeCrear = computed(() => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.clientes.crear'));
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly telefono = telefono;
  /** Obras por cliente. */
  protected readonly obras = computed(() =>
    this.ventas.obras().reduce((m, o) => m.set(o.clienteId, (m.get(o.clienteId) ?? 0) + 1), new Map<string, number>()),
  );
  protected readonly texto = signal('');
  private readonly base = computed(() => filtrarClientes(this.ventas.clientes(), this.texto()));
  /** Filtros por columna, en el buscador: con o sin RFC, obras y portal. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  private readonly columnas = {
    rfc: (c: Cliente) => (c.empresa.rfc ? 'si' : 'no'),
    obras: (c: Cliente) => ((this.obras().get(c.id) ?? 0) > 0 ? 'si' : 'no'),
    portal: (c: Cliente) => (c.portal ? 'si' : 'no'),
  };
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const base = this.base();
    const n = (col: keyof typeof this.columnas, v: string) => base.filter((c) => this.columnas[col](c) === v).length;
    const siNo = (id: keyof typeof this.columnas, titulo: string, si: string, no: string) => ({
      id,
      titulo,
      opciones: [
        { id: 'si', nombre: si, n: n(id, 'si') },
        { id: 'no', nombre: no, n: n(id, 'no') },
      ],
    });
    return [
      siNo('rfc', 'RFC', 'Con RFC', 'Sin RFC'),
      siNo('obras', 'Obras', 'Con obras', 'Sin obras'),
      siNo('portal', 'Portal', 'Conectado al portal', 'Sin portal'),
    ];
  });
  protected readonly filas = computed(() =>
    this.base().filter((c) => (Object.keys(this.columnas) as (keyof typeof this.columnas)[]).every((col) => pasaFiltro(this.filtros(), col, this.columnas[col](c)))),
  );
  /** Los marcados con las casillas; se desmarcan al cambiar la búsqueda, como en Odoo. */
  protected readonly casillas = seleccionMultiple(this.filas);
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`;
    return n === 1 ? '1 cliente' : `${n} clientes`;
  });

  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.filas().find((c) => c.id === this.vista.abiertaId()) ?? null);

  private readonly detalle = viewChild(DetalleCliente);

  /** Con la vista previa en edición, se pregunta antes de dejarla (el otro cliente abre sin editar). */
  private puedeDejarla(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando este cliente. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }

  protected abrir(c: Cliente): void {
    if (c.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(c.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(c: Cliente): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/clientes', c.id]);
  }
}
