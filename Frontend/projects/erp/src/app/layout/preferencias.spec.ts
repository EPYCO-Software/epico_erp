import { nombreDispositivo } from './preferencias';

describe('nombreDispositivo', () => {
  it('reconoce sistema y navegador aunque el user agent mencione otros', () => {
    const chromeWindows =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
    const edge = `${chromeWindows} Edg/142.0.0.0`;
    const safariIphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const chromeAndroid =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

    expect(nombreDispositivo(chromeWindows)).toBe('Windows · Chrome');
    expect(nombreDispositivo(edge)).toBe('Windows · Edge');
    expect(nombreDispositivo(safariIphone)).toBe('iOS · Safari');
    expect(nombreDispositivo(chromeAndroid)).toBe('Android · Chrome');
    expect(nombreDispositivo('')).toBe('Equipo · Navegador');
  });
});
