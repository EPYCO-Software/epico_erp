import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY } from 'ui';
import { HistorialService } from './historial';

// El autor sale de la sesión (AuthService), que guarda con esta clave.
beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'erp-prueba' }] }));

describe('HistorialService', () => {
  const r = 'cotizacion:EPI-PRES-ESC-26092';
  const llamada = { registro: r, tipo: 'llamada', resumen: 'Confirmar bombeo', fechaLimite: '2026-11-10', asignadaA: 'Ana Pech', nota: '' } as const;

  it('la actividad programada queda pendiente; hecha, sale de las pendientes y todo queda en el historial, lo último arriba', () => {
    const h = TestBed.inject(HistorialService);
    h.nota(r, 'El cliente pide precio especial');
    h.programar(llamada);
    const [a] = h.actividadesDe(r);
    expect(a).toMatchObject({ tipo: 'llamada', resumen: 'Confirmar bombeo', asignadaA: 'Ana Pech' });
    h.marcarHecha(a);
    expect(h.actividadesDe(r)).toEqual([]);
    expect(h.de(r).map((e) => e.texto)).toEqual([
      'Actividad realizada: Llamada · Confirmar bombeo',
      'Actividad programada: Llamada · Confirmar bombeo',
      'El cliente pide precio especial',
    ]);
    expect(h.de(r)[1].detalles).toEqual(['Para el 10/11/2026, asignada a Ana Pech']);
    expect(h.de(r)[2].nota).toBe(true);
  });

  it('cada registro tiene su historial y sus actividades; cancelar también queda registrado', () => {
    const h = TestBed.inject(HistorialService);
    h.programar(llamada);
    h.nota('pedido:PED-26-0151', 'Otra cosa');
    h.cancelar(h.actividadesDe(r)[0]);
    expect(h.actividadesDe(r)).toEqual([]);
    expect(h.de(r)[0].texto).toBe('Actividad cancelada: Llamada · Confirmar bombeo');
    expect(h.de('pedido:PED-26-0151').map((e) => e.texto)).toEqual(['Otra cosa']);
  });
});

describe('fecha de edición', () => {
  it('es lo último del historial que no sea una nota ni una actividad', () => {
    const h = TestBed.inject(HistorialService);
    const r = 'cliente:c-maya';
    h.agregar([{ id: 'e1', registro: r, fecha: '2026-11-01T10:00:00-06:00', autor: 'Ana', texto: 'Datos del cliente actualizados' }]);
    h.nota(r, 'Llamar el lunes');
    h.programar({ registro: r, tipo: 'llamada', resumen: 'Seguimiento', fechaLimite: '2026-11-10', asignadaA: 'Ana Pech', nota: '' });
    expect(h.ultimaEdicion(r)).toBe('2026-11-01T10:00:00-06:00');
    expect(h.ultimaEdicion('cliente:otro')).toBeUndefined();
  });
});
