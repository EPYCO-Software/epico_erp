import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService, CotizacionGuardada, Pedido, PedidoVista, ViajeCamion, aIsoConOffset, esLugar, mensajeError, pedidoDePartida, plantaPara } from 'ui';
import { ObrasService } from './obras.service';
import { ApiPedidoPortal, aPedidoPortal, aViaje } from './pedidos-api';

// Sin backend (pruebas, demo): pedidos de ejemplo en memoria. Con él, los crea el backend al aceptar la cotización y
// el portal solo los consulta (con su cobranza y sus viajes).
const PEDIDOS_DEMO: Pedido[] = [
  // Se entrega hoy (la fecha se calcula al cargar) con 3 camiones: ver SeguimientoService.
  {
    id: 'pe-demo-0', folio: 'PED-26-0140', clienteId: 'c1', plantaId: 'CZM', obraId: 'o1',
    producto: 'Losa y estructura · f´c 250 kg/cm²', volumenM3: 24, fechaHoraEntrega: aIsoConOffset(new Date()), estado: 'en_ruta',
    importe: 109968, cobro: 'pagado', facturaFolio: 'FAC-26-0931',
  },
  {
    id: 'pe-demo-1', folio: 'PED-26-0141', clienteId: 'c1', plantaId: 'CZM', obraId: 'o1', cotizacionId: 'c-demo-2',
    producto: 'Pavimento · MR 45 kg/cm²', volumenM3: 35, fechaHoraEntrega: '2026-11-06T07:30:00-05:00', estado: 'programado',
    importe: 217210, cobro: 'por_facturar',
  },
  {
    id: 'pe-demo-2', folio: 'PED-26-0137', clienteId: 'c1', plantaId: 'ESC', obraId: 'o2',
    producto: 'Cimentación · f´c 200 kg/cm² con bombeo', volumenM3: 22, fechaHoraEntrega: '2026-10-29T08:00:00-06:00', estado: 'entregado',
    importe: 107184, cobro: 'por_facturar',
  },
  {
    id: 'pe-demo-3', folio: 'PED-26-0133', clienteId: 'c1', plantaId: 'CZM', obraId: 'o1',
    producto: 'Firmes y banquetas · f´c 150 kg/cm²', volumenM3: 8, fechaHoraEntrega: '2026-10-22T09:00:00-05:00', estado: 'entregado',
    importe: 31088, cobro: 'facturado', facturaFolio: 'FAC-26-0912',
  },
  {
    id: 'pe-demo-4', folio: 'PED-26-0128', clienteId: 'c1', plantaId: 'ESC', obraId: 'o2',
    producto: 'Losa y estructura · f´c 250 kg/cm²', volumenM3: 15, fechaHoraEntrega: '2026-10-12T07:30:00-06:00', estado: 'entregado',
    importe: 68730, cobro: 'pagado', facturaFolio: 'FAC-26-0870',
  },
];

/** Un pedido "en curso" aún no termina su entrega: mientras exista, su obra no se puede editar. */
export const enCurso = (p: Pick<Pedido, 'estado'>) => p.estado !== 'entregado' && p.estado !== 'cancelado';

let siguiente = 1;

/**
 * Pedidos del cliente: entrega, cobranza y relación con la cotización que los originó. Con backend se leen de
 * /portal/pedidos al entrar (y al aceptar una cotización), con su planta y sus viajes (SeguimientoService).
 * shortcut: la lista no trae las líneas: se pide el detalle de cada pedido (con muchos pedidos, que la lista las traiga).
 */
@Service()
export class PedidosService {
  private readonly obras = inject(ObrasService);
  private readonly base = inject(AUTH_API_URL, { optional: true });
  private readonly http = this.base ? inject(HttpClient) : null;
  private readonly auth = this.base ? inject(AuthService) : null;
  private readonly _pedidos = signal<Pedido[]>(this.base ? [] : PEDIDOS_DEMO);
  /** Con backend: planta (nombre y zona) y viajes de cada pedido. */
  private readonly plantas = signal(new Map<string, { nombre: string; zonaHoraria: string }>());
  readonly viajes = signal(new Map<string, ViajeCamion[]>());
  readonly cargando = signal(false);
  readonly errorCarga = signal('');
  private consecutivo = 141;

  constructor() {
    if (!this.base) return;
    const cliente = computed(() => this.auth!.sesion()?.cliente?.id ?? '');
    effect(() => {
      if (cliente()) untracked(() => void this.recargar());
    });
  }

  async recargar(): Promise<void> {
    const clienteId = this.auth!.sesion()?.cliente?.id ?? '';
    this.cargando.set(true);
    try {
      const lista = await firstValueFrom(this.http!.get<{ items: ApiPedidoPortal[] }>(`${this.base}/portal/pedidos?pagina=1&tamano=500`));
      const completos = await Promise.all(lista.items.map((p) => firstValueFrom(this.http!.get<ApiPedidoPortal>(`${this.base}/portal/pedidos/${p.id}`))));
      this.plantas.set(new Map(completos.map((p) => [p.id, { nombre: p.planta.nombre, zonaHoraria: p.planta.zonaHoraria }])));
      this.viajes.set(new Map(completos.map((p) => [p.id, p.remisiones.map((v) => aViaje(v, p.planta.zonaHoraria))])));
      this._pedidos.set(completos.map((p) => aPedidoPortal(p, clienteId)));
      this.errorCarga.set('');
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Con nombres y zona horaria ya resueltos; el de entrega más reciente primero. */
  readonly pedidos = computed<PedidoVista[]>(() =>
    this._pedidos()
      .map((p) => {
        const obra = this.obras.buscar(p.obraId);
        const planta = this.plantas().get(p.id) ?? plantaPara(obra);
        const obraNombre = obra?.nombre ?? (esLugar(p.obraId) ? 'Lugar de entrega' : 'Obra');
        return { ...p, clienteNombre: '', obraNombre, plantaNombre: planta.nombre, zonaHoraria: planta.zonaHoraria };
      })
      .sort((a, b) => b.fechaHoraEntrega.localeCompare(a.fechaHoraEntrega)),
  );

  /** Importe total, pagado y pendiente de pago (MXN, con IVA), sin cancelados. */
  readonly resumen = computed(() => {
    const vigentes = this._pedidos().filter((p) => p.estado !== 'cancelado');
    const suma = (l: Pedido[]) => l.reduce((t, p) => t + p.importe, 0);
    // "finalizado" (ERP) también ya se pagó
    const pagado = suma(vigentes.filter((p) => p.cobro === 'pagado' || p.cobro === 'finalizado'));
    return { total: suma(vigentes), pagado, pendiente: suma(vigentes) - pagado };
  });

  buscar(folio: string): PedidoVista | null {
    return this.pedidos().find((p) => p.folio === folio) ?? null;
  }

  deCotizacion(cotizacionId: string): PedidoVista[] {
    return this.pedidos().filter((p) => p.cotizacionId === cotizacionId);
  }

  deObra(obraId: string): PedidoVista[] {
    return this.pedidos().filter((p) => p.obraId === obraId);
  }

  /** La obra tiene al menos un pedido que no se ha entregado (ni cancelado). */
  obraConPedidoEnCurso(obraId: string): boolean {
    return this._pedidos().some((p) => p.obraId === obraId && enCurso(p));
  }

  /** Sin backend: aceptar una cotización genera un pedido por partida, ligado a ella. Devuelve los pedidos creados. */
  generarDesdeCotizacion(c: CotizacionGuardada): Pedido[] {
    const nuevos = c.partidas.map<Pedido>((p) => ({
      id: `pe-${Date.now().toString(36)}-${siguiente++}`,
      folio: `PED-${c.fecha.slice(2, 4)}-${String(++this.consecutivo).padStart(4, '0')}`,
      clienteId: 'c1',
      plantaId: plantaPara(this.obras.buscar(p.obraId)).clave,
      cotizacionId: c.id,
      ...pedidoDePartida(p, c.descuento),
      estado: 'programado',
      cobro: 'por_cobrar',
    }));
    this._pedidos.update((p) => [...p, ...nuevos]);
    return nuevos;
  }
}
