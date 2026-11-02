export interface Remision {
  id: string;
  folio: string;
  pedidoId: string;
  volumenM3: number;
  /** ISO 8601 con offset. */
  fechaHoraSalida: string;
}

export interface RemisionVista extends Remision {
  pedidoFolio: string;
  obraNombre: string;
}
