import { TestBed } from '@angular/core/testing';
import { CotizadorState } from './cotizador.state';
import { aInputLocal } from './entrega';

/** Fecha válida (en 3 días) a la hora indicada. */
const enTresDias = (hora: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(hora, 0, 0, 0);
  return aInputLocal(d);
};

describe('CotizadorState.irA (indicador de pasos)', () => {
  const crear = () => {
    TestBed.configureTestingModule({ providers: [CotizadorState] });
    return TestBed.inject(CotizadorState);
  };

  it('sin solución elegida, ir a Especificaciones entra como "Configurar desde cero"', async () => {
    const s = crear();
    await s.irA(2);
    expect(s.paso()).toBe(2);
    expect(s.solucionId()).toBe('personalizado');
  });

  it('con solución elegida, ir a Especificaciones la conserva', async () => {
    const s = crear();
    s.elegirSolucion('pavimento');
    await s.irA(2);
    expect(s.paso()).toBe(2);
    expect(s.solucionId()).toBe('pavimento');
  });

  it('ir a Servicios valida el volumen: inválido se queda en Especificaciones', async () => {
    const s = crear();
    s.elegirSolucion('losa');
    s.modelo.update((m) => ({ ...m, volumenM3: 0 }));
    await s.irA(3);
    expect(s.paso()).toBe(2);
    s.modelo.update((m) => ({ ...m, volumenM3: 15 }));
    await s.irA(3);
    expect(s.paso()).toBe(3);
  });

  it('hacia atrás siempre se puede', async () => {
    const s = crear();
    s.elegirSolucion('losa');
    await s.irA(3);
    await s.irA(1);
    expect(s.paso()).toBe(1);
    expect(s.solucionId()).toBe('losa');
  });
});

describe('CotizadorState: maquinaria y obra de entrega', () => {
  const crear = () => {
    TestBed.configureTestingModule({ providers: [CotizadorState] });
    const s = TestBed.inject(CotizadorState);
    s.definirEntrega(enTresDias(10));
    return s;
  };

  it('renta de maquinaria sin equipo bloquea agregar y deja en Servicios', () => {
    const s = crear();
    s.elegirSolucion('firmes');
    s.alternarServicio('renta-maquinaria');
    s.agregar();
    expect(s.partidas()).toHaveLength(0);
    expect(s.paso()).toBe(3);
    expect(s.faltaMaquinaria()).toBe(true);
    s.alternarMaquinaria('allanadora');
    s.elegirObra(s.obras()[0].id);
    s.agregar();
    expect(s.partidas()).toHaveLength(1);
    expect(s.partidas()[0].maquinaria).toEqual([{ tipo: 'allanadora', dias: 1 }]);
  });

  it('quitar la renta borra los equipos y los días se limitan a 1–30', () => {
    const s = crear();
    s.alternarServicio('renta-maquinaria');
    s.alternarMaquinaria('aplanadora');
    s.diasMaquinaria('aplanadora', 45);
    expect(s.maquinaria()[0].dias).toBe(30);
    s.diasMaquinaria('aplanadora', 0);
    expect(s.maquinaria()[0].dias).toBe(1);
    s.alternarServicio('renta-maquinaria');
    expect(s.maquinaria()).toEqual([]);
  });

  it('sin obra elegida no deja agregar; después conserva la última obra para el siguiente producto', () => {
    const s = crear();
    expect(s.obraId()).toBeNull();
    s.elegirSolucion('losa');
    s.agregar();
    expect(s.partidas()).toHaveLength(0);
    expect(s.faltaObra()).toBe(true);
    expect(s.paso()).toBe(3);
    const [a, b] = s.obras();
    s.elegirObra(a.id);
    s.agregar();
    s.elegirSolucion('firmes');
    expect(s.obraId()).toBe(a.id); // por defecto, la última
    s.elegirObra(b.id); // el cliente la cambia
    s.agregar();
    expect(s.partidas().map((p) => p.obraId)).toEqual([a.id, b.id]);
  });

  it('el botón principal dice lo que hará en cada paso', async () => {
    const s = crear();
    expect(s.textoAccion()).toBe('Pasar a especificaciones');
    await s.irA(2);
    expect(s.textoAccion()).toBe('Confirmar especificaciones');
    await s.irA(3);
    expect(s.textoAccion()).toBe('Agregar a cotización');
  });

  it('la partida lleva la obra elegida; una obra nueva queda seleccionada', () => {
    const s = crear();
    const obra = s.agregarObra({ nombre: 'Plaza Centro', direccion: 'Calle 5 #20', municipio: 'Mérida, Yuc.', responsable: { nombre: 'Ana Pérez' }, contactos: [{ nombre: 'Ana', lada: '+52', numero: '9991234567' }] });
    expect(s.obraId()).toBe(obra.id);
    s.elegirSolucion('losa');
    s.agregar();
    expect(s.partidas().at(-1)?.obraId).toBe(obra.id);
    expect(s.obraId()).toBe(obra.id); // se conserva para el siguiente concreto
  });
});

describe('CotizadorState: fecha de entrega', () => {
  const crear = () => {
    TestBed.configureTestingModule({ providers: [CotizadorState] });
    return TestBed.inject(CotizadorState);
  };

  it('sin fecha válida no deja agregar', () => {
    const s = crear();
    s.elegirSolucion('losa');
    s.elegirObra(s.obras()[0].id);
    s.agregar();
    expect(s.partidas()).toHaveLength(0);
    s.definirEntrega(aInputLocal(new Date(Date.now() + 2 * 3600_000))); // en 2 horas: muy pronto
    s.agregar();
    expect(s.partidas()).toHaveLength(0);
    s.definirEntrega(enTresDias(9));
    s.agregar();
    expect(s.partidas()).toHaveLength(1);
    expect(s.partidas()[0].entrega).toMatch(/T09:00:00[+-]\d{2}:\d{2}$/);
  });

  it('horario nocturno agrega el servicio nocturno, no se puede quitar, y se va al volver al día', () => {
    const s = crear();
    s.elegirSolucion('firmes');
    s.definirEntrega(enTresDias(19));
    expect(s.entregaNocturna()).toBe(true);
    expect(s.servicios()).toContain('colado-nocturno');
    s.alternarServicio('colado-nocturno'); // bloqueado
    expect(s.servicios()).toContain('colado-nocturno');
    s.definirEntrega(enTresDias(10));
    expect(s.servicios()).not.toContain('colado-nocturno');
  });

  it('si el cliente eligió el nocturno a mano, no se quita al cambiar a horario de día', () => {
    const s = crear();
    s.elegirSolucion('firmes');
    s.definirEntrega(enTresDias(10));
    s.alternarServicio('colado-nocturno');
    s.definirEntrega(enTresDias(11));
    expect(s.servicios()).toContain('colado-nocturno');
  });

  it('la fecha se conserva para el siguiente producto y vuelve a aplicar el nocturno', () => {
    const s = crear();
    s.elegirObra(s.obras()[0].id);
    s.definirEntrega(enTresDias(6)); // 6 am: nocturna
    s.elegirSolucion('losa');
    s.agregar();
    expect(s.partidas()[0].servicios).toContain('colado-nocturno');
    s.elegirSolucion('firmes');
    expect(s.entregaLocal()).toBe(enTresDias(6));
    expect(s.servicios()).toContain('colado-nocturno');
  });
});
