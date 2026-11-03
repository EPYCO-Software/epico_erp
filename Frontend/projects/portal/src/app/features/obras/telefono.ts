import { ContactoObra } from 'ui';

/** Ladas disponibles; México va primero y es la de por defecto. */
export const LADAS = [
  { lada: '+52', pais: 'México' },
  { lada: '+1', pais: 'EE. UU. / Canadá' },
  { lada: '+501', pais: 'Belice' },
  { lada: '+502', pais: 'Guatemala' },
  { lada: '+503', pais: 'El Salvador' },
  { lada: '+504', pais: 'Honduras' },
  { lada: '+57', pais: 'Colombia' },
  { lada: '+53', pais: 'Cuba' },
  { lada: '+34', pais: 'España' },
  { lada: '+49', pais: 'Alemania' },
  { lada: '+39', pais: 'Italia' },
] as const;

export const LADA_MX = '+52';

/** Quita espacios, guiones, puntos y paréntesis. */
export const soloDigitos = (numero: string) => numero.replace(/[\s\-.()]/g, '');

/** Mensaje de error o null. México: 10 dígitos; otros países: 6 a 14 (E.164 admite 15 con la lada). */
export function validarTelefono(lada: string, numero: string): string | null {
  const n = soloDigitos(numero);
  if (!n) return 'Escribe el número de teléfono.';
  if (!/^\d+$/.test(n)) return 'Usa solo números.';
  if (lada === LADA_MX && n.length !== 10) return 'Un número de México tiene 10 dígitos.';
  if (lada !== LADA_MX && (n.length < 6 || n.length > 14)) return 'Revisa el número: debe tener entre 6 y 14 dígitos.';
  return null;
}

/** "+52 987 873 9361" para México; otros países, la lada y el número tal cual. */
export function telefonoVisible(c: Pick<ContactoObra, 'lada' | 'numero'>): string {
  const n = soloDigitos(c.numero);
  return c.lada === LADA_MX && n.length === 10 ? `${c.lada} ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : `${c.lada} ${n}`;
}

/** Para enlaces tel: (E.164). */
export const telefonoEnlace = (c: Pick<ContactoObra, 'lada' | 'numero'>) => `tel:${c.lada}${soloDigitos(c.numero)}`;
