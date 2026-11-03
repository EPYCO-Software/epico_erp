import { InjectionToken, Service, computed, inject, signal } from '@angular/core';

export interface Sesion {
  usuario: { nombre: string; correo: string };
  /** Solo en el ERP: concretera con la que entró el usuario. */
  empresaId?: string;
  token: string;
}

export interface Credenciales {
  correo: string;
  password: string;
  empresaId?: string;
  /** true: la sesión sobrevive al cerrar el navegador (localStorage); false: solo esta pestaña. */
  recordar: boolean;
}

/** Clave de almacenamiento de la sesión. Cada app provee la suya para que ERP y portal no compartan sesión. */
export const AUTH_STORAGE_KEY = new InjectionToken<string>('AUTH_STORAGE_KEY');

@Service()
export class AuthService {
  private readonly key = inject(AUTH_STORAGE_KEY);
  private readonly _sesion = signal<Sesion | null>(this.leer());

  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);

  async login(c: Credenciales): Promise<Sesion> {
    // shortcut: login estático, acepta cualquier credencial. Reemplazar por la llamada al backend
    // (que devuelva el token y lance error con credenciales inválidas) sin cambiar esta firma.
    await new Promise((r) => setTimeout(r, 600));
    const sesion: Sesion = {
      usuario: { nombre: c.correo.split('@')[0] || 'Usuario', correo: c.correo },
      empresaId: c.empresaId,
      token: 'demo',
    };
    this.borrar();
    this.escribir(c.recordar ? localStorage : sessionStorage, sesion);
    this._sesion.set(sesion);
    return sesion;
  }

  logout(): void {
    this.borrar();
    this._sesion.set(null);
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
