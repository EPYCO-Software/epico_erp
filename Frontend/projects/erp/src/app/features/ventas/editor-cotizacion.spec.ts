import { totalesCotizacion } from 'ui';
import { COTIZACIONES } from './datos';
import { cambiosDe } from './editor-cotizacion';

describe('editar una cotización: traslado', () => {
  const p = COTIZACIONES.find((c) => c.id === 'EPI-PRES-ESC-26090')!.partidas[0];
  const edicion = (distancia: number | null) => ({
    partidas: [{ ...p, precio: null, distancia }],
    descuento: null,
    traslado: { incluidosKm: 20, precioKm: 10 },
  });

  it('con distancia guarda el traslado y cobra los km extra; sin distancia, sin traslado', () => {
    const lejos = cambiosDe(edicion(30));
    expect(lejos.partidas[0].traslado).toEqual({ distanciaKm: 30, incluidosKm: 20, precioKm: 10 });
    // 10 km extra × $10 = $100 por m³ × 6 m³ = $600 más de subtotal
    expect(totalesCotizacion(lejos).subtotal - totalesCotizacion(cambiosDe(edicion(null))).subtotal).toBe(600);
    expect(cambiosDe(edicion(null)).partidas[0].traslado).toBeUndefined();
  });
});
