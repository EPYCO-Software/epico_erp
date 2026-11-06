import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY } from 'ui';
import { HistorialService } from '../../core/historial';
import { registro } from './datos';
import { ContextoOrden, LineaOrden, Programa, ProgramasService, desdePlantilla, evaluar } from './lealtad';

beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'erp-prueba' }] }));

const prog = (p: Partial<Programa> & Pick<Programa, 'tipo'>): Programa => ({ ...desdePlantilla(p.tipo), id: 'p', ...p });
const linea = (productoId: string, cantidad: number, precio: number, categoria: LineaOrden['categoria'] = 'concreto-fc'): LineaOrden => ({
  productoId,
  categoria,
  cantidad,
  precio,
});
const ctx = (c: Partial<ContextoOrden> = {}): ContextoOrden => ({ codigo: '', saldo: 0, traslado: 1200, fecha: '2026-11-06', ...c });
// 20 m³ de f´c 250 a $3,950 = $79,000; 2 m³ de bombeo a $250 = $500
const orden = [linea('fc-250', 20, 3950), linea('servicio-bomba', 2, 250, 'servicio')];

describe('evaluar: cada tipo de programa', () => {
  it('promoción: automática con compra mínima (traslado gratis)', () => {
    const p = prog({ tipo: 'promocion' });
    expect(evaluar(p, orden, ctx())).toMatchObject({ aplica: true, descuento: 1200 });
    expect(evaluar(p, [linea('fc-250', 5, 3950)], ctx())).toMatchObject({ aplica: false, motivo: 'Faltan $30,250.00 para la compra mínima.' });
  });

  it('código: solo con el código; el % solo sobre lo que aplica', () => {
    const p = prog({ tipo: 'codigo' });
    expect(evaluar(p, orden, ctx()).aplica).toBe(false);
    expect(evaluar(p, orden, ctx({ codigo: ' concreto10 ' }))).toMatchObject({ aplica: true, descuento: 7900 });
  });

  it('compra X recibe Y: gratis las más baratas, por cada grupo completo', () => {
    const p = prog({ tipo: 'compra-x', productoId: 'fc-250', cantidadX: 10, cantidadY: 1 });
    expect(evaluar(p, orden, ctx())).toMatchObject({ aplica: true, descuento: 3950, motivo: '1 gratis por llevar 20.' });
    expect(evaluar(p, [linea('fc-250', 22, 3950)], ctx()).descuento).toBe(7900);
    expect(evaluar(p, [linea('fc-250', 10, 3950)], ctx()).aplica).toBe(false);
  });

  it('próxima orden: con la compra mínima gana un cupón; el cupón se usa una vez en otra orden', () => {
    const p = prog({ tipo: 'proxima-orden', cupones: [{ codigo: 'SIG12345', usado: false }, { codigo: 'USADO123', usado: true }] });
    expect(evaluar(p, orden, ctx())).toMatchObject({ aplica: false, gana: 'Un cupón de 5 % de descuento para su próxima orden.' });
    expect(evaluar(p, orden, ctx({ codigo: 'sig12345' }))).toMatchObject({ aplica: true, descuento: 3975 });
    expect(evaluar(p, orden, ctx({ codigo: 'USADO123' })).motivo).toBe('Ese cupón ya se usó.');
  });

  it('lealtad: 1 punto por cada $100; con los puntos de canje, el monto', () => {
    const p = prog({ tipo: 'lealtad' });
    expect(evaluar(p, orden, ctx({ saldo: 100 }))).toMatchObject({ aplica: false, gana: '795 puntos (quedaría con 895).' });
    expect(evaluar(p, orden, ctx({ saldo: 600 }))).toMatchObject({ aplica: true, descuento: 2500, gana: '795 puntos (quedaría con 895).' });
  });

  it('cupones: un código único, una vez', () => {
    const p = prog({ tipo: 'cupones', cupones: [{ codigo: 'EXPO7K2M', usado: false }] });
    expect(evaluar(p, orden, ctx({ codigo: 'EXPO7K2M' }))).toMatchObject({ aplica: true, descuento: 7950 });
    expect(evaluar(p, orden, ctx({ codigo: 'OTRO' })).aplica).toBe(false);
  });

  it('sellos: 1 por unidad de lo que aplica; con la meta, la recompensa', () => {
    const p = prog({ tipo: 'sellos', categoria: 'concreto-fc' });
    expect(evaluar(p, orden, ctx({ saldo: 3 }))).toMatchObject({ aplica: false, gana: '20 sellos.' });
    expect(evaluar(p, orden, ctx({ saldo: 10 }))).toMatchObject({ aplica: true, descuento: 7900 });
  });

  it('archivado o fuera de vigencia no aplica; el descuento no pasa del subtotal', () => {
    expect(evaluar(prog({ tipo: 'promocion', activo: false }), orden, ctx()).motivo).toBe('El programa está archivado.');
    expect(evaluar(prog({ tipo: 'promocion', fin: '2026-10-31' }), orden, ctx()).motivo).toBe('Fuera de su vigencia.');
    expect(evaluar(prog({ tipo: 'promocion', compraMinima: 0, recompensa: 'monto', valor: 999999 }), orden, ctx()).descuento).toBe(79500);
  });
});

describe('ProgramasService', () => {
  it('alta, cupones únicos y marcar usado, con historial', () => {
    const s = TestBed.inject(ProgramasService);
    const h = TestBed.inject(HistorialService);
    const p = s.crear({ ...desdePlantilla('cupones'), nombre: ' Cupones obra ' });
    const nuevos = s.generarCupones(p.id, 3);
    expect(new Set(nuevos).size).toBe(3);
    expect(nuevos.every((c) => /^[A-Z2-9]{8}$/.test(c))).toBe(true);
    s.alternarUsado(p.id, nuevos[0]);
    expect(s.programa(p.id)!.cupones.filter((c) => c.usado).map((c) => c.codigo)).toEqual([nuevos[0]]);
    expect(s.programa(p.id)!.nombre).toBe('Cupones obra');
    expect(h.de(registro.programa(p.id)).map((e) => e.texto)).toEqual([`Cupón ${nuevos[0]} marcado como usado`, '3 cupones generados', 'Programa creado']);
  });
});
