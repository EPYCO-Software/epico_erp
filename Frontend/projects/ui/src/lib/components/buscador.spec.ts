import { TestBed } from '@angular/core/testing';
import { Buscador, FiltrosElegidos, enRango, opcionesDe, pasaFiltro } from './buscador';

describe('buscador: filtros por columna', () => {
  it('casillas: ninguna marcada deja pasar todo; marcadas, solo esas', () => {
    expect(pasaFiltro({}, 'estado', 'enviada')).toBe(true);
    expect(pasaFiltro({ estado: ['borrador'] }, 'estado', 'enviada')).toBe(false);
    expect(pasaFiltro({ estado: ['borrador', 'enviada'] }, 'estado', 'enviada')).toBe(true);
  });

  it('rangos de fecha (por día, con offset) y de número, abiertos de un lado', () => {
    const f: FiltrosElegidos = { fecha: ['2026-11-01', '2026-11-15'], total: ['1000', ''] };
    expect(enRango(f, 'fecha', '2026-11-15T23:30:00-06:00')).toBe(true);
    expect(enRango(f, 'fecha', '2026-11-16T00:10:00-06:00')).toBe(false);
    expect(enRango(f, 'total', 999)).toBe(false);
    expect(enRango(f, 'total', 5000)).toBe(true);
    // Sin valor no pasa un rango activo; sin rango, todo pasa
    expect(enRango(f, 'fecha', null)).toBe(false);
    expect(enRango({}, 'fecha', null)).toBe(true);
  });

  it('opcionesDe: valores distintos con su conteo, sin vacíos y en orden', () => {
    const filas = [{ m: 'Mérida' }, { m: 'Cancún' }, { m: 'Mérida' }, { m: '' }];
    expect(opcionesDe(filas, (f) => f.m)).toEqual([
      { id: 'Cancún', nombre: 'Cancún', n: 1 },
      { id: 'Mérida', nombre: 'Mérida', n: 2 },
    ]);
  });

  it('lo elegido se ve como etiqueta en la barra y su × lo quita (un rango, completo)', async () => {
    const fixture = TestBed.createComponent(Buscador);
    fixture.componentRef.setInput('idBuscar', 'b');
    fixture.componentRef.setInput('etiqueta', 'Buscar');
    fixture.componentRef.setInput('grupos', [
      { id: 'estado', titulo: 'Estado', opciones: [{ id: 'a', nombre: 'Activo' }, { id: 'i', nombre: 'Inactivo' }] },
      { id: 'total', titulo: 'Total', rango: 'numero', prefijo: '$' },
    ]);
    fixture.componentRef.setInput('filtros', { estado: ['a'], total: ['1000', ''] });
    await fixture.whenStable();
    const quitar = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button[aria-label^="Quitar filtro"]')];
    expect(quitar().map((b) => b.getAttribute('aria-label'))).toEqual(['Quitar filtro: Activo', 'Quitar filtro: Total: desde $1,000']);
    quitar()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.filtros()).toEqual({ estado: ['a'], total: [] });
  });
});
