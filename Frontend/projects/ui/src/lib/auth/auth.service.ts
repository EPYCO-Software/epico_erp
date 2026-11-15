import { InjectionToken, Service, computed, inject, signal } from '@angular/core';

/** Planta de una razón social, como la devuelve el login del backend. */
export interface PlantaSesion {
  id: string;
  codigo: string;
  nombre: string;
  zonaHoraria: string;
  lat: number | null;
  lng: number | null;
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
 * shortcut: el portal aún no la provee (el backend no tiene usuarios de portal); proveerla cuando los tenga.
 */
export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL');

@Service()
export class AuthService {
  private readonly key = inject(AUTH_STORAGE_KEY);
  private readonly api = inject(AUTH_API_URL, { optional: true });
  private readonly _sesion = signal<Sesion | null>(this.leer());
  /** Un solo refresh a la vez: varias peticiones con 401 esperan el mismo. */
  private refrescando: Promise<Sesion | null> | null = null;

  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);

  async login(c: Credenciales): Promise<Sesion> {
    const sesion = this.api ? await this.pedir('/auth/login', { correo: c.correo, password: c.password, empresaId: c.empresaId }) : await demo(c);
    this.guardar(sesion, c.recordar);
    return sesion;
  }

  /** Token nuevo con el refresh token (que también cambia). Si ya no sirve, cierra la sesión y devuelve null. */
  refrescar(): Promise<Sesion | null> {
    const refreshToken = this._sesion()?.refreshToken;
    if (!this.api || !refreshToken) return Promise.resolve(null);
    this.refrescando ??= this.pedir('/auth/refresh', { refreshToken })
      .then((s) => {
        this.guardar(s, this.recordada());
        return s;
      })
      .catch(() => {
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
  }

  private async pedir(ruta: string, cuerpo: object): Promise<Sesion> {
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
    return (await r.json()) as Sesion;
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
