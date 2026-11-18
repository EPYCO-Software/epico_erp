import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { pesos } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { mensajeDe } from '../ventas/datos';
import { FlotaApi, Operador, ResumenRecorridos, TIPO_TRAYECTO, TipoTrayecto, Trayecto, tocaCarga } from './flota-api';

/** "2026-11-18T09:30" (hora del navegador) ↔ ISO UTC. */
const aLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const num = (v: string) => (v.trim() === '' ? null : Number(v));

interface Captura {
  id?: string;
  tipo: TipoTrayecto;
  inicio: string;
  fin: string;
  origen: string;
  destino: string;
  odometroInicio: string;
  odometroFin: string;
  km: string;
  operadorId: string;
  notas: string;
}

/**
 * Recorridos de una unidad: en los últimos 30 días, trayectos, km, litros de diésel, costo, rendimiento y los km desde la
 * última carga (con el aviso de registrar carga y odómetro cada 7 días o 500 km). Con `completo`, además la lista de
 * trayectos — los de entrega los crea el sistema al terminar un viaje (km estimados) y aquí se corrigen con el odómetro
 * real — y el registro de trayectos fuera de órdenes (traslados, fletes, a taller…).
 */
@Component({
  selector: 'app-recorridos-unidad',
  imports: [DecimalPipe, RouterLink],
  host: { class: 'block' },
  template: `
    <section [attr.aria-labelledby]="'recorridos-' + equipoId()">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 [id]="'recorridos-' + equipoId()" [class]="completo() ? 'text-base font-bold' : 'text-sm font-bold'">Recorridos y combustible (30 días)</h3>
        @if (completo() && puede('flota.trayectos.crear') && !editando()) {
          <button type="button" [class]="boton" (click)="nuevo()">Registrar trayecto</button>
        }
      </div>
      @if (r(); as r) {
        @if (toca()) {
          <p class="mt-2 rounded-lg bg-[#FBF0DD] px-3 py-2 text-sm font-semibold text-[#7A5410]">
            Toca registrar carga y odómetro:
            {{ r.ultimaCarga ? 'la última fue hace ' + diasDesde(r.ultimaCarga.fecha) + ' días y lleva ' + (r.kmDesdeUltimaCarga | number: '1.0-0') + ' km' : 'no tiene cargas registradas' }}.
            <a [routerLink]="['/flota/combustible']" [queryParams]="{ unidad: equipoId() }" class="underline underline-offset-4">Registrar carga</a>
          </p>
        }
        <dl class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div [class]="cifra"><dt [class]="etiqueta">Trayectos</dt><dd class="font-bold tabular-nums">{{ r.trayectos }}</dd></div>
          <div [class]="cifra">
            <dt [class]="etiqueta">Km</dt>
            <dd class="font-bold tabular-nums">{{ r.km | number: '1.0-0' }}@if (r.kmEstimados) {<span class="block text-xs font-normal text-texto-suave">{{ r.kmEstimados | number: '1.0-0' }} estimados</span>}</dd>
          </div>
          <div [class]="cifra"><dt [class]="etiqueta">Diésel</dt><dd class="font-bold tabular-nums">{{ r.litros | number: '1.0-0' }} L</dd></div>
          <div [class]="cifra"><dt [class]="etiqueta">Costo</dt><dd class="font-bold tabular-nums">\${{ pesos(r.costoCombustible) }}</dd></div>
          <div [class]="cifra"><dt [class]="etiqueta">Rendimiento</dt><dd class="font-bold tabular-nums">{{ r.rendimientoKmL != null ? (r.rendimientoKmL | number: '1.0-2') + ' km/L' : '—' }}</dd></div>
          <div [class]="cifra"><dt [class]="etiqueta">Desde la última carga</dt><dd class="font-bold tabular-nums">{{ r.kmDesdeUltimaCarga | number: '1.0-0' }} km</dd></div>
        </dl>
      } @else if (resumen.error()) {
        <p class="mt-1 text-sm text-texto-suave">No se pudo leer el resumen de recorridos.</p>
      } @else {
        <p class="mt-1 text-sm text-texto-suave">Cargando recorridos…</p>
      }

      @if (completo()) {
        @if (editando(); as c) {
          <form novalidate class="mt-3 grid gap-3 rounded-xl border border-acero/70 bg-white/70 p-3 sm:grid-cols-2" (submit)="guardar($event)">
            <div>
              <label for="tray-tipo" [class]="etiqueta">Tipo</label>
              <select id="tray-tipo" class="campo mt-1 h-10 px-2" (change)="cambiar({ tipo: $any($event.target).value })">
                @for (t of tipos; track t.id) {
                  <option [value]="t.id" [selected]="t.id === c.tipo">{{ t.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="tray-operador" [class]="etiqueta">Operador</label>
              <select id="tray-operador" class="campo mt-1 h-10 px-2" (change)="cambiar({ operadorId: $any($event.target).value })">
                <option value="" [selected]="!c.operadorId">Sin dato</option>
                @for (o of operadores(); track o.id) {
                  <option [value]="o.id" [selected]="o.id === c.operadorId">{{ o.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="tray-inicio" [class]="etiqueta">Salió</label>
              <input id="tray-inicio" type="datetime-local" class="campo mt-1 h-10 px-3" aria-describedby="tray-inicio-error" [value]="c.inicio" (input)="cambiar({ inicio: $any($event.target).value })" />
              <p id="tray-inicio-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !c.inicio ? 'Indica cuándo salió.' : '' }}</p>
            </div>
            <div>
              <label for="tray-fin" [class]="etiqueta">Regresó</label>
              <input id="tray-fin" type="datetime-local" class="campo mt-1 h-10 px-3" [value]="c.fin" (input)="cambiar({ fin: $any($event.target).value })" />
            </div>
            <div>
              <label for="tray-origen" [class]="etiqueta">Origen</label>
              <input id="tray-origen" class="campo mt-1 h-10 px-3" [value]="c.origen" (input)="cambiar({ origen: $any($event.target).value })" />
            </div>
            <div>
              <label for="tray-destino" [class]="etiqueta">Destino</label>
              <input id="tray-destino" class="campo mt-1 h-10 px-3" [value]="c.destino" (input)="cambiar({ destino: $any($event.target).value })" />
            </div>
            <div>
              <label for="tray-odo-ini" [class]="etiqueta">Odómetro al salir (km)</label>
              <input id="tray-odo-ini" type="number" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="c.odometroInicio" (input)="cambiar({ odometroInicio: $any($event.target).value })" />
            </div>
            <div>
              <label for="tray-odo-fin" [class]="etiqueta">Odómetro al regresar (km)</label>
              <input
                id="tray-odo-fin"
                type="number"
                class="campo mt-1 h-10 px-3 text-right tabular-nums"
                [attr.aria-invalid]="!!errorOdometro()"
                aria-describedby="tray-odo-error"
                [value]="c.odometroFin"
                (input)="cambiar({ odometroFin: $any($event.target).value })"
              />
              <p id="tray-odo-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ errorOdometro() }}</p>
            </div>
            @if (!c.odometroInicio || !c.odometroFin) {
              <div>
                <label for="tray-km" [class]="etiqueta">Km recorridos (sin odómetro)</label>
                <input id="tray-km" type="number" step="0.1" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="c.km" (input)="cambiar({ km: $any($event.target).value })" />
              </div>
            }
            <div [class.sm:col-span-2]="!!c.odometroInicio && !!c.odometroFin">
              <label for="tray-notas" [class]="etiqueta">Notas</label>
              <input id="tray-notas" class="campo mt-1 h-10 px-3" [value]="c.notas" (input)="cambiar({ notas: $any($event.target).value })" />
            </div>
            <div class="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" class="boton-primario h-9 w-auto px-4 text-sm" [disabled]="ocupado()">{{ c.id ? 'Guardar' : 'Registrar' }}</button>
              <button type="button" [class]="boton" (click)="editando.set(null)">Cancelar</button>
            </div>
          </form>
        }
        @if (trayectos().length) {
          <div tabindex="0" role="region" aria-label="Trayectos de la unidad" class="mt-3 overflow-x-auto">
            <table class="w-full min-w-160 text-left text-sm">
              <thead class="text-texto-suave">
                <tr>
                  <th scope="col" class="py-1.5 pr-3 font-semibold">Salió</th>
                  <th scope="col" class="py-1.5 pr-3 font-semibold">Tipo</th>
                  <th scope="col" class="py-1.5 pr-3 font-semibold">Recorrido</th>
                  <th scope="col" class="py-1.5 pr-3 text-right font-semibold">Km</th>
                  <th scope="col" class="py-1.5 font-semibold"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (t of trayectos(); track t.id) {
                  <tr class="border-t border-acero/50">
                    <td class="py-1.5 pr-3 whitespace-nowrap tabular-nums">{{ fecha(t.inicio) }}</td>
                    <td class="py-1.5 pr-3">{{ tiposTexto[t.tipo] }}</td>
                    <td class="py-1.5 pr-3">{{ recorrido(t) }}</td>
                    <td class="py-1.5 pr-3 text-right tabular-nums">
                      {{ t.km != null ? (t.km | number: '1.0-1') : '—' }}@if (t.kmEstimado) {<span class="block text-xs text-texto-suave">estimado</span>}
                    </td>
                    <td class="py-1.5 text-right">
                      @if (puede('flota.trayectos.editar')) {
                        <button type="button" [class]="botonChico" (click)="editar(t)">{{ t.kmEstimado ? 'Poner odómetro' : 'Editar' }}<span class="sr-only"> del trayecto del {{ fecha(t.inicio) }}</span></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (lista.hasValue()) {
          <p class="mt-2 text-sm text-texto-suave">Sin trayectos registrados.</p>
        }
        <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
        <p class="mt-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
      }
    </section>
  `,
})
export class RecorridosUnidad {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  readonly equipoId = input.required<string>();
  /** En la ficha: la lista de trayectos y su registro. En la vista previa, solo el resumen. */
  readonly completo = input(false);
  readonly operadores = input<Operador[]>([]);

  protected readonly pesos = pesos;
  protected readonly tiposTexto = TIPO_TRAYECTO;
  protected readonly tipos = (Object.keys(TIPO_TRAYECTO) as TipoTrayecto[]).map((id) => ({ id, nombre: TIPO_TRAYECTO[id] }));
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly cifra = 'rounded-lg bg-white/80 px-3 py-2';
  protected readonly boton =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly resumen = resource({ params: () => this.equipoId(), loader: ({ params }) => this.api.resumen(params) });
  protected readonly r = computed<ResumenRecorridos | null>(() => (this.resumen.hasValue() ? this.resumen.value() : null));
  protected readonly toca = computed(() => !!this.r() && tocaCarga(this.r()!));
  protected diasDesde(iso: string): number {
    return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  }

  protected readonly lista = resource({
    params: () => (this.completo() ? this.equipoId() : undefined),
    loader: ({ params }) => this.api.lista<Trayecto>('trayectos', { equipoId: params }),
  });
  protected readonly trayectos = computed(() =>
    (this.lista.hasValue() ? this.lista.value() : []).filter((t) => t.equipoId === this.equipoId()).sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio)),
  );
  protected fecha(iso: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }
  protected recorrido(t: Trayecto): string {
    const ruta = [t.origen, t.destino].filter(Boolean).join(' → ');
    const odo = t.odometroInicio != null && t.odometroFin != null ? `${t.odometroInicio.toLocaleString('es-MX')} → ${t.odometroFin.toLocaleString('es-MX')} km` : '';
    return [ruta, odo, t.notas].filter(Boolean).join(' · ') || '—';
  }

  // ---------- Registro ----------
  protected readonly editando = signal<Captura | null>(null);
  protected readonly intento = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal('');
  protected readonly error = signal('');
  private original: Trayecto | null = null;
  protected readonly errorOdometro = computed(() => {
    const c = this.editando();
    const [a, b] = [num(c?.odometroInicio ?? ''), num(c?.odometroFin ?? '')];
    return a != null && b != null && b < a ? 'No puede ser menor al de salida.' : '';
  });

  protected nuevo(): void {
    this.original = null;
    this.abrirCaptura({ tipo: 'traslado', inicio: aLocal(new Date().toISOString()), fin: '', origen: '', destino: '', odometroInicio: '', odometroFin: '', km: '', operadorId: '', notas: '' });
  }
  protected editar(t: Trayecto): void {
    this.original = t;
    this.abrirCaptura({
      id: t.id,
      tipo: t.tipo,
      inicio: aLocal(t.inicio),
      fin: t.fin ? aLocal(t.fin) : '',
      origen: t.origen ?? '',
      destino: t.destino ?? '',
      odometroInicio: t.odometroInicio?.toString() ?? '',
      odometroFin: t.odometroFin?.toString() ?? '',
      km: t.km?.toString() ?? '',
      operadorId: t.operadorId ?? '',
      notas: t.notas ?? '',
    });
  }
  private abrirCaptura(c: Captura): void {
    this.intento.set(false);
    this.aviso.set('');
    this.error.set('');
    this.editando.set(c);
  }
  protected cambiar(c: Partial<Captura>): void {
    this.editando.update((x) => (x ? { ...x, ...c } : x));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    this.intento.set(true);
    const c = this.editando();
    if (!c || !c.inicio || this.errorOdometro()) return;
    const [odoIni, odoFin] = [num(c.odometroInicio), num(c.odometroFin)];
    this.ocupado.set(true);
    this.error.set('');
    try {
      await this.api.guardarRegistro<Trayecto>('trayectos', {
        ...(this.original ?? { sucursalId: null, pedidoId: null, remisionId: null }),
        equipoId: this.equipoId(),
        tipo: c.tipo,
        inicio: new Date(c.inicio).toISOString(),
        fin: c.fin ? new Date(c.fin).toISOString() : null,
        origen: c.origen.trim() || null,
        destino: c.destino.trim() || null,
        odometroInicio: odoIni,
        odometroFin: odoFin,
        // Con los dos odómetros el backend calcula los km; sin ellos, los escritos
        km: odoIni != null && odoFin != null ? odoFin - odoIni : num(c.km),
        kmEstimado: false,
        operadorId: c.operadorId || null,
        notas: c.notas.trim() || null,
      });
      this.editando.set(null);
      this.aviso.set(c.id ? 'Trayecto actualizado.' : 'Trayecto registrado.');
      this.lista.reload();
      this.resumen.reload();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.ocupado.set(false);
    }
  }
}
