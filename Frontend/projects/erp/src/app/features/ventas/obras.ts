import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MapPin } from 'lucide';
import { AuthService, Buscador, FiltrosElegidos, GrupoFiltro, Icon, Obra, opcionesDe, pasaFiltro } from 'ui';
import { TODOS, tiene } from '../../core/permisos';
import { normalizar } from '../../core/modulos';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService } from './datos';
import { DetalleObra } from './detalle-obra';

/**
 * Ventas → Órdenes → Obras: las posiciones de entrega, de un cliente o generales (sin cliente). Como Clientes: clic o
 * Enter abre la vista previa a la derecha y doble clic la vista completa.
 */
@Component({
  selector: 'app-obras-ventas',
  imports: [Buscador, Icon, EnEncabezado, PanelLateral, DetalleObra, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puedeCrear()) {
            <a routerLink="/ventas/obras/nueva" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Obras</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-obra"
          etiqueta="Buscar obras por nombre, dirección, municipio o cliente"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ filas().length === 1 ? '1 obra' : filas().length + ' obras' }}</p>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <div tabindex="0" role="region" aria-label="Tabla de obras" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <caption class="sr-only">Obras. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa.</caption>
              <thead [class]="cajas.titulos">
                <tr>
                  <th scope="col" class="px-3 py-2.5 pl-4 font-semibold">Obra</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Cliente</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Dirección</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Municipio</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Responsable</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">GPS</th>
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track f.o.id) {
                  <tr
                    [id]="'fila-' + f.o.id"
                    tabindex="0"
                    [class]="fila"
                    [attr.aria-current]="f.o.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(f.o)"
                    (dblclick)="verCompleta(f.o)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(f.o)"
                  >
                    <td class="px-3 py-2.5 pl-4 font-semibold">{{ f.o.nombre }}</td>
                    <td class="px-3 py-2.5">
                      @if (f.cliente) {
                        {{ f.cliente }}
                      } @else {
                        <span class="text-texto-suave">General</span>
                      }
                    </td>
                    <td class="max-w-xs truncate px-3 py-2.5" [class.hidden]="previa()">{{ f.o.direccion }}</td>
                    <td class="px-3 py-2.5">{{ f.o.municipio || '—' }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ f.o.responsable.nombre || '—' }}</td>
                    <td class="px-3 py-2.5">
                      @if (f.o.ubicacion) {
                        <span class="inline-flex items-center gap-1 text-[#2E5E4A]"><ui-icon [icono]="iconos.gps" [tamano]="14" />Sí</span>
                      } @else {
                        <span class="text-texto-suave">Sin GPS</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="px-3 py-12 text-center text-texto-suave">
                      {{ ventas.cargando() ? 'Cargando obras…' : texto() ? 'Ninguna obra coincide con la búsqueda.' : 'Aún no hay obras.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as o) {
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-obra [o]="o" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class ObrasVentas {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly ventas = inject(VentasService);

  protected readonly iconos = { gps: MapPin };
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly texto = signal('');
  /** De clientes o generales, en el botón de filtros del buscador (se suman; ninguno = todas). */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    {
      id: 'tipo',
      titulo: 'Tipo de obra',
      opciones: [
        { id: 'clientes', nombre: 'De clientes', n: this.ventas.obras().filter((o) => o.clienteId).length },
        { id: 'generales', nombre: 'Generales', n: this.ventas.obras().filter((o) => !o.clienteId).length },
      ],
    },
    { id: 'municipio', titulo: 'Municipio', opciones: opcionesDe(this.ventas.obras(), (o) => o.municipio) },
    {
      id: 'gps',
      titulo: 'GPS',
      opciones: [
        { id: 'si', nombre: 'Con punto en el mapa', n: this.ventas.obras().filter((o) => o.ubicacion).length },
        { id: 'no', nombre: 'Sin punto en el mapa', n: this.ventas.obras().filter((o) => !o.ubicacion).length },
      ],
    },
  ]);
  protected readonly puedeCrear = computed(() => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.obras.crear'));

  protected readonly filas = computed(() => {
    const palabras = normalizar(this.texto()).split(/\s+/).filter(Boolean);
    return this.ventas
      .obras()
      .filter(
        (o) =>
          pasaFiltro(this.filtros(), 'tipo', o.clienteId ? 'clientes' : 'generales') &&
          pasaFiltro(this.filtros(), 'municipio', o.municipio) &&
          pasaFiltro(this.filtros(), 'gps', o.ubicacion ? 'si' : 'no'),
      )
      .map((o) => ({ o, cliente: o.clienteId ? (this.ventas.cliente(o.clienteId)?.nombre ?? 'Cliente') : '' }))
      .filter(({ o, cliente }) => {
        const t = normalizar(`${o.nombre} ${o.direccion} ${o.municipio} ${cliente || 'general'}`);
        return palabras.every((p) => t.includes(p));
      })
      .sort((a, b) => a.o.nombre.localeCompare(b.o.nombre));
  });

  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.ventas.obras().find((o) => o.id === this.vista.abiertaId()) ?? null);
  private readonly detalle = viewChild(DetalleObra);

  /** Con la vista previa en edición, se pregunta antes de dejarla (la otra abre sin editar). */
  private puedeDejarla(): boolean {
    return (
      !this.detalle()?.enEdicion() || confirm('Estás editando esta obra. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?')
    );
  }

  protected abrir(o: Obra): void {
    if (o.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(o.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(o: Obra): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/obras', o.id]);
  }
}
