export type EstadoPedido = 'programado' | 'en_planta' | 'en_ruta' | 'en_obra' | 'entregado' | 'cancelado';

export interface Pedido {
  id: string;
  folio: string;
  clienteId: string;
  plantaId: string;
  obraId: string;
  producto: string;
  volumenM3: number;
  /** ISO 8601 con offset. */
  fechaHoraEntrega: string;
  estado: EstadoPedido;
}

export interface PedidoVista extends Pedido {
  clienteNombre: string;
  obraNombre: string;
  plantaNombre: string;
  /** Zona IANA de la planta, para mostrar las horas con fechaZona. */
  zonaHoraria: string;
}
