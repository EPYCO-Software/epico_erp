import { direccionDe } from './elegir-ubicacion';

describe('direccionDe (dirección del mapa con el formato de las obras)', () => {
  it('calle, número y colonia; municipio con el estado abreviado', () => {
    expect(
      direccionDe({ road: 'Calle 31', house_number: '120', suburb: 'Centro', city: 'Escárcega', state: 'Campeche' }),
    ).toEqual({ direccion: 'Calle 31 120, Centro', municipio: 'Escárcega, Camp.' });
    expect(direccionDe({ road: 'Avenida Rafael E. Melgar', town: 'Cozumel', state: 'Quintana Roo' })).toEqual({
      direccion: 'Avenida Rafael E. Melgar',
      municipio: 'Cozumel, Q. Roo',
    });
  });

  it('sin datos no inventa nada', () => {
    expect(direccionDe({})).toEqual({});
    expect(direccionDe({ village: 'Xpujil', state: 'Campeche' })).toEqual({ municipio: 'Xpujil, Camp.' });
  });
});
