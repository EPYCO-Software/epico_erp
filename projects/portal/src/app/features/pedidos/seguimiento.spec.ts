import { ProgramaViaje, entregaActiva, minutosParaLlegar, senal, simularViaje } from './seguimiento';

const T0 = new Date(2026, 10, 3, 10, 0);
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const programa = (cambios: Partial<ProgramaViaje> = {}): ProgramaViaje => ({
  id: 'v1', pedidoId: 'pe1', unidad: 'ECO-21', operador: 'Raúl', volumenM3: 8,
  salida: min(0), llegada: min(20), origen: { lat: 20, lng: -87 }, destino: { lat: 21, lng: -86 }, gps: true,
  ...cambios,
});

describe('seguimiento de camiones', () => {
  it('avanza de planta a obra: cargando, en camino (posición intermedia), descargando y entregado', () => {
    expect(simularViaje(programa(), min(-5)).estado).toBe('cargando');
    const enRuta = simularViaje(programa(), min(10));
    expect(enRuta.estado).toBe('en_ruta');
    expect(enRuta.posicion).toMatchObject({ lat: 20.5, lng: -86.5 });
    expect(simularViaje(programa(), min(30)).estado).toBe('en_obra');
    expect(simularViaje(programa(), min(50)).estado).toBe('regresando');
  });

  it('señal: en vivo, perdida (posición congelada) o sin GPS', () => {
    expect(senal(simularViaje(programa(), min(10)), min(10))).toBe('en_vivo');
    const perdida = simularViaje(programa({ senalHasta: min(5) }), min(10));
    expect(senal(perdida, min(10))).toBe('perdida');
    expect(perdida.posicion).toMatchObject({ lat: 20.25, lng: -86.75 }); // donde estaba al perder señal
    const sinGps = simularViaje(programa({ gps: false }), min(10));
    expect(senal(sinGps, min(10))).toBe('sin_gps');
    expect(sinGps.posicion).toBeUndefined();
  });

  it('minutos para llegar solo mientras no ha llegado; la entrega sigue activa hasta que todos descargan', () => {
    expect(minutosParaLlegar(simularViaje(programa(), min(12)), min(12))).toBe(8);
    expect(minutosParaLlegar(simularViaje(programa(), min(25)), min(25))).toBeNull();
    expect(entregaActiva([simularViaje(programa(), min(50)), simularViaje(programa({ id: 'v2', llegada: min(40) }), min(50))])).toBe(true);
    expect(entregaActiva([simularViaje(programa(), min(50))])).toBe(false);
  });
});
