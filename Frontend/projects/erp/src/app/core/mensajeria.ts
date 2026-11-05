import { Service, computed, signal } from '@angular/core';
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
  /** Página a la que lleva al abrirla. */
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
  { id: 'maria', nombre: 'María Dzul', puesto: 'Laboratorio · Planta Cancún', estado: 'desconectado' },
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
      mensajes: [{ id: 1, autorId: 'ana', texto: '¿Ya quedó la cotización de Torre Norte? El cliente la pide para hoy.', fecha: hace(12) }],
    },
    {
      id: 'chat-luis',
      tipo: 'chat',
      nombre: 'Luis Canché',
      personaId: 'luis',
      noLeidos: 0,
      mensajes: [
        { id: 2, autorId: YO, texto: '¿A qué hora sale la olla 12?', fecha: hace(26 * 60) },
        { id: 3, autorId: 'luis', texto: 'Sale a las 7:30 de Planta Cozumel.', fecha: hace(26 * 60 - 4) },
      ],
    },
    { id: 'chat-maria', tipo: 'chat', nombre: 'María Dzul', personaId: 'maria', noLeidos: 0, mensajes: [] },
    {
      id: 'canal-ventas',
      tipo: 'canal',
      nombre: 'ventas',
      noLeidos: 1,
      mensajes: [{ id: 4, autorId: 'ana', texto: 'Recuerden registrar cada visita a obra en el CRM.', fecha: hace(95) }],
    },
    {
      id: 'canal-general',
      tipo: 'canal',
      nombre: 'general',
      noLeidos: 0,
      mensajes: [
        { id: 5, autorId: 'jorge', texto: 'Bienvenidos al ERP de EPICO. Aquí van los avisos para todos.', fecha: hace(3 * 24 * 60) },
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

const ultimaFecha = (c: Conversacion) => (c.mensajes.length ? Date.parse(c.mensajes[c.mensajes.length - 1].fecha) : 0);

/** Notificaciones, chats y canales del ERP (el globo del encabezado) y los chats abiertos abajo a la derecha. */
@Service()
export class MensajeriaService {
  readonly personas = PERSONAS;
  readonly conversaciones = signal<Conversacion[]>(conversacionesDemo());
  readonly notificaciones = signal<Notificacion[]>(notificacionesDemo());
  /** En orden de apertura: la última es la más reciente. */
  readonly ventanas = signal<Ventana[]>([]);

  /** La más reciente primero; las que no tienen mensajes, al final. */
  readonly recientes = computed(() => [...this.conversaciones()].sort((a, b) => ultimaFecha(b) - ultimaFecha(a)));
  readonly noLeidos = computed(
    () =>
      this.conversaciones().reduce((n, c) => n + c.noLeidos, 0) + this.notificaciones().filter((n) => !n.leida).length,
  );

  private ultimoId = 100;

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
    const mensaje: Mensaje = { id: ++this.ultimoId, autorId: YO, texto: limpio, fecha: new Date().toISOString() };
    this.actualizar(id, (c) => ({ ...c, mensajes: [...c.mensajes, mensaje] }));
  }

  /** Chat directo con la persona: el que ya existe o uno nuevo, vacío. Devuelve su id. */
  chatCon(personaId: string): string | undefined {
    const persona = this.persona(personaId);
    if (!persona) return undefined;
    const existente = this.conversaciones().find((c) => c.tipo === 'chat' && c.personaId === personaId);
    if (existente) return existente.id;
    const nuevo: Conversacion = { id: `chat-${personaId}`, tipo: 'chat', nombre: persona.nombre, personaId, mensajes: [], noLeidos: 0 };
    this.conversaciones.update((cs) => [...cs, nuevo]);
    return nuevo.id;
  }

  leerNotificacion(id: string): void {
    this.notificaciones.update((ns) => ns.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }

  descartarNotificacion(id: string): void {
    this.notificaciones.update((ns) => ns.filter((n) => n.id !== id));
  }

  private actualizar(id: string, cambio: (c: Conversacion) => Conversacion): void {
    this.conversaciones.update((cs) => cs.map((c) => (c.id === id ? cambio(c) : c)));
  }
}
