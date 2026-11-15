import { ApiCotizacion, ApiEvento, ApiPedido, ApiProducto, aCotizacion, aEvento, aPedido, contexto, cotizacionApi, idFront } from './ventas-api';

// Respuestas reales de la API local (recortadas)
const ESC = '01a1da03-939d-7c9f-861b-dad30822af34';
const empresas = [{ plantas: [{ id: ESC, codigo: 'ESC', zonaHoraria: 'America/Merida' }] }];
const producto = (id: string, codigo: string) => ({ id, codigo }) as ApiProducto;
const productos = [
  producto('p-fc250', 'CON-FC-250'),
  producto('p-bomba', 'SRV-BOMBA-ESTACIONARIA'),
  producto('p-vibrador', 'REN-VIBRADOR'),
  producto('p-traslado', 'SRV-TRASLADO'),
  producto('p-nuevo', 'GEN-SACO'),
];
const ctx = contexto(empresas, productos);
const unidadDe = (id: string) => (id === 'servicio-bomba-estacionaria' ? 'M³' : 'Día');

const cotizacion: ApiCotizacion = {
  id: 'c1',
  createdAt: '',
  updatedAt: null,
  sucursalId: ESC,
  clienteId: 'cli',
  obraId: 'obra',
  vendedorId: 'u1',
  folio: 'EPI-PRES-ESC-26001',
  serie: 'EPI-PRES-ESC-26001',
  revision: 0,
  baseId: null,
  estado: 'borrador',
  origen: 'erp',
  ocultaAlCliente: false,
  fecha: '2026-11-14T12:27:46.109982Z',
  descuento: 11220.48,
  subtotal: 112204.8,
  total: 130157.57,
  partidas: [
    {
      id: '01a1da07-2f4c-7d84-904e-f47acb449b76',
      createdAt: '',
      updatedAt: null,
      orden: 0,
      nombre: 'Losa de cimentación',
      solucionId: null,
      tipoResistencia: 'fc',
      resistenciaKgCm2: 250,
      edadDias: 28,
      revenimientoCm: 14,
      tmaMm: 20,
      cemento: 'CPC 30R',
      exposicion: 'normal',
      colocacion: 'bombeo',
      aditivos: [],
      volumenM3: 24,
      precioM3: 3950,
      entrega: '2026-11-20T14:00:00Z',
      trasladoDistanciaKm: 34.56,
      trasladoIncluidosKm: 20,
      trasladoPrecioKm: 12,
      lineas: [
        { id: 'l1', productoId: 'p-bomba', concepto: 'Bombeo de concreto', cantidad: 24, dias: null, precioUnitario: 500, importe: 12000 },
        { id: 'l2', productoId: 'p-vibrador', concepto: 'Renta de vibrador', cantidad: 1, dias: 2, precioUnitario: 600, importe: 1200 },
      ],
    },
  ],
};

describe('ventas-api: de la API al front', () => {
  it('los productos del tarifario conservan su id del front (por código); los nuevos, su uuid', () => {
    expect(idFront(producto('x', 'CON-FC-300'))).toBe('fc-300');
    expect(idFront(producto('x', 'SRV-BOMBA-PLUMA'))).toBe('servicio-bomba-pluma');
    expect(idFront(producto('uuid-1', 'GEN-SACO'))).toBe('uuid-1');
  });

  it('cotización: planta por código, fechas en la hora de la planta, descuento en %, servicios y maquinaria como claves', () => {
    const c = aCotizacion(cotizacion, ctx);
    expect(c).toMatchObject({ id: 'c1', plantaId: 'ESC', clienteId: 'cli', descuento: 10, estado: 'borrador' });
    expect(c.fecha).toBe('2026-11-14T06:27:46-06:00');
    const [p] = c.partidas;
    expect(p.entrega).toBe('2026-11-20T08:00:00-06:00');
    expect(p.obraId).toBe('obra');
    expect(p.servicios).toEqual(['bomba-estacionaria', 'renta-maquinaria']);
    expect(p.maquinaria).toEqual([{ tipo: 'vibrador', dias: 2 }]);
    expect(p.traslado).toEqual({ distanciaKm: 34.56, incluidosKm: 20, precioKm: 12 });
    // 3950 es la tarifa del f´c 250: no es precio especial
    expect(p.precioM3).toBeUndefined();
    expect(aCotizacion({ ...cotizacion, partidas: [{ ...cotizacion.partidas[0], precioM3: 3800 }] }, ctx).partidas[0].precioM3).toBe(3800);
  });

  it('pedido: volumen y producto de la línea de concreto, importe con IVA, solicitud de planta en la hora de la planta', () => {
    const pedido = {
      id: 'p1',
      sucursalId: ESC,
      clienteId: 'cli',
      obraId: 'obra',
      cotizacionId: 'c1',
      partidaId: 'pa1',
      folio: 'PED-ESC-26-001',
      fechaHoraEntrega: '2026-11-20T14:00:00Z',
      estado: 'programado',
      cobro: 'por_cobrar',
      metodoPago: 'sin_metodo',
      estatusPlanta: 'actualizacion',
      solicitudPlantaFecha: '2026-11-21T15:00:00Z',
      solicitudPlantaNota: 'Sin camión ese día',
      descuento: 0,
      subtotal: 112204.8,
      total: 130157.57,
      lineas: [
        { id: 'a', productoId: 'p-traslado', descripcion: 'Traslado', cantidad: 24, precioUnitario: 175.2, importe: 4204.8 },
        { id: 'b', productoId: 'p-fc250', descripcion: 'Losa: f´c 250', cantidad: 24, precioUnitario: 3950, importe: 94800 },
      ],
    } as unknown as ApiPedido;
    expect(aPedido(pedido, ctx)).toMatchObject({
      plantaId: 'ESC',
      producto: 'Losa: f´c 250',
      volumenM3: 24,
      importe: 130157.57,
      fechaHoraEntrega: '2026-11-20T08:00:00-06:00',
      solicitudPlanta: { fecha: '2026-11-21T09:00:00-06:00', nota: 'Sin camión ese día' },
    });
  });

  it('historial: textos de alta legibles, cambios con nombres en vez de ids, notas marcadas', () => {
    const nombres = new Map([['u1', 'Root'], ['cli', 'Constructora Maya']]);
    const e = (x: Partial<ApiEvento>): ApiEvento => ({ id: 'e', registroTipo: 'Cotizacion', registroId: 'c1', fecha: 'f', autorId: 'u1', tipo: 'cambio', texto: 'Cambios guardados', detalles: null, cambios: [], ...x });
    expect(aEvento(e({ tipo: 'creado', registroTipo: 'CotizacionPartida', texto: 'CotizacionPartida creado' }), 'cotizacion:c1', (id) => nombres.get(id)).texto).toBe('Producto agregado');
    const cambio = aEvento(e({ cambios: [{ etiqueta: 'Cliente', tipoDato: 'referencia', valorAnterior: null, valorNuevo: 'cli' }] }), 'cotizacion:c1', (id) => nombres.get(id));
    expect(cambio).toMatchObject({ autor: 'Root', registro: 'cotizacion:c1', cambios: [{ campo: 'Cliente', antes: '—', despues: 'Constructora Maya' }] });
    expect(aEvento(e({ tipo: 'nota', autorId: null }), 'x', () => undefined)).toMatchObject({ nota: true, autor: 'Sistema' });
  });
});

describe('ventas-api: del front a la API', () => {
  it('la cotización va con la sucursal, la obra de la cotización, el descuento en % y las líneas con su producto', () => {
    const front = aCotizacion(cotizacion, ctx);
    const existentes = new Set(front.partidas.map((p) => p.id));
    const cuerpo = cotizacionApi({ clienteId: 'cli', plantaId: 'ESC', partidas: front.partidas, descuento: 10 }, ctx, unidadDe, {}, existentes);
    expect(cuerpo).toMatchObject({ sucursalId: ESC, clienteId: 'cli', obraId: 'obra', descuentoPct: 10 });
    const [p] = cuerpo.partidas;
    // id de la API: se edita (no se crea otra)
    expect(p).toMatchObject({ id: '01a1da07-2f4c-7d84-904e-f47acb449b76', resistenciaKgCm2: 250, precioM3: null, entrega: '2026-11-20T14:00:00.000Z', trasladoDistanciaKm: 34.56 });
    expect(p.lineas).toEqual([
      { productoId: 'p-bomba', cantidad: 24 },
      { productoId: 'p-vibrador', cantidad: 1, dias: 2 },
    ]);
    // Una partida nueva (aunque su id del front parezca uuid) va sin id; al crear, ninguna lleva
    expect(cotizacionApi({ clienteId: 'cli', plantaId: 'ESC', partidas: [{ ...front.partidas[0], id: crypto.randomUUID() }] }, ctx, unidadDe, {}, existentes).partidas[0]).not.toHaveProperty('id');
    expect(cotizacionApi({ clienteId: 'cli', plantaId: 'ESC', partidas: front.partidas }, ctx, unidadDe).partidas[0]).not.toHaveProperty('id');
  });
});
