import { Component, ElementRef, effect, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LocateFixed, X } from 'lucide';
import { Icon, MapaSelector, UbicacionGps, plantaPara } from 'ui';

/** Lo que se eligió: el punto y, si el mapa la conoce, su dirección y municipio ("Escárcega, Camp."). */
export interface UbicacionElegida {
  ubicacion: UbicacionGps;
  direccion?: string;
  municipio?: string;
}

interface DireccionNominatim {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
}

const ESTADOS: Record<string, string> = {
  Campeche: 'Camp.',
  'Quintana Roo': 'Q. Roo',
  Yucatán: 'Yuc.',
  Tabasco: 'Tab.',
  Chiapas: 'Chis.',
};

/** La dirección de OpenStreetMap con el formato de las obras: "Calle 31 120, Centro" y "Escárcega, Camp.". */
export function direccionDe(a: DireccionNominatim): Pick<UbicacionElegida, 'direccion' | 'municipio'> {
  const calle = [a.road, a.house_number].filter(Boolean).join(' ');
  const direccion = [calle, a.neighbourhood ?? a.suburb].filter(Boolean).join(', ');
  const lugar = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  const municipio = lugar ? [lugar, a.state && (ESTADOS[a.state] ?? a.state)].filter(Boolean).join(', ') : '';
  return { ...(direccion ? { direccion } : {}), ...(municipio ? { municipio } : {}) };
}

// shortcut: Nominatim público de OpenStreetMap (gratis; uso ligero: una búsqueda por acción). Con tráfico real, usar
// un servidor propio o de un proveedor con la misma API.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Planta Escárcega: de ahí parte el mapa si no hay punto ni municipio conocido. */
const ESCARCEGA: UbicacionGps = { lat: 18.6101, lng: -90.7352 };

/**
 * Ventana para elegir en el mapa a dónde se entrega: buscar una calle o lugar, "Mi ubicación" (la del equipo) o
 * mover el mapa hasta que la marca quede en la entrada. "Usar este punto" la devuelve con la dirección y el municipio
 * del mapa (si los conoce) para llenar lo que falte. Mapa libre (OpenStreetMap), sin costo ni API key.
 */
@Component({
  selector: 'app-elegir-ubicacion',
  imports: [DecimalPipe, Icon, MapaSelector],
  host: { class: 'contents' },
  template: `
    <!-- Esc cierra el diálogo y no debe llegar a quien lo contiene -->
    <dialog
      #dialogo
      aria-labelledby="ubicacion-titulo"
      class="glass-strong m-auto w-[min(56rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
        <h2 id="ubicacion-titulo" class="text-lg font-bold">Ubicación de entrega</h2>
        <button type="button" aria-label="Cerrar sin elegir" [class]="botonIcono" (click)="abierto.set(false)">
          <ui-icon [icono]="iconos.cerrar" />
        </button>
      </div>
      <div class="space-y-3 px-4 py-4 sm:px-6">
        <form role="search" novalidate class="flex flex-wrap gap-2" (submit)="buscar($event)">
          <label for="ubicacion-buscar" class="sr-only">Buscar una calle, colonia o lugar</label>
          <input
            id="ubicacion-buscar"
            type="search"
            autocomplete="off"
            placeholder="Busca una calle, colonia o lugar…"
            class="campo h-10 min-w-0 flex-1 px-3 text-sm"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
          />
          <button type="submit" [class]="botonSecundario">Buscar</button>
          <button type="button" [class]="botonSecundario" (click)="miUbicacion()">
            <ui-icon [icono]="iconos.mia" [tamano]="16" />Mi ubicación
          </button>
        </form>
        <p class="text-sm text-texto-suave empty:hidden" aria-live="polite">{{ estado() }}</p>
        @if (resultados().length) {
          <ul class="max-h-40 scroll-caja rounded-xl bg-white/80 text-sm" aria-label="Resultados de la búsqueda">
            @for (r of resultados(); track r.nombre) {
              <li>
                <button
                  type="button"
                  class="w-full px-3 py-2 text-left hover:bg-carbon/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico"
                  (click)="ir(r.ubicacion)"
                >
                  {{ r.nombre }}
                </button>
              </li>
            }
          </ul>
        }
        @if (abierto()) {
          <ui-mapa-selector class="h-[min(55vh,26rem)]" [(punto)]="punto" [zoom]="zoomInicial" />
        }
        <p class="text-sm text-texto-suave">
          Mueve el mapa (arrastrando, con la rueda o con las flechas) o haz clic hasta que la marca quede en la entrada de
          la obra. Punto: {{ punto().lat | number: '1.5-5' }}, {{ punto().lng | number: '1.5-5' }}
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
          <button type="button" class="boton-primario h-10 w-auto px-4 text-sm disabled:opacity-60" [disabled]="ocupado()" (click)="usar()">
            Usar este punto
          </button>
          <button type="button" [class]="botonSecundario" (click)="abierto.set(false)">Cancelar</button>
        </div>
      </div>
    </dialog>
  `,
})
export class ElegirUbicacion {
  readonly abierto = model(false);
  /** El punto que ya tenía el lugar, si hay. */
  readonly inicial = input<UbicacionGps | null>(null);
  /** Municipio escrito: sin punto, el mapa parte de la planta que lo atiende. */
  readonly municipio = input('');
  readonly elegida = output<UbicacionElegida>();

  protected readonly iconos = { cerrar: X, mia: LocateFixed };
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonIcono =
    'flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';

  protected readonly punto = signal<UbicacionGps>(ESCARCEGA);
  protected zoomInicial = 14;
  protected readonly texto = signal('');
  protected readonly resultados = signal<{ nombre: string; ubicacion: UbicacionGps }[]>([]);
  protected readonly estado = signal('');
  protected readonly ocupado = signal(false);

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        untracked(() => {
          const inicial = this.inicial();
          this.punto.set(inicial ?? plantaPara({ municipio: this.municipio() }).ubicacion ?? ESCARCEGA);
          this.zoomInicial = inicial ? 17 : 14;
          this.texto.set('');
          this.resultados.set([]);
          this.estado.set('');
        });
        d.showModal();
      } else if (!this.abierto() && d.open) {
        d.close();
      }
    });
  }

  protected async buscar(e: Event): Promise<void> {
    e.preventDefault();
    const q = this.texto().trim();
    if (!q) return;
    this.estado.set('Buscando…');
    try {
      const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=mx&accept-language=es&q=${encodeURIComponent(q)}`);
      const lista = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      this.resultados.set(lista.map((x) => ({ nombre: x.display_name, ubicacion: { lat: +x.lat, lng: +x.lon } })));
      this.estado.set(lista.length ? `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'}: elige uno.` : 'Sin resultados: prueba con otra calle o un lugar cercano.');
    } catch {
      this.estado.set('No se pudo buscar. Mueve el mapa a mano.');
    }
  }

  protected ir(u: UbicacionGps): void {
    this.punto.set(u);
    this.resultados.set([]);
    this.estado.set('Listo: ajusta la marca si hace falta.');
  }

  protected miUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.estado.set('Este navegador no da la ubicación.');
      return;
    }
    this.estado.set('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => this.ir({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => this.estado.set('No se pudo obtener tu ubicación (¿permiso denegado?). Busca o mueve el mapa.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  /** Devuelve el punto con la dirección del mapa, si la hay (si el servicio no responde, solo el punto). */
  protected async usar(): Promise<void> {
    const ubicacion = this.punto();
    this.ocupado.set(true);
    this.estado.set('Leyendo la dirección del punto…');
    let datos: Pick<UbicacionElegida, 'direccion' | 'municipio'> = {};
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&accept-language=es&lat=${ubicacion.lat}&lon=${ubicacion.lng}`, {
        signal: AbortSignal.timeout(5000),
      });
      datos = direccionDe(((await r.json()) as { address?: DireccionNominatim }).address ?? {});
    } catch {
      // Sin dirección: el punto basta para que el operador llegue.
    }
    this.ocupado.set(false);
    this.elegida.emit({ ubicacion, ...datos });
    this.abierto.set(false);
  }
}
