import { UbicacionGps } from './obra';

export interface Planta {
  id: string;
  nombre: string;
  /** Zona IANA, p. ej. 'America/Cancun' o 'America/Merida'. */
  zonaHoraria: string;
  /** Salida de los camiones: de aquí se mide la distancia a la obra (cargo por traslado). */
  ubicacion?: UbicacionGps;
}
