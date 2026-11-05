import { TestBed } from '@angular/core/testing';
import {
  CLIENTES,
  COTIZACIONES,
  FiltroCotizaciones,
  VentasService,
  especificacionBase,
  filtrarClientes,
  filtrarCotizaciones,
  filtrarPedidos,
  filtrarProductos,
  codigoSugerido,
  existenciasBajas,
  isoEnZona,
  modificable,
  plantaDeMunicipio,
  registro,
  siguienteFolio,
  telefono,
  totalVigente,
} from './datos';
import { HistorialService } from '../../core/historial';
import { PRODUCTOS } from 'ui';
import { AUTH_STORAGE_KEY } from 'ui';

// VentasService registra en el historial, que toma el autor de la sesión (AuthService, que guarda con esta clave).
beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'erp-prueba' }] }));

describe('filtrarCotizaciones', () => {
  const todas: FiltroCotizaciones = { plantas: ['ESC', 'XPJ', 'CZM', 'CUN'], vendedorId: null, estados: [], texto: '' };
  const folios = (f: Partial<FiltroCotizaciones>) => filtrarCotizaciones(COTIZACIONES, { ...todas, ...f }).map((c) => c.folio);

  it('sin filtros devuelve todas, de la más reciente a la más antigua', () => {
    const fechas = COTIZACIONES.map((c) => Date.parse(c.fecha));
    expect(folios({})).toHaveLength(14);
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  it('las recibidas (del portal) se filtran por su estado y se pueden modificar', () => {
    expect(folios({ estados: ['recibida'] })).toEqual(['EPI-WEB-CZM-26003', 'EPI-WEB-ESC-26004']);
    expect(COTIZACIONES.filter((c) => c.estado === 'recibida').every((c) => c.origen === 'portal' && modificable(c))).toBe(true);
  });

  it('solo muestra las de las plantas elegidas', () => {
    expect(folios({ plantas: ['XPJ'] })).toEqual(['EPI-PRES-XPJ-26014']);
  });

  it('"Mis cotizaciones", estados (se suman) y planta se combinan', () => {
    expect(folios({ plantas: ['ESC'], vendedorId: 'operaciones@epicoconcretos.mx', estados: ['borrador', 'enviada'] })).toEqual([
      'EPI-PRES-ESC-26092',
      'EPI-PRES-ESC-26091',
    ]);
  });

  it('busca por folio, cliente u obra sin importar acentos ni el orden de las palabras', () => {
    expect(folios({ texto: 'escarcega bodega' })).toEqual(['EPI-PRES-ESC-26088']);
    expect(folios({ texto: '26117' })).toEqual(['EPI-PRES-CUN-26117']);
    expect(folios({ texto: 'infraestructura' })).toHaveLength(2);
    expect(folios({ texto: 'periferico infraestructura' })).toEqual(['EPI-PRES-ESC-26089']);
    expect(folios({ texto: 'no existe' })).toEqual([]);
  });

  it('el total no cuenta las canceladas', () => {
    const sol = filtrarCotizaciones(COTIZACIONES, { ...todas, texto: 'edificaciones sol' });
    expect(sol.map((c) => c.estado)).toEqual(['pedido', 'cancelada']);
    expect(totalVigente(sol)).toBe(sol[0].total);
  });

  it('el neto sale del mismo tarifario que el portal (ui): 6 m³ de f´c 200 a $3,700 + IVA', () => {
    expect(COTIZACIONES.find((c) => c.folio === 'EPI-PRES-ESC-26090')!.total).toBe(25752);
  });
});

describe('VentasService', () => {
  const buscar = (s: VentasService, id: string) => s.cotizaciones().find((c) => c.id === id)!;

  it('guardar una ya enviada la vuelve la revisión R1 en borrador y recalcula el neto con precio especial y descuento', () => {
    const s = TestBed.inject(VentasService);
    const antes = buscar(s, 'EPI-PRES-ESC-26090');
    s.guardar(antes.id, { partidas: antes.partidas.map((p) => ({ ...p, precioM3: 3500 })), descuento: 10 });
    const c = buscar(s, antes.id);
    expect([c.folio, c.revision, c.estado]).toEqual(['EPI-PRES-ESC-26090-R1', 1, 'borrador']);
    // 6 m³ × $3,500 = $21,000 − 10 % = $18,900 + IVA 16 % = $21,924
    expect(c.total).toBe(21924);
  });

  it('guardar un borrador no crea revisión', () => {
    const s = TestBed.inject(VentasService);
    s.guardar('EPI-PRES-ESC-26092', { partidas: buscar(s, 'EPI-PRES-ESC-26092').partidas, descuento: 5 });
    expect(buscar(s, 'EPI-PRES-ESC-26092')).toMatchObject({ folio: 'EPI-PRES-ESC-26092', revision: 0, estado: 'borrador', descuento: 5 });
  });

  it('enviar la marca como enviada y guarda a dónde se mandó', () => {
    const s = TestBed.inject(VentasService);
    s.enviar('EPI-PRES-ESC-26092', 'compras@constructoramaya.mx', false);
    expect(buscar(s, 'EPI-PRES-ESC-26092')).toMatchObject({
      estado: 'enviada',
      envio: { correo: 'compras@constructoramaya.mx', portal: false },
    });
  });
});

describe('nueva cotización', () => {
  it('siguienteFolio sigue la serie de la planta en el año y empieza en 001', () => {
    const folios = ['EPI-PRES-ESC-26092', 'EPI-PRES-ESC-26090', 'EPI-PRES-CZM-26041', 'EPI-PRES-ESC-25310'];
    expect(siguienteFolio(folios, 'ESC', '2026-11-05T10:00:00-06:00')).toBe('EPI-PRES-ESC-26093');
    expect(siguienteFolio(folios, 'CUN', '2026-11-05T10:00:00-05:00')).toBe('EPI-PRES-CUN-26001');
    expect(siguienteFolio(folios, 'ESC', '2027-01-02T10:00:00-06:00')).toBe('EPI-PRES-ESC-27001');
  });

  it('isoEnZona da la hora de la planta con su offset', () => {
    const utc = new Date('2026-11-05T16:30:00Z');
    expect(isoEnZona('America/Merida', utc)).toBe('2026-11-05T10:30:00-06:00');
    expect(isoEnZona('America/Cancun', utc)).toBe('2026-11-05T11:30:00-05:00');
  });

  it('plantaDeMunicipio elige la planta que atiende (Cancún solo en el ERP)', () => {
    expect(plantaDeMunicipio('Escárcega, Camp.')).toBe('ESC');
    expect(plantaDeMunicipio('Cozumel, Q. Roo')).toBe('CZM');
    expect(plantaDeMunicipio('Cancún, Q. Roo')).toBe('CUN');
    expect(plantaDeMunicipio('Mérida, Yuc.')).toBeNull();
  });

  it('alta rápida de cliente y su lugar de entrega: se pueden cotizar y se ven en Ventas', () => {
    const s = TestBed.inject(VentasService);
    const c = s.crearCliente({ nombre: ' Obras Kin ', contacto: 'Pedro Kin', telefono: '981 123 4567', correo: '' });
    expect(c).toMatchObject({ nombre: 'Obras Kin', portal: false, facturacion: [], contacto: { telefono: '9811234567' } });
    expect(s.cliente(c.id)).toBe(c);
    const o = s.crearObra(c.id, { nombre: '', direccion: 'Calle 20 #5', municipio: 'Escárcega, Camp.', referencias: '', contacto: 'Pedro Kin', telefono: '9811234567' });
    expect(o).toMatchObject({ nombre: 'Entrega a domicilio', clienteId: c.id, contactos: [{ numero: '9811234567' }] });
    const base = s.cotizaciones().find((x) => x.id === 'EPI-PRES-ESC-26090')!;
    const q = s.crear({ clienteId: c.id, plantaId: 'ESC', partidas: base.partidas.map((p) => ({ ...p, obraId: o.id })), descuento: undefined }, 'operaciones@epicoconcretos.mx');
    expect([q.clienteNombre, q.obrasNombre]).toEqual(['Obras Kin', 'Entrega a domicilio']);
  });

  it('orden directa: una por producto; sin cotización guarda su partida, con ella la deja confirmada', () => {
    const s = TestBed.inject(VentasService);
    const base = s.cotizaciones().find((x) => x.id === 'EPI-PRES-ESC-26092')!;
    const nueva = { clienteId: 'c-maya', plantaId: 'ESC', partidas: base.partidas, descuento: 5 };
    const cotizacionesAntes = s.cotizaciones().length;
    const sin = s.crearOrdenes(nueva, 'operaciones@epicoconcretos.mx', false);
    expect(sin).toHaveLength(2);
    expect(sin[0]).toMatchObject({ estado: 'programado', partida: base.partidas[0], descuento: 5, clienteNombre: 'Constructora Maya' });
    expect(sin[0].cotizacionId).toBeUndefined();
    expect(s.cotizaciones()).toHaveLength(cotizacionesAntes);
    const con = s.crearOrdenes(nueva, 'operaciones@epicoconcretos.mx', true);
    const c = s.cotizaciones()[0];
    expect(c.estado).toBe('pedido');
    expect(con.map((p) => p.cotizacionId)).toEqual([c.id, c.id]);
    expect(con[0].folio).not.toBe(sin[0].folio);
  });

  it('nueva basada en otra: queda ligada y las dos lo anotan; ocultar al cliente y enviar la vuelve visible', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    const base = s.cotizaciones().find((x) => x.id === 'EPI-PRES-ESC-26091')!;
    const c = s.crear({ clienteId: base.clienteId, plantaId: 'ESC', partidas: base.partidas.map((p) => ({ ...p, precioM3: 3000 })), descuento: undefined, baseId: base.id }, 'operaciones@epicoconcretos.mx');
    expect(c.baseId).toBe(base.id);
    expect(c.total).toBeLessThan(base.total);
    expect(h.de(registro.cotizacion(c.id))[0].texto).toBe(`Cotización creada a partir de ${base.folio}`);
    expect(h.de(registro.cotizacion(base.id))[0].texto).toBe(`Se creó ${c.folio} a partir de esta`);
    s.cambiarVisibilidad(base.id, false);
    expect(s.cotizaciones().find((x) => x.id === base.id)!.ocultaAlCliente).toBe(true);
    s.enviar(base.id, 'compras@grupohabita.mx', true);
    expect(s.cotizaciones().find((x) => x.id === base.id)!.ocultaAlCliente).toBeUndefined();
  });

  it('las órdenes nacen por cobrar, con su método de pago y sin enviar a planta; el cobro cambia y se anota', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    expect(s.pedidos().every((p) => p.cobro === 'por_cobrar')).toBe(true);
    const base = s.cotizaciones().find((x) => x.id === 'EPI-PRES-ESC-26092')!;
    const [o] = s.crearOrdenes({ clienteId: 'c-maya', plantaId: 'ESC', partidas: base.partidas, descuento: undefined }, 'operaciones@epicoconcretos.mx', false, 'transferencia');
    expect(o).toMatchObject({ cobro: 'por_cobrar', metodoPago: 'transferencia', estatusPlanta: 'no_enviado' });
    s.cambiarCobro(o.id, 'credito');
    expect(s.pedidos().find((p) => p.id === o.id)!.cobro).toBe('credito');
    expect(h.de(registro.pedido(o.folio))[0].cambios).toEqual([{ campo: 'Cobro', antes: 'Por cobrar', despues: 'Crédito' }]);
  });

  it('editar una orden recalcula su importe con su propia partida, la cotización no cambia y vuelve a planta', () => {
    const s = TestBed.inject(VentasService);
    const o = s.pedidos().find((p) => p.cotizacionId === 'EPI-PRES-ESC-26089')!; // 180 m³, ya enviado a planta
    const cot = s.cotizaciones().find((c) => c.id === o.cotizacionId)!;
    s.editarPedido(o.id, { fechaHoraEntrega: '2026-11-10T08:00:00-06:00', volumenM3: 90, metodoPago: 'transferencia' });
    const e = s.pedidos().find((p) => p.id === o.id)!;
    expect(e).toMatchObject({ volumenM3: 90, metodoPago: 'transferencia', estatusPlanta: 'enviado', fechaHoraEntrega: '2026-11-10T08:00:00-06:00' });
    expect(e.importe).toBeLessThan(o.importe);
    expect(e.partida!.volumenM3).toBe(90);
    expect(s.cotizaciones().find((c) => c.id === cot.id)!.partidas[0].volumenM3).toBe(180);
    // Entregada: ya no se edita
    const entregada = s.pedidos().find((p) => p.estado === 'entregado')!;
    s.editarPedido(entregada.id, { fechaHoraEntrega: entregada.fechaHoraEntrega, volumenM3: 1, metodoPago: 'sin_metodo' });
    expect(s.pedidos().find((p) => p.id === entregada.id)!.volumenM3).toBe(entregada.volumenM3);
  });

  it('planta: enviar, pedir actualización (aceptarla cambia la entrega y confirma), rechazar y reenviar', () => {
    const s = TestBed.inject(VentasService);
    const o = s.pedidos().find((p) => p.estatusPlanta === 'no_enviado')!;
    const p = () => s.pedidos().find((x) => x.id === o.id)!;
    s.estatusPlanta(o.id, 'enviado');
    s.estatusPlanta(o.id, 'actualizacion', { fecha: '2026-12-01T09:00:00-06:00', nota: 'Sin ollas ese día' });
    expect(p()).toMatchObject({ estatusPlanta: 'actualizacion', solicitudPlanta: { nota: 'Sin ollas ese día' } });
    s.estatusPlanta(o.id, 'confirmado');
    expect(p()).toMatchObject({ estatusPlanta: 'confirmado', fechaHoraEntrega: '2026-12-01T09:00:00-06:00' });
    expect(p().solicitudPlanta).toBeUndefined();
    s.estatusPlanta(o.id, 'rechazada', { nota: 'Planta en mantenimiento' });
    s.estatusPlanta(o.id, 'enviado');
    expect(p()).toMatchObject({ estatusPlanta: 'enviado' });
  });

  it('crear la deja en borrador, primera de la lista, con folio, vendedor y neto', () => {
    const s = TestBed.inject(VentasService);
    const base = s.cotizaciones().find((c) => c.id === 'EPI-PRES-ESC-26090')!;
    const c = s.crear({ clienteId: 'c-maya', plantaId: 'ESC', partidas: base.partidas, descuento: undefined }, 'operaciones@epicoconcretos.mx');
    expect(c).toMatchObject({ folio: 'EPI-PRES-ESC-26093', estado: 'borrador', revision: 0, clienteNombre: 'Constructora Maya', vendedorNombre: 'Operaciones' });
    expect(c.total).toBe(base.total);
    expect(s.cotizaciones()[0].id).toBe(c.id);
  });
});

describe('productos', () => {
  it('se buscan por código, nombre o categoría y se sabe dónde se usan', () => {
    expect(filtrarProductos(PRODUCTOS, 'servicio bomba').map((p) => p.id)).toEqual(['servicio-bomba-estacionaria', 'servicio-bomba-pluma']);
    expect(filtrarProductos(PRODUCTOS, 'CON-MR').every((p) => p.categoria === 'concreto-mr')).toBe(true);
    const s = TestBed.inject(VentasService);
    const uso = s.usoDe('fc-300');
    // f´c 300: Columnas y trabes (26092), Losa de cimentación (CZM-26041), Muelle (26040, 350 no), Losa del puente (26089)…
    expect(uso.cotizaciones.map((c) => c.folio)).toContain('EPI-PRES-ESC-26089');
    expect(uso.pedidos.map((p) => p.cotizacionId)).toContain('EPI-PRES-ESC-26089');
    expect(uso.m3).toBeGreaterThan(0);
    expect(s.usoDe('maquinaria-aplanadora').cotizaciones).toEqual([]);
  });

  it('alta de un producto general con su código sugerido y control de existencias', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    const usados = s.productos().map((p) => p.codigo);
    expect(codigoSugerido('general', 'Saco de cemento 50 kg', usados)).toBe('GEN-SACO-DE-CEMENTO-50-KG');
    expect(codigoSugerido('servicio', 'Bomba estacionaria', ['SRV-BOMBA-ESTACIONARIA'])).toBe('SRV-BOMBA-ESTACIONARIA-2');
    const saco = s.crearProducto({ tipo: 'general', codigo: 'gen-saco', nombre: 'Saco de cemento 50 kg', unidad: 'Saco', precio: 245, descripcion: '', existencias: 40, minimoExistencias: 10 });
    expect(saco).toMatchObject({ codigo: 'GEN-SACO', categoria: 'general', existencias: 40, minimoExistencias: 10 });
    expect(s.productos().at(-1)).toBe(saco);
    s.moverExistencias(saco.id, 'salida', 32, 'Venta de mostrador');
    const despues = s.productos().find((p) => p.id === saco.id)!;
    expect(despues.existencias).toBe(8);
    expect(existenciasBajas(despues)).toBe(true);
    expect(h.de(registro.producto(saco.id))[0]).toMatchObject({ texto: 'Salida de 32 saco', cambios: [{ campo: 'Existencias', antes: '40', despues: '8' }] });
    const flete = s.crearProducto({ tipo: 'servicio', codigo: 'SRV-FLETE', nombre: 'Flete', unidad: 'Viaje', precio: 900, descripcion: '' });
    expect(flete.existencias).toBeUndefined();
  });
});

describe('VentasService: de cotización a pedido', () => {
  it('confirmar genera un pedido por partida, ligado a ella, y la cotización pasa a pedido', () => {
    const s = TestBed.inject(VentasService);
    const c = s.cotizaciones().find((x) => x.id === 'EPI-PRES-ESC-26092')!;
    const nuevos = s.confirmar(c.id);
    expect(nuevos.map((p) => [p.folio, p.partidaId, p.obraNombre, p.estado])).toEqual([
      ['PED-26-0155', '1a', 'Torre Norte', 'programado'],
      ['PED-26-0156', '1b', 'Torre Norte', 'programado'],
    ]);
    // Los importes de sus pedidos suman el neto de la cotización
    expect(nuevos.reduce((t, p) => t + p.importe, 0)).toBe(c.total);
    expect(s.cotizaciones().find((x) => x.id === c.id)!.estado).toBe('pedido');
    expect(s.pedidosDe(c.id)).toHaveLength(2);
    expect(s.confirmar(c.id)).toEqual([]);
  });

  it('las cotizaciones demo que ya son pedido tienen los suyos; los de entregas pasadas, entregados', () => {
    const s = TestBed.inject(VentasService);
    for (const c of s.cotizaciones().filter((x) => x.estado === 'pedido')) expect(s.pedidosDe(c.id)).toHaveLength(c.partidas.length);
    expect(s.pedidosDe('EPI-PRES-ESC-26086')[0]).toMatchObject({ folio: 'PED-26-0151', estado: 'entregado', cobro: 'por_cobrar', estatusPlanta: 'confirmado' });
    expect(s.pedidosDe('EPI-PRES-ESC-26089')[0]).toMatchObject({ folio: 'PED-26-0153', estado: 'programado' });
  });
});

describe('búsquedas de órdenes y clientes', () => {
  it('órdenes: solo las de las plantas elegidas, por folio, cliente, obra o la cotización de la que salieron', () => {
    const s = TestBed.inject(VentasService);
    const folios = (plantas: string[], texto: string) => filtrarPedidos(s.pedidos(), plantas, texto).map((p) => p.folio);
    expect(folios(['ESC'], '')).toEqual(['PED-26-0153', 'PED-26-0152', 'PED-26-0151']);
    expect(folios(['ESC', 'CUN'], 'plaza centro')).toEqual(['PED-26-0154']);
    expect(folios(['ESC'], 'EPI-PRES-ESC-26086')).toEqual(['PED-26-0151']);
  });

  it('clientes: por nombre, razón social, RFC o contacto, sin importar acentos', () => {
    const ids = (texto: string) => filtrarClientes(CLIENTES, texto).map((c) => c.id);
    expect(ids('')).toHaveLength(6);
    expect(ids('caribe')).toEqual(['c-delta', 'c-sol']);
    expect(ids('CDC260101AA1')).toEqual(['c-delta']);
    expect(ids('canche')).toEqual(['c-habita']);
  });

  it('teléfonos legibles, con lada si la tienen', () => {
    expect(telefono('9811234567')).toBe('981 123 4567');
    expect(telefono('3055550142', '+1')).toBe('+1 305 555 0142');
    expect(telefono('')).toBe('');
  });
});

describe('historial de ventas', () => {
  it('guardar registra lo que cambió: precio del concreto, descuento y total, y los productos y servicios', () => {
    const s = TestBed.inject(VentasService);
    const antes = s.cotizaciones().find((c) => c.id === 'EPI-PRES-ESC-26092')!;
    const [losas, columnas] = antes.partidas;
    const nueva = { ...columnas, id: 'n1', nombre: 'Concreto MR 45 kg/cm²', volumenM3: 12, especificacion: especificacionBase('mr', 45) };
    s.guardar(antes.id, { partidas: [{ ...losas, precioM3: 3800, servicios: [] }, nueva], descuento: 5 });
    const [e] = TestBed.inject(HistorialService).de(registro.cotizacion(antes.id));
    expect(e.texto).toBe('Cambios guardados');
    expect(e.cambios).toEqual([
      { campo: 'Precio del concreto · Losas de entrepiso', antes: '$3,950.00', despues: '$3,800.00' },
      { campo: 'Descuento', antes: '0 %', despues: '5 %' },
      // 120 m³ × $3,800 + 12 m³ MR 45 × $4,450 = $509,400 − 5 % + IVA
      { campo: 'Total', antes: '$791,990.00', despues: '$561,358.80' },
    ]);
    expect(e.detalles).toEqual([
      'Servicios de Losas de entrepiso: − Bombeo de concreto',
      'Se agregó Concreto MR 45 kg/cm² · 12 m³',
      'Se quitó Columnas y trabes · 35 m³',
    ]);
  });

  it('confirmar queda en la cotización (estado y pedidos) y en cada pedido nuevo', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    s.confirmar('EPI-PRES-ESC-26092');
    expect(h.de(registro.cotizacion('EPI-PRES-ESC-26092'))[0]).toMatchObject({
      texto: 'Cotización confirmada',
      cambios: [{ campo: 'Estado', antes: 'Borrador', despues: 'Pedido' }],
      detalles: ['Generó los pedidos PED-26-0155, PED-26-0156'],
    });
    expect(h.de(registro.pedido('PED-26-0156'))[0].texto).toBe('Orden de venta creada desde la cotización EPI-PRES-ESC-26092');
  });

  it('los registros de ejemplo traen su historial, lo más reciente arriba', () => {
    TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    expect(h.de(registro.cotizacion('EPI-PRES-ESC-26086')).map((e) => e.texto)).toEqual([
      'Cotización confirmada',
      'Cotización enviada al cliente',
      'Cotización creada',
    ]);
    expect(h.de(registro.pedido('PED-26-0151')).map((e) => e.texto)).toEqual([
      'Entrega completada',
      'Orden de venta creada desde la cotización EPI-PRES-ESC-26086',
    ]);
    expect(h.de(registro.cliente('c-delta')).map((e) => e.texto)).toEqual(['Se conectó al portal de clientes', 'Cliente dado de alta']);
  });
});

describe('editar un cliente', () => {
  it('guarda los datos limpios, registra lo que cambió y su nombre cambia también en cotizaciones y pedidos', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    const antes = s.cliente('c-delta')!;
    s.guardarCliente('c-delta', {
      ...antes,
      nombre: 'Delta Constructora',
      empresa: { ...antes.empresa, rfc: ' cdc260101aa1 ' },
      contacto: { ...antes.contacto, telefono: '987 872 1199' },
    });
    const c = s.cliente('c-delta')!;
    expect([c.nombre, c.empresa.rfc, c.contacto.telefono, c.empresa.nombreComercial]).toEqual([
      'Delta Constructora',
      'CDC260101AA1',
      '9878721199',
      'Delta Constructora',
    ]);
    expect(s.cotizaciones().filter((q) => q.clienteId === 'c-delta').every((q) => q.clienteNombre === 'Delta Constructora')).toBe(true);
    expect(s.pedidos().filter((p) => p.clienteId === 'c-delta').every((p) => p.clienteNombre === 'Delta Constructora')).toBe(true);
    const [e] = h.de(registro.cliente('c-delta'));
    expect(e.texto).toBe('Datos del cliente actualizados');
    // El RFC solo cambió de forma (espacios y minúsculas): no cuenta como cambio
    expect(e.cambios).toEqual([
      { campo: 'Nombre comercial', antes: 'Constructora Delta', despues: 'Delta Constructora' },
      { campo: 'Teléfono del contacto', antes: '987 872 1144', despues: '987 872 1199' },
    ]);
  });

  it('agregar y quitar datos de facturación queda anotado; sin cambios no se registra nada', () => {
    const s = TestBed.inject(VentasService);
    const h = TestBed.inject(HistorialService);
    const antes = s.cliente('c-maya')!;
    const cuantos = h.de(registro.cliente('c-maya')).length;
    s.guardarCliente('c-maya', antes);
    expect(h.de(registro.cliente('c-maya'))).toHaveLength(cuantos);
    const nuevo = { ...antes.facturacion[0], id: 'f-nuevo', alias: 'Obra Norte', predeterminado: true };
    s.guardarCliente('c-maya', { ...antes, facturacion: [{ ...antes.facturacion[0], predeterminado: false }, nuevo] });
    const [e] = h.de(registro.cliente('c-maya'));
    expect(e.detalles).toEqual(['Se agregaron los datos de facturación Obra Norte']);
    expect(e.cambios).toEqual([{ campo: 'Facturación predeterminada', antes: 'Constructora Maya', despues: 'Obra Norte' }]);
  });
});
