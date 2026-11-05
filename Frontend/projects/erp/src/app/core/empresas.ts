/** Concretera (cliente de EPICO) con la que entra el usuario; se elige en el login. */
export interface Empresa {
  id: string;
  nombre: string;
}

// shortcut: lista fija de concreteras para la demo; vendrá del backend según las empresas del usuario.
export const EMPRESAS: Empresa[] = [
  { id: 'demo', nombre: 'Demo Company' },
  { id: 'epico', nombre: 'EPICO Concretos' },
];
