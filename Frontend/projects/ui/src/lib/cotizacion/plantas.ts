import { signal } from '@angular/core';
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
  { clave: 'XPJ', nombre: 'PLANTA XPUJIL', coincide: /xpujil/i, zonaHoraria: 'America/Merida', ubicacion: { lat: 18.5097, lng: -89.3946 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
  { clave: 'CUN', nombre: 'PLANTA CANCUN', coincide: /canc[uú]n/i, zonaHoraria: 'America/Cancun', ubicacion: { lat: 21.1619, lng: -86.8515 }, telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' },
];
const GENERAL: PlantaContacto = { clave: 'GEN', nombre: 'EPICO CONCRETOS', zonaHoraria: 'America/Merida', telefonos: TELEFONOS, correos: 'epico.concretos@gmail.com' };

/** Una planta del backend (GET /portal/catalogo → plantas). */
export interface PlantaServidor {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zonaHoraria: string;
  lat: number | null;
  lng: number | null;
  kmIncluidos: number | null;
  precioKm: number | null;
}

/** Con backend, las plantas reales (las carga el portal al entrar); null = las fijas de arriba (pruebas, demo). */
export const plantasServidor = signal<PlantaServidor[] | null>(null);

const distancia2 = (a: UbicacionGps, b: { lat: number | null; lng: number | null }) =>
  b.lat == null || b.lng == null ? Infinity : (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

/** La planta del backend que atiende la obra: la más cercana a su GPS, la de su municipio o la primera. */
function plantaServidorPara(lista: PlantaServidor[], obra: Pick<Obra, 'municipio' | 'ubicacion'> | null | undefined): PlantaContacto {
  const n = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const u = obra?.ubicacion;
  const p =
    (u ? [...lista].sort((a, b) => distancia2(u, a) - distancia2(u, b))[0] : undefined) ??
    (obra?.municipio ? lista.find((x) => n(`${x.nombre} ${x.direccion ?? ''}`).includes(n(obra.municipio.split(',')[0]))) : undefined) ??
    lista[0];
  if (!p) return GENERAL;
  return {
    clave: p.codigo,
    nombre: p.nombre.toUpperCase(),
    zonaHoraria: p.zonaHoraria,
    ...(p.lat != null && p.lng != null ? { ubicacion: { lat: p.lat, lng: p.lng } } : {}),
    telefonos: p.telefono ?? '',
    correos: '',
  };
}

export function plantaPara(obra: Pick<Obra, 'municipio'> & Partial<Pick<Obra, 'ubicacion'>> | null | undefined): PlantaContacto {
  const remotas = plantasServidor();
  if (remotas) return plantaServidorPara(remotas, obra);
  const p = obra ? PLANTAS.find((x) => x.coincide.test(obra.municipio)) : undefined;
  return p ? { clave: p.clave, nombre: p.nombre, zonaHoraria: p.zonaHoraria, ubicacion: p.ubicacion, telefonos: p.telefonos, correos: p.correos } : GENERAL;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "30 de septiembre del 2026", como en la cotización impresa. */
export const fechaLarga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`;
