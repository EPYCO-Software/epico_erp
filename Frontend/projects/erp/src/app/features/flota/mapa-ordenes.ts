import { Component, computed, inject, input, output, resource } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FechaZonaPipe, MapaSeguimiento, PedidoVista, PuntoMapa, UbicacionGps } from 'ui';
import { plantasVigentes } from '../../core/plantas';
import { VentasService } from '../ventas/datos';
import { FlotaApi } from './flota-api';

/**
 * Las órdenes en el mapa (OpenStreetMap): la obra o el lugar de entrega de cada una, sus plantas y los camiones con GPS
 * (Traccar). Como el mapa es complementario, al lado va la misma lista en texto; clic en una abre su vista previa. Las
 * que no tienen coordenadas se dicen aparte.
 */
@Component({
  selector: 'app-mapa-ordenes',
  imports: [DecimalPipe, FechaZonaPipe, MapaSeguimiento],
  host: { class: 'block' },
  template: `
    <div class="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
      @if (puntos().length) {
        <ui-mapa-seguimiento class="h-[28rem] xl:h-[calc(100dvh-14rem)]" [puntos]="puntos()" titulo="Mapa de las obras de las órdenes, sus plantas y los camiones con GPS" />
      } @else {
        <p class="flex h-64 items-center justify-center rounded-xl bg-carbon/5 px-6 text-center text-sm text-texto-suave">Ninguna de estas órdenes tiene la ubicación de su obra.</p>
      }
      <div class="min-w-0">
        <p class="text-sm text-texto-suave">
          {{ conUbicacion().length }} en el mapa{{ sinUbicacion().length ? ' · ' + sinUbicacion().length + ' sin ubicación' : '' }}{{ camiones() ? ' · ' + camiones() + ' camiones con GPS' : '' }}
        </p>
        <ul class="mt-2 grid max-h-[calc(100dvh-16rem)] gap-1.5 overflow-x-hidden overflow-y-auto p-1">
          @for (p of pedidos(); track p.id) {
            <li>
              <button
                type="button"
                class="w-full rounded-lg bg-white/85 px-3 py-2 text-left text-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-epico aria-current:ring-2 aria-current:ring-epico"
                [attr.aria-current]="p.id === abiertaId() ? 'true' : null"
                (click)="abrir.emit(p.id)"
              >
                <span class="flex items-baseline justify-between gap-2">
                  <span class="font-semibold">{{ p.folio }}</span>
                  <span class="text-xs text-texto-suave tabular-nums">{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria : 'dd/MM HH:mm' }}</span>
                </span>
                <span class="block truncate text-xs text-texto-suave">{{ p.obraNombre }} · {{ p.volumenM3 | number: '1.0-1' }} m³</span>
                @if (!ubicacion(p)) {
                  <span class="block text-xs font-semibold text-[#7A5410]">Sin ubicación en el mapa</span>
                }
              </button>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class MapaOrdenes {
  private readonly ventas = inject(VentasService);
  private readonly api = inject(FlotaApi);

  readonly pedidos = input.required<PedidoVista[]>();
  readonly abiertaId = input<string | null>(null);
  readonly abrir = output<string>();

  /** La obra (Ventas) o el lugar de entrega de la orden. */
  protected ubicacion(p: PedidoVista): UbicacionGps | undefined {
    return this.ventas.obras().find((o) => o.id === p.obraId)?.ubicacion ?? p.lugar?.ubicacion;
  }
  protected readonly conUbicacion = computed(() => this.pedidos().filter((p) => this.ubicacion(p)));
  protected readonly sinUbicacion = computed(() => this.pedidos().filter((p) => !this.ubicacion(p)));

  private readonly tablero = resource({ loader: () => (this.ventas.conBackend ? this.api.tablero().catch(() => null) : Promise.resolve(null)) });
  private readonly posiciones = computed(() => (this.tablero.hasValue() ? (this.tablero.value()?.equipos ?? []) : []).filter((f) => f.posicion));
  protected readonly camiones = computed(() => this.posiciones().length);

  protected readonly puntos = computed<PuntoMapa[]>(() => {
    // Varias órdenes a la misma obra van en un solo marcador ("Torre Norte · 10 órdenes"): si no, se enciman
    const porLugar = new Map<string, PedidoVista[]>();
    for (const p of this.conUbicacion()) {
      const u = this.ubicacion(p)!;
      const k = `${u.lat.toFixed(5)},${u.lng.toFixed(5)}`;
      porLugar.set(k, [...(porLugar.get(k) ?? []), p]);
    }
    const obras: PuntoMapa[] = [...porLugar.values()].map((ps) => ({
      id: 'o-' + ps[0].id,
      tipo: 'obra',
      ...this.ubicacion(ps[0])!,
      etiqueta: ps.length === 1 ? `${ps[0].folio} · ${ps[0].obraNombre}` : `${ps[0].obraNombre} · ${ps.length} órdenes`,
    }));
    if (!obras.length) return [];
    const codigos = new Set(this.conUbicacion().map((p) => p.plantaId));
    const plantas: PuntoMapa[] = plantasVigentes()
      .filter((pl) => codigos.has(pl.id) && pl.ubicacion)
      .map((pl) => ({ id: 'p-' + pl.id, tipo: 'planta', ...pl.ubicacion!, etiqueta: pl.nombre }));
    const camiones: PuntoMapa[] = this.posiciones().map((f) => ({ id: 'c-' + f.equipo.id, tipo: 'camion', lat: f.posicion!.lat, lng: f.posicion!.lng, etiqueta: f.equipo.numeroEconomico }));
    return [...plantas, ...obras, ...camiones];
  });
}
