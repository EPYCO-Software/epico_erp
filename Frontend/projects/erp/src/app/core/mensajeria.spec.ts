import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH_API_URL, AUTH_STORAGE_KEY } from 'ui';
import { MensajeriaService, YO, formatoCuando } from './mensajeria';

describe('MensajeriaService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: AUTH_STORAGE_KEY, useValue: 'test.mensajeria' }] }));
  const servicio = () => TestBed.inject(MensajeriaService);

  it('cuenta como sin leer los mensajes de chats y canales y las notificaciones no leídas', () => {
    // Ana (1) + #ventas (1) + pedido confirmado (1)
    expect(servicio().noLeidos()).toBe(3);
  });

  it('abrir marca leído, agrega la ventana y si ya estaba la restaura y la trae al frente', () => {
    const s = servicio();
    s.abrir('chat-ana');
    s.abrir('canal-ventas');
    expect(s.noLeidos()).toBe(1);
    s.minimizar('chat-ana');
    expect(s.ventanas()).toEqual([
      { id: 'chat-ana', minimizada: true },
      { id: 'canal-ventas', minimizada: false },
    ]);
    s.abrir('chat-ana');
    expect(s.ventanas()).toEqual([
      { id: 'canal-ventas', minimizada: false },
      { id: 'chat-ana', minimizada: false },
    ]);
    s.cerrar('canal-ventas');
    expect(s.ventanas().map((v) => v.id)).toEqual(['chat-ana']);
  });

  it('no abre conversaciones que no existen', () => {
    const s = servicio();
    s.abrir('chat-nadie');
    expect(s.ventanas()).toEqual([]);
  });

  it('enviar agrega el mensaje sin espacios de más e ignora los vacíos', () => {
    const s = servicio();
    s.enviar('chat-maria', '   ');
    expect(s.conversacion('chat-maria')?.mensajes).toEqual([]);
    s.enviar('chat-maria', '  Hola, María  ');
    expect(s.conversacion('chat-maria')?.mensajes).toEqual([expect.objectContaining({ autorId: YO, texto: 'Hola, María' })]);
    expect(s.recientes()[0].id).toBe('chat-maria');
  });

  it('chatCon reutiliza el chat existente o crea uno vacío', () => {
    const s = servicio();
    expect(s.chatCon('ana')).toBe('chat-ana');
    expect(s.chatCon('jorge')).toBe('chat-jorge');
    expect(s.conversacion('chat-jorge')).toMatchObject({ tipo: 'chat', nombre: 'Jorge May', mensajes: [] });
    expect(s.chatCon('nadie')).toBeUndefined();
  });

  it('formatoCuando usa la hora para hoy y la fecha para otros días, en la zona de la planta', () => {
    const ahora = new Date('2026-11-04T12:00:00-06:00');
    expect(formatoCuando('2026-11-04T08:00:00-06:00', 'America/Merida', ahora)).toBe('HH:mm');
    expect(formatoCuando('2026-11-03T23:30:00-06:00', 'America/Merida', ahora)).toBe('dd/MM');
    // 00:30 en Cancún (UTC−5) sigue siendo el día anterior en Mérida (UTC−6)
    expect(formatoCuando('2026-11-04T00:30:00-05:00', 'America/Merida', ahora)).toBe('dd/MM');
  });
});

describe('MensajeriaService con backend', () => {
  const KEY = 'test.mensajeria.api';
  beforeEach(() => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', refreshToken: 'r', usuario: { id: 'u1', nombre: 'Ana', correo: 'a@x.mx' } }));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AUTH_STORAGE_KEY, useValue: KEY }, { provide: AUTH_API_URL, useValue: '/api/v1' }],
    });
  });
  afterEach(() => localStorage.removeItem(KEY));

  it('sin chat ni ejemplos: trae las notificaciones del servidor, cuenta sus no leídas y marca leída allá', async () => {
    const s = TestBed.inject(MensajeriaService);
    const http = TestBed.inject(HttpTestingController);
    expect([s.conChat, s.conversaciones().length, s.personas.length]).toEqual([false, 0, 0]);
    TestBed.tick();
    http.expectOne('/api/v1/me/notificaciones?soloNoLeidas=false&skip=0&take=50').flush({
      items: [{ id: 'n1', modulo: 'ventas', titulo: 'Cotización recibida del portal', texto: 'X', ruta: null, fecha: '2026-11-16T10:00:00Z', leidaEn: null }],
      total: 1,
      noLeidas: 4,
    });
    await Promise.resolve();
    expect(s.notificaciones()).toEqual([
      { id: 'n1', modulo: 'ventas', titulo: 'Cotización recibida del portal', texto: 'X', ruta: '', fecha: '2026-11-16T10:00:00Z', leida: false },
    ]);
    expect(s.noLeidos()).toBe(4);
    s.leerNotificacion('n1');
    http.expectOne({ method: 'PUT', url: '/api/v1/me/notificaciones/n1/leida' }).flush(null);
    expect(s.noLeidos()).toBe(3);
  });
});
