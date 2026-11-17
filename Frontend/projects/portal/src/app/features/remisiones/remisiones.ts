import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, Buscador, FiltrosElegidos, GlassCard, GrupoFiltro, PageHeader, enRango, fechaHoraCorta, mensajeError, opcionesDe, pasaFiltro } from 'ui';
import { ApiViaje } from '../../core/services/pedidos-api';
import { ESTADO_VIAJE } from '../pedidos/seguimiento';

/** Remisiones (viajes) de los pedidos del cliente: GET /portal/remisiones. Sin backend, "próximamente". */
@Component({
  selector: 'app-remisiones',
  imports: [Buscador, GlassCard, PageHeader],
  template: `
    <ui-page-header title="Remisiones" subtitle="Comprobantes de entrega por viaje" />
    @if (!conServidor) {
      <ui-glass-card heading="Remisiones recientes">
        <p class="text-sm text-texto-suave">Próximamente.</p>
      </ui-glass-card>
    } @else {
      @if (error()) {
        <p role="alert" class="glass mb-4 px-5 py-4 text-sm font-medium text-critico">
          {{ error() }}
        </p>
      }
      <ui-buscador
        class="mb-3 max-w-2xl"
        idBuscar="buscar-remision"
        etiqueta="Buscar remisiones por folio, pedido, unidad u operador"
        [(texto)]="texto"
        [grupos]="grupos()"
        [(filtros)]="filtros"
      />
      <!-- Como las tablas del ERP: los títulos de orilla a orilla de la caja (overflow-hidden recorta sus esquinas) -->
      <div class="glass overflow-hidden pb-2">
        <div
          class="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
          tabindex="0"
          role="region"
          aria-label="Tabla de remisiones"
        >
          <table class="w-full text-left text-sm whitespace-nowrap">
            <caption class="sr-only">
              Remisiones de tus pedidos, la más reciente primero.
            </caption>
            <thead class="bg-white/95 shadow-[0_1px_0_var(--color-acero)]">
              <tr>
                <th scope="col" class="px-3 py-2.5 pl-4 font-semibold">Remisión</th>
                <th scope="col" class="px-3 py-2.5 font-semibold">Pedido</th>
                <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" class="px-3 py-2.5 text-right font-semibold">m³</th>
                <th scope="col" class="px-3 py-2.5 font-semibold">Unidad</th>
                <th scope="col" class="px-3 py-2.5 font-semibold">Salida</th>
                <th scope="col" class="px-3 py-2.5 font-semibold">Llegada</th>
              </tr>
            </thead>
            <tbody>
              @for (r of visibles(); track r.id) {
                <tr class="border-b border-acero/40">
                  <td class="px-3 py-2.5 pl-4 font-semibold">{{ r.folio }}</td>
                  <td class="px-3 py-2.5">{{ r.pedidoFolio }}</td>
                  <td class="px-3 py-2.5">{{ estado(r) }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums">{{ r.volumenM3 }}</td>
                  <td class="px-3 py-2.5">
                    {{ r.camion || '—' }}{{ r.operador ? ' · ' + r.operador : '' }}
                  </td>
                  <td class="px-3 py-2.5">{{ fecha(r.salidaEn) }}</td>
                  <td class="px-3 py-2.5">
                    {{ fecha(r.llegadaEn ?? r.llegadaEstimada)
                    }}{{ !r.llegadaEn && r.llegadaEstimada ? ' (estimada)' : '' }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-3 py-12 text-center text-texto-suave">
                    {{
                      cargando()
                        ? 'Cargando remisiones…'
                        : remisiones().length
                          ? 'Ninguna remisión coincide con la búsqueda o los filtros.'
                          : 'Aún no hay remisiones de tus pedidos.'
                    }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export default class Remisiones {
  private readonly base = inject(AUTH_API_URL, { optional: true });
  protected readonly conServidor = !!this.base;
  private readonly http = this.base ? inject(HttpClient) : null;
  protected readonly remisiones = signal<ApiViaje[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly texto = signal('');
  /** Un grupo por columna: pedido, estado, volumen, unidad y salida (ninguno marcado = todas). */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const todas = this.remisiones();
    return [
      { id: 'pedido', titulo: 'Pedido', opciones: opcionesDe(todas, (r) => r.pedidoFolio) },
      { id: 'estado', titulo: 'Estado', opciones: opcionesDe(todas, (r) => r.estado, (e) => this.estado({ estado: e } as ApiViaje)) },
      { id: 'volumen', titulo: 'Volumen', rango: 'numero', sufijo: ' m³' },
      { id: 'unidad', titulo: 'Unidad', opciones: opcionesDe(todas, (r) => r.camion ?? '') },
      { id: 'salida', titulo: 'Salida', rango: 'fecha' },
    ];
  });
  protected readonly visibles = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const f = this.filtros();
    return this.remisiones().filter(
      (r) =>
        pasaFiltro(f, 'pedido', r.pedidoFolio) &&
        pasaFiltro(f, 'estado', r.estado) &&
        enRango(f, 'volumen', r.volumenM3) &&
        pasaFiltro(f, 'unidad', r.camion ?? '') &&
        enRango(f, 'salida', r.salidaEn) &&
        (!q || `${r.folio} ${r.pedidoFolio} ${r.camion ?? ''} ${r.operador ?? ''}`.toLowerCase().includes(q)),
    );
  });

  constructor() {
    if (this.base) void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.http!.get<{ items: ApiViaje[] }>(`${this.base}/portal/remisiones?pagina=1&tamano=200`),
      );
      this.remisiones.set(r.items);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected estado(r: ApiViaje): string {
    return r.estado === 'terminado' ? 'Terminado' : ESTADO_VIAJE[r.estado];
  }

  /** shortcut: hora del navegador; con varias zonas, mostrarla en la de la planta del pedido. */
  protected fecha(iso: string | null): string {
    return iso ? fechaHoraCorta(iso) : '—';
  }
}
