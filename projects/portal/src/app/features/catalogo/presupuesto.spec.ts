import { PartidaCotizacion } from 'ui';
import { conceptoConcreto, fechaHoraCorta, lineasPartida, pesos, plantaPara, precioConcreto, totales } from './presupuesto';

const partida = (cambios: Partial<PartidaCotizacion> = {}): PartidaCotizacion => ({
  id: 'p1',
  nombre: 'Losa',
  solucionId: 'losa',
  volumenM3: 20,
  servicios: [],
  maquinaria: [],
  obraId: 'o1',
  entrega: '2026-10-15T08:00:00-06:00',
  especificacion: {
    tipoResistencia: 'fc', resistenciaKgCm2: 200, edadDias: 28, revenimientoCm: 14, tmaMm: 19,
    cemento: 'CPC 30R', exposicion: 'normal', colocacion: 'directa', aditivos: [],
  },
  ...cambios,
});

describe('presupuesto', () => {
  it('reproduce la cotización real EPI-PRES-ESC-26085: f´c 200 rev 14, 20 m³ con bombeo', () => {
    const l = lineasPartida(partida({ servicios: ['bomba-estacionaria'] }));
    expect(l.map((x) => [x.unidad, x.precio, x.cantidad, x.importe])).toEqual([
      ['M³', 3700, 20, 74000],
      ['M³', 500, 20, 10000],
    ]);
    expect(conceptoConcreto(partida())).toBe('Concreto premezclado f´c: 200 kg/cm², Rev. 14 cm, Edad 28 días, TMA 19 mm.');
    expect(totales(l)).toEqual({ subtotal: 84000, iva: 13440, neto: 97440 });
  });

  it('aplica mínimos de bombeo (10 m³ estacionaria, 20 m³ pluma)', () => {
    const l = lineasPartida(partida({ volumenM3: 6, servicios: ['bomba-estacionaria', 'bomba-pluma'] }));
    expect(l[1].cantidad).toBe(10);
    expect(l[2].cantidad).toBe(20);
  });

  it('el precio del concreto suma edad, cemento RS y aditivos', () => {
    const p = partida();
    p.especificacion = { ...p.especificacion, edadDias: 7, cemento: 'CPC 30R RS', aditivos: ['impermeabilizante'] };
    expect(precioConcreto(p)).toBe(3700 + 300 + 250 + 180);
    expect(conceptoConcreto(p)).toContain('cemento CPC 30R RS, con impermeabilizante integral');
  });

  it('servicios por unidad: nocturno por m³, laboratorio y asesoría por servicio, maquinaria por día', () => {
    const l = lineasPartida(
      partida({ servicios: ['colado-nocturno', 'muestreo-laboratorio', 'asesoria-tecnica', 'renta-maquinaria'], maquinaria: [{ tipo: 'allanadora', dias: 2 }] }),
    );
    expect(l.slice(1).map((x) => [x.unidad, x.cantidad, x.importe])).toEqual([
      ['M³', 20, 5000],
      ['Servicio', 1, 1800],
      ['Visita', 1, 2500],
      ['Día', 2, 2400],
    ]);
  });

  it('formatea pesos y elige planta por municipio', () => {
    expect(pesos(97440)).toBe('97,440.00');
    expect(plantaPara({ municipio: 'Escárcega, Camp.' }).clave).toBe('ESC');
    expect(plantaPara({ municipio: 'Cozumel, Q. Roo' }).nombre).toBe('PLANTA COZUMEL');
    expect(plantaPara({ municipio: 'Mérida, Yuc.' }).clave).toBe('GEN');
    expect(plantaPara(null).clave).toBe('GEN');
  });

  it('fechaHoraCorta respeta la hora guardada con offset (la de la obra), sin convertir a la zona del navegador', () => {
    expect(fechaHoraCorta('2026-11-24T19:30:00-05:00')).toBe('24/11/2026 19:30');
    expect(fechaHoraCorta('2026-11-20T08:00:00-06:00')).toBe('20/11/2026 08:00');
  });
});
