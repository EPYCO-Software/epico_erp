import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('inicia con el saludo del asesor', () => {
    const chat = TestBed.inject(ChatService);
    expect(chat.mensajes().map((m) => m.de)).toEqual(['asesor']);
  });

  it('enviar agrega el mensaje del cliente, muestra "escribiendo" y luego llega la respuesta', () => {
    const chat = TestBed.inject(ChatService);
    chat.abrir();
    chat.enviar('  ¿Tienen bombeo?  ');
    expect(chat.mensajes().at(-1)).toMatchObject({ de: 'cliente', texto: '¿Tienen bombeo?' });
    expect(chat.escribiendo()).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(chat.escribiendo()).toBe(false);
    expect(chat.mensajes().at(-1)?.de).toBe('asesor');
    expect(chat.noLeidos()).toBe(0); // estaba abierto
  });

  it('ignora mensajes vacíos', () => {
    const chat = TestBed.inject(ChatService);
    chat.enviar('   ');
    expect(chat.mensajes()).toHaveLength(1);
  });

  it('cuenta no leídos con el chat cerrado y los limpia al abrir', () => {
    const chat = TestBed.inject(ChatService);
    chat.recibir('Tu cotización está lista');
    chat.recibir('¿Necesitas algo más?');
    expect(chat.noLeidos()).toBe(2);
    expect(chat.hayNoLeidos()).toBe(true);
    chat.abrir();
    expect(chat.noLeidos()).toBe(0);
  });

  it('los ids son únicos', () => {
    const chat = TestBed.inject(ChatService);
    chat.recibir('a');
    chat.recibir('b');
    const ids = chat.mensajes().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
