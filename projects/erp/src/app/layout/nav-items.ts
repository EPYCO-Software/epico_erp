export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'General', items: [{ label: 'Dashboard', icon: 'pi-home', path: '/dashboard' }] },
  {
    label: 'Operación',
    items: [
      { label: 'Pedidos', icon: 'pi-clipboard', path: '/pedidos' },
      { label: 'Flota', icon: 'pi-truck', path: '/flota' },
      { label: 'Combustible', icon: 'pi-gauge', path: '/combustible' },
    ],
  },
  { label: 'Calidad', items: [{ label: 'Laboratorio', icon: 'pi-filter', path: '/laboratorio' }] },
  {
    label: 'Activos',
    items: [
      { label: 'Mantenimiento', icon: 'pi-wrench', path: '/mantenimiento' },
      { label: 'Inventario', icon: 'pi-box', path: '/inventario' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', icon: 'pi-users', path: '/clientes' },
      { label: 'Ventas', icon: 'pi-chart-line', path: '/ventas' },
      { label: 'Facturación', icon: 'pi-file', path: '/facturacion' },
    ],
  },
  { label: 'Configuración', items: [{ label: 'Configuración', icon: 'pi-cog', path: '/configuracion' }] },
];
