import { Injector, inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard } from 'ui';
import { IdModulo, buscarModulo, enlacesDelMenu, moduloActivoGuard } from './core/modulos';

/** Sección de un módulo que aún no tiene página: "en construcción", con el encabezado del módulo. */
const enConstruccion = (path: string, seccion: string): Route => ({
  path,
  title: `${seccion} · EPICO ERP`,
  data: { seccion },
  loadComponent: () => import('./features/modulos/proximamente'),
});

/** Las opciones del menú del módulo que aún no tienen página (todas menos `hechas`), "en construcción". */
const menuEnConstruccion = (id: IdModulo, hechas: string[]): Route[] => {
  const modulo = buscarModulo(id)!;
  return (modulo.menu ?? [])
    .flatMap(enlacesDelMenu)
    .filter((e) => !hechas.includes(e.ruta))
    .map((e) => enConstruccion(e.ruta.slice(modulo.ruta.length + 1), e.nombre));
};

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · EPICO ERP',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login'),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    // Las páginas de módulos no activados llevan al aviso de /modulos/:id (data.modulo de cada ruta).
    canActivateChild: [moduloActivoGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Módulos · EPICO ERP',
        loadComponent: () => import('./features/inicio/inicio'),
      },
      {
        path: 'dashboard',
        data: { modulo: 'analitica' },
        title: 'Dashboard · EPICO ERP',
        loadComponent: () => import('./features/dashboard/dashboard'),
      },
      {
        path: 'pedidos',
        data: { modulo: 'pedidos' },
        title: 'Pedidos · EPICO ERP',
        loadComponent: () => import('./features/pedidos/pedidos'),
      },
      {
        path: 'flota',
        data: { modulo: 'logistica' },
        title: 'Flota · EPICO ERP',
        loadComponent: () => import('./features/flota/flota'),
      },
      {
        path: 'combustible',
        data: { modulo: 'logistica' },
        title: 'Combustible · EPICO ERP',
        loadComponent: () => import('./features/combustible/combustible'),
      },
      {
        path: 'laboratorio',
        data: { modulo: 'calidad' },
        title: 'Laboratorio · EPICO ERP',
        loadComponent: () => import('./features/laboratorio/laboratorio'),
      },
      {
        path: 'mantenimiento',
        data: { modulo: 'operaciones' },
        title: 'Mantenimiento · EPICO ERP',
        loadComponent: () => import('./features/mantenimiento/mantenimiento'),
      },
      {
        path: 'inventario',
        data: { modulo: 'inventario' },
        title: 'Inventario · EPICO ERP',
        loadComponent: () => import('./features/inventario/inventario'),
      },
      {
        path: 'clientes',
        data: { modulo: 'crm' },
        title: 'Clientes · EPICO ERP',
        loadComponent: () => import('./features/clientes/clientes'),
      },
      {
        // Sin componente: sus hijas heredan data.modulo (el encabezado muestra el módulo y su menú).
        path: 'ventas',
        data: { modulo: 'ventas' },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'cotizaciones' },
          {
            path: 'cotizaciones',
            title: 'Cotizaciones · EPICO ERP',
            loadComponent: () => import('./features/ventas/cotizaciones'),
          },
          {
            // La misma lista, abierta en las que llegaron del portal (data.recibidas llega como input).
            path: 'cotizaciones/recibidas',
            title: 'Cotizaciones recibidas · EPICO ERP',
            data: { recibidas: true },
            loadComponent: () => import('./features/ventas/cotizaciones'),
          },
          {
            path: 'cotizaciones/nueva',
            title: 'Nueva cotización · EPICO ERP',
            loadComponent: () => import('./features/ventas/nueva-cotizacion'),
            // Con cambios sin guardar, pregunta antes de salir.
            canDeactivate: [(c: { puedeSalir(): boolean }) => c.puedeSalir()],
          },
          {
            path: 'cotizaciones/:id',
            title: (ruta) => `${ruta.paramMap.get('id')} · EPICO ERP`,
            loadComponent: () => import('./features/ventas/cotizacion'),
          },
          {
            path: 'ordenes',
            title: 'Órdenes de venta · EPICO ERP',
            loadComponent: () => import('./features/ventas/ordenes'),
          },
          {
            // La misma hoja que Nueva cotización, en modo orden de venta (data.modo llega como input).
            path: 'ordenes/nueva',
            title: 'Nueva orden de venta · EPICO ERP',
            data: { modo: 'orden' },
            loadComponent: () => import('./features/ventas/nueva-cotizacion'),
            canDeactivate: [(c: { puedeSalir(): boolean }) => c.puedeSalir()],
          },
          {
            path: 'ordenes/:folio',
            title: (ruta) => `${ruta.paramMap.get('folio')} · EPICO ERP`,
            loadComponent: () => import('./features/ventas/pedido'),
          },
          {
            path: 'productos',
            title: 'Productos · EPICO ERP',
            loadComponent: () => import('./features/ventas/productos'),
          },
          {
            path: 'productos/nuevo',
            title: 'Nuevo producto · EPICO ERP',
            loadComponent: () => import('./features/ventas/nuevo-producto'),
            canDeactivate: [(c: { puedeSalir(): boolean }) => c.puedeSalir()],
          },
          {
            path: 'productos/:id',
            // El nombre vigente (también los dados de alta), sin cargar Ventas con la app: se importa al abrirla.
            title: (ruta) => {
              const injector = inject(Injector);
              return import('./features/ventas/datos').then(
                (m) => `${injector.get(m.VentasService).productos().find((p) => p.id === ruta.paramMap.get('id'))?.nombre ?? 'Producto'} · EPICO ERP`,
              );
            },
            loadComponent: () => import('./features/ventas/producto'),
          },
          {
            path: 'por-cobrar',
            title: 'Por cobrar · EPICO ERP',
            loadComponent: () => import('./features/ventas/por-cobrar'),
          },
          {
            path: 'clientes',
            title: 'Clientes · EPICO ERP',
            loadComponent: () => import('./features/ventas/clientes'),
          },
          {
            path: 'clientes/:id',
            // El nombre vigente del cliente (se puede editar), sin cargar sus datos con la app: se importan al abrirla.
            title: (ruta) => {
              const injector = inject(Injector);
              return import('./features/ventas/datos').then(
                (m) => `${injector.get(m.VentasService).cliente(ruta.paramMap.get('id') ?? '')?.nombre ?? 'Cliente'} · EPICO ERP`,
              );
            },
            loadComponent: () => import('./features/ventas/cliente'),
          },
          ...menuEnConstruccion('ventas', ['/ventas/cotizaciones', '/ventas/cotizaciones/recibidas', '/ventas/ordenes', '/ventas/por-cobrar', '/ventas/productos', '/ventas/clientes']),
        ],
      },
      {
        path: 'facturacion',
        data: { modulo: 'finanzas' },
        title: 'Facturación · EPICO ERP',
        loadComponent: () => import('./features/facturacion/facturacion'),
      },
      {
        path: 'configuracion',
        data: { modulo: 'seguridad' },
        title: 'Configuración · EPICO ERP',
        loadComponent: () => import('./features/configuracion/configuracion'),
      },
      {
        path: 'modulos/:id',
        title: 'Módulo · EPICO ERP',
        loadComponent: () => import('./features/modulos/proximamente'),
      },
      { path: '**', redirectTo: 'inicio' },
    ],
  },
];
