export interface MuestraLaboratorio {
  id: string;
  remisionId: string;
  /** ISO 8601 con offset. */
  fechaMuestreo: string;
  edadDias: number;
  resistenciaDisenoKgCm2: number;
  /** null mientras el ensaye no se ha realizado. */
  resistenciaObtenidaKgCm2: number | null;
}

export interface MuestraLaboratorioVista extends MuestraLaboratorio {
  remisionFolio: string;
  obraNombre: string;
}
