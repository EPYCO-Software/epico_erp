import { CategoriaProducto, PRODUCTOS, ProductoTarifa, conceptoConcreto, kmExtra, precioConcreto } from '../cotizacion/formato';
import { Cliente } from '../models/cliente';
import { Cotizacion, EstadoCotizacion, Maquinaria, PartidaCotizacion, ServicioObra } from '../models/cotizacion';
import { LugarDeEntrega, Obra, idLugar } from '../models/obra';
import { EstadoCobro, EstadoPedido, EstatusPlanta, MetodoPago, Pedido, ReagendaPendiente, TiemposViaje } from '../models/pedido';
import { isoEnZona } from '../time/zona';

/** Lo que se manda al crear una cotización. `baseId`: la cotización de la que se partió, para comparar precios. */
export type NuevaCotizacion = Pick<Cotizacion, 'clienteId' | 'plantaId' | 'partidas' | 'descuento' | 'baseId' | 'reemplazaId' | 'lugar'>;

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
  limiteCredito?: number | null;
  diasCredito?: number;
  limiteCotizaciones?: number | null;
  limiteObras?: number | null;
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
  /** null = obra general (sin cliente). */
  clienteId: string | null;
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
  /** Concretos: soluciones del cotizador (pavimento, losa…). */
  soluciones?: string[] | null;
  categoriaId: string;
  tipo: 'concreto' | 'servicio' | 'general';
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadId: string;
  precioLista: number;
  minimoCobro: number | null;
  /** Lo menos que se puede pedir, en su unidad. */
  pedidoMinimo?: number | null;
  /** Minutos de servicio por viaje (descarga, bombeo o uso). */
  tiempoServicioMin?: number | null;
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
  /** Pedido especial: sin producto; precioM3 null mientras Ventas no lo cotice. */
  especial?: boolean;
  lineas: ApiLinea[];
}
/** El lugar de entrega sin obra, como lo guarda el backend (cotización y pedido). */
interface ApiEntrega {
  entregaDireccion?: string | null;
  entregaMunicipio?: string | null;
  entregaReferencias?: string | null;
  entregaLat?: number | null;
  entregaLng?: number | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
}

/** El lugar de entrega de la API, si lo tiene (sin obra). */
export function lugarDe(e: ApiEntrega): LugarDeEntrega | undefined {
  if (!e.entregaDireccion) return undefined;
  return {
    direccion: e.entregaDireccion,
    municipio: e.entregaMunicipio ?? '',
    ...(e.entregaReferencias ? { referencias: e.entregaReferencias } : {}),
    ...(e.entregaLat != null && e.entregaLng != null ? { ubicacion: { lat: e.entregaLat, lng: e.entregaLng } } : {}),
    contacto: e.contactoNombre ?? '',
    telefono: e.contactoTelefono ?? '',
  };
}

/** El lugar para la API (obraId va null); sin lugar, los campos en null. */
export function entregaApi(l: LugarDeEntrega | undefined) {
  return {
    entregaDireccion: l?.direccion.trim() || null,
    entregaMunicipio: l?.municipio.trim() || null,
    entregaReferencias: l?.referencias?.trim() || null,
    entregaLat: l?.ubicacion?.lat ?? null,
    entregaLng: l?.ubicacion?.lng ?? null,
    ...(l ? { contactoNombre: l.contacto.trim() || null, contactoTelefono: l.telefono.replace(/\D/g, '') || null } : {}),
  };
}

export interface ApiCotizacion extends Base, ApiEntrega {
  sucursalId: string;
  clienteId: string | null;
  obraId: string | null;
  vendedorId: string | null;
  folio: string;
  serie: string;
  revision: number;
  baseId: string | null;
  reemplazaId?: string | null;
  reemplazadaPorId?: string | null;
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
export interface ApiPedido extends Base, ApiEntrega {
  sucursalId: string;
  clienteId: string;
  /** null con lugar de entrega. */
  obraId: string | null;
  cotizacionId: string | null;
  partidaId: string | null;
  vendedorId: string | null;
  folio: string;
  fechaHoraEntrega: string;
  estado: EstadoPedido;
  cobro: EstadoCobro;
  creditoDesde?: string | null;
  confirmadaEn?: string | null;
  confirmadaPorId?: string | null;
  /** Números económicos de las unidades asignadas (sus viajes) y los m³ que ya llevan. */
  unidades?: string[] | null;
  m3Asignados?: number | null;
  tiempos?: TiemposViaje | null;
  reagendaPendiente?: ReagendaPendiente | null;
  clienteTieneCorreo?: boolean | null;
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
  /** El backend lo manda como texto JSON ('["Fecha límite: …"]'); se acepta también la lista. */
  detalles: string | string[] | null;
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
export const aUtc = (iso: string | undefined) => (iso ? new Date(iso).toISOString() : null);
export const redondear = (n: number) => Math.round(n * 100) / 100;

/** El id del tarifario del front que tiene ese código (CON-FC-300 → fc-300); si no hay, el uuid. */
export function idFront(p: Pick<ApiProducto, 'id' | 'codigo'>): string {
  // Los aditivos dados de alta, como los del tarifario: 'aditivo-' + su clave (partidaUsa los encuentra así)
  const aditivo = /^AJ-ADT-(.+)$/.exec(p.codigo);
  return PRODUCTOS.find((x) => x.codigo === p.codigo)?.id ?? (aditivo ? 'aditivo-' + aditivo[1].toLowerCase() : p.id);
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
export const sucursalDe = (ctx: Contexto, codigo: string) => [...ctx.plantas].find(([, p]) => p.codigo === codigo)?.[0] ?? codigo;
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
    limites: { cotizaciones: c.limiteCotizaciones ?? null, obras: c.limiteObras ?? null },
    credito: { limite: c.limiteCredito ?? null, dias: c.diasCredito ?? 0 },
  };
}

export function aObra(o: ApiObra): Obra {
  return {
    id: o.id,
    clienteId: o.clienteId ?? '',
    nombre: o.nombre,
    direccion: o.direccion,
    municipio: o.municipio ?? '',
    ...(o.referencias ? { referencias: o.referencias } : {}),
    ...(o.lat != null && o.lng != null ? { ubicacion: { lat: o.lat, lng: o.lng } } : {}),
    responsable: { nombre: o.responsableNombre ?? '' },
    contactos: o.contactos ?? [],
  };
}

export function aProducto(
  p: ApiProducto,
  categorias: Map<string, string>,
  unidades: Map<string, string>,
  existencias: number | undefined,
  equipos: string[] = [],
): ProductoTarifa {
  return {
    id: idFront(p),
    codigo: p.codigo,
    nombre: p.nombre,
    categoria: (categorias.get(p.categoriaId) ?? p.tipo) as CategoriaProducto,
    unidad: unidades.get(p.unidadId) ?? '',
    precio: p.precioLista,
    ...(p.minimoCobro != null ? { minimo: p.minimoCobro } : {}),
    ...(p.pedidoMinimo ? { pedidoMinimo: p.pedidoMinimo } : {}),
    ...(p.tiempoServicioMin ? { tiempoServicioMin: p.tiempoServicioMin } : {}),
    descripcion: p.descripcion,
    ...(p.controlaExistencias ? { existencias: existencias ?? 0, minimoExistencias: p.minimoExistencias ?? 0 } : {}),
    // Solo los dados de alta (los del tarifario conservan su id del front y no se configuran).
    ...(p.concretoFc && p.concretoRevenimientoCm != null && p.concretoSuministro && idFront(p) === p.id
      ? { configuracion: { fc: p.concretoFc, edad: String(p.concretoEdadDias ?? 28), rev: String(p.concretoRevenimientoCm), suministro: p.concretoSuministro } }
      : {}),
    ...(p.soluciones?.length ? { soluciones: [...p.soluciones] } : {}),
    // Las unidades que lo atienden (producto-equipos)
    ...(p.equipoTipo ? { equipo: { tipo: p.equipoTipo.replace(/_/g, '-'), unidades: equipos } } : {}),
  };
}

/** Partida de la API → la del front: especificación anidada, servicios y maquinaria como claves, entrega en la planta. */
/** La colocación en la API se llama distinto: el front dice "bombeo"; la API, "bombeable" (y solo acepta esas dos). */
const COLOCACION_API: Record<PartidaCotizacion['especificacion']['colocacion'], string> = { directa: 'directa', bombeo: 'bombeable' };
const colocacionDeApi = (c: string | null | undefined): PartidaCotizacion['especificacion']['colocacion'] =>
  /^bombe/i.test(c ?? '') ? 'bombeo' : 'directa';

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
      // En minúsculas, como las claves del front (datos viejos traían "Normal")
      exposicion: p.exposicion?.toLowerCase() as PartidaCotizacion['especificacion']['exposicion'],
      colocacion: colocacionDeApi(p.colocacion),
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
  // Pedido especial: su precio solo si ya lo puso Ventas
  if (p.especial) return { ...partida, especial: true, ...(p.precioM3 != null ? { precioM3: p.precioM3 } : {}) };
  // La API siempre devuelve el precio; en el front solo va si es especial (distinto del de tarifa).
  return p.precioM3 !== precioConcreto(partida) ? { ...partida, precioM3: p.precioM3 } : partida;
}

export function aCotizacion(c: ApiCotizacion, ctx: Contexto): Cotizacion {
  const { codigo, zona } = planta(ctx, c.sucursalId);
  const lugar = c.obraId ? undefined : lugarDe(c);
  return {
    id: c.id,
    folio: c.folio,
    fecha: enZona(c.fecha, zona),
    serie: c.serie,
    revision: c.revision,
    ...(c.baseId ? { baseId: c.baseId } : {}),
    ...(c.reemplazaId ? { reemplazaId: c.reemplazaId } : {}),
    ...(c.reemplazadaPorId ? { reemplazadaPorId: c.reemplazadaPorId } : {}),
    // El front guarda el % (la API, el importe)
    ...(c.descuento && c.subtotal ? { descuento: redondear((c.descuento / c.subtotal) * 100) } : {}),
    // Sin obra, las partidas apuntan a su lugar de entrega
    partidas: [...c.partidas].sort((a, b) => a.orden - b.orden).map((p) => aPartida(p, c.obraId ?? (lugar ? idLugar(c.id) : ''), zona, ctx)),
    ...(lugar ? { lugar } : {}),
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
  const lugar = p.obraId ? undefined : lugarDe(p);
  return {
    id: p.id,
    folio: p.folio,
    clienteId: p.clienteId,
    plantaId: codigo,
    obraId: p.obraId ?? (lugar ? idLugar(p.id) : ''),
    ...(lugar ? { lugar } : {}),
    producto: concreto?.descripcion ?? '',
    volumenM3: concreto?.cantidad ?? 0,
    fechaHoraEntrega: enZona(p.fechaHoraEntrega, zona),
    estado: p.estado,
    ...(p.cotizacionId ? { cotizacionId: p.cotizacionId } : {}),
    ...(p.partidaId ? { partidaId: p.partidaId } : {}),
    importe: p.total,
    cobro: p.cobro,
    ...(p.creditoDesde ? { creditoDesde: p.creditoDesde } : {}),
    ...(p.confirmadaEn ? { confirmadaEn: p.confirmadaEn } : {}),
    ...(p.confirmadaPorId ? { confirmadaPorId: p.confirmadaPorId } : {}),
    ...(p.unidades?.length ? { unidades: p.unidades, m3Asignados: p.m3Asignados ?? 0 } : {}),
    ...(p.tiempos ? { tiempos: p.tiempos } : {}),
    ...(p.reagendaPendiente ? { reagendaPendiente: p.reagendaPendiente } : {}),
    ...(p.clienteTieneCorreo != null ? { clienteTieneCorreo: p.clienteTieneCorreo } : {}),
    metodoPago: p.metodoPago,
    estatusPlanta: p.estatusPlanta,
    ...(p.solicitudPlantaFecha || p.solicitudPlantaNota
      ? { solicitudPlanta: { ...(p.solicitudPlantaFecha ? { fecha: enZona(p.solicitudPlantaFecha, zona) } : {}), nota: p.solicitudPlantaNota ?? '' } }
      : {}),
    ...(p.descuento && p.subtotal ? { descuento: redondear((p.descuento / p.subtotal) * 100) } : {}),
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
    colocacion: COLOCACION_API[e.colocacion],
    aditivos: e.aditivos,
    volumenM3: p.volumenM3,
    precioM3: p.precioM3 ?? null,
    especial: !!p.especial,
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
    // A una obra o a un lugar de entrega, nunca a los dos
    obraId: n.lugar ? null : n.partidas.find((p) => p.obraId)?.obraId || null,
    ...entregaApi(n.lugar),
    descuentoPct: n.descuento ?? 0,
    ...(n.baseId ? { baseId: n.baseId } : {}),
    ...(n.reemplazaId ? { reemplazaId: n.reemplazaId } : {}),
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
    obraId: n.lugar ? null : p.obraId,
    ...entregaApi(n.lugar),
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

/** Máximo que da el backend por consulta en las listas CRUD (?skip&take). */
export const TAKE_MAXIMO = 500;

/**
 * Todos los registros de una lista CRUD, de TAKE_MAXIMO en TAKE_MAXIMO. `ruta` sin skip/take (puede llevar filtros).
 * shortcut: trae todo; con mucho volumen, filtrar o paginar en pantalla.
 */
export async function todos<T>(get: (ruta: string) => Promise<T[]>, ruta: string): Promise<T[]> {
  const sep = ruta.includes('?') ? '&' : '?';
  const res: T[] = [];
  for (let skip = 0; ; skip += TAKE_MAXIMO) {
    const pagina = await get(`${ruta}${sep}skip=${skip}&take=${TAKE_MAXIMO}`);
    res.push(...pagina);
    if (pagina.length < TAKE_MAXIMO) return res;
  }
}

/** "G03 · Gastos en general" → "G03": el backend guarda la clave del SAT (uso de CFDI máx. 4 caracteres). */
export const claveSat = (t: string) => t.split('·')[0].trim();
