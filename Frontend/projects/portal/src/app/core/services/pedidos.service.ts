import { Service, computed, inject, signal } from '@angular/core';
import { CotizacionGuardada, Pedido, PedidoVista, aIsoConOffset, pedidoDePartida, plantaPara } from 'ui';
import { ObrasService } from './obras.service';

// shortcut: pedidos en memoria. Al conectar el backend, los crea el ERP al aceptar la cotización y el portal solo
// los consulta (con su facturación y cobranza); esta API no cambia.
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

/** Pedidos del cliente: entrega, cobranza y relación con la cotización que los originó. */
@Service()
export class PedidosService {
  private readonly obras = inject(ObrasService);
  private readonly _pedidos = signal<Pedido[]>(PEDIDOS_DEMO);
  private consecutivo = 141;

  /** Con nombres y zona horaria ya resueltos; el de entrega más reciente primero. */
  readonly pedidos = computed<PedidoVista[]>(() =>
    this._pedidos()
      .map((p) => {
        const obra = this.obras.buscar(p.obraId);
        const planta = plantaPara(obra);
        return { ...p, clienteNombre: '', obraNombre: obra?.nombre ?? 'Obra', plantaNombre: planta.nombre, zonaHoraria: planta.zonaHoraria };
      })
      .sort((a, b) => b.fechaHoraEntrega.localeCompare(a.fechaHoraEntrega)),
  );

  /** Importe total, pagado y pendiente de pago (MXN, con IVA), sin cancelados. */
  readonly resumen = computed(() => {
    const vigentes = this._pedidos().filter((p) => p.estado !== 'cancelado');
    const suma = (l: Pedido[]) => l.reduce((t, p) => t + p.importe, 0);
    const pagado = suma(vigentes.filter((p) => p.cobro === 'pagado'));
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

  /** Aceptar una cotización genera un pedido por partida, ligado a ella. Devuelve los pedidos creados. */
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
