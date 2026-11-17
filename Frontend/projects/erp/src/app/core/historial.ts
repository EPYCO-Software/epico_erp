import { Service, computed, inject, signal } from '@angular/core';
import { AuthService } from 'ui';

export type TipoActividad = 'pendiente' | 'correo' | 'llamada' | 'reunion' | 'documento';

/** En el orden del diálogo "Programar actividad", como en Odoo. */
export const TIPOS_ACTIVIDAD: Record<TipoActividad, string> = {
  pendiente: 'Actividades pendientes',
  correo: 'Correo electrónico',
  llamada: 'Llamada',
  reunion: 'Reunión',
  documento: 'Documento',
};

/** Un campo que cambió, como el seguimiento de Odoo: "$4,455.66 → $1,908.33 (Total)". */
export interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

/** Una entrada del historial de un registro: qué pasó, quién y cuándo. */
export interface EventoHistorial {
  id: string;
  /** Registro al que pertenece: "cotizacion:EPI-PRES-ESC-26092", "pedido:PED-26-0151", "cliente:c-maya"… */
  registro: string;
  /** ISO 8601 */
  fecha: string;
  autor: string;
  texto: string;
  detalles?: string[];
  cambios?: Cambio[];
  /** Nota interna escrita a mano (se ve distinta de lo que registra el sistema). */
  nota?: boolean;
  /** Programar, hacer o cancelar una actividad: como la nota, no cuenta como edición del registro. */
  actividad?: boolean;
}

export interface Actividad {
  id: string;
  registro: string;
  tipo: TipoActividad;
  resumen: string;
  /** yyyy-MM-dd */
  fechaLimite: string;
  asignadaA: string;
  nota: string;
}

export type NuevaActividad = Omit<Actividad, 'id'>;

/** "Llamada · Confirmar bombeo"; si el resumen es el del tipo, solo "Llamada". */
export const tituloActividad = (a: Pick<Actividad, 'tipo' | 'resumen'>) =>
  a.resumen && a.resumen !== TIPOS_ACTIVIDAD[a.tipo] ? `${TIPOS_ACTIVIDAD[a.tipo]} · ${a.resumen}` : TIPOS_ACTIVIDAD[a.tipo];

let siguiente = 1;
const nuevoId = () => `h-${Date.now().toString(36)}-${siguiente++}`;
/** Las actividades creadas en memoria (registro que no es del backend) llevan id local. */
const esLocal = (id: string) => id.startsWith('h-');
const dia = (fecha: string) => fecha.split('-').reverse().join('/');

/**
 * Historial de cada registro del ERP, como el chatter de Odoo pero sin mensajes: lo que hacen las pantallas (enviar,
 * confirmar, guardar cambios…) con sus campos antes → después, notas internas y actividades programadas. Cada
 * pantalla registra en el suyo con una clave "tipo:id"; layout/historial.ts lo muestra a la derecha.
 */
@Service()
export class HistorialService {
  // shortcut: en memoria (se pierde al recargar). Con backend, cada registro trae su historial y las acciones lo
  // escriben en el servidor, con su autor y hora reales; esta API no cambia.
  private readonly auth = inject(AuthService);
  private readonly eventos = signal<EventoHistorial[]>([]);
  private readonly actividades = signal<Actividad[]>([]);

  /** Quien está en sesión ("operaciones" → "Operaciones"). */
  readonly usuario = computed(() => {
    const nombre = this.auth.sesion()?.usuario.nombre || 'Usuario';
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  });

  /**
   * Con API: el hilo de los registros de Ventas vive en el backend (lo genera al guardar); VentasService lo conecta.
   * Sin ella (pruebas, demo), todo queda en memoria.
   */
  remoto: {
    cargar(registro: string): Promise<EventoHistorial[] | null>;
    nota(registro: string, texto: string): Promise<boolean>;
    /** Pendientes del registro; null si el registro no es del backend. */
    actividades(registro: string): Promise<Actividad[] | null>;
    /** La guarda (hecha = ya realizada); null si el registro no es del backend. */
    programar(a: NuevaActividad, hecha: boolean): Promise<Actividad | null>;
    cerrar(a: Actividad, como: 'hecha' | 'cancelada'): Promise<void>;
  } | null = null;
  /** Con API: a quién se puede asignar una actividad (los usuarios de la organización). */
  readonly personas = signal<string[] | null>(null);
  /** Los eventos que vinieron del backend (se reemplazan al recargar; los locales, como actividades, se quedan). */
  private readonly delServidor = new Set<string>();

  /** Trae del backend el hilo de un registro (si es de los que tiene); sin API no hace nada. */
  async cargar(registro: string): Promise<void> {
    const [eventos, actividades] = await Promise.all([
      this.remoto?.cargar(registro).catch(() => null),
      this.remoto?.actividades(registro).catch(() => null),
    ]);
    if (actividades) this.actividades.update((lista) => [...lista.filter((a) => a.registro !== registro), ...actividades]);
    if (!eventos) return;
    this.eventos.update((lista) => [...lista.filter((e) => !(e.registro === registro && this.delServidor.has(e.id))), ...eventos]);
    for (const e of eventos) this.delServidor.add(e.id);
  }

  /** Del más reciente al más antiguo; en el mismo instante, el último que llegó arriba. */
  de(registro: string): EventoHistorial[] {
    return this.eventos()
      .map((e, orden) => ({ e, orden }))
      .filter(({ e }) => e.registro === registro)
      .sort((a, b) => Date.parse(b.e.fecha) - Date.parse(a.e.fecha) || b.orden - a.orden)
      .map(({ e }) => e);
  }

  /** Cuándo se editó por última vez (lo último que no sea una nota ni una actividad). */
  ultimaEdicion(registro: string): string | undefined {
    return this.de(registro).find((e) => !e.nota && !e.actividad)?.fecha;
  }

  /** Las que siguen pendientes, la que vence primero arriba. */
  actividadesDe(registro: string): Actividad[] {
    return this.actividades()
      .filter((a) => a.registro === registro)
      .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite));
  }

  /** Lo que hizo quien está en sesión, con la hora de ahora. */
  registrar(registro: string, e: Pick<EventoHistorial, 'texto' | 'detalles' | 'cambios' | 'nota' | 'actividad'>): void {
    this.agregar([{ ...e, registro, id: nuevoId(), fecha: new Date().toISOString(), autor: this.usuario() }]);
  }

  /** El historial que ya traen los registros (con su autor y fecha). */
  agregar(eventos: EventoHistorial[]): void {
    this.eventos.update((lista) => [...lista, ...eventos]);
  }

  nota(registro: string, texto: string): void {
    if (!this.remoto) return this.registrar(registro, { texto, nota: true });
    // En el backend si el registro es suyo; si no (o falla), aquí
    void this.remoto
      .nota(registro, texto)
      .then((ok) => (ok ? this.cargar(registro) : this.registrar(registro, { texto, nota: true })))
      .catch(() => this.registrar(registro, { texto, nota: true }));
  }

  /** Con API se guarda allá (si falla, lanza el error y no queda nada a medias). */
  async programar(a: NuevaActividad): Promise<void> {
    // Con backend, él escribe "Actividad programada" en el hilo del registro: se vuelve a leer
    const remota = await this.remoto?.programar(a, false);
    if (remota) return this.cargar(a.registro);
    this.actividades.update((lista) => [...lista, { ...a, id: nuevoId() }]);
    this.registrar(a.registro, {
      actividad: true,
      texto: `Actividad programada: ${tituloActividad(a)}`,
      detalles: [`Para el ${dia(a.fechaLimite)}, asignada a ${a.asignadaA}`, ...(a.nota ? [a.nota] : [])],
    });
  }

  /** Hecha (programada antes o directo desde el diálogo): sale de las pendientes y queda en el historial. */
  async marcarHecha(a: NuevaActividad & { id?: string }): Promise<void> {
    if (this.remoto && a.id && !esLocal(a.id)) {
      await this.remoto.cerrar(a as Actividad, 'hecha');
      return this.cargar(a.registro);
    }
    if (!a.id && (await this.remoto?.programar(a, true))) return this.cargar(a.registro);
    if (a.id) this.actividades.update((lista) => lista.filter((x) => x.id !== a.id));
    this.registrar(a.registro, {
      actividad: true,
      texto: `Actividad realizada: ${tituloActividad(a)}`,
      detalles: a.nota ? [a.nota] : undefined,
    });
  }

  async cancelar(a: Actividad): Promise<void> {
    if (this.remoto && !esLocal(a.id)) {
      await this.remoto.cerrar(a, 'cancelada');
      return this.cargar(a.registro);
    }
    this.actividades.update((lista) => lista.filter((x) => x.id !== a.id));
    this.registrar(a.registro, { actividad: true, texto: `Actividad cancelada: ${tituloActividad(a)}` });
  }
}
