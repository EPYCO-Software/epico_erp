import { TestBed } from '@angular/core/testing';
import { EspecificacionConcreto } from 'ui';
import { CotizacionService } from './cotizacion.service';

const esp: EspecificacionConcreto = {
  tipoResistencia: 'fc', resistenciaKgCm2: 200, edadDias: 28, revenimientoCm: 10, tmaMm: 19,
  cemento: 'CPC 30R', exposicion: 'normal', colocacion: 'directa', aditivos: [],
};

describe('CotizacionService', () => {
  it('lista los diseños con favoritos primero', () => {
    const s = TestBed.inject(CotizacionService);
    expect(s.disenos()[0].favorito).toBe(true);
    s.alternarFavorito(s.disenos()[1].id);
    expect(s.disenos().every((d) => d.favorito)).toBe(true);
  });

  it('guardarDiseno agrega el diseño con nombre limpio', () => {
    const s = TestBed.inject(CotizacionService);
    const d = s.guardarDiseno('  Firme bodega  ', 'firmes', esp);
    expect(d.nombre).toBe('Firme bodega');
    expect(s.disenos().some((x) => x.id === d.id)).toBe(true);
  });

  it('agrega y quita partidas, y suma el volumen', () => {
    const s = TestBed.inject(CotizacionService);
    const a = s.agregarPartida('Losa', { solucionId: 'losa', especificacion: esp, volumenM3: 12.5, servicios: [], maquinaria: [], obraId: 'o1', entrega: '2026-10-15T08:00:00-06:00' });
    s.agregarPartida('Firme', { solucionId: 'firmes', especificacion: esp, volumenM3: 8, servicios: ['muestreo-laboratorio'], maquinaria: [], obraId: 'o2', entrega: '2026-10-16T09:00:00-06:00' });
    expect(s.partidas()).toHaveLength(2);
    expect(s.volumenTotal()).toBe(20.5);
    s.quitarPartida(a.id);
    expect(s.partidas().map((p) => p.nombre)).toEqual(['Firme']);
    expect(new Set([a.id, s.partidas()[0].id]).size).toBe(2);
  });

  it('guardar: asigna folio provisional, archiva las partidas y vacía el carrito', () => {
    const s = TestBed.inject(CotizacionService);
    s.agregarPartida('Losa', { solucionId: 'losa', especificacion: esp, volumenM3: 10, servicios: [], maquinaria: [], obraId: 'o1', entrega: '2026-10-15T08:00:00-06:00' });
    const fecha = new Date(2026, 9, 1);
    expect(s.nuevoFolio('ESC', fecha)).toBe('EPI-WEB-ESC-26003'); // 26001 y 26002 son las demo
    const c = s.guardarCotizacion('EPI-WEB-ESC-26003', fecha);
    expect(c.partidas).toHaveLength(1);
    expect(s.partidas()).toEqual([]);
    expect(s.cotizaciones()[0]).toMatchObject({ folio: 'EPI-WEB-ESC-26003', serie: 'EPI-WEB-ESC-26003', revision: 0 });
    expect(s.nuevoFolio('CZM', fecha)).toBe('EPI-WEB-CZM-26004');
  });

  it('modificar crea revisiones de la misma serie; la más reciente encabeza y las anteriores quedan anidadas', () => {
    const s = TestBed.inject(CotizacionService);
    const demo = s.buscarCotizacion('c-demo-1')!;
    s.editar(demo, 'revision');
    expect(s.partidas()).toHaveLength(demo.partidas.length);
    s.quitarPartida(s.partidas()[0].id);
    const r1 = s.guardarCotizacion(s.nuevoFolio('ESC'));
    expect(r1).toMatchObject({ folio: 'EPI-WEB-ESC-26001-R1', serie: 'EPI-WEB-ESC-26001', revision: 1, baseId: demo.id });
    expect(demo.partidas).toHaveLength(2); // la original no cambia
    s.editar(demo, 'revision'); // aunque se parta de la original, sigue la numeración de la serie
    expect(s.guardarCotizacion(s.nuevoFolio('ESC')).folio).toBe('EPI-WEB-ESC-26001-R2');
    const [serie] = s.series();
    expect(serie.actual.revision).toBe(2);
    expect(serie.anteriores.map((c) => c.revision)).toEqual([1, 0]);
    expect(s.edicion()).toBeNull();
  });

  it('usar como base crea una serie nueva que recuerda su origen; cancelar vacía el carrito', () => {
    const s = TestBed.inject(CotizacionService);
    const demo = s.buscarCotizacion('c-demo-1')!;
    s.editar(demo, 'base');
    const nueva = s.guardarCotizacion(s.nuevoFolio('CZM', new Date(2026, 10, 3)));
    expect(nueva).toMatchObject({ folio: 'EPI-WEB-CZM-26003', serie: 'EPI-WEB-CZM-26003', revision: 0, baseId: demo.id });
    expect(s.series()).toHaveLength(3);
    s.editar(demo, 'revision');
    s.cancelarEdicion();
    expect(s.partidas()).toEqual([]);
    expect(s.edicion()).toBeNull();
  });
});
