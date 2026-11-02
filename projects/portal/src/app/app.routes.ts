import { Routes } from '@angular/router';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'obras' },
      {
        path: 'obras',
        title: 'Mis obras · Portal EPICO',
        loadComponent: () => import('./features/obras/obras'),
      },
      {
        path: 'pedidos',
        title: 'Pedidos · Portal EPICO',
        loadComponent: () => import('./features/pedidos/pedidos'),
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
      { path: '**', redirectTo: 'obras' },
    ],
  },
];
