import { TestBed } from '@angular/core/testing';
import { MensajeriaService, YO, formatoCuando } from './mensajeria';

describe('MensajeriaService', () => {
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
