import { ApiObra, EstadoCobro, EstadoPedido, EstadoViaje, EstatusPlanta, Pedido, PlantaServidor, ViajeCamion, idLugar, isoEnZona } from 'ui';

/** Un viaje (remisión) como lo da GET /portal/remisiones y PedidoPortal.remisiones. */
export interface ApiViaje {
  id: string;
  folio: string;
  pedidoId: string;
  pedidoFolio: string;
  estado: 'programado' | 'cargando' | 'en_ruta' | 'en_obra' | 'regresando' | 'terminado';
  volumenM3: number;
  camion: string | null;
  operador: string | null;
  salidaEn: string | null;
  llegadaEstimada: string | null;
  llegadaEn: string | null;
  terminadaEn: string | null;
  lat: number | null;
  lng: number | null;
}

/** GET /portal/pedidos[/{id}]: el pedido con su obra, su planta, su cobro y sus viajes. */
export interface ApiPedidoPortal {
  id: string;
  folio: string;
  cotizacionId: string | null;
  estado: EstadoPedido;
  estatusPlanta: EstatusPlanta;
  fechaHoraEntrega: string | null;
  /** null si va a un lugar de entrega sin obra (capturado en el ERP). */
  obra: ApiObra | null;
  /** Con lugar de entrega (sin obra). */
  lugar?: { direccion: string; municipio: string | null; referencias: string | null; lat: number | null; lng: number | null } | null;
  planta: PlantaServidor;
  cobro: { estado: EstadoCobro; subtotal: number; descuento: number; iva: number; total: number; pagado: number; pendiente: number };
  lineas: { descripcion: string; cantidad: number }[] | null;
  remisiones: ApiViaje[];
}

/** Pedido del portal → el del front: producto y m³ de su primera línea (el concreto), fechas en la zona de la planta. */
export function aPedidoPortal(p: ApiPedidoPortal, clienteId: string): Pedido {
  const concreto = p.lineas?.[0];
  return {
    id: p.id,
    folio: p.folio,
    clienteId,
    plantaId: p.planta.codigo,
    obraId: p.obra?.id ?? idLugar(p.id),
    ...(p.lugar
      ? {
          lugar: {
            direccion: p.lugar.direccion,
            municipio: p.lugar.municipio ?? '',
            ...(p.lugar.referencias ? { referencias: p.lugar.referencias } : {}),
            ...(p.lugar.lat != null && p.lugar.lng != null ? { ubicacion: { lat: p.lugar.lat, lng: p.lugar.lng } } : {}),
            contacto: '',
            telefono: '',
          },
        }
      : {}),
    producto: concreto?.descripcion ?? '',
    volumenM3: concreto?.cantidad ?? 0,
    fechaHoraEntrega: p.fechaHoraEntrega ? isoEnZona(p.planta.zonaHoraria, new Date(p.fechaHoraEntrega)) : '',
    estado: p.estado,
    ...(p.cotizacionId ? { cotizacionId: p.cotizacionId } : {}),
    importe: p.cobro.total,
    cobro: p.cobro.estado,
    estatusPlanta: p.estatusPlanta,
  };
}

/** Viaje de la API → el del seguimiento. "terminado" se muestra como entregado; sin GPS de flota, sin posición. */
export function aViaje(v: ApiViaje, zona: string): ViajeCamion {
  const fecha = (utc: string | null) => (utc ? isoEnZona(zona, new Date(utc)) : undefined);
  const estado: EstadoViaje = v.estado === 'terminado' ? 'regresando' : v.estado;
  const salida = fecha(v.salidaEn);
  const llegada = fecha(v.llegadaEstimada);
  return {
    id: v.id,
    pedidoId: v.pedidoId,
    unidad: v.camion ?? 'Sin unidad',
    operador: v.operador ?? '',
    volumenM3: v.volumenM3,
    estado,
    ...(salida ? { salida } : {}),
    ...(llegada ? { llegadaEstimada: llegada } : {}),
    ...(v.lat != null && v.lng != null ? { posicion: { lat: v.lat, lng: v.lng, fecha: new Date().toISOString() } } : {}),
  };
}
