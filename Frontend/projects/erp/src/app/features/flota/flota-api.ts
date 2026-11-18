import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MetodoPago, TiemposViaje } from 'ui';
import { TIPOS_EQUIPO, TipoEquipo } from '../ventas/datos';

const BASE = '/api/v1';

/** Todo tipo de unidad: los de TIPOS_EQUIPO más "otro". */
export type TipoUnidad = TipoEquipo | 'otro';
export type CategoriaUnidad = 'concreto' | 'bombeo' | 'carga' | 'maquinaria' | 'otro';

/** Para agrupar y filtrar: una concretera es, al final, una empresa de ingeniería civil. */
export const CATEGORIAS_UNIDAD: Record<CategoriaUnidad, string> = {
  concreto: 'Transporte de concreto',
  bombeo: 'Bombeo',
  carga: 'Carga y flete',
  maquinaria: 'Maquinaria',
  otro: 'Otro',
};

const CATEGORIA: Record<TipoUnidad, CategoriaUnidad> = {
  revolvedor: 'concreto',
  'bomba-pluma': 'bombeo',
  'bomba-estacionaria': 'bombeo',
  volteo: 'carga',
  plataforma: 'carga',
  tractocamion: 'carga',
  pipa: 'carga',
  camioneta: 'carga',
  retroexcavadora: 'maquinaria',
  cargador: 'maquinaria',
  excavadora: 'maquinaria',
  grua: 'maquinaria',
  montacargas: 'maquinaria',
  aplanadora: 'maquinaria',
  vibrador: 'maquinaria',
  allanadora: 'maquinaria',
  otro: 'otro',
};

export const categoriaDe = (t: TipoUnidad): CategoriaUnidad => CATEGORIA[t] ?? 'otro';
export const nombreTipo = (t: TipoUnidad): string => (t === 'otro' ? 'Otro' : (TIPOS_EQUIPO[t] ?? 'Otro'));
export const TIPOS_UNIDAD: { id: TipoUnidad; nombre: string; categoria: CategoriaUnidad }[] = [
  ...(Object.keys(TIPOS_EQUIPO) as TipoEquipo[]),
  'otro' as const,
].map((id) => ({ id, nombre: nombreTipo(id), categoria: categoriaDe(id) }));

/** Lo que carga cada categoría y en qué unidad se mide su capacidad. */
export const UNIDADES_CAPACIDAD = ['m³', 't', 'L', 'm'] as const;

export type EstadoUnidad = 'disponible' | 'mantenimiento' | 'fuera_de_servicio';
export const ESTADO_UNIDAD: Record<EstadoUnidad, string> = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  fuera_de_servicio: 'Fuera de servicio',
};

/** Una unidad de la flota (Equipo en la API). */
export interface Unidad {
  id: string;
  /** Planta principal (siempre está en sucursalIds). */
  sucursalId: string;
  /** Todas las plantas en las que opera: puede ser más de una. */
  sucursalIds?: string[];
  tipo: TipoUnidad;
  numeroEconomico: string;
  descripcion: string | null;
  placas: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  capacidad: number | null;
  unidadCapacidad: string | null;
  estado: EstadoUnidad;
  /** Operador habitual: se propone al asignarla (operadorId del catálogo; el nombre queda de respaldo). */
  operadorNombre: string | null;
  operadorId?: string | null;
  /** uniqueId del dispositivo en Traccar: con él se ve su posición. */
  gpsId: string | null;
  notas: string | null;
  activo: boolean;
}

export interface Posicion {
  lat: number;
  lng: number;
  /** ISO UTC de la lectura. */
  fecha: string;
  velocidadKmh: number | null;
}

/** El viaje activo de una unidad (lo que la tiene ocupada). */
export interface ViajeActivo {
  remisionId: string;
  pedidoId: string;
  pedidoFolio: string;
  estado: EstadoViaje;
  entrega: string;
}

/** Una fila del tablero: la unidad con su planta, su viaje activo, si se puede asignar (y por qué no) y su posición. */
export interface FilaTablero {
  equipo: Unidad;
  plantaNombre: string;
  /** Todas sus plantas (la principal primero). */
  plantaNombres?: string[];
  viaje: ViajeActivo | null;
  disponible: boolean;
  motivo: string | null;
  posicion: Posicion | null;
  /** Su operador habitual del catálogo. */
  operador?: { id: string; nombre: string; licenciaVence: string | null } | null;
}

export interface Tablero {
  gps: { configurado: boolean };
  equipos: FilaTablero[];
}

export type EstadoViaje = 'programado' | 'cargando' | 'en_ruta' | 'en_obra' | 'regresando' | 'terminado';
export const ESTADO_VIAJE: Record<EstadoViaje, string> = {
  programado: 'Programado',
  cargando: 'Cargando',
  en_ruta: 'En ruta',
  en_obra: 'En obra',
  regresando: 'Regresando',
  terminado: 'Terminado',
};
const ORDEN_VIAJE = Object.keys(ESTADO_VIAJE) as EstadoViaje[];
/** El paso que sigue (null: ya terminó). Los viajes solo avanzan. */
export const siguienteEstado = (e: EstadoViaje): EstadoViaje | null => ORDEN_VIAJE[ORDEN_VIAJE.indexOf(e) + 1] ?? null;
/** El verbo del botón para pasar a ese estado. */
export const ACCION_VIAJE: Record<EstadoViaje, string> = {
  programado: 'Programar',
  cargando: 'Empezar a cargar',
  en_ruta: 'Salió a obra',
  en_obra: 'Llegó a obra',
  regresando: 'Descargó, regresa',
  terminado: 'Terminar viaje',
};

/** Un viaje (remisión) de una orden, con su unidad. */
export interface Viaje {
  id: string;
  folio: string;
  equipoId: string | null;
  numeroEconomico: string | null;
  tipoEquipo: TipoUnidad | null;
  placas: string | null;
  operadorNombre: string | null;
  volumenM3: number;
  estado: EstadoViaje;
  salidaEn: string | null;
  llegadaEstimada: string | null;
  llegadaEn: string | null;
  terminadaEn: string | null;
  posicion: Posicion | null;
  /** Ventana que ocupa la unidad (UTC): sale de planta, regresa. Transporte ida y vuelta + servicio. */
  salidaProgramada?: string | null;
  regresoEstimado?: string | null;
  duracionMin?: number | null;
}

export interface Asignacion {
  equipoId: string;
  /** Del catálogo de operadores; si no, el nombre escrito. */
  operadorId?: string | null;
  operadorNombre: string | null;
  volumenM3: number;
  metodoPago?: MetodoPago;
  /** UTC; sin ella, el backend la calcula (entrega − la mitad del transporte). */
  salidaProgramada?: string | null;
}

export interface DispositivoGps {
  uniqueId: string;
  nombre: string;
  estado: string;
  ultimaPosicion: string | null;
  equipoId: string | null;
}

// La API manda los enums en snake_case (bomba_pluma); el front los usa con guion (bomba-pluma), como en Productos.
const tipoFront = (t: string | null): TipoUnidad => (t ?? 'otro').replace(/_/g, '-') as TipoUnidad;
const tipoApi = (t: TipoUnidad) => t.replace(/-/g, '_');
const aUnidad = (e: Unidad): Unidad => ({ ...e, tipo: tipoFront(e.tipo) });
const aViaje = (v: Viaje): Viaje => ({ ...v, tipoEquipo: v.tipoEquipo ? tipoFront(v.tipoEquipo) : null });

/** Flota y viajes contra el backend (Logística). Sin backend no hay flota: las páginas lo avisan. */
@Service()
export class FlotaApi {
  private readonly http = inject(HttpClient);

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(BASE + ruta));
  }
  private post<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(BASE + ruta, cuerpo));
  }

  async tablero(pedidoId?: string): Promise<Tablero> {
    const t = await this.get<Tablero>('/flota/tablero' + (pedidoId ? `?pedidoId=${encodeURIComponent(pedidoId)}` : ''));
    return { ...t, equipos: t.equipos.map((f) => ({ ...f, equipo: aUnidad(f.equipo) })) };
  }

  /** Alta (sin id) o edición. PUT manda el registro completo. */
  async guardar(u: Omit<Unidad, 'id'> & { id?: string }): Promise<Unidad> {
    const cuerpo = { ...u, tipo: tipoApi(u.tipo) };
    const r = u.id
      ? await firstValueFrom(this.http.put<Unidad>(`${BASE}/equipos/${u.id}`, cuerpo))
      : await this.post<Unidad>('/equipos', cuerpo);
    return aUnidad(r);
  }

  gps(): Promise<{ configurado: boolean; dispositivos: DispositivoGps[] }> {
    return this.get('/flota/gps');
  }

  async viajes(pedidoId: string): Promise<Viaje[]> {
    return (await this.get<Viaje[]>(`/pedidos/${pedidoId}/viajes`)).map(aViaje);
  }

  async asignar(pedidoId: string, a: Asignacion): Promise<Viaje> {
    return aViaje(await this.post<Viaje>(`/pedidos/${pedidoId}/viajes`, a));
  }

  async avanzar(viajeId: string, estado: EstadoViaje): Promise<Viaje> {
    return aViaje(await this.post<Viaje>(`/viajes/${viajeId}/estado`, { estado }));
  }

  quitar(pedidoId: string, viajeId: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${BASE}/pedidos/${pedidoId}/viajes/${viajeId}`));
  }

  // ---------- Despacho y ficha ----------

  async despacho(fecha: string): Promise<FilaDespacho[]> {
    const r = await this.get<FilaDespacho[]>(`/flota/despacho?fecha=${fecha}`);
    return r.map((f) => ({ ...f, viajes: f.viajes.map(aViaje) }));
  }

  async unidad(id: string): Promise<Unidad> {
    return aUnidad(await this.get<Unidad>(`/equipos/${id}`));
  }

  async viajesDeUnidad(id: string): Promise<{ items: ViajeUnidad[]; total: number; resumen: ResumenUnidad }> {
    type Item = Omit<ViajeUnidad, keyof Viaje> & { viaje: Viaje };
    const r = await this.get<{ items: Item[]; total: number; resumen: ResumenUnidad }>(`/equipos/${id}/viajes?pagina=1&tamano=50`);
    return { ...r, items: r.items.map(({ viaje, ...resto }) => ({ ...aViaje(viaje), ...resto })) };
  }

  // ---------- Posiciones y recorridos (GPS) ----------

  async posiciones(): Promise<PosicionUnidad[]> {
    return (await this.get<PosicionUnidad[]>('/flota/posiciones')).map((x) => ({ ...x, tipo: tipoFront(x.tipo) }));
  }

  /** Sin rango: las últimas 12 h. Máximo 7 días. */
  recorrido(equipoId: string, desde?: string, hasta?: string): Promise<Recorrido> {
    const q = new URLSearchParams({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) });
    return this.get(`/equipos/${equipoId}/recorrido${q.size ? '?' + q : ''}`);
  }

  async lineaTiempo(fecha: string): Promise<FilaLineaTiempo[]> {
    return (await this.get<FilaLineaTiempo[]>(`/flota/linea-tiempo?fecha=${fecha}`)).map((f) => ({ ...f, equipo: { ...f.equipo, tipo: tipoFront(f.equipo.tipo) } }));
  }

  checklist(tipo: TipoUnidad): Promise<PuntoChecklist[]> {
    return this.get(`/flota/checklist?tipo=${tipoApi(tipo)}`);
  }

  /** Sube un archivo (foto, firma) y devuelve su id. */
  async subirArchivo(archivo: Blob, nombre: string, categoria: string, registro?: { tipo: string; id: string }): Promise<string> {
    const f = new FormData();
    f.append('archivo', archivo, nombre);
    f.append('categoria', categoria);
    if (registro) {
      f.append('registroTipo', registro.tipo);
      f.append('registroId', registro.id);
    }
    return (await this.post<{ id: string }>('/archivos', f)).id;
  }

  /** El archivo como URL local (las imágenes piden el token: no sirven como src directo). */
  async urlArchivo(id: string): Promise<string> {
    return URL.createObjectURL(await firstValueFrom(this.http.get(`${BASE}/archivos/${id}`, { responseType: 'blob' })));
  }

  remision(viajeId: string): Promise<DatosRemision> {
    return this.get(`/viajes/${viajeId}/remision`);
  }

  firmar(viajeId: string, archivoId: string, recibeNombre: string): Promise<unknown> {
    return this.post(`/viajes/${viajeId}/firma`, { archivoId, recibeNombre });
  }

  indicadores(desde: string, hasta: string, sucursalId?: string): Promise<Indicadores> {
    const q = new URLSearchParams({ desde, hasta, ...(sucursalId ? { sucursalId } : {}) });
    return this.get(`/flota/indicadores?${q}`);
  }

  recorridoViaje(viajeId: string): Promise<Recorrido> {
    return this.get(`/viajes/${viajeId}/recorrido`);
  }

  /** Trayectos, km, combustible y rendimiento de una unidad (por omisión, los últimos 30 días). */
  resumen(equipoId: string): Promise<ResumenRecorridos> {
    return this.get(`/equipos/${equipoId}/resumen`);
  }

  vencimientos(dias = 30): Promise<Vencimiento[]> {
    return this.get(`/flota/vencimientos?dias=${dias}`);
  }

  // ---------- Catálogos (CRUD del backend) ----------

  lista<T>(recurso: Recurso, filtro: Record<string, string> = {}): Promise<T[]> {
    return this.get<T[]>(`/${recurso}?${new URLSearchParams({ ...filtro, take: '500' })}`);
  }

  /** Alta (sin id) o edición (PUT con el registro completo). */
  guardarRegistro<T extends { id?: string }>(recurso: Recurso, r: T): Promise<T> {
    return r.id ? firstValueFrom(this.http.put<T>(`${BASE}/${recurso}/${r.id}`, r)) : this.post<T>(`/${recurso}`, r);
  }

  borrar(recurso: Recurso, id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${BASE}/${recurso}/${id}`));
  }

  estadoMantenimiento(id: string, estado: EstadoMantenimiento): Promise<Mantenimiento> {
    return this.post(`/mantenimientos/${id}/estado`, { estado });
  }

  // ---------- Tiempos y reagenda de una orden ----------

  /** null = volver al calculado por la distancia. */
  tiempos(pedidoId: string, transporteMin: number | null): Promise<unknown> {
    return firstValueFrom(this.http.put(`${BASE}/pedidos/${pedidoId}/tiempos`, { transporteMin }));
  }

  reagendar(pedidoId: string, r: { fechaHoraEntrega: string; motivo: string; correo?: string | null }): Promise<ResultadoReagenda> {
    return this.post(`/pedidos/${pedidoId}/reagendar`, r);
  }

  solicitudes(pedidoId: string): Promise<SolicitudReagenda[]> {
    return this.get(`/pedidos/${pedidoId}/solicitudes-reagenda`);
  }

  solicitudesPendientes(): Promise<SolicitudReagenda[]> {
    return this.get('/solicitudes-reagenda?estado=pendiente');
  }

  solicitar(pedidoId: string, s: { fechaPropuesta: string; motivo: string }): Promise<SolicitudReagenda> {
    return this.post(`/pedidos/${pedidoId}/solicitudes-reagenda`, s);
  }

  aceptar(solicitudId: string, a: { correo?: string | null; fechaHoraEntrega?: string | null }): Promise<ResultadoReagenda> {
    return this.post(`/solicitudes-reagenda/${solicitudId}/aceptar`, a);
  }

  rechazar(solicitudId: string, nota: string): Promise<SolicitudReagenda> {
    return this.post(`/solicitudes-reagenda/${solicitudId}/rechazar`, { nota });
  }
}

export interface SolicitudReagenda {
  id: string;
  pedidoId: string;
  /** UTC. */
  fechaPropuesta: string;
  motivo: string;
  origen: 'planta' | 'logistica' | 'ventas' | 'cliente';
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  solicitadoPorId: string | null;
  solicitadoEn: string;
  resueltaPorId: string | null;
  resueltaEn: string | null;
  notaResolucion: string | null;
}
export const ORIGEN_REAGENDA: Record<SolicitudReagenda['origen'], string> = {
  planta: 'Planta',
  logistica: 'Logística',
  ventas: 'Ventas',
  cliente: 'El cliente',
};
export interface ResultadoReagenda {
  notificadoA: string[];
  /** Unidades que ya no cabían a la nueva hora y se quitaron. */
  quitados?: string[];
}

export type Recurso = 'operadores' | 'equipo-documentos' | 'cargas-combustible' | 'mantenimientos' | 'trayectos' | 'inspecciones';

// ---------- Despacho ----------

export interface PedidoDespacho {
  id: string;
  folio: string;
  clienteId: string;
  clienteNombre: string;
  obraNombre: string;
  /** UTC. */
  fechaHoraEntrega: string;
  zonaHoraria: string;
  sucursalId: string;
  plantaNombre: string;
  producto: string;
  volumenM3: number;
  m3Asignados: number;
  estado: string;
  metodoPago: MetodoPago;
  confirmadaEn: string | null;
  estatusPlanta?: string | null;
  tiempos?: TiemposViaje | null;
}
export interface FilaDespacho {
  pedido: PedidoDespacho;
  viajes: Viaje[];
}

/** Columnas del despacho, como un kanban: la orden que aún necesita unidad y cada viaje según su estado. */
export const COLUMNAS_DESPACHO = ['por_asignar', 'programado', 'cargando', 'en_ruta', 'en_obra', 'regresando', 'terminado'] as const;
export type ColumnaDespacho = (typeof COLUMNAS_DESPACHO)[number];
export const NOMBRE_COLUMNA: Record<ColumnaDespacho, string> = { por_asignar: 'Por asignar', ...ESTADO_VIAJE };

export type TarjetaDespacho =
  | { tipo: 'orden'; id: string; pedido: PedidoDespacho; faltan: number }
  | { tipo: 'viaje'; id: string; pedido: PedidoDespacho; viaje: Viaje };

/** Reparte el día en columnas: por asignar = órdenes confirmadas a las que les faltan m³ en ollas; lo demás, sus viajes. */
export function columnasDespacho(filas: FilaDespacho[]): Record<ColumnaDespacho, TarjetaDespacho[]> {
  const r = Object.fromEntries(COLUMNAS_DESPACHO.map((c) => [c, [] as TarjetaDespacho[]])) as Record<ColumnaDespacho, TarjetaDespacho[]>;
  for (const { pedido, viajes } of filas) {
    const faltan = Math.round((pedido.volumenM3 - (pedido.m3Asignados ?? 0)) * 10) / 10;
    const vivo = !['cancelado', 'entregado'].includes(pedido.estado);
    if (gestionable(pedido) && vivo && faltan > 0) r.por_asignar.push({ tipo: 'orden', id: 'o-' + pedido.id, pedido, faltan });
    for (const v of viajes) r[v.estado].push({ tipo: 'viaje', id: v.id, pedido, viaje: v });
  }
  return r;
}

// ---------- Ficha de unidad ----------

export interface ViajeUnidad extends Viaje {
  pedidoId: string;
  pedidoFolio: string;
  clienteNombre: string;
  obraNombre: string;
  fechaHoraEntrega: string;
}
export interface ResumenUnidad {
  viajes: number;
  m3: number | null;
  ultimoViaje: string | null;
}

// ---------- Operadores ----------

export interface Operador {
  id?: string;
  sucursalId: string | null;
  nombre: string;
  telefono: string | null;
  licenciaNumero: string | null;
  licenciaTipo: string | null;
  /** YYYY-MM-DD. */
  licenciaVence: string | null;
  activo: boolean;
  notas: string | null;
}

// ---------- Documentos y vencimientos ----------

export type TipoDocumento = 'seguro' | 'verificacion' | 'tarjeta_circulacion' | 'permiso_sct' | 'tenencia' | 'calibracion' | 'otro';
export const TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  calibracion: 'Calibración',
  seguro: 'Seguro',
  verificacion: 'Verificación',
  tarjeta_circulacion: 'Tarjeta de circulación',
  permiso_sct: 'Permiso SCT',
  tenencia: 'Tenencia',
  otro: 'Otro',
};
export interface DocumentoUnidad {
  id?: string;
  equipoId: string;
  tipo: TipoDocumento;
  numero: string | null;
  /** YYYY-MM-DD. */
  vence: string | null;
  archivoId: string | null;
  notas: string | null;
}
export interface Vencimiento {
  tipo: 'documento' | 'licencia' | 'mantenimiento' | 'combustible';
  registroId: string;
  equipoId: string | null;
  operadorId: string | null;
  titulo: string;
  vence: string;
  vencido: boolean;
}

/** Días de hoy a una fecha YYYY-MM-DD (negativo: ya pasó). Es un día, no una hora: se cuenta en el calendario local. */
export function diasPara(fecha: string, hoy = new Date()): number {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86_400_000);
}
/** YYYY-MM-DD → "18/11/2026". */
export const fechaCorta = (f: string) => f.slice(0, 10).split('-').reverse().join('/');
/** "Vencido hace 3 días", "Vence hoy", "Vence en 12 días" (los próximos 30) o "Vence el …", con su tono. */
export function textoVence(fecha: string | null, hoy = new Date()): { texto: string; tono: string } {
  if (!fecha) return { texto: 'Sin vencimiento', tono: 'text-texto-suave' };
  const n = diasPara(fecha, hoy);
  if (n < 0) return { texto: `Vencido hace ${-n} ${n === -1 ? 'día' : 'días'}`, tono: 'font-semibold text-[#8E332C]' };
  if (n === 0) return { texto: 'Vence hoy', tono: 'font-semibold text-[#8E332C]' };
  if (n <= 30) return { texto: `Vence en ${n} ${n === 1 ? 'día' : 'días'}`, tono: 'font-semibold text-[#7A5410]' };
  return { texto: `Vence el ${fechaCorta(fecha)}`, tono: 'text-texto-suave' };
}

// ---------- GPS ----------

/** Sensores que manda el GPS (Traccar), ya normalizados; lo demás en `otros`. */
export interface Sensores {
  tamborRpm?: number | null;
  tamborSentido?: 'carga' | 'descarga' | 'detenido' | null;
  motorEncendido?: boolean | null;
  combustiblePct?: number | null;
  temperaturaC?: number | null;
  otros?: Record<string, unknown>;
}
export interface PuntoRecorrido {
  /** UTC. */
  fecha: string;
  lat: number;
  lng: number;
  velocidadKmh: number | null;
  rumbo: number | null;
  altitudM: number | null;
  atributos: Sensores | null;
}
export interface PosicionUnidad extends PuntoRecorrido {
  equipoId: string;
  numeroEconomico: string;
  tipo: TipoUnidad;
  plantaNombres: string[];
  viaje: { id: string; pedidoFolio: string; estado: EstadoViaje } | null;
}
export interface Recorrido {
  puntos: PuntoRecorrido[];
  viajes: { id: string; folio: string; pedidoFolio: string; estado: EstadoViaje; salidaEn: string | null; llegadaEn: string | null; regresandoEn: string | null; terminadaEn: string | null }[];
  resumen: { km: number; velocidadMaxKmh: number | null; velocidadPromKmh: number | null; enMovimientoMin: number; detenidoMin: number };
}

/** Sin señal si la última posición tiene más de esto. */
export const MINUTOS_SIN_SENAL = 10;
export type SituacionGps = 'en_movimiento' | 'detenida' | 'sin_senal';
export const SITUACION_GPS: Record<SituacionGps | 'sin_gps', string> = {
  en_movimiento: 'En movimiento',
  detenida: 'Detenida',
  sin_senal: 'Sin señal',
  sin_gps: 'Sin GPS',
};
/** En movimiento (> 5 km/h), detenida, o sin señal reciente. */
export function situacionGps(p: Pick<PuntoRecorrido, 'fecha' | 'velocidadKmh'>, ahora = Date.now()): SituacionGps {
  if (ahora - Date.parse(p.fecha) > MINUTOS_SIN_SENAL * 60_000) return 'sin_senal';
  return (p.velocidadKmh ?? 0) > 5 ? 'en_movimiento' : 'detenida';
}
/** "Tambor cargando a 12 rpm", "Motor apagado"… para leer los sensores de un punto. */
export function textoSensores(a: Sensores | null | undefined): string[] {
  if (!a) return [];
  const r: string[] = [];
  if (a.tamborSentido) r.push(`Tambor: ${{ carga: 'cargando / mezclando', descarga: 'descargando', detenido: 'detenido' }[a.tamborSentido]}${a.tamborRpm != null ? ` a ${a.tamborRpm} rpm` : ''}`);
  else if (a.tamborRpm != null) r.push(`Tambor a ${a.tamborRpm} rpm`);
  if (a.motorEncendido != null) r.push(a.motorEncendido ? 'Motor encendido' : 'Motor apagado');
  if (a.combustiblePct != null) r.push(`Combustible ${Math.round(a.combustiblePct)} %`);
  if (a.temperaturaC != null) r.push(`Temperatura ${a.temperaturaC} °C`);
  return r;
}

// ---------- Línea de tiempo ----------

export type Etapa = 'carga' | 'ida' | 'obra' | 'regreso';
export const ETAPA: Record<Etapa, string> = { carga: 'Carga', ida: 'Ida', obra: 'En obra', regreso: 'Regreso' };
/** Colores de las etapas (con contraste para el texto blanco o carbón que llevan encima). */
export const COLOR_ETAPA: Record<Etapa, string> = { carga: 'bg-[#7A5410]', ida: 'bg-[#2B5F75]', obra: 'bg-epico', regreso: 'bg-[#2E5E4A]' };
export interface FilaLineaTiempo {
  equipo: { id: string; numeroEconomico: string; tipo: TipoUnidad; plantaNombres: string[]; estado: EstadoUnidad };
  viajes: {
    id: string;
    folio: string;
    pedidoId: string;
    pedidoFolio: string;
    clienteNombre: string;
    obraNombre: string;
    estado: EstadoViaje;
    salidaProgramada: string | null;
    regresoEstimado: string | null;
    etapas: { etapa: Etapa; inicio: string; fin: string; real: boolean }[];
  }[];
  mantenimientos: { id: string; descripcion: string; inicio: string; fin: string }[];
}
/** Posición (0–100 %) de un instante dentro de la jornada [desde, hasta]. */
export function enJornada(iso: string, desde: number, hasta: number): number {
  return Math.min(100, Math.max(0, ((Date.parse(iso) - desde) / (hasta - desde)) * 100));
}

// ---------- Indicadores ----------

export interface Indicadores {
  totales: { remisiones: number; m3: number; viajesTerminados: number; cicloPromMin: number | null; tiempoObraPromMin: number | null; prolongados: number };
  porUnidad: { equipoId: string; numeroEconomico: string; viajes: number; m3: number; cicloPromMin: number | null; tiempoObraPromMin: number | null }[];
  porConductor: { operadorId: string | null; nombre: string; viajes: number; m3: number; cicloPromMin: number | null }[];
  porCliente: { clienteId: string; nombre: string; viajes: number; m3: number; cicloPromMin: number | null; tiempoObraPromMin: number | null }[];
  porVendedor: { vendedorId: string | null; nombre: string; viajes: number; m3: number }[];
  porDia: { dia: string; viajes: number; m3: number }[];
  prolongados: { viajeId: string; folio: string; pedidoFolio: string; numeroEconomico: string; clienteNombre: string; obraNombre: string; llegadaEn: string; salidaObraEn: string; minutos: number }[];
}
/** Más que esto en obra es "prolongado" (igual que en el backend). */
export const MINUTOS_PROLONGADO = 90;

// ---------- Inspección ----------

export interface PuntoChecklist {
  clave: string;
  texto: string;
  /** Si falla, la unidad no sale (inspección rechazada). */
  critico: boolean;
}
export type ResultadoInspeccion = 'aprobada' | 'con_observaciones' | 'rechazada';
export const RESULTADO_INSPECCION: Record<ResultadoInspeccion, { texto: string; tono: string }> = {
  aprobada: { texto: 'Aprobada', tono: 'bg-[#E3EFE9] text-[#2E5E4A]' },
  con_observaciones: { texto: 'Con observaciones', tono: 'bg-[#FBF0DD] text-[#7A5410]' },
  rechazada: { texto: 'Rechazada', tono: 'bg-[#F6E3E1] text-[#8E332C]' },
};
export interface Inspeccion {
  id?: string;
  equipoId: string;
  /** UTC. */
  fecha: string;
  operadorId: string | null;
  inspectorNombre: string;
  /** Lo calcula el backend con los puntos. */
  resultado?: ResultadoInspeccion;
  puntos: { clave: string; texto: string; ok: boolean; nota?: string | null }[];
  odometroKm: number | null;
  firmaArchivoId: string | null;
  fotoArchivoIds: string[];
  notas: string | null;
}
/** Igual que el backend: falla un punto crítico → rechazada; otro → con observaciones; si no, aprobada. */
export function resultadoDe(puntos: { clave: string; ok: boolean }[], checklist: PuntoChecklist[]): ResultadoInspeccion {
  const critico = new Set(checklist.filter((c) => c.critico).map((c) => c.clave));
  if (puntos.some((p) => !p.ok && critico.has(p.clave))) return 'rechazada';
  return puntos.some((p) => !p.ok) ? 'con_observaciones' : 'aprobada';
}

// ---------- Remisión ----------

export interface DatosRemision {
  id: string;
  folio: string;
  /** UTC: cuando empezó a cargar (o salió, o se dio de alta). */
  fecha: string;
  estado: EstadoViaje;
  empresa: { razonSocial: string; nombreComercial: string | null; rfc: string | null };
  planta: { nombre: string; direccion: string | null; telefono: string | null };
  pedidoFolio: string;
  clienteId: string;
  clienteNombre: string;
  obra: { nombre: string; direccion: string | null; municipio: string | null };
  producto: string;
  m3: number;
  /** m³ de ollas del pedido hasta este viaje inclusive. */
  m3Acumulado: number;
  m3Pedido: number;
  numeroEconomico: string | null;
  placas: string | null;
  operador: string | null;
  horas: { cargandoEn: string | null; salidaEn: string | null; llegadaEn: string | null; regresandoEn: string | null; terminadaEn: string | null };
  /** Huella de la remisión (la API la verifica en una impresa). */
  sello: string | null;
  firmaArchivoId: string | null;
  recibeNombre: string | null;
}

// ---------- Trayectos ----------

export type TipoTrayecto = 'entrega' | 'traslado' | 'flete' | 'mantenimiento' | 'otro';
export const TIPO_TRAYECTO: Record<TipoTrayecto, string> = {
  entrega: 'Entrega de orden',
  traslado: 'Traslado',
  flete: 'Flete',
  mantenimiento: 'A taller',
  otro: 'Otro',
};
/** Un recorrido de una unidad: los de entrega los crea el backend al terminar un viaje (km estimados); los demás se registran a mano. */
export interface Trayecto {
  id?: string;
  equipoId: string;
  sucursalId: string | null;
  /** UTC. */
  inicio: string;
  fin: string | null;
  tipo: TipoTrayecto;
  origen: string | null;
  destino: string | null;
  odometroInicio: number | null;
  odometroFin: number | null;
  km: number | null;
  kmEstimado: boolean;
  pedidoId: string | null;
  remisionId: string | null;
  operadorId: string | null;
  notas: string | null;
}
export interface ResumenRecorridos {
  trayectos: number;
  km: number;
  kmEstimados: number;
  viajes: number;
  m3: number | null;
  litros: number;
  costoCombustible: number;
  rendimientoKmL: number | null;
  ultimaCarga: { fecha: string; odometroKm: number | null; horometro: number | null } | null;
  ultimoOdometroKm: number | null;
  kmDesdeUltimaCarga: number;
}
/** Los dos avisos de combustible (iguales que en el backend): una carga cada 7 días o cada 500 km. */
export const AVISO_COMBUSTIBLE = { dias: 7, km: 500 };
/** ¿Toca registrar carga y odómetro? */
export function tocaCarga(r: Pick<ResumenRecorridos, 'ultimaCarga' | 'kmDesdeUltimaCarga'>, ahora = Date.now()): boolean {
  if (!r.ultimaCarga) return true;
  return ahora - Date.parse(r.ultimaCarga.fecha) > AVISO_COMBUSTIBLE.dias * 86_400_000 || r.kmDesdeUltimaCarga >= AVISO_COMBUSTIBLE.km;
}

// ---------- Combustible ----------

export interface CargaCombustible {
  id?: string;
  equipoId: string;
  sucursalId: string | null;
  /** UTC. */
  fecha: string;
  litros: number;
  costoTotal: number;
  odometroKm: number | null;
  horometro: number | null;
  operadorId: string | null;
  notas: string | null;
}

/**
 * Rendimiento de cada carga a tanque lleno: los km recorridos desde la carga anterior de esa unidad entre los litros de
 * esta (km/L) y, con horómetro, litros por hora (L/h). La primera carga de cada unidad no tiene con qué compararse.
 */
export function rendimientos(cargas: CargaCombustible[]): Map<string, { kmL: number | null; lh: number | null }> {
  const r = new Map<string, { kmL: number | null; lh: number | null }>();
  const porUnidad = new Map<string, CargaCombustible[]>();
  for (const c of cargas) porUnidad.set(c.equipoId, [...(porUnidad.get(c.equipoId) ?? []), c]);
  for (const lista of porUnidad.values()) {
    lista.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
    lista.forEach((c, i) => {
      const prev = lista[i - 1];
      const km = prev && c.odometroKm != null && prev.odometroKm != null ? c.odometroKm - prev.odometroKm : null;
      const h = prev && c.horometro != null && prev.horometro != null ? c.horometro - prev.horometro : null;
      r.set(c.id ?? '', {
        // Un odómetro que baja es un dato mal capturado: sin rendimiento
        kmL: km != null && km >= 0 && c.litros > 0 ? Math.round((km / c.litros) * 100) / 100 : null,
        lh: h != null && h > 0 ? Math.round((c.litros / h) * 100) / 100 : null,
      });
    });
  }
  return r;
}

// ---------- Mantenimiento ----------

export type EstadoMantenimiento = 'programado' | 'en_proceso' | 'terminado' | 'cancelado';
export const ESTADO_MANTENIMIENTO: Record<EstadoMantenimiento, string> = {
  programado: 'Programado',
  en_proceso: 'En proceso',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
};
export const TONO_MANTENIMIENTO: Record<EstadoMantenimiento, string> = {
  programado: 'bg-[#E6F0F4] text-[#2B5F75]',
  en_proceso: 'bg-[#FBF0DD] text-[#7A5410]',
  terminado: 'bg-[#E3EFE9] text-[#2E5E4A]',
  cancelado: 'bg-carbon/8 text-texto-suave',
};
export interface Mantenimiento {
  id?: string;
  equipoId: string;
  tipo: 'preventivo' | 'correctivo';
  descripcion: string;
  /** YYYY-MM-DD. */
  programadoPara: string | null;
  programadoKm: number | null;
  estado: EstadoMantenimiento;
  inicioEn: string | null;
  finEn: string | null;
  costo: number | null;
  taller: string | null;
  notas: string | null;
}
/** Qué se puede hacer desde cada estado (el backend también lo valida). */
export const ACCIONES_MANTENIMIENTO: Record<EstadoMantenimiento, { estado: EstadoMantenimiento; texto: string }[]> = {
  programado: [
    { estado: 'en_proceso', texto: 'Iniciar (pasa a taller)' },
    { estado: 'cancelado', texto: 'Cancelar' },
  ],
  en_proceso: [{ estado: 'terminado', texto: 'Terminar (vuelve a disponible)' }],
  terminado: [],
  cancelado: [],
};

/** Lista para logística: confirmada por Ventas o en solicitud de confirmación a planta (enviada o con actualización). */
export const gestionable = (p: { confirmadaEn?: string | null; estatusPlanta?: string | null }) =>
  !!p.confirmadaEn || p.estatusPlanta === 'enviado' || p.estatusPlanta === 'actualizacion';

export type Asignacion_ = 'sin_camion' | 'parcial' | 'completa';
export const ASIGNACION: Record<Asignacion_, string> = { sin_camion: 'Sin camión', parcial: 'Faltan m³', completa: 'Con camión' };
/** Sin camión = ninguna unidad; parcial = unidades, pero las ollas no completan los m³. */
export function asignacionDe(p: { unidades?: string[]; m3Asignados?: number; volumenM3: number }): Asignacion_ {
  if (!p.unidades?.length) return 'sin_camion';
  return (p.m3Asignados ?? 0) < p.volumenM3 ? 'parcial' : 'completa';
}

/** Órdenes de logística a las que aún les falta camión (ninguna unidad, o las ollas no completan los m³). */
export function sinCamion(pedidos: { confirmadaEn?: string | null; estatusPlanta?: string | null; estado: string; unidades?: string[]; m3Asignados?: number; volumenM3: number }[]): number {
  return pedidos.filter(
    (p) => gestionable(p) && !['entregado', 'cancelado'].includes(p.estado) && (!p.unidades?.length || (p.m3Asignados ?? 0) < p.volumenM3),
  ).length;
}

/** "08:00–11:00" de la ventana de un viaje, en la hora de la planta. */
export function textoVentana(v: Pick<Viaje, 'salidaProgramada' | 'regresoEstimado'>, zona: string): string {
  if (!v.salidaProgramada || !v.regresoEstimado) return '';
  const h = (iso: string) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zona }).format(new Date(iso));
  return `${h(v.salidaProgramada)}–${h(v.regresoEstimado)}`;
}

/** El estado que se ve en la flota: el manual (mantenimiento, fuera de servicio, baja) o, si está disponible, si va en un viaje. */
export function estadoFila(f: Pick<FilaTablero, 'equipo' | 'viaje'>): { id: string; texto: string; tono: string } {
  if (!f.equipo.activo) return { id: 'baja', texto: 'Dada de baja', tono: 'bg-carbon/8 text-texto-suave' };
  if (f.equipo.estado === 'mantenimiento') return { id: 'mantenimiento', texto: ESTADO_UNIDAD.mantenimiento, tono: 'bg-[#FBF0DD] text-[#7A5410]' };
  if (f.equipo.estado === 'fuera_de_servicio') return { id: 'fuera_de_servicio', texto: ESTADO_UNIDAD.fuera_de_servicio, tono: 'bg-[#F6E3E1] text-[#8E332C]' };
  if (f.viaje) return { id: 'en_viaje', texto: `${ESTADO_VIAJE[f.viaje.estado]} · ${f.viaje.pedidoFolio}`, tono: 'bg-[#E6F0F4] text-[#2B5F75]' };
  return { id: 'disponible', texto: 'Disponible', tono: 'bg-[#E3EFE9] text-[#2E5E4A]' };
}

/** "7 m³", "12 t" o "—". */
export const textoCapacidad = (u: Pick<Unidad, 'capacidad' | 'unidadCapacidad'>) =>
  u.capacidad ? `${u.capacidad.toLocaleString('es-MX')} ${u.unidadCapacidad ?? ''}`.trim() : '—';
