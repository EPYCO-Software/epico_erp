import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Buscador, FiltrosElegidos, GrupoFiltro, opcionesDe } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService } from '../ventas/datos';
import { PreviaOrden } from './previa-orden';
import { TableroDespacho } from './tablero-despacho';

/**
 * Logística → Despacho del día (/flota/despacho): el tablero del día por hora y por estado (tablero-despacho.ts). Clic
 * en el folio de una tarjeta abre la orden en la vista previa de la derecha, como en las listas: fecha (reagendar),
 * unidades y tiempos. Los filtros van en el buscador; respeta las plantas del encabezado.
 */
@Component({
  selector: 'app-despacho',
  imports: [Buscador, EnEncabezado, PanelLateral, PreviaOrden, TableroDespacho],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Despacho del día</h1>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-despacho"
          etiqueta="Buscar por orden, cliente, obra o unidad"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ tablero()?.resumen() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 class="text-xl font-bold">El despacho necesita el servidor</h2>
      </section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            <app-tablero-despacho [texto]="texto()" [filtros]="filtros()" [abiertaId]="vista.abiertaId()" (abrir)="vista.abrir($event)" />
          </div>
        </div>
        @if (previa(); as p) {
          <aside appPanelLateral (cerrar)="vista.cerrar()">
            <app-previa-orden [p]="p" (cerrar)="vista.cerrar()" (cambio)="tablero()?.recargar()" />
          </aside>
        }
      </div>
    }
  `,
})
export default class Despacho {
  private readonly ventas = inject(VentasService);
  protected readonly conBackend = this.ventas.conBackend;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly tablero = viewChild(TableroDespacho);
  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const filas = this.tablero()?.filas() ?? [];
    return [
      { id: 'planta', titulo: 'Planta', opciones: opcionesDe(filas, (f) => f.pedido.plantaNombre) },
      { id: 'cliente', titulo: 'Cliente', opciones: opcionesDe(filas, (f) => f.pedido.clienteNombre) },
    ];
  });
  protected readonly vista = vistaPrevia();
  /** La orden completa de Ventas (con sus tiempos, reagenda y unidades). */
  protected readonly previa = computed(() => this.ventas.pedidos().find((p) => p.id === this.vista.abiertaId()) ?? null);
}
