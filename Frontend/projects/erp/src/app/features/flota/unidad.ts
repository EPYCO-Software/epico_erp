import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, FechaZonaPipe, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { Historial } from '../../layout/historial';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe, registro } from '../ventas/datos';
import {
  CATEGORIAS_UNIDAD,
  CargaCombustible,
  ESTADO_MANTENIMIENTO,
  ESTADO_VIAJE,
  FlotaApi,
  Mantenimiento,
  Operador,
  TONO_MANTENIMIENTO,
  Unidad,
  categoriaDe,
  estadoFila,
  fechaCorta,
  nombreTipo,
  rendimientos,
  textoCapacidad,
} from './flota-api';
import { DocumentosUnidad } from './documentos-unidad';
import { FormUnidad } from './form-unidad';
import { RecorridosUnidad } from './recorridos-unidad';

/**
 * Vista completa de una unidad (/flota/unidades/:id), como las de Ventas: su estado y viaje actual, cifras (viajes, m³,
 * rendimiento de diésel, próximo servicio), sus datos (editables), documentos con vencimiento, viajes recientes, cargas
 * de combustible y mantenimientos; a la derecha, su historial de cambios.
 */
@Component({
  selector: 'app-unidad',
  imports: [DecimalPipe, RouterLink, FechaZonaPipe, EnEncabezado, Historial, RutaNavegacion, FormUnidad, DocumentosUnidad, RecorridosUnidad],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion lista="Unidades" ruta="/flota" [actual]="u()?.numeroEconomico ?? '…'" />
      </div>
    </ng-template>

    @if (unidad.error()) {
      <section class="glass mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
        <h1 class="text-2xl font-bold">No encontramos esa unidad</h1>
        <p class="mt-1 text-texto-suave">{{ mensaje(unidad.error()) }}</p>
        <a routerLink="/flota" class="mt-6 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-epico-oscuro hover:bg-epico/5">Volver a unidades</a>
      </section>
    } @else if (u(); as u) {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-texto-suave">{{ tipo(u) }} · {{ categoria(u) }}</p>
                <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ u.numeroEconomico }}</h1>
                <p class="text-sm text-texto-suave">{{ subtitulo(u) }}</p>
                <p class="text-sm text-texto-suave">Opera en: {{ (fila()?.plantaNombres?.length ? fila()!.plantaNombres! : [fila()?.plantaNombre ?? '—']).join(', ') }}</p>
              </div>
              <span [class]="'rounded-md px-2.5 py-1 text-sm font-bold ' + estado().tono">{{ estado().texto }}</span>
            </div>

            <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl bg-white/80 px-4 py-3">
                <dt class="text-xs font-bold tracking-wide text-texto-suave uppercase">Viajes</dt>
                <dd class="text-xl font-bold tabular-nums">{{ resumen()?.viajes ?? '—' }}</dd>
              </div>
              <div class="rounded-xl bg-white/80 px-4 py-3">
                <dt class="text-xs font-bold tracking-wide text-texto-suave uppercase">m³ entregados</dt>
                <dd class="text-xl font-bold tabular-nums">{{ resumen()?.m3 != null ? (resumen()!.m3! | number: '1.0-1') : '—' }}</dd>
              </div>
              <div class="rounded-xl bg-white/80 px-4 py-3">
                <dt class="text-xs font-bold tracking-wide text-texto-suave uppercase">Rendimiento</dt>
                <dd class="text-xl font-bold tabular-nums">{{ rendimiento() }}</dd>
              </div>
              <div class="rounded-xl bg-white/80 px-4 py-3">
                <dt class="text-xs font-bold tracking-wide text-texto-suave uppercase">Próximo servicio</dt>
                <dd class="text-xl font-bold">{{ proximoServicio() }}</dd>
              </div>
            </dl>
            @if (fila()?.viaje; as v) {
              <p class="mt-3 text-sm">
                Va en <a [routerLink]="['/ventas/ordenes', v.pedidoFolio]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ v.pedidoFolio }}</a>
                · {{ estadosViaje[v.estado] }}
                @if (fila()?.posicion; as pos) {
                  · GPS {{ pos.lat.toFixed(5) }}, {{ pos.lng.toFixed(5) }}
                }
              </p>
            }

            <section class="mt-6 border-t border-acero/60 pt-5" aria-labelledby="datos-titulo">
              <h2 id="datos-titulo" class="mb-3 text-base font-bold">Datos de la unidad</h2>
              <p class="mb-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
              <p class="mb-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
              @for (x of [u]; track x.id + version()) {
                <app-form-unidad
                  [unidad]="x"
                  [plantas]="plantas()"
                  [soloLectura]="!puede('flota.equipos.editar')"
                  [guardando]="guardando()"
                  [ocupados]="ocupados()"
                  [operadores]="operadores()"
                  (listo)="guardar($event)"
                  (descartar)="version.set(version() + 1)"
                />
              }
            </section>

            <app-documentos-unidad class="mt-6 border-t border-acero/60 pt-5" [equipoId]="u.id" />

            <app-recorridos-unidad class="mt-6 border-t border-acero/60 pt-5" [equipoId]="u.id" [completo]="true" [operadores]="operadores()" />

            <section class="mt-6 border-t border-acero/60 pt-5" aria-labelledby="viajes-titulo">
              <h2 id="viajes-titulo" class="text-base font-bold">Viajes recientes</h2>
              @if (viajes().length) {
                <div tabindex="0" role="region" aria-label="Viajes recientes de la unidad" class="mt-2 overflow-x-auto">
                  <table class="w-full min-w-160 text-left text-sm">
                    <thead class="text-texto-suave">
                      <tr>
                        <th scope="col" class="py-1.5 pr-3 font-semibold">Entrega</th>
                        <th scope="col" class="py-1.5 pr-3 font-semibold">Orden</th>
                        <th scope="col" class="py-1.5 pr-3 font-semibold">Cliente · obra</th>
                        <th scope="col" class="py-1.5 pr-3 text-right font-semibold">m³</th>
                        <th scope="col" class="py-1.5 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (v of viajes(); track v.id) {
                        <tr class="border-t border-acero/50">
                          <td class="py-1.5 pr-3 whitespace-nowrap tabular-nums">{{ v.fechaHoraEntrega | fechaZona: zona() }}</td>
                          <td class="py-1.5 pr-3">
                            <a [routerLink]="['/ventas/ordenes', v.pedidoFolio]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ v.pedidoFolio }}</a>
                          </td>
                          <td class="py-1.5 pr-3">{{ v.clienteNombre }} · {{ v.obraNombre }}</td>
                          <td class="py-1.5 pr-3 text-right tabular-nums">{{ v.volumenM3 | number: '1.0-1' }}</td>
                          <td class="py-1.5">{{ estadosViaje[v.estado] }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="mt-1 text-sm text-texto-suave">{{ viajesRes.isLoading() ? 'Cargando…' : 'Aún no tiene viajes.' }}</p>
              }
            </section>

            <section class="mt-6 border-t border-acero/60 pt-5" aria-labelledby="combustible-titulo">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 id="combustible-titulo" class="text-base font-bold">Combustible</h2>
                <a [routerLink]="['/flota/combustible']" [queryParams]="{ unidad: u.id }" class="text-sm font-semibold underline-offset-4 hover:text-epico hover:underline">Ver todas las cargas</a>
              </div>
              @if (cargas().length) {
                <ul class="mt-2 grid gap-1.5 text-sm">
                  @for (c of cargas().slice(0, 5); track c.id) {
                    <li class="flex flex-wrap justify-between gap-2 rounded-lg bg-white/85 px-3 py-2">
                      <span>{{ c.fecha | fechaZona: zona() : 'dd/MM/yyyy' }} · {{ c.litros | number: '1.0-1' }} L · \${{ pesos(c.costoTotal) }}</span>
                      <span class="text-texto-suave tabular-nums">
                        {{ c.odometroKm != null ? (c.odometroKm | number) + ' km' : c.horometro != null ? c.horometro + ' h' : '' }}
                        {{ textoRendimiento(c) }}
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="mt-1 text-sm text-texto-suave">Sin cargas registradas.</p>
              }
            </section>

            <section class="mt-6 border-t border-acero/60 pt-5" aria-labelledby="mantto-titulo">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 id="mantto-titulo" class="text-base font-bold">Mantenimiento</h2>
                <a [routerLink]="['/flota/mantenimiento']" [queryParams]="{ unidad: u.id }" class="text-sm font-semibold underline-offset-4 hover:text-epico hover:underline">Ver y programar</a>
              </div>
              @if (mantenimientos().length) {
                <ul class="mt-2 grid gap-1.5 text-sm">
                  @for (m of mantenimientos().slice(0, 5); track m.id) {
                    <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 px-3 py-2">
                      <span>
                        <span class="font-semibold">{{ m.descripcion }}</span>
                        <span class="text-texto-suave"> · {{ m.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo' }}{{ m.programadoPara ? ' · ' + corta(m.programadoPara) : '' }}</span>
                      </span>
                      <span [class]="'rounded-md px-2 py-0.5 text-xs font-bold ' + tonoMantto[m.estado]">{{ estadosMantto[m.estado] }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="mt-1 text-sm text-texto-suave">Sin servicios registrados.</p>
              }
            </section>
          </article>
        </div>
        <aside appHistorial [registro]="registroUnidad()"></aside>
      </div>
    } @else {
      <p class="glass mx-auto max-w-xl px-6 py-10 text-center text-texto-suave">Cargando la unidad…</p>
    }
  `,
})
export default class UnidadFicha {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly auth = inject(AuthService);
  /** De la ruta /flota/unidades/:id */
  readonly id = input.required<string>();

  protected readonly cajas = CAJAS_VISTA;
  protected readonly estadosViaje = ESTADO_VIAJE;
  protected readonly estadosMantto = ESTADO_MANTENIMIENTO;
  protected readonly tonoMantto = TONO_MANTENIMIENTO;
  protected readonly pesos = pesos;
  protected readonly corta = fechaCorta;
  protected readonly mensaje = mensajeDe;
  protected readonly registroUnidad = computed(() => registro.equipo(this.id()));

  protected readonly unidad = resource({ params: () => this.id(), loader: ({ params }) => this.api.unidad(params) });
  protected readonly u = computed(() => (this.unidad.hasValue() ? this.unidad.value() : undefined));
  private readonly tablero = resource({ loader: () => this.api.tablero() });
  protected readonly fila = computed(() => (this.tablero.hasValue() ? this.tablero.value().equipos.find((f) => f.equipo.id === this.id()) : undefined));
  protected readonly estado = computed(() => estadoFila({ equipo: this.u()!, viaje: this.fila()?.viaje ?? null }));
  protected readonly ocupados = computed(() =>
    this.tablero.hasValue() ? this.tablero.value().equipos.filter((f) => f.equipo.id !== this.id()).map((f) => f.equipo.numeroEconomico) : [],
  );
  protected readonly plantas = computed(() => (this.auth.sesion()?.empresas ?? []).flatMap((e) => e.plantas).map((p) => ({ id: p.id, nombre: p.nombre })));
  /** La zona de su planta para las horas (o la de la sesión). */
  protected readonly zona = computed(
    () => (this.auth.sesion()?.empresas ?? []).flatMap((e) => e.plantas).find((p) => p.id === this.u()?.sucursalId)?.zonaHoraria ?? 'America/Mexico_City',
  );

  protected readonly viajesRes = resource({ params: () => this.id(), loader: ({ params }) => this.api.viajesDeUnidad(params) });
  protected readonly viajes = computed(() => (this.viajesRes.hasValue() ? this.viajesRes.value().items : []));
  protected readonly resumen = computed(() => (this.viajesRes.hasValue() ? this.viajesRes.value().resumen : null));

  private readonly cargasRes = resource({
    params: () => this.id(),
    loader: ({ params }) => this.api.lista<CargaCombustible>('cargas-combustible', { equipoId: params }).catch(() => [] as CargaCombustible[]),
  });
  protected readonly cargas = computed(() =>
    (this.cargasRes.hasValue() ? this.cargasRes.value() : []).filter((c) => c.equipoId === this.id()).sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)),
  );
  private readonly rend = computed(() => rendimientos(this.cargas()));
  protected textoRendimiento(c: CargaCombustible): string {
    const r = this.rend().get(c.id ?? '');
    return r?.kmL != null ? `· ${r.kmL} km/L` : r?.lh != null ? `· ${r.lh} L/h` : '';
  }
  /** Promedio de las cargas con dato: km/L o L/h. */
  protected readonly rendimiento = computed(() => {
    const vals = [...this.rend().values()];
    const km = vals.map((v) => v.kmL).filter((v): v is number => v != null);
    const lh = vals.map((v) => v.lh).filter((v): v is number => v != null);
    if (km.length) return `${(km.reduce((a, b) => a + b, 0) / km.length).toFixed(2)} km/L`;
    if (lh.length) return `${(lh.reduce((a, b) => a + b, 0) / lh.length).toFixed(2)} L/h`;
    return '—';
  });

  private readonly operadoresRes = resource({ loader: () => this.api.lista<Operador>('operadores').catch(() => [] as Operador[]) });
  protected readonly operadores = computed(() => (this.operadoresRes.hasValue() ? this.operadoresRes.value() : []));

  private readonly manttoRes = resource({
    params: () => this.id(),
    loader: ({ params }) => this.api.lista<Mantenimiento>('mantenimientos', { equipoId: params }).catch(() => [] as Mantenimiento[]),
  });
  protected readonly mantenimientos = computed(() =>
    (this.manttoRes.hasValue() ? this.manttoRes.value() : [])
      .filter((m) => m.equipoId === this.id())
      .sort((a, b) => (b.programadoPara ?? b.inicioEn ?? '').localeCompare(a.programadoPara ?? a.inicioEn ?? '')),
  );
  protected readonly proximoServicio = computed(() => {
    const p = this.mantenimientos()
      .filter((m) => m.estado === 'programado' && m.programadoPara)
      .sort((a, b) => a.programadoPara!.localeCompare(b.programadoPara!))[0];
    if (this.mantenimientos().some((m) => m.estado === 'en_proceso')) return 'En taller';
    return p ? fechaCorta(p.programadoPara!) : '—';
  });

  protected tipo(u: Unidad): string {
    return nombreTipo(u.tipo);
  }
  protected categoria(u: Unidad): string {
    return CATEGORIAS_UNIDAD[categoriaDe(u.tipo)];
  }
  protected subtitulo(u: Unidad): string {
    return [u.marca, u.modelo, u.anio, u.placas, textoCapacidad(u) !== '—' ? textoCapacidad(u) : null].filter(Boolean).join(' · ');
  }

  constructor() {
    // El historial remoto (chatter) lo conecta VentasService al crearse
    inject(VentasService);
  }

  protected readonly version = signal(0);
  protected readonly guardando = signal(false);
  protected readonly aviso = signal('');
  protected readonly error = signal('');
  protected async guardar(cambios: Omit<Unidad, 'id'> & { id?: string }): Promise<void> {
    this.guardando.set(true);
    this.aviso.set('');
    this.error.set('');
    try {
      // PUT manda el registro completo: lo que trae la API más lo editado
      await this.api.guardar({ ...this.u()!, ...cambios, id: this.id() });
      this.unidad.reload();
      this.tablero.reload();
      this.aviso.set('Cambios guardados.');
    } catch (e) {
      this.error.set(mensajeDe(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
