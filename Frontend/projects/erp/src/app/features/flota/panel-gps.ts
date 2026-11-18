import { Component, DestroyRef, computed, effect, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Maximize2, Pause, Play, X } from 'lucide';
import { Icon, textoDuracion } from 'ui';
import { ESTADO_VIAJE, FlotaApi, PosicionUnidad, PuntoRecorrido, Recorrido, SITUACION_GPS, nombreTipo, situacionGps, textoSensores } from './flota-api';

type Rango = 'ultimas2h' | 'hoy' | 'ayer' | 'viaje' | 'personalizado';
const RANGOS: { id: Rango; nombre: string }[] = [
  { id: 'ultimas2h', nombre: 'Últimas 2 h' },
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: 'viaje', nombre: 'Viaje actual' },
  { id: 'personalizado', nombre: 'Otro rango' },
];
const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const hora = (iso: string) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Ventana [desde, hasta] (ISO UTC) de un rango; null = el del viaje (otro endpoint). */
export function ventanaDe(r: Exclude<Rango, 'viaje' | 'personalizado'>, ahora = new Date()): [string, string] {
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (r === 'ultimas2h') return [new Date(ahora.getTime() - 2 * 3600_000).toISOString(), ahora.toISOString()];
  if (r === 'hoy') return [inicioHoy.toISOString(), ahora.toISOString()];
  return [new Date(inicioHoy.getTime() - 86_400_000).toISOString(), inicioHoy.toISOString()];
}

/**
 * Panel de una unidad en el mapa de flota (como el de Loop4): dónde está y qué dicen sus sensores ahora; su recorrido en un
 * rango (últimas 2 h, hoy, ayer, el viaje en curso u otro) con km, velocidades y tiempos; y la reproducción del recorrido
 * con una barra de tiempo: el punto elegido se marca en el mapa (salida `punto`) con su hora, velocidad, altitud y
 * sensores. La gráfica de velocidad y altitud es apoyo visual; los mismos datos van en texto.
 */
@Component({
  selector: 'app-panel-gps',
  imports: [DecimalPipe, Icon, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ u().numeroEconomico }}</h2>
        <p class="text-sm text-texto-suave">{{ tipo() }} · {{ u().plantaNombres.join(', ') }}</p>
      </div>
      <div class="-mt-1 -mr-1 flex shrink-0">
        <a [routerLink]="['/flota/unidades', u().equipoId]" aria-label="Abrir ficha de la unidad" title="Abrir ficha de la unidad" [class]="botonIcono">
          <ui-icon [icono]="iconos.completa" [tamano]="17" />
        </a>
        <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()"><ui-icon [icono]="iconos.cerrar" [tamano]="18" /></button>
      </div>
    </div>

    <section class="mt-3 rounded-xl bg-white/70 p-3 text-sm" aria-labelledby="gps-ahora">
      <h3 id="gps-ahora" class="font-semibold">Ahora</h3>
      <p class="mt-1">
        <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + tonoSituacion()">{{ situacionTexto() }}</span>
        <span class="text-texto-suave"> · señal {{ hace(u().fecha) }}</span>
      </p>
      <dl class="mt-2 grid grid-cols-3 gap-2">
        <div [class]="cifra"><dt [class]="etiqueta">Velocidad</dt><dd class="font-bold tabular-nums">{{ u().velocidadKmh != null ? (u().velocidadKmh | number: '1.0-0') + ' km/h' : '—' }}</dd></div>
        <div [class]="cifra"><dt [class]="etiqueta">Altitud</dt><dd class="font-bold tabular-nums">{{ u().altitudM != null ? (u().altitudM | number: '1.0-0') + ' m' : '—' }}</dd></div>
        <div [class]="cifra"><dt [class]="etiqueta">Rumbo</dt><dd class="font-bold tabular-nums">{{ u().rumbo != null ? (u().rumbo | number: '1.0-0') + '°' : '—' }}</dd></div>
      </dl>
      @if (sensoresAhora().length) {
        <ul class="mt-2 grid gap-0.5" aria-label="Sensores">
          @for (s of sensoresAhora(); track s) {
            <li>{{ s }}</li>
          }
        </ul>
      }
      @if (u().viaje; as v) {
        <p class="mt-2">
          Va en <a [routerLink]="['/ventas/ordenes', v.pedidoFolio]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ v.pedidoFolio }}</a> · {{ estados[v.estado] }}
        </p>
      }
    </section>

    <section class="mt-3 rounded-xl bg-white/70 p-3 text-sm" aria-labelledby="gps-recorrido">
      <h3 id="gps-recorrido" class="font-semibold">Recorrido</h3>
      <div class="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Rango del recorrido">
        @for (r of rangos(); track r.id) {
          <button type="button" [class]="botonChico" [attr.aria-pressed]="rango() === r.id" (click)="elegirRango(r.id)">{{ r.nombre }}</button>
        }
      </div>
      @if (rango() === 'personalizado') {
        <form novalidate class="mt-2 grid grid-cols-2 gap-2" (submit)="aplicarRango($event)">
          <div>
            <label for="gps-desde" [class]="etiqueta">Desde</label>
            <input id="gps-desde" type="datetime-local" class="campo mt-1 h-9 px-2" [value]="desde()" (input)="desde.set($any($event.target).value)" />
          </div>
          <div>
            <label for="gps-hasta" [class]="etiqueta">Hasta</label>
            <input id="gps-hasta" type="datetime-local" class="campo mt-1 h-9 px-2" [value]="hasta()" (input)="hasta.set($any($event.target).value)" />
          </div>
          <p class="col-span-2 text-xs font-medium text-critico empty:hidden" role="alert">{{ errorRango() }}</p>
          <button type="submit" class="boton-primario col-span-2 h-9 w-auto px-3 text-sm">Ver recorrido</button>
        </form>
      }

      @if (datos.isLoading()) {
        <p class="mt-2 text-texto-suave">Cargando el recorrido…</p>
      } @else if (datos.error()) {
        <p class="mt-2 font-medium text-critico" role="alert">No se pudo leer el recorrido.</p>
      } @else if (r(); as r) {
        @if (!r.puntos.length) {
          <p class="mt-2 text-texto-suave">Sin posiciones en ese rango.</p>
        } @else {
          <dl class="mt-2 grid grid-cols-3 gap-2">
            <div [class]="cifra"><dt [class]="etiqueta">Km</dt><dd class="font-bold tabular-nums">{{ r.resumen.km | number: '1.0-1' }}</dd></div>
            <div [class]="cifra"><dt [class]="etiqueta">Vel. máx.</dt><dd class="font-bold tabular-nums">{{ r.resumen.velocidadMaxKmh != null ? (r.resumen.velocidadMaxKmh | number: '1.0-0') + ' km/h' : '—' }}</dd></div>
            <div [class]="cifra"><dt [class]="etiqueta">Vel. prom.</dt><dd class="font-bold tabular-nums">{{ r.resumen.velocidadPromKmh != null ? (r.resumen.velocidadPromKmh | number: '1.0-0') + ' km/h' : '—' }}</dd></div>
            <div [class]="cifra + ' col-span-3 sm:col-span-3'">
              <dt class="sr-only">Tiempos</dt>
              <dd>En movimiento {{ duracion(r.resumen.enMovimientoMin) }} · detenida {{ duracion(r.resumen.detenidoMin) }}</dd>
            </div>
          </dl>

          <!-- Reproducción -->
          <div class="mt-3">
            <div class="flex items-center gap-2">
              <button type="button" [class]="botonIconoChico" [attr.aria-label]="reproduciendo() ? 'Pausar la reproducción' : 'Reproducir el recorrido'" (click)="alternarReproduccion()">
                <ui-icon [icono]="reproduciendo() ? iconos.pausa : iconos.play" [tamano]="16" />
              </button>
              <label for="gps-tiempo" class="sr-only">Momento del recorrido</label>
              <input
                id="gps-tiempo"
                type="range"
                class="w-full accent-epico"
                min="0"
                [max]="r.puntos.length - 1"
                [value]="indice()"
                [attr.aria-valuetext]="textoPunto()"
                (input)="irA($any($event.target).valueAsNumber)"
              />
            </div>
            <!-- Velocidad (rojo) y altitud (gris) en el tiempo; el cursor es el momento elegido -->
            <svg viewBox="0 0 300 60" class="mt-1 h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
              <polyline [attr.points]="lineaAltitud()" fill="none" stroke="#9AA0A6" stroke-width="1.2" vector-effect="non-scaling-stroke" />
              <polyline [attr.points]="lineaVelocidad()" fill="none" stroke="#D3181E" stroke-width="1.5" vector-effect="non-scaling-stroke" />
              <line [attr.x1]="cursorX()" [attr.x2]="cursorX()" y1="0" y2="60" stroke="#1A1A1C" stroke-width="1" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="flex justify-between text-xs text-texto-suave tabular-nums">
              <span>{{ horaDe(r.puntos[0].fecha) }}</span>
              <span><span class="text-epico">━</span> velocidad <span class="text-[#9AA0A6]">━</span> altitud</span>
              <span>{{ horaDe(r.puntos[r.puntos.length - 1].fecha) }}</span>
            </p>
            @if (actual()) {
              <p class="mt-2 rounded-lg bg-[#E6F0F4] px-3 py-2 text-[#24485A]" aria-live="polite">{{ textoPunto() }}</p>
            }
          </div>

          @if (r.viajes.length) {
            <p class="mt-3 text-xs font-bold tracking-wide text-texto-suave uppercase">Viajes en este rango</p>
            <ul class="mt-1 grid gap-1">
              @for (v of r.viajes; track v.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 px-3 py-1.5">
                  <span>{{ v.folio }} · <a [routerLink]="['/ventas/ordenes', v.pedidoFolio]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ v.pedidoFolio }}</a> · {{ estados[v.estado] }}</span>
                  <button type="button" [class]="botonChico" (click)="verViaje(v.id)">Ver su recorrido<span class="sr-only"> ({{ v.folio }})</span></button>
                </li>
              }
            </ul>
          }
        }
      }
    </section>
  `,
})
export class PanelGps {
  private readonly api = inject(FlotaApi);
  readonly u = input.required<PosicionUnidad>();
  readonly cerrar = output();
  /** El recorrido a dibujar y el punto de la reproducción (null: ninguno). */
  readonly recorrido = output<PuntoRecorrido[]>();
  readonly punto = output<PuntoRecorrido | null>();

  protected readonly iconos = { cerrar: X, completa: Maximize2, play: Play, pausa: Pause };
  protected readonly estados = ESTADO_VIAJE;
  protected readonly duracion = textoDuracion;
  protected readonly horaDe = hora;
  protected readonly etiqueta = 'block text-[11px] font-bold tracking-wide text-texto-suave uppercase';
  protected readonly cifra = 'rounded-lg bg-white/80 px-2.5 py-1.5';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonIconoChico =
    'flex size-8 shrink-0 items-center justify-center rounded-lg border border-acero-oscuro bg-white transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon aria-pressed:border-epico aria-pressed:bg-epico/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected tipo(): string {
    return nombreTipo(this.u().tipo);
  }
  protected readonly situacion = computed(() => situacionGps(this.u()));
  protected situacionTexto(): string {
    return SITUACION_GPS[this.situacion()];
  }
  protected tonoSituacion(): string {
    return { en_movimiento: 'bg-[#E3EFE9] text-[#2E5E4A]', detenida: 'bg-[#E6F0F4] text-[#2B5F75]', sin_senal: 'bg-[#FBF0DD] text-[#7A5410]' }[this.situacion()];
  }
  protected hace(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
    return min < 1 ? 'hace un momento' : min < 60 ? `hace ${min} min` : `hace ${textoDuracion(min)}`;
  }
  protected readonly sensoresAhora = computed(() => textoSensores(this.u().atributos));

  // ---------- Rango ----------
  /** "Viaje actual" solo si va en uno. Al cambiar de unidad se vuelve a las últimas 2 h. */
  protected readonly rangos = computed(() => RANGOS.filter((r) => r.id !== 'viaje' || this.u().viaje));
  protected readonly rango = linkedSignal<string, Rango>({ source: () => this.u().equipoId, computation: () => 'ultimas2h' });
  protected readonly desde = signal(aLocal(new Date(Date.now() - 6 * 3600_000)));
  protected readonly hasta = signal(aLocal(new Date()));
  protected readonly errorRango = signal('');
  /** Lo que se pide al backend: un rango del equipo o un viaje. */
  private readonly consulta = linkedSignal<string, { equipoId: string; desde?: string; hasta?: string; viajeId?: string }>({
    source: () => this.u().equipoId,
    computation: (id) => {
      const [d, h] = ventanaDe('ultimas2h');
      return { equipoId: id, desde: d, hasta: h };
    },
  });
  protected elegirRango(r: Rango): void {
    this.rango.set(r);
    this.errorRango.set('');
    if (r === 'personalizado') return;
    if (r === 'viaje') return this.verViaje(this.u().viaje!.id);
    const [d, h] = ventanaDe(r);
    this.consulta.set({ equipoId: this.u().equipoId, desde: d, hasta: h });
  }
  protected aplicarRango(e: Event): void {
    e.preventDefault();
    const [d, h] = [new Date(this.desde()), new Date(this.hasta())];
    if (!this.desde() || !this.hasta() || isNaN(d.getTime()) || isNaN(h.getTime())) return this.errorRango.set('Elige las dos fechas.');
    if (h <= d) return this.errorRango.set('"Hasta" debe ser después de "desde".');
    if (h.getTime() - d.getTime() > 7 * 86_400_000) return this.errorRango.set('El rango máximo es de 7 días.');
    this.errorRango.set('');
    this.consulta.set({ equipoId: this.u().equipoId, desde: d.toISOString(), hasta: h.toISOString() });
  }
  protected verViaje(viajeId: string): void {
    if (this.rango() !== 'viaje') this.rango.set('viaje');
    this.consulta.set({ equipoId: this.u().equipoId, viajeId });
  }

  protected readonly datos = resource({
    params: () => this.consulta(),
    loader: ({ params }) => (params.viajeId ? this.api.recorridoViaje(params.viajeId) : this.api.recorrido(params.equipoId, params.desde, params.hasta)),
  });
  protected readonly r = computed<Recorrido | null>(() => (this.datos.hasValue() ? this.datos.value() : null));
  private readonly puntos = computed(() => this.r()?.puntos ?? []);

  // ---------- Reproducción ----------
  protected readonly indice = linkedSignal({ source: this.puntos, computation: (p) => Math.max(0, p.length - 1) });
  protected readonly actual = computed(() => this.puntos()[this.indice()] ?? null);
  protected readonly reproduciendo = signal(false);
  private reloj: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => this.recorrido.emit(this.puntos()));
    effect(() => this.punto.emit(this.puntos().length ? this.actual() : null));
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  protected irA(i: number): void {
    this.indice.set(i);
  }
  protected alternarReproduccion(): void {
    if (this.reproduciendo()) return this.detener();
    if (this.indice() >= this.puntos().length - 1) this.indice.set(0);
    this.reproduciendo.set(true);
    // Unos 20 s el recorrido completo, sin bajar de 60 ms por paso
    const paso = Math.max(1, Math.round(this.puntos().length / 300));
    this.reloj = setInterval(() => {
      const sig = this.indice() + paso;
      if (sig >= this.puntos().length - 1) {
        this.indice.set(this.puntos().length - 1);
        this.detener();
      } else this.indice.set(sig);
    }, 60);
  }
  private detener(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
    this.reproduciendo.set(false);
  }

  protected readonly textoPunto = computed(() => {
    const p = this.actual();
    if (!p) return '';
    const datos = [
      hora(p.fecha),
      p.velocidadKmh != null ? `${Math.round(p.velocidadKmh)} km/h` : null,
      p.altitudM != null ? `${Math.round(p.altitudM)} m de altitud` : null,
      ...textoSensores(p.atributos),
    ];
    return datos.filter(Boolean).join(' · ');
  });

  /** Puntos de la gráfica (x de 0 a 300, y de 58 a 2). */
  private serie(valor: (p: PuntoRecorrido) => number | null): string {
    const ps = this.puntos();
    if (ps.length < 2) return '';
    const vals = ps.map((p) => valor(p) ?? 0);
    const [min, max] = [Math.min(...vals), Math.max(...vals)];
    const alto = max - min || 1;
    return vals.map((v, i) => `${((i / (ps.length - 1)) * 300).toFixed(1)},${(58 - ((v - min) / alto) * 56).toFixed(1)}`).join(' ');
  }
  protected readonly lineaVelocidad = computed(() => this.serie((p) => p.velocidadKmh));
  protected readonly lineaAltitud = computed(() => this.serie((p) => p.altitudM));
  protected readonly cursorX = computed(() => (this.puntos().length > 1 ? (this.indice() / (this.puntos().length - 1)) * 300 : 0));
}
