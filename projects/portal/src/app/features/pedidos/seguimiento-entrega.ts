import { Component, computed, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CircleCheck, Clock, Factory, MapPin, Radio, Truck, WifiOff } from 'lucide';
import { FechaZonaPipe, Icon, MapaSeguimiento, PedidoVista, PuntoMapa, ViajeCamion } from 'ui';
import { ObrasService } from '../../core/services/obras.service';
import { SeguimientoService } from '../../core/services/seguimiento.service';
import { plantaPara } from '../catalogo/presupuesto';
import { ESTADO_VIAJE, MINUTOS_SENAL, Senal, minutosDesde, minutosParaLlegar, senal } from './seguimiento';

/** Pedidos cuya entrega está en marcha: se ofrece el seguimiento de camiones. */
export const porEntregarse = (p: Pick<PedidoVista, 'estado'> | null) => !!p && ['en_planta', 'en_ruta', 'en_obra'].includes(p.estado);

const ICONO_ESTADO = { cargando: Factory, en_ruta: Truck, en_obra: MapPin, regresando: CircleCheck };

/**
 * Dónde van los camiones de un pedido: mapa con planta, obra y camiones, y lista en texto con estado, señal y
 * horarios. Funciona con uno o varios camiones y con unidades sin seguimiento en tiempo real.
 */
@Component({
  selector: 'app-seguimiento-entrega',
  imports: [DecimalPipe, FechaZonaPipe, Icon, MapaSeguimiento],
  template: `
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="seguimiento-titulo" class="text-lg font-bold">Seguimiento de la entrega</h2>
      <p class="text-sm text-texto-suave">{{ resumen() }}</p>
    </div>

    @if (viajes().length) {
      <div class="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        @if (puntos().length) {
          <ui-mapa-seguimiento class="h-80 xl:h-full xl:min-h-96" [puntos]="puntos()" [titulo]="'Mapa de los camiones del pedido ' + p().folio" />
        }
        <ul class="space-y-2" aria-label="Camiones del pedido">
          @for (v of viajes(); track v.id) {
            <li class="rounded-xl bg-white/80 p-3 text-sm shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="flex items-center gap-2 font-bold">
                  <ui-icon [icono]="iconoEstado[v.estado]" [tamano]="18" class="text-epico" />{{ v.unidad }}
                  <span class="font-normal text-texto-suave">· {{ v.volumenM3 | number: '1.0-1' }} m³</span>
                </p>
                @switch (senalDe(v)) {
                  @case ('en_vivo') {
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-[#E5F0EA] px-2 py-0.5 text-xs font-semibold text-[#2E5E4A]">
                      <ui-icon [icono]="iconos.vivo" [tamano]="13" />En vivo
                    </span>
                  }
                  @case ('perdida') {
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-[#FBF0DD] px-2 py-0.5 text-xs font-semibold text-[#7A5410]">
                      <ui-icon [icono]="iconos.sinSenal" [tamano]="13" />Señal perdida
                    </span>
                  }
                  @default {
                    <span class="inline-flex items-center gap-1.5 rounded-md bg-carbon/6 px-2 py-0.5 text-xs font-semibold text-texto-suave">
                      <ui-icon [icono]="iconos.reloj" [tamano]="13" />Sin seguimiento en tiempo real
                    </span>
                  }
                }
              </div>
              <p class="mt-1 font-medium">{{ estadoViaje[v.estado] }}</p>
              <p class="text-texto-suave">
                @switch (v.estado) {
                  @case ('cargando') {
                    Sale de planta ~{{ v.salida | fechaZona: zona() : 'HH:mm' }} · llegada estimada {{ v.llegadaEstimada | fechaZona: zona() : 'HH:mm' }}
                  }
                  @case ('en_ruta') {
                    Llega en ~{{ minutos(v) }} min ({{ v.llegadaEstimada | fechaZona: zona() : 'HH:mm' }})
                    @if (senalDe(v) === 'sin_gps') {
                      · estimado por horario
                    }
                  }
                  @case ('en_obra') {
                    En obra desde {{ v.llegadaEstimada | fechaZona: zona() : 'HH:mm' }}
                  }
                  @default {
                    Concreto entregado
                  }
                }
              </p>
              @if (senalDe(v) === 'perdida') {
                <p class="mt-1 text-xs text-[#7A5410]">Última ubicación hace {{ hace(v) }} min. Puede estar en una zona sin cobertura.</p>
              }
              <p class="mt-1 text-xs text-texto-suave">Operador: {{ v.operador }}</p>
            </li>
          }
        </ul>
      </div>
      @if (!puntos().length) {
        <p class="mt-3 rounded-xl bg-carbon/5 px-4 py-3 text-sm text-texto-suave">
          Los camiones de este pedido no tienen seguimiento en tiempo real; te mostramos los horarios estimados.
        </p>
      }
      <p class="mt-3 text-xs text-texto-suave">
        Las posiciones se actualizan solas. "En vivo" = reporte de hace menos de {{ minutosSenal }} min. Horas de la planta que surte el pedido.
      </p>
    } @else {
      <p class="mt-2 text-sm text-texto-suave">Cuando los camiones salgan de planta podrás ver aquí dónde van.</p>
    }
  `,
})
export class SeguimientoEntrega {
  readonly p = input.required<PedidoVista>();

  private readonly seguimiento = inject(SeguimientoService);
  private readonly obras = inject(ObrasService);
  protected readonly iconos = { vivo: Radio, sinSenal: WifiOff, reloj: Clock };
  protected readonly iconoEstado = ICONO_ESTADO;
  protected readonly estadoViaje = ESTADO_VIAJE;
  protected readonly minutosSenal = MINUTOS_SENAL;

  protected readonly viajes = computed(() => this.seguimiento.viajesDe(this.p().id));
  protected readonly zona = computed(() => this.p().zonaHoraria);

  protected readonly puntos = computed<PuntoMapa[]>(() => {
    const ahora = this.seguimiento.ahora();
    const camiones = this.viajes()
      .filter((v) => v.posicion && v.estado !== 'regresando')
      .map((v) => ({
        id: v.id,
        tipo: 'camion' as const,
        lat: v.posicion!.lat,
        lng: v.posicion!.lng,
        etiqueta: senal(v, ahora) === 'perdida' ? `${v.unidad} (sin señal)` : v.unidad,
        atenuado: senal(v, ahora) === 'perdida',
      }));
    if (!camiones.length) return [];
    const obra = this.obras.buscar(this.p().obraId);
    const planta = plantaPara(obra);
    return [
      ...(planta.ubicacion ? [{ id: 'planta', tipo: 'planta' as const, ...planta.ubicacion, etiqueta: 'Planta' }] : []),
      ...(obra?.ubicacion ? [{ id: 'obra', tipo: 'obra' as const, ...obra.ubicacion, etiqueta: obra.nombre }] : []),
      ...camiones,
    ];
  });

  protected readonly resumen = computed(() => {
    const v = this.viajes();
    if (!v.length) return '';
    const ahora = this.seguimiento.ahora();
    const vivos = v.filter((x) => senal(x, ahora) === 'en_vivo').length;
    const entregados = v.filter((x) => x.estado === 'regresando').length;
    return `${v.length} ${v.length === 1 ? 'camión' : 'camiones'} · ${vivos} en vivo · ${entregados} entregado${entregados === 1 ? '' : 's'}`;
  });

  protected senalDe(v: ViajeCamion): Senal {
    return senal(v, this.seguimiento.ahora());
  }

  protected minutos(v: ViajeCamion): number | null {
    return minutosParaLlegar(v, this.seguimiento.ahora());
  }

  protected hace(v: ViajeCamion): number {
    return minutosDesde(v.posicion!.fecha, this.seguimiento.ahora());
  }
}
