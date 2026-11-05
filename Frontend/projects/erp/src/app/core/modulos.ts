import { Service, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export type IdModulo =
  | 'seguridad'
  | 'crm'
  | 'ventas'
  | 'pedidos'
  | 'productos'
  | 'calidad'
  | 'compras'
  | 'inventario'
  | 'planeacion'
  | 'automatizacion'
  | 'logistica'
  | 'operaciones'
  | 'finanzas'
  | 'personal'
  | 'documentos'
  | 'analitica'
  | 'integraciones';

export interface Modulo {
  id: IdModulo;
  nombre: string;
  /** Página del módulo. Los que aún no tienen página van a /modulos/:id ("en construcción"). */
  ruta: string;
  /** Activado para la empresa. Los demás se ven en la lista, pero al abrirlos avisan que no están activados. */
  activo: boolean;
  /** Menús del encabezado dentro del módulo, como los de las apps de Odoo. */
  menu?: MenuModulo[];
}

export interface EnlaceModulo {
  nombre: string;
  ruta: string;
}

/** Un menú desplegable del módulo: sus enlaces y, debajo, secciones con título (como Configuración en Odoo). */
export interface MenuModulo {
  nombre: string;
  enlaces: EnlaceModulo[];
  secciones?: { titulo: string; enlaces: EnlaceModulo[] }[];
}

/** Todos los enlaces de un menú, en orden. */
export const enlacesDelMenu = (m: MenuModulo) => [...m.enlaces, ...(m.secciones ?? []).flatMap((s) => s.enlaces)];

// shortcut: módulos activos fijos para todas las empresas; vendrán del backend (licencia/configuración por empresa).
const ACTIVOS: IdModulo[] = ['crm', 'ventas', 'pedidos'];

/**
 * Los mismos menús que Ventas en Odoo. Las opciones sin página abren "en construcción" (app.routes.ts).
 * Equipos de ventas (en Órdenes y en Configuración) está desactivado hasta que tenga su lógica.
 */
const MENU_VENTAS: MenuModulo[] = [
  {
    nombre: 'Órdenes',
    enlaces: [
      { nombre: 'Cotizaciones', ruta: '/ventas/cotizaciones' },
      { nombre: 'Cotizaciones recibidas', ruta: '/ventas/cotizaciones/recibidas' },
      { nombre: 'Órdenes', ruta: '/ventas/ordenes' },
      { nombre: 'Clientes', ruta: '/ventas/clientes' },
    ],
  },
  {
    nombre: 'Por cobrar',
    enlaces: [
      { nombre: 'Órdenes por cobrar', ruta: '/ventas/por-cobrar' },
      { nombre: 'Órdenes para crear ventas adicionales', ruta: '/ventas/ventas-adicionales' },
    ],
  },
  {
    nombre: 'Productos',
    enlaces: [
      { nombre: 'Productos', ruta: '/ventas/productos' },
      { nombre: 'Listas de precios', ruta: '/ventas/listas-de-precios' },
      { nombre: 'Descuentos y programas de lealtad', ruta: '/ventas/descuentos-y-lealtad' },
      { nombre: 'Tarjetas de regalo y monedero electrónico', ruta: '/ventas/tarjetas-de-regalo' },
    ],
  },
  {
    nombre: 'Reportes',
    enlaces: [
      { nombre: 'Ventas', ruta: '/ventas/reportes/ventas' },
      { nombre: 'Vendedores', ruta: '/ventas/reportes/vendedores' },
      { nombre: 'Productos', ruta: '/ventas/reportes/productos' },
      { nombre: 'Clientes', ruta: '/ventas/reportes/clientes' },
    ],
  },
  {
    nombre: 'Configuración',
    enlaces: [
      { nombre: 'Ajustes', ruta: '/ventas/configuracion/ajustes' },
    ],
    secciones: [
      {
        titulo: 'Órdenes de venta',
        enlaces: [
          { nombre: 'Plantillas de cotización', ruta: '/ventas/configuracion/plantillas' },
          { nombre: 'Encabezados/pies de página', ruta: '/ventas/configuracion/encabezados-y-pies' },
          { nombre: 'Métodos de entrega', ruta: '/ventas/configuracion/metodos-de-entrega' },
          { nombre: 'Etiquetas', ruta: '/ventas/configuracion/etiquetas' },
        ],
      },
      {
        titulo: 'Productos',
        enlaces: [
          { nombre: 'Opciones de los combos', ruta: '/ventas/configuracion/combos' },
          { nombre: 'Categorías', ruta: '/ventas/configuracion/categorias' },
          { nombre: 'Etiquetas de producto', ruta: '/ventas/configuracion/etiquetas-de-producto' },
          { nombre: 'Unidades y embalajes', ruta: '/ventas/configuracion/unidades' },
        ],
      },
      {
        titulo: 'Pagos en línea',
        enlaces: [
          { nombre: 'Proveedores de pago', ruta: '/ventas/configuracion/proveedores-de-pago' },
          { nombre: 'Métodos de pago', ruta: '/ventas/configuracion/metodos-de-pago' },
        ],
      },
      { titulo: 'Actividades', enlaces: [{ nombre: 'Planes de actividad', ruta: '/ventas/configuracion/planes-de-actividad' }] },
    ],
  },
];

/**
 * Catálogo de módulos del ERP, en el orden de la pantalla de inicio. Es la navegación de la app.
 * Los nombres llevan espacio no separable (\u00a0) donde el mockup corta la línea distinto ("Integraciones / e IoT").
 */
const CATALOGO: Omit<Modulo, 'activo'>[] = [
  { id: 'seguridad', nombre: 'Seguridad y plataforma', ruta: '/configuracion' },
  { id: 'crm', nombre: 'CRM', ruta: '/clientes' },
  { id: 'ventas', nombre: 'Ventas', ruta: '/ventas', menu: MENU_VENTAS },
  { id: 'pedidos', nombre: 'Pedidos y atención', ruta: '/pedidos' },
  { id: 'productos', nombre: 'Productos y recetas', ruta: '/modulos/productos' },
  { id: 'calidad', nombre: 'Calidad y laboratorio', ruta: '/laboratorio' },
  { id: 'compras', nombre: 'Compras y proveedores', ruta: '/modulos/compras' },
  { id: 'inventario', nombre: 'Inventario y materiales', ruta: '/inventario' },
  { id: 'planeacion', nombre: 'Planeación y despacho', ruta: '/modulos/planeacion' },
  { id: 'automatizacion', nombre: 'Automatización de planta', ruta: '/modulos/automatizacion' },
  { id: 'logistica', nombre: 'Logística, flota y bombeo', ruta: '/flota' },
  { id: 'operaciones', nombre: 'Operaciones y mantenimiento', ruta: '/mantenimiento' },
  { id: 'finanzas', nombre: 'Finanzas y facturación', ruta: '/facturacion' },
  { id: 'personal', nombre: 'Personal y colaboradores', ruta: '/modulos/personal' },
  { id: 'documentos', nombre: 'Documentos y cumplimiento', ruta: '/modulos/documentos' },
  { id: 'analitica', nombre: 'Analítica y torre de control', ruta: '/dashboard' },
  { id: 'integraciones', nombre: 'Integraciones e\u00a0IoT', ruta: '/modulos/integraciones' },
];

export const MODULOS: Modulo[] = CATALOGO.map((m) => ({ ...m, activo: ACTIVOS.includes(m.id) }));

/** Minúsculas y sin acentos, para buscar "planeacion" y encontrar "Planeación". */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Módulos cuyo nombre contiene todas las palabras buscadas (en cualquier orden, sin importar acentos). */
export function filtrarModulos(modulos: Modulo[], texto: string): Modulo[] {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return modulos;
  return modulos.filter((m) => {
    const nombre = normalizar(m.nombre);
    return palabras.every((p) => nombre.includes(p));
  });
}

export const buscarModulo = (id: string) => MODULOS.find((m) => m.id === id);

/** Qué módulos muestra la pantalla de inicio (botón de filtros al final del buscador). Se suman. */
export type FiltroModulos = 'activados' | 'favoritos' | 'todos';

/** En el orden del panel de filtros. */
export const FILTROS_MODULOS: { id: FiltroModulos; nombre: string }[] = [
  { id: 'activados', nombre: 'Activados' },
  { id: 'favoritos', nombre: 'Favoritos' },
  { id: 'todos', nombre: 'Todos los módulos' },
];

/** Los módulos de cualquiera de los filtros (se suman), en el orden del catálogo. */
export function modulosDelFiltro(filtros: FiltroModulos[], favoritos: Modulo[]): Modulo[] {
  return MODULOS.filter(
    (m) =>
      filtros.includes('todos') ||
      (filtros.includes('activados') && m.activo) ||
      (filtros.includes('favoritos') && favoritos.includes(m)),
  );
}

const LISTA = new Intl.ListFormat('es');

@Service()
export class ModulosService {
  /** Texto del buscador del encabezado (y del de la pantalla de inicio en celular). */
  readonly busqueda = signal('');
  /** Por defecto solo los activados. Nunca queda vacío: sin ninguno es "todos". */
  readonly filtros = signal<FiltroModulos[]>(['activados']);
  /** "activados y favoritos" (en el orden del panel), para títulos y etiquetas. */
  readonly descripcion = computed(() =>
    LISTA.format(FILTROS_MODULOS.filter((f) => this.filtros().includes(f.id)).map((f) => f.nombre.toLowerCase())),
  );
  // shortcut: favoritos fijos; cuando exista la tabla `preferencias` del backend, leerlos y guardarlos por usuario.
  private readonly idsFavoritos = signal<IdModulo[]>(['seguridad', 'crm', 'ventas', 'pedidos']);

  readonly favoritos = computed(() =>
    this.idsFavoritos()
      .map(buscarModulo)
      .filter((m): m is Modulo => !!m),
  );
  /** Los de los filtros elegidos; la búsqueda busca dentro de ellos. */
  readonly resultados = computed(() => filtrarModulos(modulosDelFiltro(this.filtros(), this.favoritos()), this.busqueda()));
  readonly buscando = computed(() => this.busqueda().trim() !== '');

  /** Activados y Favoritos se combinan; "Todos" quita los demás y marcar otro lo quita a él. */
  alternarFiltro(id: FiltroModulos): void {
    this.filtros.update((antes) => {
      if (id === 'todos') return ['todos'];
      const otros = antes.filter((f) => f !== 'todos');
      const despues = otros.includes(id) ? otros.filter((f) => f !== id) : [...otros, id];
      return despues.length ? despues : ['todos'];
    });
  }
}

/**
 * Las páginas de módulos no activados no se abren ni escribiendo la dirección: llevan al aviso de /modulos/:id.
 * Cada ruta indica su módulo en `data.modulo`.
 */
export const moduloActivoGuard: CanActivateFn = (ruta) => {
  const id = ruta.data['modulo'] as IdModulo | undefined;
  const modulo = id ? buscarModulo(id) : undefined;
  return !modulo || modulo.activo || inject(Router).createUrlTree(['/modulos', modulo.id]);
};
