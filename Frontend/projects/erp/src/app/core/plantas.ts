import { Service, computed, signal } from '@angular/core';
import { Planta } from 'ui';

/** Razón social de la concretera, con las plantas que opera. Una concretera puede tener varias. */
export interface RazonSocial {
  id: string;
  nombre: string;
  plantas: Planta[];
}

// shortcut: razones sociales y plantas fijas para la demo (las del portal más Cancún), con coordenadas aproximadas
// (las de Xpujil y Cancún, del centro del municipio); vendrán del backend
// según la concretera con la que entró el usuario y las plantas que tiene permitidas.
export const RAZONES_SOCIALES: RazonSocial[] = [
  {
    id: 'sureste',
    nombre: 'EPICO Concretos del Sureste',
    plantas: [
      { id: 'ESC', nombre: 'Planta Escárcega', zonaHoraria: 'America/Merida', ubicacion: { lat: 18.6101, lng: -90.7352 } },
      { id: 'XPJ', nombre: 'Planta Xpujil', zonaHoraria: 'America/Merida', ubicacion: { lat: 18.5097, lng: -89.3946 } },
    ],
  },
  {
    id: 'caribe',
    nombre: 'EPICO Concretos del Caribe',
    plantas: [
      { id: 'CZM', nombre: 'Planta Cozumel', zonaHoraria: 'America/Cancun', ubicacion: { lat: 20.4878, lng: -86.9422 } },
      { id: 'CUN', nombre: 'Planta Cancún', zonaHoraria: 'America/Cancun', ubicacion: { lat: 21.1619, lng: -86.8515 } },
    ],
  },
];

export type EstadoGrupo = 'todas' | 'algunas' | 'ninguna';

/** Agrega o quita una planta de la selección. Nunca deja la selección vacía (la última no se quita). */
export function alternarPlanta(seleccion: string[], id: string): string[] {
  if (!seleccion.includes(id)) return [...seleccion, id];
  return seleccion.length > 1 ? seleccion.filter((s) => s !== id) : seleccion;
}

/** Casilla de una razón social: si todas sus plantas están, las quita (salvo que no quede ninguna); si no, las agrega. */
export function alternarGrupo(seleccion: string[], ids: string[]): string[] {
  if (estadoGrupo(seleccion, ids) === 'todas') {
    const resto = seleccion.filter((s) => !ids.includes(s));
    return resto.length ? resto : seleccion;
  }
  return [...seleccion, ...ids.filter((id) => !seleccion.includes(id))];
}

export function estadoGrupo(seleccion: string[], ids: string[]): EstadoGrupo {
  const n = ids.filter((id) => seleccion.includes(id)).length;
  return n === 0 ? 'ninguna' : n === ids.length ? 'todas' : 'algunas';
}

/**
 * Plantas con las que trabaja el usuario: una principal (la que muestra el encabezado) y opcionalmente otras.
 * Clic en el nombre = trabajar solo con esa; casillas = combinar varias. Siempre queda al menos una.
 */
@Service()
export class PlantasService {
  readonly razones = RAZONES_SOCIALES;
  // shortcut: la selección vive en memoria; con backend, guardarla por usuario y filtrar los datos con ella.
  readonly seleccion = signal<string[]>([RAZONES_SOCIALES[0].plantas[0].id]);
  readonly actualId = signal(RAZONES_SOCIALES[0].plantas[0].id);

  private readonly todas = RAZONES_SOCIALES.flatMap((r) => r.plantas);
  readonly actual = computed(() => this.todas.find((p) => p.id === this.actualId()) ?? this.todas[0]);
  /** Cuántas plantas hay además de la principal. */
  readonly otras = computed(() => this.seleccion().length - 1);

  estado(razon: RazonSocial): EstadoGrupo {
    return estadoGrupo(
      this.seleccion(),
      razon.plantas.map((p) => p.id),
    );
  }

  soloEsta(id: string): void {
    this.seleccion.set([id]);
    this.actualId.set(id);
  }

  soloRazon(razon: RazonSocial): void {
    this.seleccion.set(razon.plantas.map((p) => p.id));
    this.actualId.set(razon.plantas[0].id);
  }

  alternar(id: string): void {
    this.cambiar(alternarPlanta(this.seleccion(), id));
  }

  alternarRazon(razon: RazonSocial): void {
    this.cambiar(
      alternarGrupo(
        this.seleccion(),
        razon.plantas.map((p) => p.id),
      ),
    );
  }

  /** Si la principal salió de la selección, la principal pasa a ser la primera que quedó. */
  private cambiar(seleccion: string[]): void {
    this.seleccion.set(seleccion);
    if (!seleccion.includes(this.actualId())) this.actualId.set(seleccion[0]);
  }
}
