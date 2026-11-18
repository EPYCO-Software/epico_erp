import { agruparPorHora, diasVisibles, enZona, horasVisibles, inicioSemana, mover, porDia } from './calendario-entregas';

describe('filas de hora (Día y Semana)', () => {
  const e = (hora: string) => ({ p: { id: hora } as never, hora });
  it('de 06:00 a 20:00; crece si hay entregas antes o después; solo crecen las horas con entregas', () => {
    const vacias = horasVisibles([]);
    expect([vacias.length, vacias[0].etiqueta, vacias.at(-1)!.etiqueta, vacias.some((h) => h.ocupada)]).toEqual([15, '06:00', '20:00', false]);
    const h = horasVisibles([e('05:30'), e('09:30'), e('09:45'), e('22:10')]);
    expect([h[0].etiqueta, h.at(-1)!.etiqueta]).toEqual(['05:00', '22:00']);
    expect(h.filter((x) => x.ocupada).map((x) => x.hora)).toEqual([5, 9, 22]);
    expect(agruparPorHora([e('09:30'), e('09:45'), e('14:00')]).get(9)!.map((x) => x.hora)).toEqual(['09:30', '09:45']);
  });
});

describe('calendario de entregas', () => {
  it('semana de lunes a domingo; mes en 6 semanas desde el lunes de su día 1', () => {
    expect(inicioSemana('2026-11-17')).toBe('2026-11-16'); // martes → lunes
    expect(inicioSemana('2026-11-22')).toBe('2026-11-16'); // domingo → su lunes
    expect(diasVisibles('semana', '2026-11-17')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    const mes = diasVisibles('mes', '2026-11-17');
    expect([mes.length, mes[0], mes[41]]).toEqual([42, '2026-10-26', '2026-12-06']);
    expect(diasVisibles('dia', '2026-11-17')).toEqual(['2026-11-17']);
  });

  it('mover: un día, una semana o un mes (al día 1, sin desbordar)', () => {
    expect(mover('dia', '2026-12-31', 1)).toBe('2027-01-01');
    expect(mover('semana', '2026-11-17', -1)).toBe('2026-11-10');
    expect(mover('mes', '2026-01-31', 1)).toBe('2026-02-01');
    expect(mover('mes', '2026-01-15', -1)).toBe('2025-12-01');
  });

  it('cada orden cae en el día y hora de su planta, ordenadas por hora', () => {
    // 05:30 UTC del 18 es el 17 a las 23:30 en Mérida y a las 00:30 del 18 en Cancún
    expect(enZona('2026-11-18T05:30:00Z', 'America/Merida')).toEqual({ dia: '2026-11-17', hora: '23:30' });
    expect(enZona('2026-11-18T05:30:00Z', 'America/Cancun')).toEqual({ dia: '2026-11-18', hora: '00:30' });
    const p = (id: string, fecha: string, zona: string) => ({ id, fechaHoraEntrega: fecha, zonaHoraria: zona }) as never;
    const mapa = porDia([p('b', '2026-11-17T16:00:00Z', 'America/Merida'), p('a', '2026-11-17T14:00:00Z', 'America/Merida'), p('c', '2026-11-18T05:30:00Z', 'America/Cancun')]);
    expect(mapa.get('2026-11-17')!.map((e) => [e.p.id, e.hora])).toEqual([['a', '08:00'], ['b', '10:00']]);
    expect(mapa.get('2026-11-18')!.map((e) => e.p.id)).toEqual(['c']);
  });
});
