import { AuthService } from 'ui';
import { inject } from '@angular/core';
import type { IdModulo } from './modulos';

/** Permiso de acceso total (root). */
export const TODOS = '*';

/** ¿Tiene ese permiso? "*" = todos; "ventas.*" = todo lo de ventas. Igual que Yo.Tiene en el backend. */
export function tiene(mios: readonly string[], clave: string): boolean {
  return mios.some((p) => p === TODOS || p === clave || (p.endsWith('.*') && clave.startsWith(p.slice(0, -1))));
}

/** ¿Tiene algún permiso dentro de ese prefijo ("ventas.", "ventas.pedidos.")? Un comodín que lo cubre también cuenta. */
export function tieneAlgo(mios: readonly string[], prefijo: string): boolean {
  return mios.some((p) => p === TODOS || p.startsWith(prefijo) || (p.endsWith('.*') && prefijo.startsWith(p.slice(0, -1))));
}

/**
 * Qué permisos del backend abren cada módulo del ERP: se ve si el usuario tiene al menos uno de ellos (por su rol).
 * Los módulos que aún no tienen permisos en el backend solo los ve root.
 */
export const PERMISOS_MODULO: Partial<Record<IdModulo, string[]>> = {
  seguridad: ['config.'],
  crm: ['crm.'],
  ventas: ['ventas.'],
  pedidos: ['ventas.pedidos.'],
  inventario: ['inventario.'],
  logistica: ['flota.', 'operacion.'],
};

/**
 * El permiso para ver cada página (por el inicio de su ruta, la más específica primero). Las que no están aquí se
 * abren con tener el módulo.
 */
export const PERMISOS_RUTA: [ruta: string, permiso: string][] = [
  // Las altas antes que su lista: la primera regla que coincide manda
  ['/ventas/cotizaciones/nueva', 'ventas.cotizaciones.crear'],
  ['/ventas/ordenes/nueva', 'ventas.pedidos.crear'],
  ['/ventas/clientes/nuevo', 'ventas.clientes.crear'],
  ['/ventas/obras/nueva', 'ventas.obras.crear'],
  ['/ventas/productos/nuevo', 'ventas.productos.crear'],
  ['/ventas/listas-de-precios/nueva', 'ventas.listas_precios.crear'],
  ['/ventas/descuentos-y-lealtad/nuevo', 'ventas.programas.crear'],
  ['/configuracion/usuarios/nuevo', 'config.usuarios.crear'],
  ['/configuracion/roles/nuevo', 'config.roles.crear'],
  ['/ventas/cotizaciones', 'ventas.cotizaciones.ver'],
  ['/ventas/ordenes', 'ventas.pedidos.ver'],
  ['/ventas/por-cobrar', 'ventas.pedidos.ver'],
  ['/ventas/ventas-adicionales', 'ventas.pedidos.ver'],
  ['/ventas/reportes', 'ventas.pedidos.ver'],
  ['/ventas/clientes', 'ventas.clientes.ver'],
  ['/ventas/obras', 'ventas.obras.ver'],
  ['/ventas/productos', 'ventas.productos.ver'],
  ['/ventas/listas-de-precios', 'ventas.listas_precios.ver'],
  ['/ventas/descuentos-y-lealtad', 'ventas.programas.ver'],
  ['/configuracion/usuarios', 'config.usuarios.ver'],
  ['/configuracion/roles', 'config.roles.ver'],
  ['/configuracion/servidores-correo', 'config.servidores_correo.ver'],
  ['/configuracion/empresas', 'config.empresas.ver'],
  ['/configuracion/plantas', 'config.sucursales.ver'],
];

/** Sin permisos en la sesión (demo sin backend) se ve todo. */
export function puedeVerModulo(mios: readonly string[] | undefined, id: IdModulo): boolean {
  if (!mios) return true;
  const prefijos = PERMISOS_MODULO[id];
  return prefijos ? prefijos.some((p) => tieneAlgo(mios, p)) : mios.includes(TODOS);
}

export function puedeVerRuta(mios: readonly string[] | undefined, url: string): boolean {
  if (!mios) return true;
  const ruta = url.split(/[?#]/)[0];
  const regla = PERMISOS_RUTA.find(([r]) => ruta === r || ruta.startsWith(r + '/'));
  return !regla || tiene(mios, regla[1]);
}

/**
 * Para componentes: `protected readonly puede = permisosSesion();` y en la plantilla `@if (puede('ventas.productos.crear'))`.
 * Sin permisos en la sesión (demo sin backend), todo.
 */
export function permisosSesion(): (permiso: string) => boolean {
  const auth = inject(AuthService);
  return (permiso) => tiene(auth.sesion()?.permisos ?? [TODOS], permiso);
}
