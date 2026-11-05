/** Reglas de la fecha de entrega estimada. Fechas en hora local del navegador (la de quien está en la obra). */

const HORA_MS = 60 * 60 * 1000;

/** Entregas de 18:00 a 06:59 se consideran nocturnas: son especiales y llevan el servicio "colado-nocturno". */
export function esNocturna(fecha: Date): boolean {
  const h = fecha.getHours();
  return h >= 18 || h < 7;
}

/** Ventana permitida: al menos 24 h de anticipación y como máximo 6 meses después. */
export function limitesEntrega(ahora: Date): { min: Date; max: Date } {
  const min = new Date(ahora.getTime() + 24 * HORA_MS);
  const max = new Date(ahora);
  max.setMonth(max.getMonth() + 6);
  return { min, max };
}

/** Valor para <input type="datetime-local"> (sin segundos ni zona). */
export function aInputLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Interpreta el valor de datetime-local como hora local. Inválido → null. */
export function deInputLocal(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO 8601 con el offset local, p. ej. 2026-10-15T08:00:00-06:00 (convención del proyecto). */
export function aIsoConOffset(d: Date): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const signo = off >= 0 ? '+' : '-';
  return `${aInputLocal(d)}:00${signo}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** Mensaje de error o null si la fecha es válida. */
export function validarEntrega(valor: string, ahora: Date): string | null {
  if (!valor) return 'Indica la fecha y hora de entrega estimada.';
  const d = deInputLocal(valor);
  if (!d) return 'La fecha no es válida.';
  const { min, max } = limitesEntrega(ahora);
  if (d < min) return 'La entrega debe programarse con al menos 24 horas de anticipación.';
  if (d > max) return 'La entrega no puede programarse con más de 6 meses de anticipación.';
  return null;
}
