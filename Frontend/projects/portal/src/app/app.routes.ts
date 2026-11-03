import { Routes } from '@angular/router';
import { authGuard, guestGuard } from 'ui';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión · Portal EPICO',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login'),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalogo' },
      {
        path: 'catalogo',
        title: 'Solicitar cotización · Portal EPICO',
        loadComponent: () => import('./features/catalogo/catalogo'),
      },
      {
        path: 'cotizaciones',
        title: 'Mis cotizaciones · Portal EPICO',
        loadComponent: () => import('./features/cotizaciones/cotizaciones'),
      },
      {
        path: 'cotizaciones/:folio',
        title: 'Cotización · Portal EPICO',
        loadComponent: () => import('./features/cotizaciones/cotizacion'),
      },
      {
        path: 'obras',
        title: 'Mis obras · Portal EPICO',
        loadComponent: () => import('./features/obras/obras'),
      },
      {
        path: 'obras/:id',
        title: 'Obra · Portal EPICO',
        loadComponent: () => import('./features/obras/obra'),
      },
      {
        path: 'perfil',
        title: 'Perfil y facturación · Portal EPICO',
        loadComponent: () => import('./features/perfil/perfil'),
      },
      {
        path: 'pedidos',
        title: 'Mis pedidos · Portal EPICO',
        loadComponent: () => import('./features/pedidos/pedidos'),
      },
      {
        path: 'pedidos/:folio',
        title: 'Pedido · Portal EPICO',
        loadComponent: () => import('./features/pedidos/pedido'),
      },
      {
        path: 'remisiones',
        title: 'Remisiones · Portal EPICO',
        loadComponent: () => import('./features/remisiones/remisiones'),
      },
      {
        path: 'facturas',
        title: 'Facturas · Portal EPICO',
        loadComponent: () => import('./features/facturas/facturas'),
      },
      {
        path: 'laboratorio',
        title: 'Laboratorio · Portal EPICO',
        loadComponent: () => import('./features/laboratorio/laboratorio'),
      },
      { path: '**', redirectTo: 'catalogo' },
    ],
  },
];
