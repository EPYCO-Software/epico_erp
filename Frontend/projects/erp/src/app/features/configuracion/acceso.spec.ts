import { Permiso, agruparPermisos, alternarClave, estadoClaves, estadoUsuario, expandir, limpiarAccesos, nombreUsuario, permitido, ponerPermiso, tiene } from './acceso';

const p = (clave: string, moduloNombre: string, recursoNombre: string, accionNombre: string): Permiso => {
  const [modulo, recurso, accion] = clave.split('.');
  return { clave, modulo, moduloNombre, recurso, recursoNombre, accion, accionNombre };
};

describe('acceso: reglas', () => {
  it('tiene: clave exacta, "*" y comodín de módulo, como el backend', () => {
    expect(tiene(['ventas.cotizaciones.ver'], 'ventas.cotizaciones.ver')).toBe(true);
    expect(tiene(['ventas.cotizaciones.ver'], 'ventas.cotizaciones.editar')).toBe(false);
    expect(tiene(['*'], 'config.roles.editar')).toBe(true);
    expect(tiene(['ventas.*'], 'ventas.pedidos.cobrar')).toBe(true);
    expect(tiene(['ventas.*'], 'config.roles.ver')).toBe(false);
  });

  it('agruparPermisos: por módulo y recurso en el orden del catálogo, sin "*"', () => {
    const g = agruparPermisos([
      { ...p('*.*.*', '', '', ''), clave: '*' },
      p('ventas.cotizaciones.ver', 'Ventas', 'Cotizaciones', 'Ver'),
      p('ventas.cotizaciones.enviar', 'Ventas', 'Cotizaciones', 'Enviar'),
      p('ventas.pedidos.ver', 'Ventas', 'Pedidos', 'Ver'),
      p('config.roles.ver', 'Configuración', 'Roles', 'Ver'),
    ]);
    expect(g.map((x) => x.nombre)).toEqual(['Ventas', 'Configuración']);
    expect(g[0].recursos.map((r) => [r.nombre, r.acciones.map((a) => a.accionNombre)])).toEqual([
      ['Cotizaciones', ['Ver', 'Enviar']],
      ['Pedidos', ['Ver']],
    ]);
  });

  it('estadoClaves: todas, algunas o ninguna (casilla de un módulo)', () => {
    const s = new Set(['a', 'b']);
    expect(estadoClaves(s, ['a', 'b'])).toBe('todas');
    expect(estadoClaves(s, ['a', 'c'])).toBe('algunas');
    expect(estadoClaves(s, ['c'])).toBe('ninguna');
    // Un comodín cubre las claves de su módulo
    expect(estadoClaves(new Set(['ventas.*']), ['ventas.a.ver', 'ventas.b.ver'])).toBe('todas');
  });

  it('alternarClave: marcar agrega; desmarcar una cubierta por comodín lo cambia por las demás claves', () => {
    const catalogo = ['ventas.a.ver', 'ventas.a.crear', 'ventas.b.ver', 'config.roles.ver'];
    expect([...alternarClave(new Set(), 'ventas.a.ver', catalogo)]).toEqual(['ventas.a.ver']);
    expect([...alternarClave(new Set(['ventas.a.ver']), 'ventas.a.ver', catalogo)]).toEqual([]);
    expect([...alternarClave(new Set(['ventas.*', 'config.roles.ver']), 'ventas.a.crear', catalogo)].sort()).toEqual([
      'config.roles.ver',
      'ventas.a.ver',
      'ventas.b.ver',
    ]);
  });

  it('limpiarAccesos: sin incompletos ni repetidos y un solo predeterminado', () => {
    const a = (empresaId: string, sucursalId: string | null, predeterminado = false) => ({ empresaId, sucursalId, predeterminado });
    expect(limpiarAccesos([a('e1', null), a('e1', null), a('', null)])).toEqual([{ empresaId: 'e1', sucursalId: null, predeterminado: true }]);
    const dos = limpiarAccesos([a('e1', null), a('e2', 's2', true), a('e1', 's1', true)]);
    expect(dos.map((x) => x.predeterminado)).toEqual([false, true, false]);
  });

  it('permisos por usuario: los del rol, más los agregados, menos los quitados (también por comodín)', () => {
    const rol = ['ventas.*'];
    const a = { agregados: ['crm.prospectos.ver'], quitados: ['ventas.listas_precios.ver'] };
    expect(permitido(rol, a, 'ventas.cotizaciones.ver')).toBe(true);
    expect(permitido(rol, a, 'ventas.listas_precios.ver')).toBe(false);
    expect(permitido(rol, a, 'crm.prospectos.ver')).toBe(true);
    expect(permitido(rol, a, 'config.usuarios.ver')).toBe(false);
    expect(permitido(rol, { agregados: [], quitados: ['ventas.*'] }, 'ventas.pedidos.ver')).toBe(false);
  });

  it('ponerPermiso guarda solo la diferencia con el rol', () => {
    const rol = ['ventas.cotizaciones.ver'];
    let a = { agregados: [] as string[], quitados: [] as string[] };
    a = ponerPermiso(rol, a, 'ventas.cotizaciones.ver', false); // lo da el rol: se quita
    expect(a).toEqual({ agregados: [], quitados: ['ventas.cotizaciones.ver'] });
    a = ponerPermiso(rol, a, 'ventas.cotizaciones.ver', true); // se deshace
    expect(a).toEqual({ agregados: [], quitados: [] });
    a = ponerPermiso(rol, a, 'crm.prospectos.ver', true); // no lo da el rol: se agrega
    expect(a).toEqual({ agregados: ['crm.prospectos.ver'], quitados: [] });
    a = ponerPermiso(rol, a, 'crm.prospectos.ver', false);
    expect(a).toEqual({ agregados: [], quitados: [] });
  });

  it('expandir cambia comodines por las claves del catálogo', () => {
    const cat = ['ventas.a.ver', 'ventas.b.ver', 'crm.p.ver'];
    expect(expandir(['ventas.*', 'crm.p.ver'], cat)).toEqual(['ventas.a.ver', 'ventas.b.ver', 'crm.p.ver']);
    expect(expandir(['*'], cat)).toEqual(cat);
  });

  it('nombre y estado del usuario', () => {
    expect(nombreUsuario({ nombre: 'Ana', apellidos: 'Pech', correo: 'a@x.mx' })).toBe('Ana Pech');
    expect(nombreUsuario({ nombre: '', apellidos: null, correo: 'a@x.mx' })).toBe('a@x.mx');
    const ahora = Date.parse('2026-11-16T12:00:00Z');
    expect(estadoUsuario({ activo: false, bloqueadoHasta: null }, ahora)).toBe('inactivo');
    expect(estadoUsuario({ activo: true, bloqueadoHasta: '2026-11-16T12:10:00Z' }, ahora)).toBe('bloqueado');
    expect(estadoUsuario({ activo: true, bloqueadoHasta: '2026-11-16T11:00:00Z' }, ahora)).toBe('activo');
  });
});
