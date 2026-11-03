import {
  Box,
  ChartLine,
  ClipboardList,
  FileText,
  FlaskConical,
  Fuel,
  House,
  IconNode,
  Settings,
  Truck,
  Users,
  Wrench,
} from 'lucide';

export interface NavItem {
  label: string;
  icon: IconNode;
  path: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'General', items: [{ label: 'Dashboard', icon: House, path: '/dashboard' }] },
  {
    label: 'Operación',
    items: [
      { label: 'Pedidos', icon: ClipboardList, path: '/pedidos' },
      { label: 'Flota', icon: Truck, path: '/flota' },
      { label: 'Combustible', icon: Fuel, path: '/combustible' },
    ],
  },
  { label: 'Calidad', items: [{ label: 'Laboratorio', icon: FlaskConical, path: '/laboratorio' }] },
  {
    label: 'Activos',
    items: [
      { label: 'Mantenimiento', icon: Wrench, path: '/mantenimiento' },
      { label: 'Inventario', icon: Box, path: '/inventario' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', icon: Users, path: '/clientes' },
      { label: 'Ventas', icon: ChartLine, path: '/ventas' },
      { label: 'Facturación', icon: FileText, path: '/facturacion' },
    ],
  },
  { label: 'Configuración', items: [{ label: 'Configuración', icon: Settings, path: '/configuracion' }] },
];
