import { DestroyRef, Service, inject, signal } from '@angular/core';
import { AUTH_API_URL, ViajeCamion, plantaPara } from 'ui';
import { ProgramaViaje, simularViaje } from '../../features/pedidos/seguimiento';
import { PedidosService } from './pedidos.service';

// shortcut: viajes simulados del pedido demo PED-26-0140 (Torre Norte, planta Cozumel), relativos a la hora de
// carga. Al conectar el ERP, viajesDe() devuelve los ViajeCamion reales y `ahora` solo sirve para "hace N min".
const PLANTA_CZM = plantaPara({ municipio: 'Cozumel' }).ubicacion!;
const TORRE_NORTE = { lat: 20.5106, lng: -86.9495 }; // obra demo o1

function programasDemo(t0: number): ProgramaViaje[] {
  const min = (n: number) => new Date(t0 + n * 60_000);
  const base = { pedidoId: 'pe-demo-0', volumenM3: 8, origen: PLANTA_CZM, destino: TORRE_NORTE };
  return [
    // Ya descargando, pero perdió la señal hace 3 min (zona sin cobertura): se ve su última posición.
    { ...base, id: 'v-14', unidad: 'ECO-14', operador: 'Raúl Canché', salida: min(-35), llegada: min(-12), gps: true, senalHasta: min(-3) },
    // En camino con GPS en vivo.
    { ...base, id: 'v-21', unidad: 'ECO-21', operador: 'Martín Uc', salida: min(-8), llegada: min(14), gps: true },
    // Unidad sin GPS: solo horarios estimados.
    { ...base, id: 'v-09', unidad: 'ECO-09', operador: 'Pedro Dzib', salida: min(6), llegada: min(30), gps: false },
  ];
}

/**
 * Camiones de cada pedido y su posición. Con backend, los viajes (remisiones) de cada pedido de PedidosService, que se
 * vuelven a pedir cada minuto; sin GPS de flota aún, solo horarios. Sin backend, simulados.
 */
@Service()
export class SeguimientoService {
  private readonly _ahora = signal(new Date());
  /** Reloj compartido: posiciones simuladas y textos "hace N min". */
  readonly ahora = this._ahora.asReadonly();
  private readonly conServidor = !!inject(AUTH_API_URL, { optional: true });
  private readonly pedidos = inject(PedidosService);
  private readonly programas = this.conServidor ? [] : programasDemo(Date.now());

  constructor() {
    const reloj = setInterval(() => this._ahora.set(new Date()), 5000);
    // shortcut: sin tiempo real, los viajes se vuelven a pedir cada minuto (junto con los pedidos).
    const viajes = this.conServidor ? setInterval(() => void this.pedidos.recargar(), 60_000) : undefined;
    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      clearInterval(viajes);
    });
  }

  /** Viajes del pedido, ordenados por salida. Vacío si el pedido no tiene camiones asignados. */
  viajesDe(pedidoId: string): ViajeCamion[] {
    if (this.conServidor) return this.pedidos.viajes().get(pedidoId) ?? [];
    const ahora = this._ahora();
    return this.programas.filter((p) => p.pedidoId === pedidoId).map((p) => simularViaje(p, ahora));
  }
}
