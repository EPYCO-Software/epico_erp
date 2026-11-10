import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY, PRODUCTOS } from 'ui';
import { HistorialService } from '../../core/historial';
import { registro } from './datos';
import { ListasPreciosService, REGLA_VACIA, filtrarListas, textoAplicaEn, textoPlantas, textoPrecio, textoVigencia } from './precios';

// El historial toma el autor de la sesión (AuthService, que guarda con esta clave).
beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'erp-prueba' }] }));

describe('listas de precios: textos', () => {
  const r = { ...REGLA_VACIA, id: 'r' };

  it('precio según su tipo y la moneda de la lista', () => {
    expect(textoPrecio({ ...r, precioFijo: 4700 }, 'MXN')).toBe('$4,700.00');
    expect(textoPrecio({ ...r, precioFijo: 230 }, 'USD')).toBe('$230.00 USD');
    expect(textoPrecio({ ...r, tipo: 'descuento', descuento: 5 }, 'MXN')).toBe('5 % de descuento');
    expect(textoPrecio({ ...r, tipo: 'formula', descuento: -5, recargo: 120 }, 'MXN')).toBe('Precio de lista + 5 % + $120.00');
    expect(textoPrecio({ ...r, tipo: 'formula', descuento: 10, recargo: -50 }, 'MXN')).toBe('Precio de lista − 10 % − $50.00');
  });

  it('a qué aplica, vigencia y plantas', () => {
    expect(textoAplicaEn(r, PRODUCTOS)).toBe('Todos los productos');
    expect(textoAplicaEn({ ...r, productoId: 'fc-300' }, PRODUCTOS)).toBe('[CON-FC-300] Concreto f´c 300 kg/cm²');
    expect(textoAplicaEn({ ...r, aplicarA: 'categoria', categoria: 'servicio' }, PRODUCTOS)).toBe('Categoría: Servicio');
    expect(textoVigencia({ inicio: '', fin: '' })).toBe('Siempre');
    expect(textoVigencia({ inicio: '2026-12-01', fin: '2026-12-31' })).toBe('01/12/2026 – 31/12/2026');
    expect(textoVigencia({ inicio: '', fin: '2026-12-31' })).toBe('Hasta 31/12/2026');
    expect(textoPlantas([])).toBe('Todas las plantas');
    expect(textoPlantas(['CUN', 'CZM'])).toBe('Cancún, Cozumel');
  });
});

describe('ListasPreciosService', () => {
  it('alta, edición y líneas (agregar, reemplazar, quitar), todo en el historial', () => {
    const s = TestBed.inject(ListasPreciosService);
    const h = TestBed.inject(HistorialService);
    const l = s.crear({ nombre: ' Planta Escárcega ', moneda: 'MXN', plantas: ['ESC'] });
    expect(s.lista(l.id)).toMatchObject({ nombre: 'Planta Escárcega', reglas: [] });
    expect(filtrarListas(s.listas(), 'escarcega').map((x) => x.id)).toEqual([l.id]);

    const regla = { ...REGLA_VACIA, id: 'r1', productoId: 'fc-200', precioFijo: 3550 };
    s.guardarRegla(l.id, regla);
    s.guardarRegla(l.id, { ...regla, precioFijo: 3600 });
    expect(s.lista(l.id)!.reglas).toEqual([{ ...regla, precioFijo: 3600 }]);
    s.quitarRegla(l.id, 'r1');
    expect(s.lista(l.id)!.reglas).toEqual([]);

    s.editar(l.id, { nombre: 'Planta Escárcega', moneda: 'USD', plantas: ['ESC', 'XPJ'] });
    expect(h.de(registro.lista(l.id)).map((e) => e.texto)).toEqual(['Lista editada', 'Línea quitada', 'Línea editada', 'Línea agregada', 'Lista de precios creada']);
    expect(h.de(registro.lista(l.id))[0].cambios).toEqual([
      { campo: 'Moneda', antes: 'MXN', despues: 'USD' },
      { campo: 'Plantas', antes: 'Escárcega', despues: 'Escárcega, Xpujil' },
    ]);
  });
});
