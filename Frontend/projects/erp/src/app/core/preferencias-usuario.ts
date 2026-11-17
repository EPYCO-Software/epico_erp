import { HttpClient } from '@angular/common/http';
import { Service, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService } from 'ui';

/** El usuario en sesión según GET /me (sin contraseña). */
export interface Yo {
  id: string;
  correo: string;
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
  puesto: string | null;
  fotoArchivoId: string | null;
}

/** Una sesión vigente del usuario (GET /me/sesiones). */
export interface SesionAbierta {
  id: string;
  creadaEn: string;
  expiraEn: string;
  ip: string | null;
  agente: string | null;
  /** La de este navegador. */
  actual: boolean;
}

/** Lo que el ERP guarda por usuario (PUT /me/preferencias reemplaza el objeto completo). */
export interface ValoresUsuario {
  /** Diálogo de Preferencias (el teléfono también va al perfil, PUT /me). */
  preferencias?: Partial<{ telefono: string; firma: string; notificaciones: 'erp' | 'correo'; plantaId: string; fueraDesde: string; fueraHasta: string; fueraMensaje: string }>;
}

/**
 * Perfil y preferencias del usuario en sesión. Con backend (AUTH_API_URL) se leen al entrar de /me y
 * /me/preferencias y se guardan allá; sin él (pruebas, demo) viven en memoria.
 */
@Service()
export class PreferenciasUsuario {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AUTH_API_URL, { optional: true });
  readonly valores = signal<ValoresUsuario>({});
  readonly yo = signal<Yo | null>(null);
  /** Cambia cada vez que llegan del backend (para aplicar la planta predeterminada una vez por sesión). */
  readonly cargadas = signal(0);

  constructor() {
    const auth = inject(AuthService);
    effect(() => {
      const id = auth.sesion()?.usuario.id;
      untracked(() => {
        this.valores.set({});
        this.yo.set(null);
        if (id && this.base) void this.cargar();
      });
    });
  }

  private async cargar(): Promise<void> {
    try {
      const [valores, yo] = await Promise.all([
        firstValueFrom(this.http.get<ValoresUsuario>(`${this.base}/me/preferencias`)),
        firstValueFrom(this.http.get<Yo>(`${this.base}/me`)),
      ]);
      this.valores.set(valores ?? {});
      this.yo.set(yo);
      this.cargadas.update((n) => n + 1);
    } catch {
      // Sin preferencias guardadas el ERP sigue con las de siempre
    }
  }

  /** Mezcla y guarda; si el backend falla, lanza y no cambia nada. */
  async guardar(cambios: ValoresUsuario): Promise<void> {
    const nuevas = { ...this.valores(), ...cambios };
    if (this.base) await firstValueFrom(this.http.put(`${this.base}/me/preferencias`, nuevas));
    this.valores.set(nuevas);
  }

  /** El teléfono es del perfil (PUT /me manda el perfil completo). */
  async guardarTelefono(telefono: string): Promise<void> {
    const yo = this.yo();
    if (!this.base || !yo || (yo.telefono ?? '') === telefono) return;
    const { nombre, apellidos, puesto, fotoArchivoId } = yo;
    this.yo.set(await firstValueFrom(this.http.put<Yo>(`${this.base}/me`, { nombre, apellidos, telefono: telefono || null, puesto, fotoArchivoId })));
  }

  /** Las sesiones vigentes, la más reciente primero; sin backend, ninguna. */
  sesiones(): Promise<SesionAbierta[]> {
    return this.base ? firstValueFrom(this.http.get<SesionAbierta[]>(`${this.base}/me/sesiones`)) : Promise.resolve([]);
  }

  /** Su refresh deja de servir (el token vive hasta 15 min). */
  cerrarSesionRemota(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.base}/me/sesiones/${id}`));
  }

  /** 400 si la actual no es; cierra las demás sesiones (la actual sigue). */
  cambiarPassword(actual: string, nueva: string): Promise<unknown> {
    if (!this.base) return Promise.resolve();
    return firstValueFrom(this.http.put(`${this.base}/me/password`, { actual, nueva }));
  }
}
