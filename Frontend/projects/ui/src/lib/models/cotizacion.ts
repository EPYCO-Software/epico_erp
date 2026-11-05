/** Cómo se lleva el concreto del camión al elemento. */
export type Colocacion = 'directa' | 'bombeo';

/** Ambiente al que queda expuesto el elemento; define cemento y aditivos recomendados. */
export type Exposicion = 'normal' | 'humedad' | 'marina';

/** RS = resistente a sulfatos (recomendado en ambiente marino). */
export type TipoCemento = 'CPC 30R' | 'CPC 40' | 'CPC 30R RS';

export type Aditivo = 'acelerante' | 'retardante' | 'impermeabilizante' | 'fibra-sintetica' | 'fibra-metalica';

export type ServicioObra =
  | 'bomba-estacionaria'
  | 'bomba-pluma'
  | 'muestreo-laboratorio'
  | 'colado-nocturno'
  | 'asesoria-tecnica'
  | 'renta-maquinaria';

/** Equipo disponible en "Renta de maquinaria". */
export type Maquinaria = 'aplanadora' | 'vibrador' | 'allanadora';

export interface RentaMaquinaria {
  tipo: Maquinaria;
  dias: number;
}

export interface EspecificacionConcreto {
  /** f'c: compresión; MR: módulo de ruptura (pavimentos). En kg/cm². */
  tipoResistencia: 'fc' | 'mr';
  resistenciaKgCm2: number;
  edadDias: number;
  revenimientoCm: number;
  /** Tamaño máximo de agregado. */
  tmaMm: number;
  cemento: TipoCemento;
  exposicion: Exposicion;
  colocacion: Colocacion;
  aditivos: Aditivo[];
}

/** Configuración que el cliente arma en el cotizador (una partida antes de agregarse). */
export interface ConfiguracionConcreto {
  solucionId: string;
  especificacion: EspecificacionConcreto;
  volumenM3: number;
  servicios: ServicioObra[];
  /** Solo con el servicio "renta-maquinaria". */
  maquinaria: RentaMaquinaria[];
  /** Obra de entrega de esta partida. */
  obraId: string;
  /** Fecha y hora de entrega estimada, ISO 8601 con offset. Entre 24 h y 6 meses después de capturarla. */
  entrega: string;
}

export interface PartidaCotizacion extends ConfiguracionConcreto {
  id: string;
  /** Nombre visible, p. ej. "Pavimento" o el nombre del diseño guardado. */
  nombre: string;
  /** Precio especial del concreto por m³ que da la concretera (ERP). Sin él, el del tarifario. */
  precioM3?: number;
  /** Cargo por distancia que fija la concretera (ERP): sin él, la entrega está dentro del radio de la planta. */
  traslado?: Traslado;
}

/**
 * De la planta a la obra: los km que pasen de `incluidosKm` se cobran a `precioKm` por cada m³ (línea "Traslado
 * adicional" de lineasPartida).
 */
export interface Traslado {
  distanciaKm: number;
  incluidosKm: number;
  precioKm: number;
}

export interface DisenoGuardado {
  id: string;
  nombre: string;
  solucionId: string;
  especificacion: EspecificacionConcreto;
  favorito: boolean;
}

/** Cotización que el cliente guardó (o descargó) desde el portal. */
export interface CotizacionGuardada {
  id: string;
  /** Folio provisional del portal (p. ej. EPI-WEB-ESC-26001); el ERP asigna el definitivo. */
  folio: string;
  /** ISO 8601 */
  fecha: string;
  partidas: PartidaCotizacion[];
  /**
   * Serie: folio de la primera versión. Modificar una cotización crea otra versión de la misma serie
   * (EPI-WEB-ESC-26001-R1, -R2…); la más reciente sustituye a las anteriores.
   */
  serie: string;
  /** 0 = original; 1, 2… = revisiones dentro de la serie. */
  revision: number;
  /** Cotización de la que se partió (revisión o nueva cotización tomada de base). */
  baseId?: string;
  /** Descuento sobre el subtotal, en %, que da la concretera (ERP). Se aplica antes del IVA. */
  descuento?: number;
}

/** Cómo se guardará la cotización que se está editando a partir de una guardada. */
export type ModoEdicion = 'revision' | 'base';

/** "recibida": la pidió el cliente en el portal y la concretera aún no responde. "pedido": el cliente la aceptó. */
export type EstadoCotizacion = 'recibida' | 'borrador' | 'enviada' | 'pedido' | 'cancelada';

/**
 * Cotización en el ERP: la misma que guarda el portal (partidas, serie y revisión) más los datos de la concretera.
 * El folio es el oficial (EPI-PRES-ESC-26085) y la fecha lleva el offset de la planta.
 */
export interface Cotizacion extends CotizacionGuardada {
  clienteId: string;
  plantaId: string;
  vendedorId: string;
  estado: EstadoCotizacion;
  /** Último envío al cliente: a su cuenta del portal si está conectado; si no, a un correo. */
  envio?: { correo: string; portal: boolean; /** ISO 8601 */ fecha: string };
  /** La pidió el cliente desde el portal (llega como "recibida"). */
  origen?: 'portal';
  /** El cliente no la ve en el portal (p. ej. una versión que se reemplazó por otra con mejor precio). */
  ocultaAlCliente?: boolean;
}

export interface CotizacionVista extends Cotizacion {
  clienteNombre: string;
  /** Obras de entrega de sus partidas, separadas por coma. */
  obrasNombre: string;
  plantaNombre: string;
  /** Zona IANA de la planta, para mostrar la fecha con fechaZona. */
  zonaHoraria: string;
  vendedorNombre: string;
  /** Neto con IVA de sus partidas (totales de cotizacion/formato.ts), MXN. */
  total: number;
}
