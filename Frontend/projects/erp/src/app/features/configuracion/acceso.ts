import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService } from 'ui';
import { TODOS, tiene } from '../../core/permisos';

// ---------- forma de la API (/api/v1) ----------

export interface Usuario {
  id: string;
  correo: string;
  tipo: 'interno' | 'portal';
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
  puesto: string | null;
  fotoArchivoId: string | null;
  activo: boolean;
  correoVerificado: boolean;
  intentosFallidos: number;
  /** ISO; mientras esté en el futuro no puede entrar (5 intentos fallidos). */
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  createdAt: string;
  /** Su rol (perfil): la plantilla de sus permisos, el mismo en todas sus empresas. */
  rolId: string | null;
}

/** A qué empresa entra un usuario (sin planta = todas las de la empresa). Sus permisos son los mismos en todas. */
export interface AccesoUsuario {
  id?: string;
  usuarioId?: string;
  empresaId: string;
  sucursalId: string | null;
  predeterminado: boolean;
}

export interface Rol {
  id: string;
  organizacionId: string | null;
  /** Rol del sistema (Root, Administrador, Ventas): solo root lo cambia. */
  sistema?: boolean;
  nombre: string;
  descripcion: string | null;
  permisos?: string[];
  /** Cuántos usuarios lo tienen. */
  usuarios?: number;
}

/** Una clave del catálogo de GET /permisos. */
export interface Permiso {
  clave: string;
  modulo: string;
  moduloNombre: string;
  recurso: string;
  recursoNombre: string;
  accion: string;
  accionNombre: string;
  descripcion?: string;
}

export interface SesionUsuario {
  id: string;
  usuarioId: string;
  empresaId: string | null;
  creadaEn: string;
  expiraEn: string;
  revocadaEn: string | null;
  ip: string | null;
  agente: string | null;
}

export type DatosUsuario = Pick<Usuario, 'correo' | 'nombre' | 'apellidos' | 'telefono' | 'puesto' | 'rolId'>;

// ---------- reglas (sin estado, con pruebas) ----------

// tiene y TODOS viven en core/permisos.ts (también los usan el menú y las rutas).
export { TODOS, tiene };

export interface GrupoPermisos {
  modulo: string;
  nombre: string;
  recursos: { recurso: string; nombre: string; acciones: Permiso[] }[];
}

/** El catálogo por módulo y recurso, en el orden en que llega (sin "*"). */
export function agruparPermisos(catalogo: readonly Permiso[]): GrupoPermisos[] {
  const grupos: GrupoPermisos[] = [];
  for (const p of catalogo) {
    if (p.clave === TODOS) continue;
    let g = grupos.find((x) => x.modulo === p.modulo);
    if (!g) grupos.push((g = { modulo: p.modulo, nombre: p.moduloNombre, recursos: [] }));
    let r = g.recursos.find((x) => x.recurso === p.recurso);
    if (!r) g.recursos.push((r = { recurso: p.recurso, nombre: p.recursoNombre, acciones: [] }));
    r.acciones.push(p);
  }
  return grupos;
}

/** "todas" | "algunas" | "ninguna" de las claves están cubiertas por la selección (casilla de un módulo). */
export function estadoClaves(seleccion: ReadonlySet<string>, claves: readonly string[]): 'todas' | 'algunas' | 'ninguna' {
  const s = [...seleccion];
  const n = claves.filter((c) => tiene(s, c)).length;
  return n === 0 ? 'ninguna' : n === claves.length ? 'todas' : 'algunas';
}

/**
 * Marca o desmarca una clave. Desmarcar una cubierta por un comodín ("ventas.*") cambia el comodín por las claves del
 * catálogo que cubría, menos esa (deja de cubrir las que se agreguen después en ese módulo).
 */
export function alternarClave(seleccion: ReadonlySet<string>, clave: string, catalogo: readonly string[]): Set<string> {
  const n = new Set(seleccion);
  if (!tiene([...n], clave)) return n.add(clave);
  n.delete(clave);
  for (const w of [...n].filter((p) => p !== '*' && p.endsWith('.*') && tiene([p], clave))) {
    n.delete(w);
    for (const c of catalogo) if (c !== clave && tiene([w], c)) n.add(c);
  }
  return n;
}

// ---------- permisos por usuario (sobre los de su rol) ----------

/**
 * Lo que un usuario tiene distinto de su rol: permisos que se le agregan y que se le quitan. Sus permisos efectivos son
 * los del rol más los agregados, menos los quitados (la misma regla que el backend).
 */
export interface AjustesUsuario {
  agregados: string[];
  quitados: string[];
}

export const SIN_AJUSTES: AjustesUsuario = { agregados: [], quitados: [] };

/** GET /usuarios/{id}/permisos: los ajustes y lo que da su rol (unión de los roles de sus accesos). */
export interface PermisosUsuario extends AjustesUsuario {
  delRol: string[];
}

/** Cambia los comodines ("ventas.*") por las claves del catálogo que cubren: la matriz trabaja con claves sueltas. */
export function expandir(claves: readonly string[], catalogo: readonly string[]): string[] {
  return [...new Set(claves.flatMap((c) => (c === TODOS || c.endsWith('.*') ? catalogo.filter((k) => tiene([c], k)) : [c])))];
}

/** ¿El usuario tiene esa clave? Por su rol o porque se le agregó, y que no se le haya quitado. */
export function permitido(delRol: readonly string[], a: AjustesUsuario, clave: string): boolean {
  return (tiene(delRol, clave) || a.agregados.includes(clave)) && !tiene(a.quitados, clave);
}

/**
 * Marca o desmarca una clave para el usuario guardando solo la diferencia con su rol: si el rol ya la da, desmarcarla
 * la quita (y marcarla deshace el quitado); si no, marcarla la agrega.
 */
export function ponerPermiso(delRol: readonly string[], a: AjustesUsuario, clave: string, marcar: boolean): AjustesUsuario {
  const delRolLaDa = tiene(delRol, clave);
  const agregados = a.agregados.filter((c) => c !== clave);
  const quitados = a.quitados.filter((c) => c !== clave);
  if (marcar && !delRolLaDa) agregados.push(clave);
  if (!marcar && delRolLaDa) quitados.push(clave);
  return { agregados, quitados };
}

/** Nombre para mostrar: "Ana Pech", o el correo si no hay nombre. */
export const nombreUsuario = (u: Pick<Usuario, 'nombre' | 'apellidos' | 'correo'>) =>
  [u.nombre, u.apellidos].filter(Boolean).join(' ').trim() || u.correo;

/** Situación para la lista: inactivo, bloqueado (por intentos) o activo. */
export function estadoUsuario(u: Pick<Usuario, 'activo' | 'bloqueadoHasta'>, ahora = Date.now()): 'activo' | 'inactivo' | 'bloqueado' {
  if (!u.activo) return 'inactivo';
  return u.bloqueadoHasta && Date.parse(u.bloqueadoHasta) > ahora ? 'bloqueado' : 'activo';
}

/** Accesos válidos: al menos uno, sin repetir empresa y planta, y uno solo predeterminado (el primero si no hay). */
export function limpiarAccesos(accesos: readonly AccesoUsuario[]): AccesoUsuario[] {
  const vistos = new Set<string>();
  const unicos = accesos.filter((a) => {
    const k = `${a.empresaId}|${a.sucursalId ?? ''}`;
    return a.empresaId && !vistos.has(k) && vistos.add(k);
  });
  const pred = Math.max(0, unicos.findIndex((a) => a.predeterminado));
  return unicos.map((a, i) => ({ empresaId: a.empresaId, sucursalId: a.sucursalId || null, predeterminado: i === pred }));
}

// ---------- servicio ----------

/**
 * Usuarios, roles y permisos de la organización (Seguridad y plataforma). Todo vive en el backend: sin AUTH_API_URL
 * (pruebas) las listas quedan vacías. Cada escritura lanza el error del servidor (mensajeDe de Ventas lo traduce).
 */
@Service()
export class AccesoService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AUTH_API_URL, { optional: true });
  private readonly auth = inject(AuthService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly accesos = signal<AccesoUsuario[]>([]);
  /** Con sus permisos y cuántos accesos los usan (GET /roles/resumen). */
  readonly roles = signal<Rol[]>([]);
  readonly catalogo = signal<Permiso[]>([]);
  readonly cargando = signal(false);
  readonly errorCarga = signal('');

  /** Los permisos de quien está en sesión: no puede dar los que no tiene. */
  readonly mios = computed(() => this.auth.sesion()?.permisos ?? []);
  readonly soyRoot = computed(() => this.mios().includes(TODOS));
  readonly yoId = computed(() => this.auth.sesion()?.usuario.id);
  /** Empresas y plantas a las que puede dar acceso: las suyas. */
  readonly empresas = computed(() => this.auth.sesion()?.empresas ?? []);

  constructor() {
    effect(() => {
      const id = this.auth.sesion()?.usuario.id;
      untracked(() => (id && this.base ? void this.recargar() : undefined));
    });
  }

  private get<T>(ruta: string) {
    return firstValueFrom(this.http.get<T>(this.base + ruta));
  }

  async recargar(): Promise<void> {
    if (!this.base) return;
    this.cargando.set(true);
    this.errorCarga.set('');
    try {
      const [usuarios, accesos, roles, catalogo] = await Promise.all([
        this.get<Usuario[]>('/usuarios?tipo=interno&take=500'),
        this.get<AccesoUsuario[]>('/usuario-accesos?take=500'),
        this.get<Rol[]>('/roles/resumen'),
        this.get<Permiso[]>('/permisos').catch(() => [] as Permiso[]),
      ]);
      this.usuarios.set(usuarios);
      this.accesos.set(accesos);
      this.roles.set(roles);
      this.catalogo.set(catalogo);
    } catch (e) {
      this.errorCarga.set((e as { status?: number }).status === 403 ? 'No tienes permiso para administrar usuarios.' : 'No se pudieron cargar los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  usuario(id: string): Usuario | null {
    return this.usuarios().find((u) => u.id === id) ?? null;
  }

  accesosDe(usuarioId: string): AccesoUsuario[] {
    return this.accesos().filter((a) => a.usuarioId === usuarioId);
  }

  rol(id: string): Rol | null {
    return this.roles().find((r) => r.id === id) ?? null;
  }

  /** "Planta Escárcega" / "Todas las plantas" y la razón social, para mostrar un acceso. */
  describirAcceso(a: AccesoUsuario): { empresa: string; planta: string } {
    const e = this.empresas().find((x) => x.id === a.empresaId);
    return {
      empresa: e?.nombre ?? 'Otra empresa',
      planta: a.sucursalId ? (e?.plantas.find((p) => p.id === a.sucursalId)?.nombre ?? 'Otra planta') : 'Todas las plantas',
    };
  }

  /** Cuántos usuarios tienen ese rol (si el backend no lo manda). */
  usuariosConRol(rolId: string): number {
    return this.usuarios().filter((u) => u.rolId === rolId).length;
  }

  // ----- usuarios -----

  /** Alta con sus accesos, sus ajustes de permisos (y contraseña inicial, si viene) en una sola operación. */
  async crearUsuario(datos: DatosUsuario, accesos: AccesoUsuario[], password: string | null, ajustes: AjustesUsuario = SIN_AJUSTES): Promise<Usuario> {
    const u = await firstValueFrom(
      this.http.post<Usuario>(`${this.base}/usuarios/alta`, {
        ...datos,
        password: password || null,
        accesos: limpiarAccesos(accesos),
        agregados: ajustes.agregados,
        quitados: ajustes.quitados,
      }),
    );
    await this.recargar();
    return u;
  }

  /** Datos (con su rol) y accesos (PUT manda el usuario completo; los accesos se reemplazan). */
  async guardarUsuario(id: string, datos: DatosUsuario, accesos: AccesoUsuario[]): Promise<void> {
    const u = this.usuario(id)!;
    await firstValueFrom(this.http.put(`${this.base}/usuarios/${id}`, { ...u, ...datos }));
    await firstValueFrom(this.http.put(`${this.base}/usuarios/${id}/accesos`, { accesos: limpiarAccesos(accesos) }));
    await this.recargar();
  }

  async activar(id: string, activo: boolean): Promise<void> {
    const u = this.usuario(id)!;
    const nuevo = await firstValueFrom(this.http.put<Usuario>(`${this.base}/usuarios/${id}`, { ...u, activo }));
    this.usuarios.update((l) => l.map((x) => (x.id === id ? nuevo : x)));
  }

  /** También lo desbloquea (intentos fallidos a cero). */
  async asignarPassword(id: string, password: string): Promise<void> {
    await firstValueFrom(this.http.put(`${this.base}/usuarios/${id}/password`, { password }));
    this.usuarios.update((l) => l.map((x) => (x.id === id ? { ...x, intentosFallidos: 0, bloqueadoHasta: null } : x)));
  }

  /** Las vigentes primero (sin revocar ni vencer). */
  async sesiones(usuarioId: string): Promise<SesionUsuario[]> {
    const lista = await this.get<SesionUsuario[]>(`/sesiones?usuarioId=${usuarioId}`);
    const ahora = Date.now();
    return lista.filter((s) => !s.revocadaEn && Date.parse(s.expiraEn) > ahora);
  }

  cerrarSesion(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/sesiones/${id}`));
  }

  // ----- roles -----

  async crearRol(nombre: string, descripcion: string, permisos: string[]): Promise<Rol> {
    const r = await firstValueFrom(this.http.post<Rol>(`${this.base}/roles`, { nombre, descripcion: descripcion || null, organizacionId: null }));
    // Sin organización lo pone el backend en la del usuario (roles del sistema solo los crea root desde el seed)
    await firstValueFrom(this.http.put(`${this.base}/roles/${r.id}/permisos`, { permisos }));
    await this.recargar();
    return r;
  }

  async guardarRol(id: string, nombre: string, descripcion: string, permisos: string[]): Promise<void> {
    const r = this.rol(id)!;
    await firstValueFrom(
      this.http.put(`${this.base}/roles/${id}`, { id, organizacionId: r.organizacionId, nombre, descripcion: descripcion || null }),
    );
    await firstValueFrom(this.http.put(`${this.base}/roles/${id}/permisos`, { permisos }));
    await this.recargar();
  }

  /** Los permisos de un usuario: lo que le da su rol y lo que se le agregó o quitó. */
  permisosDe(id: string): Promise<PermisosUsuario> {
    return this.get<PermisosUsuario>(`/usuarios/${id}/permisos`);
  }

  /** Reemplaza lo agregado y lo quitado (el rol no cambia). Aplica cuando vuelva a entrar o renueve su sesión. */
  async guardarPermisos(id: string, a: AjustesUsuario): Promise<void> {
    await firstValueFrom(this.http.put(`${this.base}/usuarios/${id}/permisos`, { agregados: a.agregados, quitados: a.quitados }));
  }

  /** Lo que dan los roles elegidos (para precargar la matriz al dar de alta). */
  permisosDeRoles(rolIds: readonly string[]): string[] {
    return [...new Set(rolIds.flatMap((id) => this.rol(id)?.permisos ?? []))];
  }

  async eliminarRol(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/roles/${id}`));
    await this.recargar();
  }
}
