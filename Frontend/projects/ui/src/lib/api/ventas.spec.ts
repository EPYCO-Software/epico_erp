import { buscarSolucion } from '../cotizacion/catalogo';
import { PartidaCotizacion } from '../models/cotizacion';
import { Contexto, aPartida, partidaApi } from './ventas';

const ctx: Contexto = { plantas: new Map(), productoFront: new Map(), productoApi: new Map(), codigoDe: new Map() };

describe('api/ventas: vocabulario de la partida', () => {
  it('la colocación "bombeo" del front viaja como "bombeable" y regresa como "bombeo"; la exposición, en minúsculas', () => {
    const partida: PartidaCotizacion = {
      id: 'p1',
      nombre: 'Losa',
      solucionId: 'losa',
      especificacion: { ...buscarSolucion('losa')!.sugerida, colocacion: 'bombeo', aditivos: [] },
      volumenM3: 10,
      servicios: [],
      maquinaria: [],
      obraId: 'o1',
      entrega: '',
    };
    const api = partidaApi(partida, 0, ctx, () => '');
    expect(api.colocacion).toBe('bombeable');
    expect(partidaApi({ ...partida, especificacion: { ...partida.especificacion, colocacion: 'directa' } }, 0, ctx, () => '').colocacion).toBe('directa');

    const leida = aPartida({ ...api, id: 'p1', exposicion: 'Normal', lineas: [] } as never, 'o1', 'America/Merida', ctx);
    expect(leida.especificacion.colocacion).toBe('bombeo');
    expect(leida.especificacion.exposicion).toBe('normal');
  });
});
