import { aInputLocal, aIsoConOffset, deInputLocal, esNocturna, limitesEntrega, validarEntrega } from './entrega';

const ahora = new Date(2026, 9, 1, 10, 0); // 1 oct 2026, 10:00 local

describe('fecha de entrega', () => {
  it('nocturna: de 18:00 a 06:59', () => {
    expect(esNocturna(new Date(2026, 9, 5, 17, 59))).toBe(false);
    expect(esNocturna(new Date(2026, 9, 5, 18, 0))).toBe(true);
    expect(esNocturna(new Date(2026, 9, 5, 23, 30))).toBe(true);
    expect(esNocturna(new Date(2026, 9, 5, 6, 59))).toBe(true);
    expect(esNocturna(new Date(2026, 9, 5, 7, 0))).toBe(false);
  });

  it('ventana: mínimo 24 h y máximo 6 meses', () => {
    const { min, max } = limitesEntrega(ahora);
    expect(aInputLocal(min)).toBe('2026-10-02T10:00');
    expect(aInputLocal(max)).toBe('2027-04-01T10:00');
  });

  it('valida vacío, formato, menos de 24 h y más de 6 meses', () => {
    expect(validarEntrega('', ahora)).toContain('Indica');
    expect(validarEntrega('mañana', ahora)).toContain('no es válida');
    expect(validarEntrega('2026-10-02T09:59', ahora)).toContain('24 horas');
    expect(validarEntrega('2026-10-02T10:00', ahora)).toBeNull();
    expect(validarEntrega('2027-04-01T10:00', ahora)).toBeNull();
    expect(validarEntrega('2027-04-01T10:01', ahora)).toContain('6 meses');
  });

  it('convierte entre datetime-local, Date e ISO con offset', () => {
    const d = deInputLocal('2026-10-15T08:30')!;
    expect(aInputLocal(d)).toBe('2026-10-15T08:30');
    expect(aIsoConOffset(d)).toMatch(/^2026-10-15T08:30:00[+-]\d{2}:\d{2}$/);
    expect(new Date(aIsoConOffset(d)).getTime()).toBe(d.getTime());
  });
});
