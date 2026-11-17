import { HttpClient } from '@angular/common/http';
import { DestroyRef, Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService } from 'ui';
import { IdModulo } from './modulos';

export type EstadoPersona = 'en_linea' | 'ausente' | 'desconectado';

export interface Persona {
  id: string;
  nombre: string;
  /** Área y planta, para reconocerla al iniciar un chat. */
  puesto: string;
  estado: EstadoPersona;
}

export interface Mensaje {
  id: number;
  /** Id de la persona, o YO para el usuario de la sesión. */
  autorId: string;
  texto: string;
  /** ISO 8601 con offset. */
  fecha: string;
}

export interface Conversacion {
  id: string;
  tipo: 'chat' | 'canal';
  /** Nombre de la persona (chat) o del canal, sin "#". */
  nombre: string;
  personaId?: string;
  mensajes: Mensaje[];
  noLeidos: number;
}

export interface Notificacion {
  id: string;
  /** Módulo que la generó: da el icono. */
  modulo: IdModulo;
  titulo: string;
  texto: string;
  fecha: string;
  /** Página a la que lleva al abrirla (vacía: ninguna). */
  ruta: string;
  leida: boolean;
}

/** Chat abierto abajo a la derecha: como ventana o, minimizado, como burbuja. */
export interface Ventana {
  id: string;
  minimizada: boolean;
}

export const YO = 'yo';

/** "HH:mm" si la fecha es de hoy en esa zona; si no, "dd/MM" (formato para el pipe fechaZona). */
export function formatoCuando(iso: string, zona: string, ahora = new Date()): string {
  const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: zona });
  return dia(new Date(iso)) === dia(ahora) ? 'HH:mm' : 'dd/MM';
}

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

// shortcut: personas, conversaciones y notificaciones de demostración, en memoria. Vendrán del backend y lo nuevo
// llegará en tiempo real (WebSocket); lo que escribe el usuario se pierde al recargar.
export const PERSONAS: Persona[] = [
  { id: 'ana', nombre: 'Ana Pech', puesto: 'Ventas · Planta Escárcega', estado: 'en_linea' },
  { id: 'luis', nombre: 'Luis Canché', puesto: 'Logística · Planta Cozumel', estado: 'ausente' },
  {
    id: 'maria',
    nombre: 'María Dzul',
    puesto: 'Laboratorio · Planta Cancún',
    estado: 'desconectado',
  },
  { id: 'jorge', nombre: 'Jorge May', puesto: 'Dirección', estado: 'en_linea' },
];

function conversacionesDemo(): Conversacion[] {
  return [
    {
      id: 'chat-ana',
      tipo: 'chat',
      nombre: 'Ana Pech',
      personaId: 'ana',
      noLeidos: 1,
      mensajes: [
        {
          id: 1,
          autorId: 'ana',
          texto: '¿Ya quedó la cotización de Torre Norte? El cliente la pide para hoy.',
          fecha: hace(12),
        },
      ],
    },
    {
      id: 'chat-luis',
      tipo: 'chat',
      nombre: 'Luis Canché',
      personaId: 'luis',
      noLeidos: 0,
      mensajes: [
        { id: 2, autorId: YO, texto: '¿A qué hora sale la olla 12?', fecha: hace(26 * 60) },
        {
          id: 3,
          autorId: 'luis',
          texto: 'Sale a las 7:30 de Planta Cozumel.',
          fecha: hace(26 * 60 - 4),
        },
      ],
    },
    {
      id: 'chat-maria',
      tipo: 'chat',
      nombre: 'María Dzul',
      personaId: 'maria',
      noLeidos: 0,
      mensajes: [],
    },
    {
      id: 'canal-ventas',
      tipo: 'canal',
      nombre: 'ventas',
      noLeidos: 1,
      mensajes: [
        {
          id: 4,
          autorId: 'ana',
          texto: 'Recuerden registrar cada visita a obra en el CRM.',
          fecha: hace(95),
        },
      ],
    },
    {
      id: 'canal-general',
      tipo: 'canal',
      nombre: 'general',
      noLeidos: 0,
      mensajes: [
        {
          id: 5,
          autorId: 'jorge',
          texto: 'Bienvenidos al ERP de EPICO. Aquí van los avisos para todos.',
          fecha: hace(3 * 24 * 60),
        },
      ],
    },
  ];
}

function notificacionesDemo(): Notificacion[] {
  return [
    {
      id: 'n-pedido',
      modulo: 'pedidos',
      titulo: 'Pedido PED-26-0141 confirmado',
      texto: 'Torre Norte · Planta Cozumel. Revisa la programación de la entrega.',
      fecha: hace(25),
      ruta: '/pedidos',
      leida: false,
    },
    {
      id: 'n-cotizacion',
      modulo: 'ventas',
      titulo: 'Cotización EPI-WEB-CZM-26002 aceptada',
      texto: 'El cliente la aceptó desde el portal y se generó su pedido.',
      fecha: hace(28 * 60),
      ruta: '/ventas',
      leida: true,
    },
  ];
}

const ultimaFecha = (c: Conversacion) =>
  c.mensajes.length ? Date.parse(c.mensajes[c.mensajes.length - 1].fecha) : 0;

interface ApiNotificacion {
  id: string;
  modulo: string;
  titulo: string;
  texto: string;
  ruta: string | null;
  fecha: string;
  leidaEn: string | null;
}

/** Cada cuánto se preguntan las notificaciones nuevas (el backend aún no las empuja). */
const SONDEO_MS = 60_000;

/**
 * Notificaciones, chats y canales del ERP (el globo del encabezado) y los chats abiertos abajo a la derecha.
 * Con backend no se muestra nada de ejemplo: las notificaciones son las de /me/notificaciones (las genera el sistema;
 * se consultan al entrar y cada minuto) y el chat se oculta porque allá no existe. Sin backend (pruebas, demo), todo de
 * ejemplo en memoria.
 */
@Service()
export class MensajeriaService {
  private readonly base = inject(AUTH_API_URL, { optional: true });
  private readonly demo = !this.base;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  /** Con backend: las no leídas que cuenta el servidor (pueden ser más de las que se traen). */
  private readonly noLeidasServidor = signal(0);
  /** Sin backend de chat, el globo solo muestra notificaciones. */
  readonly conChat = this.demo;
  readonly personas = this.demo ? PERSONAS : [];
  readonly conversaciones = signal<Conversacion[]>(this.demo ? conversacionesDemo() : []);
  readonly notificaciones = signal<Notificacion[]>(this.demo ? notificacionesDemo() : []);
  /** En orden de apertura: la última es la más reciente. */
  readonly ventanas = signal<Ventana[]>([]);

  /** La más reciente primero; las que no tienen mensajes, al final. */
  readonly recientes = computed(() =>
    [...this.conversaciones()].sort((a, b) => ultimaFecha(b) - ultimaFecha(a)),
  );
  readonly noLeidos = computed(() =>
    this.demo
      ? this.conversaciones().reduce((n, c) => n + c.noLeidos, 0) +
        this.notificaciones().filter((n) => !n.leida).length
      : this.noLeidasServidor(),
  );

  private ultimoId = 100;

  constructor() {
    if (this.demo) return;
    const quien = computed(() => this.auth.sesion()?.usuario.id ?? '');
    let reloj: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(reloj);
      if (!quien())
        return untracked(() => (this.notificaciones.set([]), this.noLeidasServidor.set(0)));
      untracked(() => void this.cargarNotificaciones());
      reloj = setInterval(() => void this.cargarNotificaciones(), SONDEO_MS);
    });
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  /** Las 50 más recientes y cuántas faltan por leer. Si falla (red, sesión), se queda con las que tenía. */
  async cargarNotificaciones(): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.http.get<{ items: ApiNotificacion[]; noLeidas: number }>(
          `${this.base}/me/notificaciones?soloNoLeidas=false&skip=0&take=50`,
        ),
      );
      this.notificaciones.set(
        r.items.map((n) => ({
          id: n.id,
          modulo: n.modulo as IdModulo,
          titulo: n.titulo,
          texto: n.texto,
          fecha: n.fecha,
          ruta: n.ruta ?? '',
          leida: n.leidaEn != null,
        })),
      );
      this.noLeidasServidor.set(r.noLeidas);
    } catch {
      // Se reintenta en el siguiente sondeo
    }
  }

  conversacion(id: string): Conversacion | undefined {
    return this.conversaciones().find((c) => c.id === id);
  }

  persona(id: string | undefined): Persona | undefined {
    return this.personas.find((p) => p.id === id);
  }

  /** Abre el chat (o lo restaura y trae al frente si ya estaba) y lo marca como leído. */
  abrir(id: string): void {
    if (!this.conversacion(id)) return;
    this.actualizar(id, (c) => ({ ...c, noLeidos: 0 }));
    this.ventanas.update((v) => [...v.filter((x) => x.id !== id), { id, minimizada: false }]);
  }

  minimizar(id: string): void {
    this.ventanas.update((v) => v.map((x) => (x.id === id ? { ...x, minimizada: true } : x)));
  }

  cerrar(id: string): void {
    this.ventanas.update((v) => v.filter((x) => x.id !== id));
  }

  enviar(id: string, texto: string): void {
    const limpio = texto.trim();
    if (!limpio) return;
    const mensaje: Mensaje = {
      id: ++this.ultimoId,
      autorId: YO,
      texto: limpio,
      fecha: new Date().toISOString(),
    };
    this.actualizar(id, (c) => ({ ...c, mensajes: [...c.mensajes, mensaje] }));
  }

  /** Chat directo con la persona: el que ya existe o uno nuevo, vacío. Devuelve su id. */
  chatCon(personaId: string): string | undefined {
    const persona = this.persona(personaId);
    if (!persona) return undefined;
    const existente = this.conversaciones().find(
      (c) => c.tipo === 'chat' && c.personaId === personaId,
    );
    if (existente) return existente.id;
    const nuevo: Conversacion = {
      id: `chat-${personaId}`,
      tipo: 'chat',
      nombre: persona.nombre,
      personaId,
      mensajes: [],
      noLeidos: 0,
    };
    this.conversaciones.update((cs) => [...cs, nuevo]);
    return nuevo.id;
  }

  leerNotificacion(id: string): void {
    const n = this.notificaciones().find((x) => x.id === id);
    if (!n || n.leida) return;
    this.notificaciones.update((ns) => ns.map((x) => (x.id === id ? { ...x, leida: true } : x)));
    if (this.demo) return;
    this.noLeidasServidor.update((k) => Math.max(0, k - 1));
    firstValueFrom(this.http.put(`${this.base}/me/notificaciones/${id}/leida`, null)).catch(
      () => void this.cargarNotificaciones(),
    );
  }

  /** Con backend: todas leídas en el servidor. */
  leerTodas(): void {
    this.notificaciones.update((ns) => ns.map((x) => ({ ...x, leida: true })));
    if (this.demo) return;
    this.noLeidasServidor.set(0);
    firstValueFrom(this.http.put(`${this.base}/me/notificaciones/leidas`, null)).catch(
      () => void this.cargarNotificaciones(),
    );
  }

  descartarNotificacion(id: string): void {
    this.notificaciones.update((ns) => ns.filter((n) => n.id !== id));
  }

  private actualizar(id: string, cambio: (c: Conversacion) => Conversacion): void {
    this.conversaciones.update((cs) => cs.map((c) => (c.id === id ? cambio(c) : c)));
  }
}
