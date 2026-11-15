import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuthService,
  CategoriaProducto,
  Cliente,
  Cotizacion,
  EstadoCobro,
  EstadoCotizacion,
  EstadoPedido,
  EstatusPlanta,
  Maquinaria,
  MetodoPago,
  Obra,
  PRODUCTOS,
  PartidaCotizacion,
  Pedido,
  ProductoTarifa,
  ServicioObra,
  conceptoConcreto,
  kmExtra,
  precioConcreto,
} from 'ui';
import { Cambio, EventoHistorial } from '../../core/historial';
import type { CambiosCliente, CambiosPedido, ClienteExpress, LugarEntrega, NuevaCotizacion, NuevoProducto, CambiosProducto } from './datos';
import { isoEnZona } from './datos';

/**
 * El backend de Ventas (/api/v1): lo que responde tiene la forma del esquema (dbml) y aquí se traduce a los modelos del
 * front (ui/models), que es lo que leen las pantallas. Las funciones de mapeo son puras (probadas en ventas-api.spec);
 * VentasApi hace las llamadas.
 *
 * Diferencias que resuelve:
 * - Plantas: el front usa el código (ESC); la API el id de la sucursal (de la sesión: empresas[].plantas[]).
 * - Productos: el front usa los ids del tarifario (fc-300, servicio-bomba-estacionaria) porque de ellos sale el cálculo
 *   de formato.ts; la API, uuid. Se cruzan por el código (CON-FC-300). Los dados de alta conservan su uuid.
 * - Servicios y maquinaria: en el front son claves; en la API, líneas con producto (SRV-…, REN-…).
 * - Fechas: la API en UTC; el front, ISO con el offset de la planta (lo que se muestra y se edita).
 * - Descuento: en el front %, en la API el importe (se manda descuentoPct).
 */

// ---------- Forma de la API ----------

interface Base {
  id: string;
  createdAt: string;
  updatedAt: string | null;
}
export interface ApiCliente extends Base {
  nombre: string;
  giro: string | null;
  correo: string | null;
  telefono: string | null;
  sitioWeb: string | null;
  esPublicoGeneral: boolean;
}
export interface ApiContacto extends Base {
  clienteId: string;
  nombre: string;
  apellidos: string | null;
  puesto: string | null;
  correo: string | null;
  telefono: string | null;
  principal: boolean;
  usuarioId: string | null;
}
export interface ApiDatoFiscal extends Base {
  clienteId: string;
  alias: string;
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  usoCfdi: string;
  codigoPostal: string;
  correo: string | null;
  direccionFiscal: string | null;
  predeterminado: boolean;
}
export interface ApiObra extends Base {
  clienteId: string;
  nombre: string;
  direccion: string;
  municipio: string | null;
  referencias: string | null;
  lat: number | null;
  lng: number | null;
  responsableNombre: string | null;
  contactos: { nombre: string; lada: string; numero: string }[] | null;
}
export interface ApiProducto extends Base {
  categoriaId: string;
  tipo: 'concreto' | 'servicio' | 'general';
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadId: string;
  precioLista: number;
  minimoCobro: number | null;
  controlaExistencias: boolean;
  minimoExistencias: number | null;
  concretoFc: string | null;
  concretoEdadDias: number | null;
  concretoRevenimientoCm: number | null;
  concretoSuministro: string | null;
  equipoTipo: string | null;
  activo: boolean;
}
export interface ApiCategoria {
  id: string;
  clave: string;
}
export interface ApiUnidad {
  id: string;
  clave: string;
  nombre: string;
}
export interface ApiExistencia {
  productoId: string;
  sucursalId: string;
  cantidad: number;
}
export interface ApiLinea {
  id: string;
  productoId: string;
  concepto: string;
  cantidad: number;
  dias: number | null;
  precioUnitario: number;
  importe: number;
}
export interface ApiPartida extends Base {
  orden: number;
  nombre: string;
  solucionId: string | null;
  tipoResistencia: 'fc' | 'mr';
  resistenciaKgCm2: number;
  edadDias: number;
  revenimientoCm: number;
  tmaMm: number;
  cemento: string;
  exposicion: string;
  colocacion: string;
  aditivos: string[];
  volumenM3: number;
  precioM3: number;
  entrega: string | null;
  trasladoDistanciaKm: number | null;
  trasladoIncluidosKm: number | null;
  trasladoPrecioKm: number | null;
  lineas: ApiLinea[];
}
export interface ApiCotizacion extends Base {
  sucursalId: string;
  clienteId: string | null;
  obraId: string | null;
  vendedorId: string | null;
  folio: string;
  serie: string;
  revision: number;
  baseId: string | null;
  estado: EstadoCotizacion;
  origen: 'erp' | 'portal';
  ocultaAlCliente: boolean;
  fecha: string;
  descuento: number;
  subtotal: number;
  total: number;
  partidas: ApiPartida[];
}
export interface ApiPedidoLinea {
  id: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}
export interface ApiPedido extends Base {
  sucursalId: string;
  clienteId: string;
  obraId: string;
  cotizacionId: string | null;
  partidaId: string | null;
  vendedorId: string | null;
  folio: string;
  fechaHoraEntrega: string;
  estado: EstadoPedido;
  cobro: EstadoCobro;
  metodoPago: MetodoPago;
  estatusPlanta: EstatusPlanta;
  solicitudPlantaFecha: string | null;
  solicitudPlantaNota: string | null;
  descuento: number;
  subtotal: number;
  total: number;
  lineas: ApiPedidoLinea[];
}
export interface ApiEvento {
  id: string;
  registroTipo: string;
  registroId: string;
  fecha: string;
  autorId: string | null;
  tipo: 'creado' | 'cambio' | 'eliminado' | 'restaurado' | 'nota' | 'mensaje' | 'actividad' | 'sistema';
  texto: string;
  detalles: string[] | null;
  cambios: { etiqueta: string; tipoDato: string; valorAnterior: string | null; valorNuevo: string | null }[];
}

// ---------- Contexto para traducir ----------

/** Lo que hace falta para traducir: plantas de la sesión y catálogos de productos. */
export interface Contexto {
  /** sucursalId → { código, zona } */
  plantas: Map<string, { codigo: string; zona: string }>;
  /** id de producto en la API → id en el front, y al revés. */
  productoFront: Map<string, string>;
  productoApi: Map<string, string>;
  /** código del producto (SRV-BOMBA-PLUMA) por id de la API. */
  codigoDe: Map<string, string>;
}

const ZONA_POR_OMISION = 'America/Mexico_City';
const enZona = (utc: string | null, zona: string) => (utc ? isoEnZona(zona, new Date(utc)) : '');
const aUtc = (iso: string | undefined) => (iso ? new Date(iso).toISOString() : null);
const redondear = (n: number) => Math.round(n * 100) / 100;

/** El id del tarifario del front que tiene ese código (CON-FC-300 → fc-300); si no hay, el uuid. */
export function idFront(p: Pick<ApiProducto, 'id' | 'codigo'>): string {
  return PRODUCTOS.find((x) => x.codigo === p.codigo)?.id ?? p.id;
}

export function contexto(empresas: { plantas: { id: string; codigo: string; zonaHoraria: string }[] }[], productos: ApiProducto[]): Contexto {
  const productoFront = new Map(productos.map((p) => [p.id, idFront(p)]));
  return {
    plantas: new Map(empresas.flatMap((e) => e.plantas).map((p) => [p.id, { codigo: p.codigo, zona: p.zonaHoraria }])),
    productoFront,
    productoApi: new Map([...productoFront].map(([api, front]) => [front, api])),
    codigoDe: new Map(productos.map((p) => [p.id, p.codigo])),
  };
}

const planta = (ctx: Contexto, sucursalId: string) => ctx.plantas.get(sucursalId) ?? { codigo: sucursalId, zona: ZONA_POR_OMISION };
const sucursalDe = (ctx: Contexto, codigo: string) => [...ctx.plantas].find(([, p]) => p.codigo === codigo)?.[0] ?? codigo;
const productoApi = (ctx: Contexto, frontId: string) => ctx.productoApi.get(frontId) ?? frontId;
const porCodigo = (ctx: Contexto, codigo: string) => [...ctx.codigoDe].find(([, c]) => c === codigo)?.[0] ?? codigo;

// ---------- API → front ----------

export function aCliente(c: ApiCliente, contactos: ApiContacto[], fiscales: ApiDatoFiscal[]): Cliente {
  const contacto = contactos.find((x) => x.principal) ?? contactos[0];
  const df = fiscales.find((x) => x.predeterminado) ?? fiscales[0];
  return {
    id: c.id,
    nombre: c.nombre,
    empresa: {
      razonSocial: df?.razonSocial ?? '',
      nombreComercial: c.nombre,
      rfc: df?.rfc ?? '',
      giro: c.giro ?? '',
      correo: c.correo ?? '',
      telefono: c.telefono ?? '',
      sitioWeb: c.sitioWeb ?? '',
      domicilioFiscal: df?.direccionFiscal ?? '',
      cargoRepresentante: contacto?.puesto ?? '',
    },
    contacto: {
      nombre: contacto?.nombre ?? '',
      apellidos: contacto?.apellidos ?? '',
      correo: contacto?.correo ?? '',
      telefono: contacto?.telefono ?? '',
      puesto: contacto?.puesto ?? '',
    },
    facturacion: fiscales.map((d) => ({
      id: d.id,
      alias: d.alias,
      razonSocial: d.razonSocial,
      rfc: d.rfc,
      regimenFiscal: d.regimenFiscal,
      codigoPostal: d.codigoPostal,
      usoCfdi: d.usoCfdi,
      correo: d.correo ?? '',
      direccionFiscal: d.direccionFiscal ?? '',
      predeterminado: d.predeterminado,
      documentos: [],
    })),
    portal: contactos.some((x) => x.usuarioId),
  };
}

export function aObra(o: ApiObra): Obra {
  return {
    id: o.id,
    clienteId: o.clienteId,
    nombre: o.nombre,
    direccion: o.direccion,
    municipio: o.municipio ?? '',
    ...(o.referencias ? { referencias: o.referencias } : {}),
    ...(o.lat != null && o.lng != null ? { ubicacion: { lat: o.lat, lng: o.lng } } : {}),
    responsable: { nombre: o.responsableNombre ?? '' },
    contactos: o.contactos ?? [],
  };
}

export function aProducto(p: ApiProducto, categorias: Map<string, string>, unidades: Map<string, string>, existencias: number | undefined): ProductoTarifa {
  return {
    id: idFront(p),
    codigo: p.codigo,
    nombre: p.nombre,
    categoria: (categorias.get(p.categoriaId) ?? p.tipo) as CategoriaProducto,
    unidad: unidades.get(p.unidadId) ?? '',
    precio: p.precioLista,
    ...(p.minimoCobro != null ? { minimo: p.minimoCobro } : {}),
    descripcion: p.descripcion,
    ...(p.controlaExistencias ? { existencias: existencias ?? 0, minimoExistencias: p.minimoExistencias ?? 0 } : {}),
    // Solo los dados de alta (los del tarifario conservan su id del front y no se configuran).
    ...(p.concretoFc && p.concretoRevenimientoCm != null && p.concretoSuministro && idFront(p) === p.id
      ? { configuracion: { fc: p.concretoFc, edad: String(p.concretoEdadDias ?? 28), rev: String(p.concretoRevenimientoCm), suministro: p.concretoSuministro } }
      : {}),
    // shortcut: las unidades conectadas (producto-equipos) aún no se leen: se muestra el tipo, sin unidades.
    ...(p.equipoTipo ? { equipo: { tipo: p.equipoTipo.replace(/_/g, '-'), unidades: [] } } : {}),
  };
}

/** Partida de la API → la del front: especificación anidada, servicios y maquinaria como claves, entrega en la planta. */
export function aPartida(p: ApiPartida, obraId: string, zona: string, ctx: Contexto): PartidaCotizacion {
  const servicios: ServicioObra[] = [];
  const maquinaria: { tipo: Maquinaria; dias: number }[] = [];
  for (const l of p.lineas) {
    const codigo = ctx.codigoDe.get(l.productoId) ?? '';
    if (codigo.startsWith('REN-')) maquinaria.push({ tipo: codigo.slice(4).toLowerCase() as Maquinaria, dias: l.dias ?? l.cantidad });
    else if (codigo.startsWith('SRV-') && codigo !== 'SRV-TRASLADO') servicios.push(codigo.slice(4).toLowerCase() as ServicioObra);
  }
  if (maquinaria.length) servicios.push('renta-maquinaria');
  const partida: PartidaCotizacion = {
    id: p.id,
    nombre: p.nombre,
    solucionId: p.solucionId ?? '',
    especificacion: {
      tipoResistencia: p.tipoResistencia,
      resistenciaKgCm2: p.resistenciaKgCm2,
      edadDias: p.edadDias,
      revenimientoCm: p.revenimientoCm,
      tmaMm: p.tmaMm,
      cemento: p.cemento as PartidaCotizacion['especificacion']['cemento'],
      exposicion: p.exposicion as PartidaCotizacion['especificacion']['exposicion'],
      colocacion: p.colocacion as PartidaCotizacion['especificacion']['colocacion'],
      aditivos: p.aditivos as PartidaCotizacion['especificacion']['aditivos'],
    },
    volumenM3: p.volumenM3,
    servicios,
    maquinaria,
    obraId,
    entrega: enZona(p.entrega, zona),
    ...(p.trasladoDistanciaKm != null
      ? { traslado: { distanciaKm: p.trasladoDistanciaKm, incluidosKm: p.trasladoIncluidosKm ?? 0, precioKm: p.trasladoPrecioKm ?? 0 } }
      : {}),
  };
  // La API siempre devuelve el precio; en el front solo va si es especial (distinto del de tarifa).
  return p.precioM3 !== precioConcreto(partida) ? { ...partida, precioM3: p.precioM3 } : partida;
}

export function aCotizacion(c: ApiCotizacion, ctx: Contexto): Cotizacion {
  const { codigo, zona } = planta(ctx, c.sucursalId);
  return {
    id: c.id,
    folio: c.folio,
    fecha: enZona(c.fecha, zona),
    serie: c.serie,
    revision: c.revision,
    ...(c.baseId ? { baseId: c.baseId } : {}),
    // El front guarda el % (la API, el importe)
    ...(c.descuento && c.subtotal ? { descuento: redondear((c.descuento / c.subtotal) * 100) } : {}),
    partidas: [...c.partidas].sort((a, b) => a.orden - b.orden).map((p) => aPartida(p, c.obraId ?? '', zona, ctx)),
    plantaId: codigo,
    clienteId: c.clienteId ?? '',
    vendedorId: c.vendedorId ?? '',
    estado: c.estado,
    ...(c.origen === 'portal' ? { origen: 'portal' as const } : {}),
    ...(c.ocultaAlCliente ? { ocultaAlCliente: true } : {}),
  };
}

export function aPedido(p: ApiPedido, ctx: Contexto): Pedido {
  const { codigo, zona } = planta(ctx, p.sucursalId);
  // La línea del concreto es la de m³ que no es servicio (la primera de concreto)
  const concreto = p.lineas.find((l) => (ctx.codigoDe.get(l.productoId) ?? '').startsWith('CON-')) ?? p.lineas[0];
  return {
    id: p.id,
    folio: p.folio,
    clienteId: p.clienteId,
    plantaId: codigo,
    obraId: p.obraId,
    producto: concreto?.descripcion ?? '',
    volumenM3: concreto?.cantidad ?? 0,
    fechaHoraEntrega: enZona(p.fechaHoraEntrega, zona),
    estado: p.estado,
    ...(p.cotizacionId ? { cotizacionId: p.cotizacionId } : {}),
    ...(p.partidaId ? { partidaId: p.partidaId } : {}),
    importe: p.total,
    cobro: p.cobro,
    metodoPago: p.metodoPago,
    estatusPlanta: p.estatusPlanta,
    ...(p.solicitudPlantaFecha || p.solicitudPlantaNota
      ? { solicitudPlanta: { ...(p.solicitudPlantaFecha ? { fecha: enZona(p.solicitudPlantaFecha, zona) } : {}), nota: p.solicitudPlantaNota ?? '' } }
      : {}),
    ...(p.descuento && p.subtotal ? { descuento: redondear((p.descuento / p.subtotal) * 100) } : {}),
  };
}

const CREADO: Record<string, string> = {
  Cotizacion: 'Cotización creada',
  CotizacionPartida: 'Producto agregado',
  CotizacionLinea: 'Servicio agregado',
  Pedido: 'Orden de venta creada',
  PedidoLinea: 'Línea agregada',
  Cliente: 'Cliente dado de alta',
  ClienteContacto: 'Contacto agregado',
  ClienteDatoFiscal: 'Datos de facturación agregados',
  Obra: 'Obra agregada',
  Producto: 'Producto dado de alta',
};

/** Un evento de la API → el del historial del front. `nombre` traduce ids (cliente, obra, usuario…) a lo que se lee. */
export function aEvento(e: ApiEvento, registro: string, nombre: (id: string) => string | undefined): EventoHistorial {
  const valor = (v: string | null) => (v == null || v === '' ? '—' : (nombre(v) ?? v));
  const cambios: Cambio[] = e.cambios.map((c) => ({ campo: c.etiqueta, antes: valor(c.valorAnterior), despues: valor(c.valorNuevo) }));
  return {
    id: e.id,
    registro,
    fecha: e.fecha,
    autor: (e.autorId && nombre(e.autorId)) || 'Sistema',
    texto: e.tipo === 'creado' ? (CREADO[e.registroTipo] ?? e.texto) : e.texto,
    ...(e.detalles?.length ? { detalles: e.detalles } : {}),
    ...(cambios.length ? { cambios } : {}),
    ...(e.tipo === 'nota' ? { nota: true } : {}),
    ...(e.tipo === 'actividad' ? { actividad: true } : {}),
  };
}

// ---------- front → API ----------

/** Servicios y maquinaria de la partida como líneas con su producto (cantidad en m³ si el servicio va por m³). */
export function lineasDe(p: PartidaCotizacion, ctx: Contexto, unidadDe: (frontId: string) => string) {
  return [
    ...p.servicios
      .filter((s) => s !== 'renta-maquinaria')
      .map((s) => {
        const id = `servicio-${s}`;
        return { productoId: productoApi(ctx, id), cantidad: unidadDe(id) === 'M³' ? p.volumenM3 : 1 };
      }),
    ...p.maquinaria.map((m) => ({ productoId: productoApi(ctx, `maquinaria-${m.tipo}`), cantidad: 1, dias: m.dias })),
  ];
}

/** `existentes`: ids de las partidas que ya están en el backend (solo esas se mandan con id: se editan). */
export function partidaApi(p: PartidaCotizacion, i: number, ctx: Contexto, unidadDe: (frontId: string) => string, existentes = new Set<string>()) {
  const e = p.especificacion;
  return {
    ...(existentes.has(p.id) ? { id: p.id } : {}),
    orden: i,
    nombre: p.nombre,
    solucionId: p.solucionId || null,
    tipoResistencia: e.tipoResistencia,
    resistenciaKgCm2: e.resistenciaKgCm2,
    edadDias: e.edadDias,
    revenimientoCm: e.revenimientoCm,
    tmaMm: e.tmaMm,
    cemento: e.cemento,
    exposicion: e.exposicion,
    colocacion: e.colocacion,
    aditivos: e.aditivos,
    volumenM3: p.volumenM3,
    precioM3: p.precioM3 ?? null,
    entrega: aUtc(p.entrega),
    trasladoDistanciaKm: p.traslado?.distanciaKm ?? null,
    trasladoIncluidosKm: p.traslado?.incluidosKm ?? null,
    trasladoPrecioKm: p.traslado?.precioKm ?? null,
    lineas: lineasDe(p, ctx, unidadDe),
  };
}

/** Cuerpo de POST/PUT /cotizaciones. La API tiene una obra por cotización: la de la primera partida. */
export function cotizacionApi(n: NuevaCotizacion, ctx: Contexto, unidadDe: (frontId: string) => string, extra: object = {}, existentes?: Set<string>) {
  return {
    sucursalId: sucursalDe(ctx, n.plantaId),
    clienteId: n.clienteId || null,
    obraId: n.partidas.find((p) => p.obraId)?.obraId || null,
    descuentoPct: n.descuento ?? 0,
    ...(n.baseId ? { baseId: n.baseId } : {}),
    partidas: n.partidas.map((p, i) => partidaApi(p, i, ctx, unidadDe, existentes)),
    ...extra,
  };
}

/** Orden directa (sin cotización): la partida como líneas de pedido: concreto, traslado, servicios y maquinaria. */
export function pedidoApi(n: NuevaCotizacion, p: PartidaCotizacion, metodoPago: MetodoPago, ctx: Contexto, unidadDe: (frontId: string) => string) {
  const concreto = `${p.especificacion.tipoResistencia}-${p.especificacion.resistenciaKgCm2}`;
  const extra = p.traslado ? kmExtra(p.traslado) : 0;
  return {
    sucursalId: sucursalDe(ctx, n.plantaId),
    clienteId: n.clienteId,
    obraId: p.obraId,
    fechaHoraEntrega: aUtc(p.entrega),
    metodoPago,
    descuentoPct: n.descuento ?? 0,
    lineas: [
      { productoId: productoApi(ctx, concreto), descripcion: `${p.nombre}: ${conceptoConcreto(p)}`, cantidad: p.volumenM3, precioUnitario: p.precioM3 ?? precioConcreto(p) },
      ...(p.traslado && extra > 0 && p.traslado.precioKm > 0
        ? [{ productoId: porCodigo(ctx, 'SRV-TRASLADO'), descripcion: `Traslado adicional: ${extra} km`, cantidad: p.volumenM3, precioUnitario: redondear(extra * p.traslado.precioKm) }]
        : []),
      ...lineasDe(p, ctx, unidadDe).map((l) => ({ productoId: l.productoId, cantidad: 'dias' in l ? l.dias : l.cantidad })),
    ],
  };
}

// ---------- Llamadas ----------

const BASE = '/api/v1';

export interface Datos {
  ctx: Contexto;
  clientes: Cliente[];
  obras: Obra[];
  productos: ProductoTarifa[];
  cotizaciones: Cotizacion[];
  pedidos: Pedido[];
  /** id → nombre de usuarios, clientes, obras, plantas y productos (para el historial y los vendedores). */
  nombres: Map<string, string>;
  /** El cliente de mostrador ("Público en general"), si ya existe. */
  publicoGeneralId: string | null;
}

@Service()
export class VentasApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  /** Las líneas de cada pedido, para editarlo (PUT manda el registro completo). */
  private readonly lineasPedido = new Map<string, ApiPedidoLinea[]>();
  private apiPedidos = new Map<string, ApiPedido>();

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(BASE + ruta));
  }
  private post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(BASE + ruta, cuerpo));
  }
  private put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(BASE + ruta, cuerpo));
  }

  /**
   * Todo lo de Ventas de una vez.
   * shortcut: trae hasta 500 de cada lista y el detalle de cada cotización (N peticiones); con más volumen, paginar y
   * pedir el detalle al abrirla.
   */
  async cargar(): Promise<Datos> {
    const [clientes, contactos, fiscales, obras, productos, categorias, unidades, existencias, encabezados, pedidos, usuarios] = await Promise.all([
      this.get<ApiCliente[]>('/clientes?take=500'),
      this.get<ApiContacto[]>('/cliente-contactos?take=500'),
      this.get<ApiDatoFiscal[]>('/cliente-datos-fiscales?take=500'),
      this.get<ApiObra[]>('/obras?take=500'),
      this.get<ApiProducto[]>('/productos?take=500'),
      this.get<ApiCategoria[]>('/categorias-producto?take=500'),
      this.get<ApiUnidad[]>('/unidades-medida?take=500'),
      this.get<ApiExistencia[]>('/existencias?take=500').catch(() => [] as ApiExistencia[]),
      this.get<ApiCotizacion[]>('/cotizaciones?take=500'),
      this.get<ApiPedido[]>('/pedidos?take=500'),
      // Sin permiso de ver usuarios, los vendedores salen sin nombre
      this.get<{ id: string; nombre: string; apellidos: string | null }[]>('/usuarios?take=500').catch(() => []),
    ]);
    const cotizaciones = await Promise.all(encabezados.map((c) => this.get<ApiCotizacion>(`/cotizaciones/${c.id}`)));
    const pedidosCompletos = await Promise.all(pedidos.map((p) => this.get<ApiPedido>(`/pedidos/${p.id}`)));
    const ctx = contexto(this.auth.sesion()?.empresas ?? [], productos);
    const cats = new Map(categorias.map((c) => [c.id, c.clave]));
    const uds = new Map(unidades.map((u) => [u.id, u.nombre]));
    const stock = new Map<string, number>();
    for (const e of existencias) stock.set(e.productoId, (stock.get(e.productoId) ?? 0) + e.cantidad);
    this.apiPedidos = new Map(pedidosCompletos.map((p) => [p.id, p]));

    const nombres = new Map<string, string>([
      ...usuarios.map((u): [string, string] => [u.id, [u.nombre, u.apellidos].filter(Boolean).join(' ')]),
      ...clientes.map((c): [string, string] => [c.id, c.nombre]),
      ...obras.map((o): [string, string] => [o.id, o.nombre]),
      ...productos.map((p): [string, string] => [p.id, p.nombre]),
      ...[...ctx.plantas].map(([id, p]): [string, string] => [id, p.codigo]),
    ]);
    const sesion = this.auth.sesion();
    if (sesion?.usuario.id) nombres.set(sesion.usuario.id, sesion.usuario.nombre);

    return {
      ctx,
      nombres,
      publicoGeneralId: clientes.find((c) => c.esPublicoGeneral)?.id ?? null,
      clientes: clientes.map((c) =>
        aCliente(
          c,
          contactos.filter((x) => x.clienteId === c.id),
          fiscales.filter((x) => x.clienteId === c.id),
        ),
      ),
      obras: obras.map(aObra),
      productos: productos.filter((p) => p.activo).map((p) => aProducto(p, cats, uds, stock.get(p.id))),
      cotizaciones: cotizaciones.map((c) => aCotizacion(c, ctx)),
      pedidos: pedidosCompletos.map((p) => aPedido(p, ctx)),
    };
  }

  async cotizacion(id: string, ctx: Contexto): Promise<Cotizacion> {
    return aCotizacion(await this.get<ApiCotizacion>(`/cotizaciones/${id}`), ctx);
  }

  async pedido(id: string, ctx: Contexto): Promise<Pedido> {
    const p = await this.get<ApiPedido>(`/pedidos/${id}`);
    this.apiPedidos.set(p.id, p);
    return aPedido(p, ctx);
  }

  async crearCotizacion(n: NuevaCotizacion, ctx: Contexto, unidadDe: (id: string) => string, extra: object = {}): Promise<Cotizacion> {
    return aCotizacion(await this.post<ApiCotizacion>('/cotizaciones', cotizacionApi(n, ctx, unidadDe, extra)), ctx);
  }

  async guardarCotizacion(id: string, n: NuevaCotizacion, existentes: Set<string>, ctx: Contexto, unidadDe: (id: string) => string): Promise<Cotizacion> {
    return aCotizacion(await this.put<ApiCotizacion>(`/cotizaciones/${id}`, cotizacionApi(n, ctx, unidadDe, {}, existentes)), ctx);
  }

  enviar(id: string): Promise<unknown> {
    return this.post(`/cotizaciones/${id}/enviar`);
  }

  ocultar(id: string, oculta: boolean): Promise<unknown> {
    return this.post(`/cotizaciones/${id}/ocultar`, { oculta });
  }

  async confirmar(id: string, ctx: Contexto): Promise<Pedido[]> {
    const pedidos = await this.post<ApiPedido[]>(`/cotizaciones/${id}/confirmar`);
    for (const p of pedidos) this.apiPedidos.set(p.id, p);
    return pedidos.map((p) => aPedido(p, ctx));
  }

  async crearPedido(cuerpo: object, ctx: Contexto): Promise<Pedido> {
    const p = await this.post<ApiPedido>('/pedidos', cuerpo);
    this.apiPedidos.set(p.id, p);
    return aPedido(p, ctx);
  }

  /** Entrega, volumen, precio del concreto y método de pago: las líneas por m³ siguen al volumen. */
  async editarPedido(id: string, c: CambiosPedido, ctx: Contexto): Promise<Pedido> {
    const antes = this.apiPedidos.get(id) ?? (await this.get<ApiPedido>(`/pedidos/${id}`));
    const volumenAntes = (antes.lineas.find((l) => (ctx.codigoDe.get(l.productoId) ?? '').startsWith('CON-')) ?? antes.lineas[0])?.cantidad;
    const p = await this.put<ApiPedido>(`/pedidos/${id}`, {
      sucursalId: antes.sucursalId,
      clienteId: antes.clienteId,
      obraId: antes.obraId,
      vendedorId: antes.vendedorId,
      fechaHoraEntrega: aUtc(c.fechaHoraEntrega),
      metodoPago: c.metodoPago,
      descuentoPct: antes.subtotal ? redondear((antes.descuento / antes.subtotal) * 100) : 0,
      lineas: antes.lineas.map((l) => {
        const esConcreto = (ctx.codigoDe.get(l.productoId) ?? '').startsWith('CON-');
        return {
          productoId: l.productoId,
          descripcion: l.descripcion,
          cantidad: l.cantidad === volumenAntes ? c.volumenM3 : l.cantidad,
          precioUnitario: esConcreto && c.precioM3 != null ? c.precioM3 : l.precioUnitario,
        };
      }),
    });
    this.apiPedidos.set(p.id, p);
    return aPedido(p, ctx);
  }

  async accionPedido(id: string, accion: 'cobro' | 'metodo-pago' | 'planta', cuerpo: object, ctx: Contexto): Promise<Pedido> {
    await this.post(`/pedidos/${id}/${accion}`, cuerpo);
    return this.pedido(id, ctx);
  }

  async crearCliente(d: ClienteExpress): Promise<{ cliente: ApiCliente; contacto: ApiContacto }> {
    const correo = d.correo.trim();
    const telefono = d.telefono.replace(/\D/g, '');
    const cliente = await this.post<ApiCliente>('/clientes', { nombre: d.nombre.trim(), correo: correo || null, telefono: telefono || null, esPublicoGeneral: false, diasCredito: 0 });
    const contacto = await this.post<ApiContacto>('/cliente-contactos', {
      clienteId: cliente.id,
      nombre: d.contacto.trim() || d.nombre.trim(),
      correo: correo || null,
      telefono: telefono || null,
      principal: true,
    });
    return { cliente, contacto };
  }

  crearPublicoGeneral(): Promise<ApiCliente> {
    return this.post<ApiCliente>('/clientes', { nombre: 'Público en general', esPublicoGeneral: true, diasCredito: 0 });
  }

  async crearObra(clienteId: string, d: LugarEntrega): Promise<Obra> {
    const contacto = d.contacto.trim();
    return aObra(
      await this.post<ApiObra>('/obras', {
        clienteId,
        nombre: d.nombre.trim() || 'Entrega a domicilio',
        direccion: d.direccion.trim(),
        municipio: d.municipio.trim() || null,
        referencias: d.referencias.trim() || null,
        lat: d.ubicacion?.lat ?? null,
        lng: d.ubicacion?.lng ?? null,
        responsableNombre: contacto || null,
        contactos: contacto ? [{ nombre: contacto, lada: '+52', numero: d.telefono.replace(/\D/g, '') }] : [],
      }),
    );
  }

  /** El cliente, su contacto principal y sus datos de facturación (se editan, se agregan o se borran). */
  async guardarCliente(id: string, c: CambiosCliente): Promise<Cliente> {
    const [cliente, contactos, fiscales] = await Promise.all([
      this.get<ApiCliente & Record<string, unknown>>(`/clientes/${id}`),
      this.get<ApiContacto[]>(`/cliente-contactos?clienteId=${id}`),
      this.get<ApiDatoFiscal[]>(`/cliente-datos-fiscales?clienteId=${id}`),
    ]);
    await this.put(`/clientes/${id}`, {
      ...cliente,
      nombre: c.nombre,
      giro: c.empresa.giro || null,
      correo: c.empresa.correo || null,
      telefono: c.empresa.telefono || null,
      sitioWeb: c.empresa.sitioWeb || null,
    });
    const principal = contactos.find((x) => x.principal) ?? contactos[0];
    const contacto = {
      clienteId: id,
      nombre: c.contacto.nombre,
      apellidos: c.contacto.apellidos || null,
      puesto: c.contacto.puesto || null,
      correo: c.contacto.correo || null,
      telefono: c.contacto.telefono || null,
      principal: true,
    };
    if (principal) await this.put(`/cliente-contactos/${principal.id}`, { ...principal, ...contacto });
    else if (c.contacto.nombre) await this.post('/cliente-contactos', contacto);
    for (const f of c.facturacion) {
      const cuerpo = {
        clienteId: id,
        alias: f.alias,
        razonSocial: f.razonSocial,
        rfc: f.rfc,
        regimenFiscal: f.regimenFiscal,
        usoCfdi: f.usoCfdi,
        codigoPostal: f.codigoPostal,
        correo: f.correo || null,
        direccionFiscal: f.direccionFiscal || null,
        predeterminado: f.predeterminado,
      };
      const existe = fiscales.find((x) => x.id === f.id);
      if (existe) await this.put(`/cliente-datos-fiscales/${f.id}`, { ...existe, ...cuerpo });
      else await this.post('/cliente-datos-fiscales', cuerpo);
    }
    for (const f of fiscales.filter((x) => !c.facturacion.some((y) => y.id === x.id))) {
      await firstValueFrom(this.http.delete(`${BASE}/cliente-datos-fiscales/${f.id}`));
    }
    const [cli, cts, fis] = await Promise.all([
      this.get<ApiCliente>(`/clientes/${id}`),
      this.get<ApiContacto[]>(`/cliente-contactos?clienteId=${id}`),
      this.get<ApiDatoFiscal[]>(`/cliente-datos-fiscales?clienteId=${id}`),
    ]);
    return aCliente(cli, cts, fis);
  }

  /** Alta o edición de un producto; devuelve el id de la API. */
  async guardarProducto(
    id: string | null,
    n: (NuevoProducto | (CambiosProducto & { tipo?: NuevoProducto['tipo'] })) & { tipo?: NuevoProducto['tipo'] },
    catalogos: { categorias: ApiCategoria[]; unidades: ApiUnidad[] },
  ): Promise<string> {
    const antes = id ? await this.get<ApiProducto & Record<string, unknown>>(`/productos/${id}`) : null;
    const tipo = n.tipo ?? antes?.tipo ?? 'general';
    const categoria = catalogos.categorias.find((c) => c.clave === tipo) ?? catalogos.categorias.find((c) => c.id === antes?.categoriaId);
    const unidad = catalogos.unidades.find((u) => u.nombre === n.unidad) ?? catalogos.unidades.find((u) => u.id === antes?.unidadId);
    const cfg = n.configuracion;
    const cuerpo = {
      ...(antes ?? {}),
      categoriaId: categoria?.id ?? antes?.categoriaId,
      tipo,
      codigo: n.codigo,
      nombre: n.nombre,
      descripcion: n.descripcion,
      unidadId: unidad?.id ?? antes?.unidadId,
      precioLista: n.precio,
      monedaCodigo: 'MXN',
      controlaExistencias: tipo === 'general',
      minimoExistencias: n.minimoExistencias ?? null,
      concretoFc: cfg?.fc ?? null,
      concretoEdadDias: cfg ? Number(cfg.edad) : null,
      concretoRevenimientoCm: cfg ? Number(cfg.rev) : null,
      concretoSuministro: cfg?.suministro ?? null,
      equipoTipo: n.equipo?.tipo ? n.equipo.tipo.replace(/-/g, '_') : null,
      activo: true,
    };
    const p = id ? await this.put<ApiProducto>(`/productos/${id}`, cuerpo) : await this.post<ApiProducto>('/productos', cuerpo);
    return p.id;
  }

  catalogosProducto(): Promise<[ApiCategoria[], ApiUnidad[]]> {
    return Promise.all([this.get<ApiCategoria[]>('/categorias-producto?take=500'), this.get<ApiUnidad[]>('/unidades-medida?take=500')]);
  }

  /** Entrada o salida en la planta en sesión (la existencia vive por planta en la API). */
  moverExistencias(productoId: string, sucursalId: string, tipo: 'entrada' | 'salida', cantidad: number): Promise<unknown> {
    return this.post('/movimientos-inventario', { productoId, sucursalId, tipo, cantidad });
  }

  historial(tipo: string, id: string): Promise<ApiEvento[]> {
    return this.get<ApiEvento[]>(`/historial/${tipo}/${id}`);
  }

  nota(tipo: string, id: string, texto: string): Promise<unknown> {
    return this.post(`/historial/${tipo}/${id}/notas`, { texto });
  }
}
