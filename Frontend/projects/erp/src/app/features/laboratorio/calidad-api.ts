import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const BASE = '/api/v1';

/** Una muestra de concreto (cilindros) tomada de una orden, normalmente de una remisión. */
export interface Muestra {
  id?: string;
  folio?: string;
  pedidoId: string;
  remisionId: string | null;
  /** UTC. */
  fechaMuestreo: string;
  revenimientoCm: number | null;
  temperaturaC: number | null;
  cilindros: number;
  resistenciaDisenoKgCm2?: number;
  laboratoristaNombre: string | null;
  notas: string | null;
}

/** El ensaye (ruptura) de un cilindro a cierta edad: se programa al crear la muestra (7, 14 y 28 días). */
export interface Ensaye {
  id?: string;
  muestraId: string;
  edadDias: number;
  /** Días, YYYY-MM-DD (sin hora). */
  fechaProgramada: string;
  fechaEnsaye: string | null;
  resistenciaKgCm2: number | null;
  laboratoristaNombre: string | null;
}

export type Dictamen = 'cumple' | 'no_cumple' | 'pendiente';
export const DICTAMEN: Record<Dictamen, { texto: string; tono: string }> = {
  cumple: { texto: 'Cumple', tono: 'bg-[#E3EFE9] text-[#2E5E4A]' },
  no_cumple: { texto: 'No cumple', tono: 'bg-[#F6E3E1] text-[#8E332C]' },
  pendiente: { texto: 'Pendiente', tono: 'bg-[#FBF0DD] text-[#7A5410]' },
};

export interface Certificado {
  pedido: { id: string; folio: string; fechaHoraEntrega: string };
  cliente: { id: string; nombre: string };
  obra: { nombre: string; direccion: string | null };
  producto: string;
  fc: number;
  edadDias: number;
  muestras: {
    folio: string;
    remisionFolio: string | null;
    fechaMuestreo: string;
    revenimientoCm: number | null;
    ensayes: { edadDias: number; fechaEnsaye: string | null; resistenciaKgCm2: number | null; porcentaje: number | null }[];
  }[];
  resumen28: { promedio: number | null; minimo: number | null; n: number };
  dictamen: Dictamen;
  emitidoEn: string;
}

/** % de la resistencia de diseño (redondeado). */
export const porcentaje = (obtenida: number | null, diseno: number | undefined) => (obtenida != null && diseno ? Math.round((obtenida / diseno) * 100) : null);

/** Laboratorio contra el backend: muestras, ensayes y el certificado de una orden. */
@Service()
export class CalidadApi {
  private readonly http = inject(HttpClient);

  muestras(filtro: Record<string, string> = {}): Promise<Muestra[]> {
    return firstValueFrom(this.http.get<Muestra[]>(`${BASE}/muestras?${new URLSearchParams({ ...filtro, take: '500' })}`));
  }
  ensayes(filtro: Record<string, string> = {}): Promise<Ensaye[]> {
    return firstValueFrom(this.http.get<Ensaye[]>(`${BASE}/ensayes?${new URLSearchParams({ ...filtro, take: '500' })}`));
  }
  guardarMuestra(m: Muestra): Promise<Muestra> {
    return m.id ? firstValueFrom(this.http.put<Muestra>(`${BASE}/muestras/${m.id}`, m)) : firstValueFrom(this.http.post<Muestra>(`${BASE}/muestras`, m));
  }
  guardarEnsaye(e: Ensaye): Promise<Ensaye> {
    return firstValueFrom(this.http.put<Ensaye>(`${BASE}/ensayes/${e.id}`, e));
  }
  certificado(pedidoId: string): Promise<Certificado> {
    return firstValueFrom(this.http.get<Certificado>(`${BASE}/pedidos/${pedidoId}/certificado`));
  }
}
