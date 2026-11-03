import { ruta, rutaRelativa } from './capas-glass';

describe('ruta', () => {
  it('arma el atributo d cerrado', () => {
    expect(ruta([['M', 0, 0], ['L', 10, 20], ['Q', 5, 5, 10, 10]])).toBe('M0 0 L10 20 Q5 5 10 10 Z');
  });

  it('pasa los puntos a coordenadas relativas a la caja (recorte objectBoundingBox)', () => {
    expect(rutaRelativa([['M', 400, 70], ['L', 915, 1145], ['Q', 657.5, 70, 400, 607.5]], [400, 70, 515, 1075])).toBe(
      'M0 0 L1 1 Q0.5 0 0 0.5 Z',
    );
  });
});
