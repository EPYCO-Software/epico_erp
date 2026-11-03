import { Service, computed, signal } from '@angular/core';

export interface MensajeChat {
  id: number;
  de: 'asesor' | 'cliente';
  texto: string;
  /** ISO 8601 */
  fecha: string;
}

/**
 * Conversación con atención al cliente. La UI (burbuja flotante) solo lee estas señales y llama a enviar(),
 * así que conectar el canal real (WebSocket, WhatsApp Business, chat del ERP…) solo cambia este servicio.
 */
@Service()
export class ChatService {
  private siguienteId = 1;
  private readonly _mensajes = signal<MensajeChat[]>([this.crear('asesor', 'Hola, ¿te ayudamos con tu cotización?')]);
  private readonly _noLeidos = signal(0);
  private readonly _escribiendo = signal(false);

  readonly mensajes = this._mensajes.asReadonly();
  readonly noLeidos = this._noLeidos.asReadonly();
  /** El asesor está escribiendo una respuesta. */
  readonly escribiendo = this._escribiendo.asReadonly();
  // shortcut: estado fijo. Al conectar, reflejar la disponibilidad real de los asesores.
  readonly enLinea = signal(true).asReadonly();
  readonly abierto = signal(false);
  readonly hayNoLeidos = computed(() => this._noLeidos() > 0);

  enviar(texto: string): void {
    const limpio = texto.trim();
    if (!limpio) return;
    this._mensajes.update((m) => [...m, this.crear('cliente', limpio)]);
    // shortcut: respuesta simulada. Reemplazar por el envío al canal real y recibir respuestas por suscripción.
    this._escribiendo.set(true);
    setTimeout(() => this.recibir('Gracias. Un asesor te responderá en unos minutos.'), 1200);
  }

  /** Mensaje entrante del asesor (hoy desde el mock; después, desde el canal real). */
  recibir(texto: string): void {
    this._escribiendo.set(false);
    this._mensajes.update((m) => [...m, this.crear('asesor', texto)]);
    if (!this.abierto()) this._noLeidos.update((n) => n + 1);
  }

  abrir(): void {
    this.abierto.set(true);
    this._noLeidos.set(0);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  private crear(de: MensajeChat['de'], texto: string): MensajeChat {
    return { id: this.siguienteId++, de, texto, fecha: new Date().toISOString() };
  }
}
