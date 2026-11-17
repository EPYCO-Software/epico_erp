import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService, EmpresaSesion, Planta } from 'ui';
import { PreferenciasUsuario } from './preferencias-usuario';

/** Razón social de la concretera, con las plantas que opera. Una concretera puede tener varias. */
/** Planta del ERP: la de ui más su traslado (de la sesión del backend). */
export type PlantaErp = Planta & { traslado?: { incluidosKm: number; precioKm: number } };

export interface RazonSocial {
  id: string;
  nombre: string;
  plantas: PlantaErp[];
}

// Sin backend (pruebas, demo): razones sociales y plantas fijas, con coordenadas aproximadas (las de Xpujil y Cancún,
// del centro del municipio). Con backend se usan las de la sesión (razonesDeSesion).
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

/**
 * Las razones sociales y plantas que puede ver el usuario, de la sesión del backend. La planta se identifica por su
 * código (ESC, CZM…), como en todo el front y en los folios; ventas-api la traduce al id de sucursal.
 */
export function razonesDeSesion(empresas: EmpresaSesion[]): RazonSocial[] {
  return empresas
    .filter((e) => e.plantas.length)
    .map((e) => ({
      id: e.id,
      nombre: e.nombre,
      plantas: e.plantas.map((p) => ({
        id: p.codigo,
        nombre: p.nombre,
        zonaHoraria: p.zonaHoraria,
        ubicacion: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : undefined,
        traslado: p.kmIncluidos != null && p.precioKm != null ? { incluidosKm: p.kmIncluidos, precioKm: p.precioKm } : undefined,
      })),
    }));
}

const vigentes = signal<RazonSocial[]>(RAZONES_SOCIALES);
/** Las razones sociales vigentes: las de la sesión o, sin backend, las fijas. Para código fuera de componentes. */
export const razonesVigentes = vigentes.asReadonly();
export const plantasVigentes = computed(() => vigentes().flatMap((r) => r.plantas));

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
  readonly razones = razonesVigentes;
  // shortcut: la selección vive en memoria; guardarla por usuario cuando exista PreferenciaUsuario en la API.
  readonly seleccion = signal<string[]>([RAZONES_SOCIALES[0].plantas[0].id]);
  readonly actualId = signal(RAZONES_SOCIALES[0].plantas[0].id);

  readonly actual = computed(() => plantasVigentes().find((p) => p.id === this.actualId()) ?? plantasVigentes()[0]);

  constructor() {
    const auth = inject(AuthService);
    // Al entrar (o cambiar de usuario) toma las plantas de la sesión; si la selección ya no existe, la primera.
    effect(() => {
      const empresas = auth.sesion()?.empresas;
      const razones = empresas?.length ? razonesDeSesion(empresas) : [];
      vigentes.set(razones.length ? razones : RAZONES_SOCIALES);
      untracked(() => {
        const ids = new Set(plantasVigentes().map((p) => p.id));
        const quedan = this.seleccion().filter((id) => ids.has(id));
        if (!quedan.length) this.soloEsta(plantasVigentes()[0].id);
        else this.cambiar(quedan);
      });
    });
    // Al llegar las preferencias del usuario, su planta predeterminada (si sigue siendo suya)
    const prefs = inject(PreferenciasUsuario);
    effect(() => {
      if (!prefs.cargadas()) return;
      const id = untracked(() => prefs.valores().preferencias?.plantaId);
      if (id && untracked(() => plantasVigentes().some((p) => p.id === id))) untracked(() => this.soloEsta(id));
    });
  }
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
