import { Obra, UbicacionGps } from '../models/obra';

/** Planta que atiende según el municipio de la obra (encabezado y clave del folio). */
export interface PlantaContacto {
  clave: string;
  nombre: string;
  telefonos: string;
  correos: string;
  /** Zona IANA de la planta (CLAUDE.md: la hora que se muestra es la de la planta). */
  zonaHoraria: string;
  /** shortcut: coordenadas aproximadas de la planta (salida de los camiones); reemplazar por las reales. */
  ubicacion?: UbicacionGps;
}

// Contacto tomado de la cotización real de Planta Escárcega; para las demás plantas solo el correo general.
const TELEFONOS = 'Cel. 987 8739361, Tel. 987 1170185';
const PLANTAS: (PlantaContacto & { coincide: RegExp })[] = [
  { clave: 'ESC', nombre: 'PLANTA ESCARCEGA', coincide: /esc[aá]rcega/i, zonaHoraria: 'America/Merida', ubicacion: { lat: 18.6101, lng: -90.7352 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com, ventas.escarcega@epiconconcretos.com' },
  { clave: 'CZM', nombre: 'PLANTA COZUMEL', coincide: /cozumel/i, zonaHoraria: 'America/Cancun', ubicacion: { lat: 20.4878, lng: -86.9422 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
  { clave: 'XPJ', nombre: 'PLANTA XPUJIL', coincide: /xpujil/i, zonaHoraria: 'America/Merida', telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
];
const GENERAL: PlantaContacto = { clave: 'GEN', nombre: 'EPICO CONCRETOS', zonaHoraria: 'America/Merida', telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' };

export function plantaPara(obra: Pick<Obra, 'municipio'> | null | undefined): PlantaContacto {
  const p = obra ? PLANTAS.find((x) => x.coincide.test(obra.municipio)) : undefined;
  return p ? { clave: p.clave, nombre: p.nombre, zonaHoraria: p.zonaHoraria, ubicacion: p.ubicacion, telefonos: p.telefonos, correos: p.correos } : GENERAL;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "30 de septiembre del 2026", como en la cotización impresa. */
export const fechaLarga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`;
