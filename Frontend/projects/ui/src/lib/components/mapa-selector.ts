import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, model, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { UbicacionGps } from '../models/obra';

/** 6 decimales: ~10 cm, de sobra para que el operador encuentre la entrada. */
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Elegir un punto en el mapa (OpenStreetMap con Leaflet, BSD-2, sin API key ni costo). La marca queda fija en el
 * centro y el punto elegido es el centro: se mueve el mapa arrastrando, con la rueda, con touch o con las flechas del
 * teclado (el mapa es enfocable), y un clic lleva la marca a ese lugar. `punto` va de ida y vuelta: si cambia desde
 * afuera (un resultado de búsqueda, "Mi ubicación"), el mapa va ahí. Requiere `leaflet/dist/leaflet.css`; se carga
 * con import() al mostrarse.
 */
@Component({
  selector: 'ui-mapa-selector',
  host: { class: 'relative block overflow-hidden rounded-xl bg-carbon/5' },
  template: `
    <div #lienzo class="size-full" role="region" [attr.aria-label]="titulo()"></div>
    <!-- La marca: su punta es el centro del mapa -->
    <svg
      aria-hidden="true"
      viewBox="0 0 24 32"
      class="pointer-events-none absolute top-1/2 left-1/2 z-[450] h-10 w-8 -translate-x-1/2 -translate-y-full drop-shadow-[0_3px_4px_rgb(0_0_0/0.35)]"
    >
      <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z" fill="#D3181E" />
      <circle cx="12" cy="12" r="4.5" fill="#fff" />
    </svg>
    @if (error()) {
      <p class="absolute inset-0 grid place-items-center p-4 text-sm text-texto-suave">No se pudo cargar el mapa.</p>
    }
  `,
})
export class MapaSelector {
  readonly punto = model.required<UbicacionGps>();
  readonly zoom = input(16);
  readonly titulo = input('Mapa: mueve el mapa hasta que la marca quede en el punto de entrega');

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  protected readonly error = signal(false);
  private mapa: Leaflet.Map | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(async () => {
      try {
        // Leaflet es CommonJS: en el build de producción el módulo llega bajo `default`; en desarrollo, directo.
        const modulo = (await import('leaflet')) as typeof Leaflet & { default?: typeof Leaflet };
        const L = modulo.default ?? modulo;
        const p = this.punto();
        const mapa = (this.mapa = L.map(this.lienzo().nativeElement, { zoomControl: false, center: [p.lat, p.lng], zoom: this.zoom() }));
        L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
        mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        // shortcut: teselas públicas de OpenStreetMap (uso ligero, con atribución), como mapa-seguimiento.ts.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa);
        mapa.on('moveend', () => {
          const c = mapa.getCenter();
          this.punto.set({ lat: redondear(c.lat), lng: redondear(c.lng) });
        });
        mapa.on('click', (e: Leaflet.LeafletMouseEvent) => mapa.panTo(e.latlng));
        // Dentro de un diálogo puede nacer sin tamaño: al tomarlo, Leaflet vuelve a medir.
        const ro = new ResizeObserver(() => mapa.invalidateSize());
        ro.observe(this.lienzo().nativeElement);
        destroy.onDestroy(() => ro.disconnect());
      } catch (e) {
        console.error('No se pudo cargar el mapa', e);
        this.error.set(true);
      }
    });
    // Un punto que llega de afuera mueve el mapa (el que sale del propio mapa ya es su centro).
    effect(() => {
      const p = this.punto();
      const c = this.mapa?.getCenter();
      if (c && (Math.abs(c.lat - p.lat) > 1e-6 || Math.abs(c.lng - p.lng) > 1e-6)) this.mapa!.setView([p.lat, p.lng], Math.max(this.mapa!.getZoom(), 16));
    });
    destroy.onDestroy(() => this.mapa?.remove());
  }
}
