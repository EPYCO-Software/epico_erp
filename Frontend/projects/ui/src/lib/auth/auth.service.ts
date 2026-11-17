import { InjectionToken, Service, computed, inject, signal } from '@angular/core';

/** Planta de una razón social, como la devuelve el login del backend. */
export interface PlantaSesion {
  id: string;
  codigo: string;
  nombre: string;
  zonaHoraria: string;
  lat: number | null;
  lng: number | null;
  /** Traslado de la planta: km incluidos en el precio y $ por km adicional por m³. */
  kmIncluidos?: number;
  precioKm?: number;
}

/** Razón social a la que el usuario tiene acceso, con sus plantas. */
export interface EmpresaSesion {
  id: string;
  nombre: string;
  plantas: PlantaSesion[];
}

export interface Sesion {
  usuario: { id?: string; nombre: string; correo: string };
  /** Solo en el ERP: razón social con la que entró el usuario. */
  empresaId?: string;
  /** JWT (15 min en el backend). */
  token: string;
  /** ISO UTC en que vence el token. */
  tokenExpira?: string;
  /** Renueva el token sin volver a pedir la contraseña (14 días). */
  refreshToken?: string;
  empresas?: EmpresaSesion[];
  /** "*" = todos. */
  permisos?: string[];
  /** Solo en el portal: el cliente del usuario (todo lo que ve es de él). */
  cliente?: { id: string; nombre: string } | null;
}

export interface Credenciales {
  correo: string;
  password: string;
  empresaId?: string;
  /** true: la sesión sobrevive al cerrar el navegador (localStorage); false: solo esta pestaña. */
  recordar: boolean;
}

/** Fallo del login o del refresh: el status HTTP y el mensaje del backend (ProblemDetails.detail). */
export class ErrorAuth extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Clave de almacenamiento de la sesión. Cada app provee la suya para que ERP y portal no compartan sesión. */
export const AUTH_STORAGE_KEY = new InjectionToken<string>('AUTH_STORAGE_KEY');

/**
 * Base de la API de autenticación ("/api/v1"). Si la app no la provee, el login es de demostración.
 */
export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL');

/** De qué app es el login (el backend no deja entrar a un usuario del portal en el ERP ni al revés). */
export const AUTH_APP = new InjectionToken<'erp' | 'portal'>('AUTH_APP', { factory: () => 'erp' });

@Service()
export class AuthService {
  private readonly key = inject(AUTH_STORAGE_KEY);
  private readonly app = inject(AUTH_APP);
  private readonly api = inject(AUTH_API_URL, { optional: true });
  private readonly _sesion = signal<Sesion | null>(this.leer());
  /** Un solo refresh a la vez: varias peticiones con 401 esperan el mismo. */
  private refrescando: Promise<Sesion | null> | null = null;
  /** La validación de la sesión guardada, una vez por carga de la app (o la del login recién hecho). */
  private validada: Promise<boolean> | null = null;

  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);
  /** La última validación o renovación no llegó al servidor (red o 5xx): la sesión se conserva, pero no se entra. */
  readonly sinConexion = signal(false);

  async login(c: Credenciales): Promise<Sesion> {
    const sesion = this.api ? await this.pedir('/auth/login', { correo: c.correo, password: c.password, empresaId: c.empresaId, app: this.app }) : await demo(c);
    this.guardar(sesion, c.recordar);
    this.validada = Promise.resolve(true);
    return sesion;
  }

  /**
   * ¿La sesión guardada sigue viva en el servidor? Al abrir la app no se confía en lo que hay en el navegador: se
   * renueva con el refresh token (el backend lo rechaza si se cerró la sesión, el usuario está inactivo, etc.) y
   * así también llegan permisos y empresas al día. Si el servidor la rechaza, se borra. Si no responde (red o 5xx),
   * se conserva pero no se entra (sinConexion) y se vuelve a intentar en la siguiente navegación. Sin backend (demo), sí.
   */
  validar(): Promise<boolean> {
    if (!this._sesion()) return Promise.resolve(false);
    if (!this.api) return Promise.resolve(true);
    if (!this._sesion()?.refreshToken) {
      this.logout();
      return Promise.resolve(false);
    }
    this.validada ??= this.refrescar().then((s) => {
      if (!s) this.validada = null;
      return !!s;
    });
    return this.validada;
  }

  /**
   * Token nuevo con el refresh token (que también cambia). Si el servidor ya no lo acepta, cierra la sesión y devuelve
   * null; si no responde (red o 5xx), devuelve null sin cerrarla, para no sacar a todos cuando el servidor se cae.
   */
  refrescar(): Promise<Sesion | null> {
    const refreshToken = this._sesion()?.refreshToken;
    if (!this.api || !refreshToken) return Promise.resolve(null);
    this.refrescando ??= this.pedir('/auth/refresh', { refreshToken })
      .then((s) => {
        this.guardar(s, this.recordada());
        this.sinConexion.set(false);
        return s;
      })
      .catch((e: unknown) => {
        if (e instanceof ErrorAuth && (e.status === 0 || e.status >= 500)) {
          this.sinConexion.set(true);
          return null;
        }
        // Otra pestaña ya lo rotó (la sesión es la misma en localStorage): se usa el suyo, ya renovado.
        const guardada = this.leer();
        if (guardada?.refreshToken && guardada.refreshToken !== refreshToken) {
          this._sesion.set(guardada);
          return guardada;
        }
        this.logout();
        return null;
      })
      .finally(() => (this.refrescando = null));
    return this.refrescando;
  }

  logout(): void {
    const refreshToken = this._sesion()?.refreshToken;
    // Avisa al backend para que el refresh token deje de servir; si falla, igual se cierra aquí.
    if (this.api && refreshToken) void fetch(`${this.api}/auth/logout`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ refreshToken }) }).catch(() => {});
    this.borrar();
    this._sesion.set(null);
    this.validada = null;
  }

  /** true si hay backend: sin él (demo) no se puede recuperar la contraseña. */
  readonly conServidor = !!this.api;

  /** Manda el enlace para restablecer la contraseña. El backend responde igual exista o no el correo. */
  async olvide(correo: string): Promise<void> {
    await this.pedir<void>('/auth/olvide', { correo });
  }

  /** Nueva contraseña con el token del enlace del correo; cierra todas las sesiones de ese usuario. */
  async restablecer(token: string, password: string): Promise<void> {
    await this.pedir<void>('/auth/restablecer', { token, password });
  }

  private async pedir<T = Sesion>(ruta: string, cuerpo: object): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.api}${ruta}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(cuerpo) });
    } catch {
      throw new ErrorAuth(0, 'No hay conexión con el servidor. Intenta de nuevo en un momento.');
    }
    if (!r.ok) {
      const problema = (await r.json().catch(() => null)) as { detail?: string } | null;
      throw new ErrorAuth(r.status, problema?.detail ?? '');
    }
    return (r.status === 204 ? undefined : await r.json()) as T;
  }

  private guardar(sesion: Sesion, recordar: boolean): void {
    this.borrar();
    this.escribir(recordar ? localStorage : sessionStorage, sesion);
    this._sesion.set(sesion);
  }

  /** La sesión actual se guardó con "Mantener sesión" (localStorage). */
  private recordada(): boolean {
    try {
      return localStorage.getItem(this.key) !== null;
    } catch {
      return false;
    }
  }

  private leer(): Sesion | null {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const raw = storage.getItem(this.key);
        if (!raw) continue;
        const s = JSON.parse(raw) as Partial<Sesion>;
        if (typeof s?.token === 'string' && typeof s.usuario?.correo === 'string') return s as Sesion;
      } catch {
        // Almacenamiento bloqueado o JSON corrupto: se trata como sin sesión.
      }
    }
    return null;
  }

  private escribir(storage: Storage, sesion: Sesion): void {
    try {
      storage.setItem(this.key, JSON.stringify(sesion));
    } catch {
      // Sin almacenamiento (modo privado estricto): la sesión vive solo en memoria.
    }
  }

  private borrar(): void {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.removeItem(this.key);
      } catch {
        // ignorado: ver escribir()
      }
    }
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Login de demostración: acepta cualquier credencial (apps sin AUTH_API_URL). */
async function demo(c: Credenciales): Promise<Sesion> {
  await new Promise((r) => setTimeout(r, 600));
  return { usuario: { nombre: c.correo.split('@')[0] || 'Usuario', correo: c.correo }, empresaId: c.empresaId, token: 'demo' };
}
