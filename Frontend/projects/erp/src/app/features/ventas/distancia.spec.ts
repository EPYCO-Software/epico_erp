import { FACTOR_RODEO, distanciaDeManejo, kmEnLineaRecta } from './distancia';

const ESCARCEGA = { lat: 18.6101, lng: -90.7352 };
const XPUJIL = { lat: 18.5097, lng: -89.3946 };

describe('distancia de la planta a la obra', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('en línea recta: Escárcega–Xpujil son unos 142 km', () => {
    expect(kmEnLineaRecta(ESCARCEGA, XPUJIL)).toBeCloseTo(141.9, 0);
    expect(kmEnLineaRecta(ESCARCEGA, ESCARCEGA)).toBe(0);
  });

  it('por carretera con la ruta de OSRM; sin servicio, la recta × rodeo marcada como aproximada', async () => {
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ routes: [{ distance: 153_420 }] }) }));
    expect(await distanciaDeManejo(ESCARCEGA, XPUJIL)).toEqual({ km: 153.4, fuente: 'carretera' });
    vi.stubGlobal('fetch', async () => {
      throw new Error('sin red');
    });
    const aprox = await distanciaDeManejo(ESCARCEGA, XPUJIL);
    expect(aprox.fuente).toBe('aprox');
    expect(aprox.km).toBeCloseTo(kmEnLineaRecta(ESCARCEGA, XPUJIL) * FACTOR_RODEO, 0);
  });
});
