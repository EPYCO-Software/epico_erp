import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';

export interface PuntoMapa {
  id: string;
  lat: number;
  lng: number;
  tipo: 'camion' | 'obra' | 'planta';
  /** Texto del marcador (número económico, nombre de la obra…). */
  etiqueta: string;
  /** Camión sin señal reciente: se dibuja atenuado y con borde punteado. */
  atenuado?: boolean;
  /** El elegido (su vista previa está abierta): más grande y con anillo. */
  resaltado?: boolean;
}

/** Un recorrido dibujado como línea (historial de posiciones de un camión). */
export interface RutaMapa {
  id: string;
  puntos: [number, number][];
  color?: string;
}

const COLOR = { camion: '#D3181E', obra: '#1A1A1C', planta: '#696D71' };

/**
 * Mapa con varios puntos (camiones, obra y planta) sobre OpenStreetMap con Leaflet (BSD-2, sin API key).
 * Es complementario: la información también va en texto junto al mapa. Requiere `leaflet/dist/leaflet.css`
 * en los estilos de la app. Se carga con import() para no pesar en las demás páginas.
 */
@Component({
  selector: 'ui-mapa-seguimiento',
  host: { class: 'block overflow-hidden rounded-xl bg-carbon/5' },
  template: `
    <div #lienzo class="size-full" role="region" [attr.aria-label]="titulo()"></div>
    @if (error()) {
      <p class="p-4 text-sm text-texto-suave">No se pudo cargar el mapa.</p>
    }
  `,
})
export class MapaSeguimiento {
  readonly puntos = input.required<PuntoMapa[]>();
  readonly titulo = input('Mapa de seguimiento');
  readonly rutas = input<RutaMapa[]>([]);
  /** Clic en un marcador (su id). Es un atajo con el mouse: quien lo usa ofrece la misma lista en texto. */
  readonly elegir = output<string>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  protected readonly error = signal(false);
  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private readonly marcadores = new Map<string, Leaflet.Marker>();
  private readonly lineas = new Map<string, Leaflet.Polyline>();
  private idsRutas = '';
  /** Solo se encuadra al inicio o cuando cambia qué puntos hay, no en cada actualización de posición. */
  private ids = '';

  constructor() {
    afterNextRender(async () => {
      try {
        // Leaflet es CommonJS: en el build de producción el módulo llega bajo `default`; en desarrollo, directo.
        const modulo = (await import('leaflet')) as typeof Leaflet & { default?: typeof Leaflet };
        const L = (this.L = modulo.default ?? modulo);
        this.mapa = L.map(this.lienzo().nativeElement, { zoomControl: false, attributionControl: true });
        L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(this.mapa);
        this.mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        // shortcut: teselas públicas de OpenStreetMap (uso ligero, con atribución). Con tráfico real, usar un
        // proveedor de teselas (o servidor propio) con la misma URL de plantilla.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.mapa);
        this.sincronizar();
      } catch (e) {
        console.error('No se pudo cargar el mapa', e);
        this.error.set(true);
      }
    });
    effect(() => {
      this.puntos();
      this.rutas();
      this.sincronizar();
    });
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
  }

  private sincronizar(): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;
    const puntos = this.puntos();
    for (const [id, m] of this.marcadores) {
      if (!puntos.some((p) => p.id === id)) {
        m.remove();
        this.marcadores.delete(id);
      }
    }
    for (const p of puntos) {
      const icono = L.divIcon({ className: '', html: this.html(p), iconSize: [0, 0] });
      const m = this.marcadores.get(p.id);
      if (m) {
        m.setLatLng([p.lat, p.lng]).setIcon(icono);
      } else {
        const nuevo = L.marker([p.lat, p.lng], { icon: icono, keyboard: false, title: p.etiqueta }).addTo(mapa);
        nuevo.on('click', () => this.elegir.emit(p.id));
        this.marcadores.set(p.id, nuevo);
      }
      if (p.resaltado) this.marcadores.get(p.id)!.setZIndexOffset(1000);
    }
    // Las rutas: se reemplazan si cambian sus puntos
    const rutas = this.rutas();
    for (const [id, l] of this.lineas) {
      if (!rutas.some((r) => r.id === id)) {
        l.remove();
        this.lineas.delete(id);
      }
    }
    for (const r of rutas) {
      const l = this.lineas.get(r.id);
      if (l) l.setLatLngs(r.puntos);
      else this.lineas.set(r.id, L.polyline(r.puntos, { color: r.color ?? '#D3181E', weight: 4, opacity: 0.85 }).addTo(mapa));
    }
    // Una ruta nueva se encuadra completa (manda sobre los puntos)
    const idsRutas = rutas.map((r) => `${r.id}:${r.puntos.length}`).join();
    if (idsRutas !== this.idsRutas) {
      this.idsRutas = idsRutas;
      const todos = rutas.flatMap((r) => r.puntos);
      if (todos.length) {
        mapa.fitBounds(L.latLngBounds(todos), { padding: [48, 48], maxZoom: 16 });
        this.ids = puntos.map((p) => p.id).join();
        return;
      }
    }
    const ids = puntos.map((p) => p.id).join();
    if (ids !== this.ids && puntos.length) {
      this.ids = ids;
      mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 });
    }
  }

  /** Etiqueta tipo "pin" centrada sobre el punto; sin imágenes (Leaflet las pide para su icono por defecto). */
  private html(p: PuntoMapa): string {
    const color = COLOR[p.tipo];
    const borde = (p.atenuado ? 'border:2px dashed #fff;opacity:.7' : 'border:2px solid #fff') + (p.resaltado ? ';outline:3px solid #1A1A1C' : '');
    const texto = p.etiqueta.replace(/[<>&"]/g, '');
    // La obra va debajo de su punto para no quedar tapada por un camión que está descargando ahí.
    const desplazamiento = p.tipo === 'obra' ? 'translate(-50%,4px)' : 'translate(-50%,-100%)';
    return `<span style="position:absolute;transform:${desplazamiento};white-space:nowrap;background:${color};color:#fff;${borde};border-radius:9999px;padding:2px 8px;font:600 12px/1.4 Figtree,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">${texto}</span>`;
  }
}
