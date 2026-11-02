import { TestBed } from '@angular/core/testing';
import { DEFAULT_TIMEZONE, FechaZonaPipe } from './fecha-zona.pipe';

describe('FechaZonaPipe', () => {
  const crear = () => TestBed.runInInjectionContext(() => new FechaZonaPipe());
  // 13:30 UTC = 08:30 en Cancún (UTC−5) = 07:30 en Mérida (UTC−6).
  const iso = '2026-11-02T08:30:00-05:00';

  it('muestra la hora en la zona de la planta, no en la del navegador', () => {
    const pipe = crear();
    expect(pipe.transform(iso, 'America/Cancun', 'HH:mm')).toBe('08:30');
    expect(pipe.transform(iso, 'America/Merida', 'HH:mm')).toBe('07:30');
  });

  it('usa DEFAULT_TIMEZONE (Mérida) si no viene zona', () => {
    expect(crear().transform(iso, undefined, 'HH:mm')).toBe('07:30');
  });

  it('respeta un DEFAULT_TIMEZONE provisto por la app', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DEFAULT_TIMEZONE, useValue: 'America/Cancun' }] });
    expect(crear().transform(iso, null, 'HH:mm')).toBe('08:30');
  });

  it('formatea fecha completa y cambia de día según la zona', () => {
    const pipe = crear();
    const medianoche = '2026-11-03T00:30:00-05:00';
    expect(pipe.transform(medianoche, 'America/Cancun')).toBe('03/11/2026 00:30');
    expect(pipe.transform(medianoche, 'America/Merida')).toBe('02/11/2026 23:30');
  });

  it('devuelve vacío con entradas vacías o inválidas y cae al default con zona inválida', () => {
    const pipe = crear();
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('no-es-fecha', 'America/Cancun')).toBe('');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(pipe.transform(iso, 'Marte/Olympus', 'HH:mm')).toBe('07:30');
  });
});
