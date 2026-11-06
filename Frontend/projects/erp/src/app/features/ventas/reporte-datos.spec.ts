import { LineaVenta, agrupar, conBombeo, contraLista, resumir, textoVariacion, variacion, csv, filtrar, granularidad, historialDemo, medir, rangoAnioAnterior, rangoAnterior, rangoDe } from './reporte-datos';

const linea = (l: Partial<LineaVenta>): LineaVenta => ({
  folio: 'PED-1',
  fecha: '2026-10-15',
  plantaId: 'ESC',
  clienteId: 'c-maya',
  productoId: 'fc-250',
  categoria: 'concreto-fc',
  vendedorId: 'ana.pech@epicoconcretos.mx',
  cantidad: 10,
  unidad: 'M³',
  m3: 10,
  importe: 40000,
  ...l,
});

describe('periodos', () => {
  it('rápidos hasta hoy, y el anterior del mismo largo', () => {
    expect(rangoDe('este-mes', '2026-11-06')).toEqual({ desde: '2026-11-01', hasta: '2026-11-06' });
    expect(rangoDe('mes-pasado', '2026-01-10')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoDe('este-trimestre', '2026-11-06')).toEqual({ desde: '2026-10-01', hasta: '2026-11-06' });
    expect(rangoDe('ultimos-12', '2026-11-06')).toEqual({ desde: '2025-12-01', hasta: '2026-11-06' });
    expect(rangoDe('anio-pasado', '2026-11-06')).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
    expect(rangoAnterior({ desde: '2026-11-01', hasta: '2026-11-06' })).toEqual({ desde: '2026-10-26', hasta: '2026-10-31' });
    expect(rangoAnioAnterior({ desde: '2028-02-01', hasta: '2028-02-29' })).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' });
    expect(granularidad({ desde: '2026-11-01', hasta: '2026-11-30' })).toBe('dia');
    expect(granularidad({ desde: '2026-08-01', hasta: '2026-11-06' })).toBe('semana');
    expect(granularidad(rangoDe('ultimos-12', '2026-11-06'))).toBe('mes');
  });
});

describe('medidas y filtro', () => {
  const lineas = [
    linea({}),
    linea({ productoId: 'servicio-bomba-pluma', categoria: 'servicio', m3: 0, importe: 6500 }),
    linea({ folio: 'PED-2', plantaId: 'CUN', productoId: 'mr-45', categoria: 'concreto-mr', m3: 5, importe: 25000 }),
  ];

  it('órdenes = folios distintos; precio por m³ = importe de concreto / m³ (el bombeo no cuenta)', () => {
    expect(medir(lineas, 'importe')).toBe(71500);
    expect(medir(lineas, 'm3')).toBe(15);
    expect(medir(lineas, 'ordenes')).toBe(2);
    expect(medir(lineas, 'precio')).toBe(4333.33);
  });

  it('por planta, categoría o producto', () => {
    const f = { desde: '2026-10-01', hasta: '2026-10-31', plantas: [], aplica: '', vendedor: '', cliente: '' };
    expect(filtrar(lineas, { ...f, plantas: ['CUN'] })).toHaveLength(1);
    expect(filtrar(lineas, { ...f, aplica: 'cat:servicio' })).toHaveLength(1);
    expect(filtrar(lineas, { ...f, aplica: 'prod:fc-250' })).toHaveLength(1);
    expect(filtrar(lineas, { ...f, hasta: '2026-10-14' })).toHaveLength(0);
  });
});

describe('agrupar (tabla dinámica)', () => {
  const nombres = { producto: {}, cliente: {} };
  const rango = { desde: '2026-08-01', hasta: '2026-10-31' };

  it('por mes: los meses sin ventas salen en cero; columnas por planta en su orden fijo; totales', () => {
    const t = agrupar([linea({}), linea({ folio: 'PED-2', fecha: '2026-08-03', plantaId: 'CUN', importe: 10000 })], {
      filas: 'mes',
      columnas: 'planta',
      medida: 'importe',
      rango,
      nombres,
      orden: 'desc',
    });
    expect(t.filas.map((f) => f.nombre)).toEqual(['ago 2026', 'sep 2026', 'oct 2026']);
    expect(t.columnas.map((c) => [c.nombre, c.color])).toEqual([
      ['Escárcega', '#2a78d6'],
      ['Cancún', '#eda100'],
    ]);
    expect(t.celdas).toEqual([
      [0, 10000],
      [0, 0],
      [40000, 0],
    ]);
    expect([t.totalFila, t.totalColumna, t.total]).toEqual([[10000, 0, 40000], [40000, 10000], 50000]);
  });

  it('por cliente: de mayor a menor y, pasando el máximo, el resto en "Otros"', () => {
    const lineas = ['a', 'b', 'c', 'd'].map((c, i) => linea({ folio: c, clienteId: c, importe: (i + 1) * 100 }));
    const t = agrupar(lineas, { filas: 'cliente', columnas: null, medida: 'importe', rango: { desde: '2026-10-01', hasta: '2026-10-31' }, nombres, orden: 'desc', maximo: 3 });
    expect(t.filas.map((f) => f.id)).toEqual(['d', 'c', '__otros']);
    expect(t.celdas.map((f) => f[0])).toEqual([400, 300, 300]);
  });
});

describe('resumen por entidad (Vendedores, Productos, Clientes)', () => {
  const nombres = { producto: { 'fc-250': 'f´c 250' }, cliente: {} };
  const lineas = [
    linea({ fecha: '2026-10-02' }),
    linea({ productoId: 'servicio-bomba-pluma', categoria: 'servicio', m3: 0, importe: 6500 }),
    linea({ folio: 'PED-2', fecha: '2026-10-20', clienteId: 'c-delta', plantaId: 'CUN', m3: 5, cantidad: 5, importe: 20000 }),
    linea({ folio: 'PED-3', vendedorId: 'luis.canche@epicoconcretos.mx', importe: 38000 }),
  ];

  it('un renglón por vendedor, de mayor a menor, con ticket, clientes, plantas, precio y lista', () => {
    const [ana, luis] = resumir(lineas, 'vendedor', nombres, { 'fc-250': 3950, 'servicio-bomba-pluma': 650 });
    expect(ana).toMatchObject({ nombre: 'Ana Pech', importe: 66500, m3: 15, ordenes: 2, clientes: 2, plantas: ['ESC', 'CUN'], ticket: 33250, primera: '2026-10-02', ultima: '2026-10-20' });
    // 15 m³ × 3,950 + 10 m³ de bombeo × 650 = 65,750 de lista
    expect(ana.lista).toBe(65750);
    expect(ana.precio).toBe(4000);
    expect(contraLista(ana)).toBeCloseTo(1.14, 2);
    expect(luis).toMatchObject({ importe: 38000, ordenes: 1 });
  });

  it('variación con signo; sin antes es "Nuevo"; bombeo sobre órdenes de concreto', () => {
    expect(variacion(110, 100)).toBeCloseTo(10);
    expect(variacion(5, 0)).toBeNull();
    expect(textoVariacion(12.345)).toBe('+12.3 %');
    expect(textoVariacion(-4)).toBe('−4 %');
    expect(textoVariacion(null)).toBe('Nuevo');
    expect(textoVariacion(null, 0)).toBe('—');
    // 3 órdenes con concreto (PED-1, 2, 3) y una con bombeo
    expect(conBombeo(lineas)).toBeCloseTo(33.33, 1);
  });

  it('orden por clave (resistencias en orden) y medida de clientes distintos', () => {
    const ls = ['fc-300', 'fc-100', 'mr-45', 'fc-150'].map((p, i) => linea({ folio: p, productoId: p, clienteId: i % 2 ? 'a' : 'b' }));
    const t = agrupar(ls, { filas: 'producto', columnas: null, medida: 'clientes', rango: { desde: '2026-10-01', hasta: '2026-10-31' }, nombres, orden: 'clave' });
    expect(t.filas.map((f) => f.id)).toEqual(['fc-100', 'fc-150', 'fc-300', 'mr-45']);
    expect(t.total).toBe(2);
  });
});

describe('csv e historial', () => {
  it('CSV con BOM, comillas escapadas y números sin formato', () => {
    expect(csv(['Cliente', 'Importe'], [['Constructora "Maya"', 1234.5]])).toBe('﻿"Cliente","Importe"\r\n"Constructora ""Maya""",1234.5');
  });

  it('el historial de demostración es siempre el mismo y no pasa de la fecha', () => {
    const a = historialDemo('2026-11-05', 60);
    expect(historialDemo('2026-11-05', 60)).toEqual(a);
    expect(a.length).toBeGreaterThan(100);
    expect(a.every((l) => l.fecha <= '2026-11-05' && l.importe > 0)).toBe(true);
  });
});
