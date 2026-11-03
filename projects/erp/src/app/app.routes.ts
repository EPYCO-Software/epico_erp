import { Routes } from '@angular/router';
import { authGuard, guestGuard } from 'ui';

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
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · EPICO ERP',
        loadComponent: () => import('./features/dashboard/dashboard'),
      },
      {
        path: 'pedidos',
        title: 'Pedidos · EPICO ERP',
        loadComponent: () => import('./features/pedidos/pedidos'),
      },
      {
        path: 'flota',
        title: 'Flota · EPICO ERP',
        loadComponent: () => import('./features/flota/flota'),
      },
      {
        path: 'combustible',
        title: 'Combustible · EPICO ERP',
        loadComponent: () => import('./features/combustible/combustible'),
      },
      {
        path: 'laboratorio',
        title: 'Laboratorio · EPICO ERP',
        loadComponent: () => import('./features/laboratorio/laboratorio'),
      },
      {
        path: 'mantenimiento',
        title: 'Mantenimiento · EPICO ERP',
        loadComponent: () => import('./features/mantenimiento/mantenimiento'),
      },
      {
        path: 'inventario',
        title: 'Inventario · EPICO ERP',
        loadComponent: () => import('./features/inventario/inventario'),
      },
      {
        path: 'clientes',
        title: 'Clientes · EPICO ERP',
        loadComponent: () => import('./features/clientes/clientes'),
      },
      {
        path: 'ventas',
        title: 'Ventas · EPICO ERP',
        loadComponent: () => import('./features/ventas/ventas'),
      },
      {
        path: 'facturacion',
        title: 'Facturación · EPICO ERP',
        loadComponent: () => import('./features/facturacion/facturacion'),
      },
      {
        path: 'configuracion',
        title: 'Configuración · EPICO ERP',
        loadComponent: () => import('./features/configuracion/configuracion'),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
