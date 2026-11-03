import { urlMapa } from './mapa';

describe('urlMapa', () => {
  it('con GPS usa las coordenadas exactas', () => {
    expect(urlMapa({ lat: 20.5106, lng: -86.9495 }, 'Calle 1')).toBe('https://maps.google.com/maps?q=20.5106,-86.9495&z=16&output=embed');
  });

  it('sin GPS busca la dirección codificada (no se puede inyectar parámetros)', () => {
    const url = urlMapa(undefined, ' Km 3 & z=1, Escárcega ');
    expect(url).toBe(`https://maps.google.com/maps?q=${encodeURIComponent('Km 3 & z=1, Escárcega')}&z=15&output=embed`);
    expect(url).not.toContain('&z=1,'); // el "&" de la dirección no se vuelve otro parámetro
  });

  it('coordenadas inválidas caen a la dirección; sin nada no hay mapa', () => {
    expect(urlMapa({ lat: NaN, lng: 1 }, 'Mérida')).toContain('q=M%C3%A9rida');
    expect(urlMapa(null, '   ')).toBeNull();
    expect(urlMapa(null, null)).toBeNull();
  });
});
