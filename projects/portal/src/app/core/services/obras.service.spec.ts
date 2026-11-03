import { TestBed } from '@angular/core/testing';
import { ObrasService } from './obras.service';

describe('ObrasService', () => {
  it('trae las obras de ejemplo y las busca por id', () => {
    const s = TestBed.inject(ObrasService);
    expect(s.obras().length).toBeGreaterThan(0);
    expect(s.buscar(s.obras()[0].id)?.nombre).toBe(s.obras()[0].nombre);
    expect(s.buscar('no-existe')).toBeNull();
    expect(s.buscar(null)).toBeNull();
  });

  it('agregar limpia espacios, omite referencias vacías y le da un id nuevo', () => {
    const s = TestBed.inject(ObrasService);
    const antes = s.obras().length;
    const o = s.agregar({ nombre: '  Plaza Centro ', direccion: ' Calle 5 #20 ', municipio: ' Mérida, Yuc. ', referencias: '   ', ubicacion: { lat: 20.97, lng: -89.62 },
      responsable: { nombre: ' Ana Pérez ', foto: '' }, contactos: [{ nombre: ' Ana ', lada: '+52', numero: '999 123-4567' }] });
    expect(o).toMatchObject({ nombre: 'Plaza Centro', direccion: 'Calle 5 #20', municipio: 'Mérida, Yuc.', referencias: undefined });
    expect(o.ubicacion).toEqual({ lat: 20.97, lng: -89.62 });
    expect(o.responsable).toEqual({ nombre: 'Ana Pérez', foto: undefined });
    expect(o.contactos).toEqual([{ nombre: 'Ana', lada: '+52', numero: '9991234567' }]);
    expect(s.obras()).toHaveLength(antes + 1);
    expect(s.obras().filter((x) => x.id === o.id)).toHaveLength(1);
  });

  it('actualizar reemplaza los datos y conserva id y cliente', () => {
    const s = TestBed.inject(ObrasService);
    const o = s.buscar('o2')!;
    s.actualizar('o2', { ...o, nombre: 'Bodega Escárcega II', contactos: [{ nombre: 'Luis', lada: '+52', numero: '9821187643' }] });
    expect(s.buscar('o2')).toMatchObject({ id: 'o2', clienteId: 'c1', nombre: 'Bodega Escárcega II' });
    expect(s.buscar('o2')!.contactos).toHaveLength(1);
  });
});
