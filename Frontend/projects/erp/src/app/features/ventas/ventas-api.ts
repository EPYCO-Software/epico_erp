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
import { Actividad, Cambio, EventoHistorial, NuevaActividad, TipoActividad } from '../../core/historial';
import { tiene } from '../../core/permisos';
import type { CambiosCliente, CambiosPedido, ClienteExpress, Equipo, LugarEntrega, NuevoProducto, CambiosProducto, TipoEquipo } from './datos';
import {
  type ApiCategoria,
  type ApiCliente,
  type ApiContacto,
  type ApiCotizacion,
  type ApiDatoFiscal,
  type ApiEvento,
  type ApiExistencia,
  type ApiObra,
  type ApiPedido,
  type ApiPedidoLinea,
  type ApiProducto,
  type ApiUnidad,
  type Contexto,
  type NuevaCotizacion,
  type NuevaObra,
  claveSat,
  todos,
  aCliente,
  aCotizacion,
  aObra,
  aPedido,
  aProducto,
  aUtc,
  contexto,
  cotizacionApi,
  isoEnZona,
  redondear,
  sucursalDe,
} from 'ui';

// Las conversiones puras viven en ui (las comparte el portal); se reexportan para quien ya las importaba de aquí.
export type { ApiCategoria, ApiCliente, ApiContacto, ApiCotizacion, ApiDatoFiscal, ApiEvento, ApiExistencia, ApiObra, ApiPedido, ApiPedidoLinea, ApiProducto, ApiUnidad, Contexto } from 'ui';
export { aCliente, aCotizacion, aObra, aPedido, aProducto, contexto, cotizacionApi, idFront, pedidoApi } from 'ui';

/** Lo que se quitó, dicho como en el ERP (el backend solo dice "Eliminado"). */
const ELIMINADO: Record<string, string> = {
  Cotizacion: 'Cotización eliminada',
  CotizacionPartida: 'Producto quitado',
  CotizacionLinea: 'Servicio quitado',
  Pedido: 'Orden de venta eliminada',
  PedidoLinea: 'Línea quitada',
  ClienteContacto: 'Contacto quitado',
  ClienteDatoFiscal: 'Datos de facturación quitados',
  Obra: 'Obra quitada',
  Producto: 'Producto dado de baja',
};

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
/** Los detalles de un evento como lista (texto JSON, lista o nada). */
function detallesDe(d: ApiEvento['detalles']): string[] {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  try {
    const v: unknown = JSON.parse(d);
    return Array.isArray(v) ? v.map(String) : [String(v)];
  } catch {
    return [d];
  }
}

export function aEvento(e: ApiEvento, registro: string, nombre: (id: string) => string | undefined): EventoHistorial {
  const detalles = detallesDe(e.detalles);
  const valor = (v: string | null) => (v == null || v === '' ? '—' : (nombre(v) ?? v));
  const cambios: Cambio[] = e.cambios.map((c) => ({ campo: c.etiqueta, antes: valor(c.valorAnterior), despues: valor(c.valorNuevo) }));
  return {
    id: e.id,
    registro,
    fecha: e.fecha,
    // Los usuarios internos están todos en los nombres (/usuarios/resumen): uno que no está es del portal del cliente
    autor: e.autorId ? (nombre(e.autorId) ?? 'Cliente (portal)') : 'Sistema',
    texto: e.tipo === 'creado' ? (CREADO[e.registroTipo] ?? e.texto) : e.tipo === 'eliminado' ? (ELIMINADO[e.registroTipo] ?? e.texto) : e.texto,
    ...(detalles.length ? { detalles } : {}),
    ...(cambios.length ? { cambios } : {}),
    ...(e.tipo === 'nota' ? { nota: true } : {}),
    ...(e.tipo === 'actividad' ? { actividad: true } : {}),
  };
}

// ---------- Llamadas ----------

const BASE = '/api/v1';

// claveSat vive en ui (también la usa el portal)
export { claveSat };

export interface ApiActividad {
  id: string;
  organizacionId: string;
  registroTipo: string;
  registroId: string;
  tipo: TipoActividad;
  resumen: string;
  /** yyyy-MM-dd */
  fechaLimite: string;
  asignadaAId: string;
  nota: string | null;
  hechaEn: string | null;
  canceladaEn: string | null;
}

/** Actividad del backend → la del historial (clave "tipo:id" del front y el nombre de a quién se asignó). */
export const aActividad = (a: ApiActividad, registro: string, nombre: (id: string) => string | undefined): Actividad => ({
  id: a.id,
  registro,
  tipo: a.tipo,
  resumen: a.resumen,
  fechaLimite: a.fechaLimite,
  asignadaA: nombre(a.asignadaAId) ?? '—',
  nota: a.nota ?? '',
});

export interface Datos {
  ctx: Contexto;
  clientes: Cliente[];
  obras: Obra[];
  productos: ProductoTarifa[];
  cotizaciones: Cotizacion[];
  pedidos: Pedido[];
  /** id → nombre de usuarios, clientes, obras, plantas y productos (para el historial y los vendedores). */
  nombres: Map<string, string>;
  /** Usuarios de la organización (quien está en sesión primero): a quién se asigna una actividad. */
  usuarios: { id: string; nombre: string }[];
  /** El cliente de mostrador ("Público en general"), si ya existe. */
  publicoGeneralId: string | null;
  /** Unidades de la flota (para conectar los servicios de renta). */
  equipos: Equipo[];
}

interface ApiEquipo {
  id: string;
  tipo: string;
  numeroEconomico: string;
  descripcion: string | null;
  activo: boolean;
}
interface ApiProductoEquipo {
  id: string;
  productoId: string;
  equipoId: string;
}

/** Sin permiso de ver ese recurso (403): lista vacía. Cualquier otro error sigue fallando. */
function vacioSinPermiso<T>(peticion: Promise<T[]>): Promise<T[]> {
  return peticion.catch((e: unknown) => {
    if ((e as { status?: number })?.status === 403) return [] as T[];
    throw e;
  });
}

@Service()
export class VentasApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  /** Las líneas de cada pedido, para editarlo (PUT manda el registro completo). */
  private readonly lineasPedido = new Map<string, ApiPedidoLinea[]>();
  private apiPedidos = new Map<string, ApiPedido>();
  /** Qué unidades atienden cada producto (id de la API), para editar la conexión. */
  private productoEquipos: ApiProductoEquipo[] = [];

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(BASE + ruta));
  }
  private post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(BASE + ruta, cuerpo));
  }
  private put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(BASE + ruta, cuerpo));
  }
  /** Todas las páginas de una lista paginada ({ items, total }). */
  private async paginas<T>(ruta: string): Promise<T[]> {
    const items: T[] = [];
    for (let pagina = 1; ; pagina++) {
      const r = await this.get<{ items: T[]; total: number }>(`${ruta}${ruta.includes('?') ? '&' : '?'}pagina=${pagina}&tamano=500`);
      items.push(...r.items);
      if (!r.items.length || items.length >= r.total) return items;
    }
  }

  /**
   * Todo lo de Ventas de una vez.
   * Cotizaciones y pedidos llegan con su detalle (incluir=partidas / lineas), por páginas.
   * shortcut: trae todas las cotizaciones y pedidos y hasta 500 de lo demás; con más volumen, pedir por periodo y
   * pedir el detalle al abrirla.
   */
  async cargar(): Promise<Datos> {
    const [clientes, contactos, fiscales, obras, productos, categorias, unidades, existencias, encabezados, pedidos, usuarios, equipos, conexiones, roles] = await Promise.all([
      // Lo que el rol no puede ver llega vacío (403) y no tumba lo demás: p. ej. quien solo consulta cotizaciones
      vacioSinPermiso(this.get<ApiCliente[]>('/clientes?take=500')),
      vacioSinPermiso(this.get<ApiContacto[]>('/cliente-contactos?take=500')),
      vacioSinPermiso(this.get<ApiDatoFiscal[]>('/cliente-datos-fiscales?take=500')),
      vacioSinPermiso(todos((r) => this.get<ApiObra[]>(r), '/obras')),
      vacioSinPermiso(this.get<ApiProducto[]>('/productos?take=500')),
      vacioSinPermiso(this.get<ApiCategoria[]>('/categorias-producto?take=500')),
      vacioSinPermiso(this.get<ApiUnidad[]>('/unidades-medida?take=500')),
      this.get<ApiExistencia[]>('/existencias?take=500').catch(() => [] as ApiExistencia[]),
      vacioSinPermiso(this.paginas<ApiCotizacion>('/cotizaciones?incluir=partidas')),
      vacioSinPermiso(this.paginas<ApiPedido>('/pedidos?incluir=lineas')),
      vacioSinPermiso(this.get<{ id: string; nombre: string; activo: boolean }[]>('/usuarios/resumen')),
      this.get<ApiEquipo[]>('/equipos?take=500').catch(() => [] as ApiEquipo[]),
      todos((r) => this.get<ApiProductoEquipo[]>(r), '/producto-equipos').catch(() => [] as ApiProductoEquipo[]),
      // Para el historial de usuarios (cambio de rol); sin permiso de ver roles no se piden
      tiene(this.auth.sesion()?.permisos ?? [], 'config.roles.ver')
        ? this.get<{ id: string; nombre: string }[]>('/roles/resumen').catch(() => [] as { id: string; nombre: string }[])
        : Promise.resolve([] as { id: string; nombre: string }[]),
    ]);
    this.productoEquipos = conexiones;
    const cotizaciones = encabezados;
    const pedidosCompletos = pedidos;
    const ctx = contexto(this.auth.sesion()?.empresas ?? [], productos);
    const cats = new Map(categorias.map((c) => [c.id, c.clave]));
    const uds = new Map(unidades.map((u) => [u.id, u.nombre]));
    const stock = new Map<string, number>();
    for (const e of existencias) stock.set(e.productoId, (stock.get(e.productoId) ?? 0) + e.cantidad);
    this.apiPedidos = new Map(pedidosCompletos.map((p) => [p.id, p]));

    const nombres = new Map<string, string>([
      ...usuarios.map((u): [string, string] => [u.id, u.nombre]),
      ...roles.map((r): [string, string] => [r.id, r.nombre]),
      ...clientes.map((c): [string, string] => [c.id, c.nombre]),
      ...obras.map((o): [string, string] => [o.id, o.nombre]),
      ...productos.map((p): [string, string] => [p.id, p.nombre]),
      ...[...ctx.plantas].map(([id, p]): [string, string] => [id, p.codigo]),
    ]);
    const sesion = this.auth.sesion();
    if (sesion?.usuario.id) nombres.set(sesion.usuario.id, sesion.usuario.nombre);

    const yo = sesion?.usuario.id;
    // A quién se puede asignar: los activos
    const lista = usuarios.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre }));
    const mio = lista.find((u) => u.id === yo) ?? (yo ? { id: yo, nombre: sesion!.usuario.nombre } : null);
    return {
      ctx,
      nombres,
      usuarios: mio ? [mio, ...lista.filter((u) => u.id !== yo)] : lista,
      publicoGeneralId: clientes.find((c) => c.esPublicoGeneral)?.id ?? null,
      clientes: clientes.map((c) =>
        aCliente(
          c,
          contactos.filter((x) => x.clienteId === c.id),
          fiscales.filter((x) => x.clienteId === c.id),
        ),
      ),
      obras: obras.map(aObra),
      productos: productos
        .filter((p) => p.activo)
        .map((p) => aProducto(p, cats, uds, stock.get(p.id), conexiones.filter((x) => x.productoId === p.id).map((x) => x.equipoId))),
      equipos: equipos
        .filter((e) => e.activo)
        .map((e) => ({ id: e.id, tipo: e.tipo.replace(/_/g, '-') as TipoEquipo, numero: e.numeroEconomico, descripcion: e.descripcion ?? '' }))
        .sort((a, b) => a.numero.localeCompare(b.numero)),
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

  cancelar(id: string): Promise<unknown> {
    return this.post(`/cotizaciones/${id}/cancelar`);
  }

  eliminarCliente(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${BASE}/clientes/${id}`));
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

  /**
   * Alta completa (Clientes → Nuevo): crea el cliente y le guarda contacto, empresa y datos fiscales con guardarCliente.
   * shortcut: no es una sola operación; si falla después de crearlo, el cliente queda con solo su nombre y se completa
   * editándolo. Con un endpoint de alta en el backend, usarlo.
   */
  async altaCliente(c: CambiosCliente): Promise<Cliente> {
    const nuevo = await this.post<ApiCliente>('/clientes', { nombre: c.nombre, esPublicoGeneral: false, diasCredito: 0 });
    try {
      return await this.guardarCliente(nuevo.id, c);
    } catch (e) {
      // No dejar un cliente a medias: se borra lo que alcanzó a crearse y se avisa el error original
      await this.borrarCliente(nuevo.id).catch(() => undefined);
      throw e;
    }
  }

  /** Borra el cliente con sus contactos y datos fiscales (solo para deshacer un alta que falló). */
  private async borrarCliente(id: string): Promise<void> {
    const [contactos, fiscales] = await Promise.all([
      this.get<ApiContacto[]>(`/cliente-contactos?clienteId=${id}`),
      this.get<ApiDatoFiscal[]>(`/cliente-datos-fiscales?clienteId=${id}`),
    ]);
    for (const f of fiscales) await firstValueFrom(this.http.delete(`${BASE}/cliente-datos-fiscales/${f.id}`));
    for (const x of contactos) await firstValueFrom(this.http.delete(`${BASE}/cliente-contactos/${x.id}`));
    await firstValueFrom(this.http.delete(`${BASE}/clientes/${id}`));
  }

  crearPublicoGeneral(): Promise<ApiCliente> {
    return this.post<ApiCliente>('/clientes', { nombre: 'Público en general', esPublicoGeneral: true, diasCredito: 0 });
  }

  /**
   * Alta o edición completa de una obra (Ventas → Obras). clienteId vacío = obra general. PUT manda el registro
   * completo (se parte del que tiene el backend).
   */
  async guardarObra(id: string | null, clienteId: string, d: NuevaObra): Promise<Obra> {
    const cuerpo = {
      clienteId: clienteId || null,
      nombre: d.nombre.trim(),
      direccion: d.direccion.trim(),
      municipio: d.municipio.trim() || null,
      referencias: d.referencias?.trim() || null,
      lat: d.ubicacion?.lat ?? null,
      lng: d.ubicacion?.lng ?? null,
      responsableNombre: d.responsable.nombre.trim() || null,
      contactos: d.contactos.map((c) => ({ nombre: c.nombre.trim(), lada: c.lada, numero: c.numero.replace(/\D/g, '') })),
    };
    if (!id) return aObra(await this.post<ApiObra>('/obras', cuerpo));
    const antes = await this.get<ApiObra & Record<string, unknown>>(`/obras/${id}`);
    return aObra(await this.put<ApiObra>(`/obras/${id}`, { ...antes, ...cuerpo }));
  }

  eliminarObra(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${BASE}/obras/${id}`));
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
        // El backend guarda la clave del SAT ("601", "G03"); el front puede traer "G03 · Gastos en general"
        regimenFiscal: claveSat(f.regimenFiscal),
        usoCfdi: claveSat(f.usoCfdi),
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
    // Al editar se queda en su categoría (concreto-fc, ajuste…); al dar de alta, la de su tipo (aditivo es su propia categoría)
    const categoria = antes ? catalogos.categorias.find((c) => c.id === antes.categoriaId) : catalogos.categorias.find((c) => c.clave === tipo);
    const unidad = catalogos.unidades.find((u) => u.nombre === n.unidad) ?? catalogos.unidades.find((u) => u.id === antes?.unidadId);
    const cfg = n.configuracion;
    const cuerpo = {
      ...(antes ?? {}),
      categoriaId: categoria?.id ?? antes?.categoriaId,
      // En la API el aditivo es de tipo concreto (categoría aditivo)
      tipo: tipo === 'aditivo' ? 'concreto' : tipo,
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
      soluciones: tipo === 'concreto' ? (n.soluciones ?? (antes?.soluciones as string[] | undefined) ?? []) : [],
      activo: true,
    };
    const p = id ? await this.put<ApiProducto>(`/productos/${id}`, cuerpo) : await this.post<ApiProducto>('/productos', cuerpo);
    // Deja conectadas exactamente las unidades elegidas (ninguna si ya no es renta de equipo)
    const quiero = n.equipo?.unidades ?? [];
    const tiene = this.productoEquipos.filter((x) => x.productoId === p.id);
    await Promise.all([
      ...tiene.filter((x) => !quiero.includes(x.equipoId)).map((x) => firstValueFrom(this.http.delete(`${BASE}/producto-equipos/${x.id}`))),
      ...quiero.filter((e) => !tiene.some((x) => x.equipoId === e)).map((equipoId) => this.post('/producto-equipos', { productoId: p.id, equipoId })),
    ]);
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

  /** El folio que tendría la siguiente cotización de esa planta (no lo consume). */
  async folioSiguiente(plantaId: string, ctx: Contexto): Promise<string> {
    return (await this.get<{ folio: string }>(`/secuencias/siguiente?tipo=cotizacion&sucursalId=${sucursalDe(ctx, plantaId)}`)).folio;
  }

  actividades(tipo: string, id: string): Promise<ApiActividad[]> {
    return this.get<ApiActividad[]>(`/actividades/registro/${tipo}/${id}`);
  }

  crearActividad(tipo: string, id: string, a: NuevaActividad, asignadaAId: string, hecha: boolean): Promise<ApiActividad> {
    return this.post<ApiActividad>('/actividades', {
      registroTipo: tipo,
      registroId: id,
      tipo: a.tipo,
      resumen: a.resumen,
      fechaLimite: a.fechaLimite,
      asignadaAId,
      nota: a.nota || null,
      hechaEn: hecha ? new Date().toISOString() : null,
    });
  }

  /** Hecha o cancelada: PUT manda el registro completo. */
  async cerrarActividad(id: string, como: 'hecha' | 'cancelada'): Promise<void> {
    const a = await this.get<ApiActividad>(`/actividades/${id}`);
    await this.put(`/actividades/${id}`, { ...a, [como === 'hecha' ? 'hechaEn' : 'canceladaEn']: new Date().toISOString() });
  }

  nota(tipo: string, id: string, texto: string): Promise<unknown> {
    return this.post(`/historial/${tipo}/${id}/notas`, { texto });
  }
}
