import { PartidaCotizacion } from '../models/cotizacion';
import { PRODUCTOS, RESISTENCIAS, lineasPartida, partidaUsa, pedidoDePartida, precioConcreto, totalesCotizacion } from './formato';

const partida: PartidaCotizacion = {
  id: 'p1',
  nombre: 'Losa',
  solucionId: 'losa',
  volumenM3: 10,
  obraId: 'o1',
  entrega: '2026-11-20T08:00:00-06:00',
  servicios: ['bomba-estacionaria'],
  maquinaria: [],
  especificacion: {
    tipoResistencia: 'fc',
    resistenciaKgCm2: 200,
    edadDias: 28,
    revenimientoCm: 14,
    tmaMm: 19,
    cemento: 'CPC 30R',
    exposicion: 'normal',
    colocacion: 'bombeo',
    aditivos: [],
  },
};

describe('formato de la cotización', () => {
  it('el precio especial por m³ sustituye al del tarifario solo en la línea del concreto', () => {
    expect(lineasPartida(partida).map((l) => l.importe)).toEqual([37000, 5000]);
    expect(lineasPartida({ ...partida, precioM3: 3500 }).map((l) => l.importe)).toEqual([35000, 5000]);
  });

  it('traslado: los km después de los incluidos se cobran por m³, debajo del concreto; dentro del radio, nada', () => {
    const lejos = lineasPartida({ ...partida, traslado: { distanciaKm: 34.56, incluidosKm: 20, precioKm: 12 } });
    // 34.56 km → 14.6 km extra × $12 = $175.20 por m³ × 10 m³
    expect(lejos[1]).toMatchObject({ unidad: 'M³', precio: 175.2, cantidad: 10, importe: 1752 });
    expect(lejos[1].concepto).toContain('14.6 km después de los 20 km incluidos');
    expect(lineasPartida({ ...partida, traslado: { distanciaKm: 18, incluidosKm: 20, precioKm: 12 } })).toHaveLength(2);
    expect(lineasPartida({ ...partida, traslado: { distanciaKm: 50, incluidosKm: 20, precioKm: 0 } })).toHaveLength(2);
  });

  it('el descuento se resta del subtotal antes del IVA', () => {
    expect(totalesCotizacion({ partidas: [partida] })).toEqual({ subtotal: 42000, descuento: 0, iva: 6720, neto: 48720 });
    expect(totalesCotizacion({ partidas: [{ ...partida, precioM3: 3500 }], descuento: 10 })).toEqual({
      subtotal: 40000,
      descuento: 4000,
      iva: 5760,
      neto: 41760,
    });
  });

  it('las resistencias cotizables salen del tarifario, de menor a mayor', () => {
    expect(RESISTENCIAS.fc).toEqual([100, 150, 200, 250, 300, 350, 400]);
    expect(RESISTENCIAS.mr).toEqual([36, 40, 42, 45, 48]);
  });

  it('el pedido de una partida lleva su entrega y su importe con el descuento de la cotización', () => {
    expect(pedidoDePartida({ ...partida, precioM3: 3500 }, 10)).toEqual({
      partidaId: 'p1',
      obraId: 'o1',
      producto: "Losa · f'c 200 kg/cm²",
      volumenM3: 10,
      fechaHoraEntrega: '2026-11-20T08:00:00-06:00',
      importe: 41760,
    });
  });

  it('el catálogo de Productos sale del mismo tarifario: precios iguales a los de la cotización', () => {
    const precio = (id: string) => PRODUCTOS.find((p) => p.id === id)!.precio;
    expect(precio('fc-200')).toBe(precioConcreto(partida));
    expect(precio('servicio-bomba-estacionaria')).toBe(lineasPartida(partida)[1].precio);
    expect(PRODUCTOS.find((p) => p.id === 'servicio-bomba-estacionaria')!.minimo).toBe(10);
    expect(new Set(PRODUCTOS.map((p) => p.id)).size).toBe(PRODUCTOS.length);
    expect(PRODUCTOS.filter((p) => p.categoria === 'concreto-fc')).toHaveLength(RESISTENCIAS.fc.length);
  });

  it('partidaUsa reconoce concreto, servicios y ajustes de una partida', () => {
    expect(partidaUsa(partida, 'fc-200')).toBe(true);
    expect(partidaUsa(partida, 'fc-250')).toBe(false);
    expect(partidaUsa(partida, 'servicio-bomba-estacionaria')).toBe(true);
    expect(partidaUsa(partida, 'servicio-bomba-pluma')).toBe(false);
    expect(partidaUsa({ ...partida, especificacion: { ...partida.especificacion, aditivos: ['fibra-sintetica'] } }, 'aditivo-fibra-sintetica')).toBe(true);
  });
});
