import { asignacionDe, categoriaDe, columnasDespacho, diasPara, estadoFila, gestionable, nombreTipo, rendimientos, siguienteEstado, textoCapacidad, textoVence, textoVentana, tocaCarga, sinCamion, situacionGps, textoSensores, enJornada, resultadoDe } from './flota-api';
import { textoDuracion } from 'ui';
import { horaTarjeta } from './tablero-despacho';

describe('flota', () => {
  it('categoría por tipo: ollas, bombas, carga, maquinaria', () => {
    expect(['revolvedor', 'bomba-pluma', 'volteo', 'retroexcavadora', 'otro'].map((t) => categoriaDe(t as never))).toEqual([
      'concreto',
      'bombeo',
      'carga',
      'maquinaria',
      'otro',
    ]);
    expect(nombreTipo('plataforma')).toBe('Plataforma (flete)');
  });

  it('los viajes solo avanzan, en orden, hasta terminado', () => {
    expect(siguienteEstado('programado')).toBe('cargando');
    expect(siguienteEstado('en_obra')).toBe('regresando');
    expect(siguienteEstado('terminado')).toBeNull();
  });

  it('estado visible: baja y taller mandan sobre el viaje; si no, en viaje o disponible', () => {
    const u = (extra: object) => ({ activo: true, estado: 'disponible', ...extra }) as never;
    const viaje = { remisionId: 'r', pedidoId: 'p', pedidoFolio: 'PED-1', estado: 'en_ruta' as const, entrega: '' };
    expect(estadoFila({ equipo: u({ activo: false }), viaje }).id).toBe('baja');
    expect(estadoFila({ equipo: u({ estado: 'mantenimiento' }), viaje }).id).toBe('mantenimiento');
    expect(estadoFila({ equipo: u({}), viaje }).texto).toBe('En ruta · PED-1');
    expect(estadoFila({ equipo: u({}), viaje: null }).id).toBe('disponible');
    expect([textoCapacidad({ capacidad: 7, unidadCapacidad: 'm³' }), textoCapacidad({ capacidad: null, unidadCapacidad: null })]).toEqual(['7 m³', '—']);
  });
});

describe('despacho, combustible y vencimientos', () => {
  it('despacho: por asignar = confirmada, viva y con m³ faltantes; cada viaje en su columna', () => {
    const pedido = (id: string, extra: object) => ({ id, volumenM3: 14, m3Asignados: 7, estado: 'en_planta', confirmadaEn: 'x', ...extra }) as never;
    const viaje = (id: string, estado: string) => ({ id, estado }) as never;
    const c = columnasDespacho([
      { pedido: pedido('a', {}), viajes: [viaje('v1', 'cargando')] },
      { pedido: pedido('b', { confirmadaEn: null }), viajes: [] },
      { pedido: pedido('c', { m3Asignados: 14 }), viajes: [viaje('v2', 'en_ruta'), viaje('v3', 'programado')] },
    ]);
    expect(c.por_asignar.map((t) => [t.pedido.id, t.tipo === 'orden' && t.faltan])).toEqual([['a', 7]]);
    expect([c.cargando.length, c.en_ruta.length, c.programado.length, c.terminado.length]).toEqual([1, 1, 1, 0]);
  });

  it('rendimiento por unidad: km/L desde la carga anterior; la primera, sin dato', () => {
    const carga = (id: string, equipoId: string, dia: number, litros: number, odometroKm: number | null, horometro: number | null = null) =>
      ({ id, equipoId, fecha: `2026-11-${String(dia).padStart(2, '0')}T12:00:00Z`, litros, odometroKm, horometro }) as never;
    const r = rendimientos([carga('b', 'olla', 5, 100, 1250), carga('a', 'olla', 1, 120, 1000), carga('x', 'retro', 2, 40, null, 100), carga('y', 'retro', 4, 60, null, 110)]);
    expect(r.get('a')).toEqual({ kmL: null, lh: null });
    expect(r.get('b')!.kmL).toBe(2.5);
    expect(r.get('y')!.lh).toBe(6);
    // Odómetro que baja (captura mal hecha): sin dato, no negativo
    expect(rendimientos([carga('p', 'o', 1, 50, 2000), carga('q', 'o', 2, 50, 1500)]).get('q')!.kmL).toBeNull();
  });

  it('vencimientos: pasados, hoy, próximos 30 días y lejanos', () => {
    const hoy = new Date(2026, 10, 18);
    expect(diasPara('2026-11-28', hoy)).toBe(10);
    expect(textoVence('2026-11-15', hoy).texto).toBe('Vencido hace 3 días');
    expect(textoVence('2026-11-18', hoy).texto).toBe('Vence hoy');
    expect(textoVence('2026-12-01', hoy).texto).toBe('Vence en 13 días');
    expect(textoVence('2027-03-01', hoy).texto).toBe('Vence el 01/03/2027');
    expect(textoVence(null, hoy).texto).toBe('Sin vencimiento');
  });
});

describe('órdenes de logística y tiempos de viaje', () => {
  it('gestionable: confirmada, o en solicitud de confirmación a planta', () => {
    expect([
      gestionable({ confirmadaEn: 'x' }),
      gestionable({ estatusPlanta: 'enviado' }),
      gestionable({ estatusPlanta: 'actualizacion' }),
      gestionable({ estatusPlanta: 'no_enviado' }),
      gestionable({}),
    ]).toEqual([true, true, true, false, false]);
  });

  it('camión: sin unidades, faltan m³ de ollas o completa', () => {
    expect(asignacionDe({ volumenM3: 14 })).toBe('sin_camion');
    expect(asignacionDe({ volumenM3: 14, unidades: ['DMA-01'], m3Asignados: 7 })).toBe('parcial');
    expect(asignacionDe({ volumenM3: 14, unidades: ['DMA-01', 'DMB-90'], m3Asignados: 14 })).toBe('completa');
  });

  it('duración y ventana en la hora de la planta', () => {
    expect([textoDuracion(180), textoDuracion(150), textoDuracion(45)]).toEqual(['3 h', '2 h 30 min', '45 min']);
    // 14:00 UTC = 08:00 en Mérida; 3 h después, 11:00
    expect(textoVentana({ salidaProgramada: '2026-11-20T14:00:00Z', regresoEstimado: '2026-11-20T17:00:00Z' }, 'America/Merida')).toBe('08:00–11:00');
    expect(textoVentana({ salidaProgramada: null, regresoEstimado: null }, 'America/Merida')).toBe('');
  });
});

describe('avisos, marcador y tablero por horas', () => {
  it('toca registrar carga: sin cargas, más de 7 días o 500 km desde la última', () => {
    const ahora = Date.parse('2026-11-18T12:00:00Z');
    expect(tocaCarga({ ultimaCarga: null, kmDesdeUltimaCarga: 0 }, ahora)).toBe(true);
    expect(tocaCarga({ ultimaCarga: { fecha: '2026-11-15T12:00:00Z', odometroKm: 1, horometro: null }, kmDesdeUltimaCarga: 120 }, ahora)).toBe(false);
    expect(tocaCarga({ ultimaCarga: { fecha: '2026-11-10T12:00:00Z', odometroKm: 1, horometro: null }, kmDesdeUltimaCarga: 0 }, ahora)).toBe(true);
    expect(tocaCarga({ ultimaCarga: { fecha: '2026-11-17T12:00:00Z', odometroKm: 1, horometro: null }, kmDesdeUltimaCarga: 500 }, ahora)).toBe(true);
  });

  it('marcador sin camión: gestionables, vivas y sin ollas completas', () => {
    const p = (extra: object) => ({ confirmadaEn: 'x', estado: 'programado', volumenM3: 14, ...extra });
    expect(sinCamion([p({}), p({ unidades: ['A'], m3Asignados: 7 }), p({ unidades: ['A'], m3Asignados: 14 }), p({ estado: 'cancelado' }), p({ confirmadaEn: null })])).toBe(2);
  });

  it('tablero: la orden va a la hora de su entrega; el viaje, a la de su salida', () => {
    const pedido = { fechaHoraEntrega: '2026-11-20T15:30:00Z', zonaHoraria: 'America/Merida' } as never;
    expect(horaTarjeta({ tipo: 'orden', id: 'o', pedido, faltan: 7 })).toBe(9);
    expect(horaTarjeta({ tipo: 'viaje', id: 'v', pedido, viaje: { salidaProgramada: '2026-11-20T14:30:00Z' } as never })).toBe(8);
  });
});

describe('GPS, línea de tiempo e inspección', () => {
  it('situación del GPS: sin señal (> 10 min), en movimiento (> 5 km/h) o detenida', () => {
    const ahora = Date.parse('2026-11-18T12:00:00Z');
    expect(situacionGps({ fecha: '2026-11-18T11:40:00Z', velocidadKmh: 40 }, ahora)).toBe('sin_senal');
    expect(situacionGps({ fecha: '2026-11-18T11:58:00Z', velocidadKmh: 40 }, ahora)).toBe('en_movimiento');
    expect(situacionGps({ fecha: '2026-11-18T11:58:00Z', velocidadKmh: 2 }, ahora)).toBe('detenida');
    expect(textoSensores({ tamborSentido: 'descarga', tamborRpm: 8, motorEncendido: true })).toEqual(['Tambor: descargando a 8 rpm', 'Motor encendido']);
  });

  it('línea de tiempo: posición dentro de la jornada, sin salirse', () => {
    const [d, h] = [Date.parse('2026-11-18T11:00:00Z'), Date.parse('2026-11-18T21:00:00Z')];
    expect(enJornada('2026-11-18T16:00:00Z', d, h)).toBe(50);
    expect([enJornada('2026-11-18T05:00:00Z', d, h), enJornada('2026-11-19T05:00:00Z', d, h)]).toEqual([0, 100]);
  });

  it('inspección: falla crítica = rechazada; otra falla = con observaciones', () => {
    const lista = [
      { clave: 'frenos', texto: 'Frenos', critico: true },
      { clave: 'luces', texto: 'Luces', critico: false },
    ];
    expect(resultadoDe([{ clave: 'frenos', ok: false }, { clave: 'luces', ok: true }], lista)).toBe('rechazada');
    expect(resultadoDe([{ clave: 'frenos', ok: true }, { clave: 'luces', ok: false }], lista)).toBe('con_observaciones');
    expect(resultadoDe([{ clave: 'frenos', ok: true }, { clave: 'luces', ok: true }], lista)).toBe('aprobada');
  });
});
