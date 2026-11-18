/*
 * Datos del cliente, los mismos en el portal (los captura en Mi perfil y Facturación) y en el ERP (Ventas → Clientes).
 */

/** Quien usa el portal en nombre del cliente (Mi perfil). */
export interface PerfilUsuario {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  puesto: string;
  representaEmpresa: boolean;
  empresa: DatosEmpresaRepresentada;
}

/** La empresa que representa (Mi perfil). */
export interface DatosEmpresaRepresentada {
  razonSocial: string;
  nombreComercial: string;
  rfc: string;
  giro: string;
  correo: string;
  telefono: string;
  sitioWeb: string;
  domicilioFiscal: string;
  cargoRepresentante: string;
}

export type TipoDocumentoFiscal =
  'Constancia de situación fiscal' | 'Carátula bancaria' | 'Comprobante de domicilio' | 'Otro';

export interface DocumentoFiscal {
  id: string;
  nombre: string;
  tipo: TipoDocumentoFiscal;
  tamano: number;
  fechaCarga: string;
  /** El archivo recién elegido (sin backend) … */
  archivo?: File;
  /** … o su id en el backend (GET /portal/archivos/{id}). */
  archivoId?: string;
}

/** Un receptor fiscal del cliente (Facturación en el portal). */
export interface DatosFacturacion {
  id: string;
  alias: string;
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  usoCfdi: string;
  correo: string;
  direccionFiscal: string;
  predeterminado: boolean;
  documentos: DocumentoFiscal[];
}

export type DatosFacturacionEntrada = Omit<DatosFacturacion, 'id' | 'documentos'>;

/**
 * Cliente de la concretera con lo que captura en el portal: su empresa y su contacto (Mi perfil) y sus receptores
 * fiscales (Facturación); sus obras son Obra con su clienteId. `portal`: ya tiene cuenta, y su contacto entra con ese
 * correo (a esa cuenta le llegan las cotizaciones).
 */
export interface Cliente {
  id: string;
  /** Como se le conoce: su nombre comercial. */
  nombre: string;
  empresa: DatosEmpresaRepresentada;
  contacto: Omit<PerfilUsuario, 'representaEmpresa' | 'empresa'>;
  facturacion: DatosFacturacion[];
  portal: boolean;
  /** Cuántas cotizaciones y obras puede crear en el portal; null = sin límite. */
  limites?: LimitesCliente;
  /** Crédito que le da la concretera: límite en pesos (null = sin crédito) y días para pagar. */
  credito?: { limite: number | null; dias: number };
}

export interface LimitesCliente {
  cotizaciones: number | null;
  obras: number | null;
}

/** RFC de 12 (persona moral) o 13 caracteres (física), sin importar espacios ni mayúsculas; la misma regla en portal y ERP. */
export const rfcValido = (rfc: string) => /^[A-Za-zÑñ&]{3,4}\d{6}[A-Za-z\d]{3}$/.test(rfc.replace(/\s/g, ''));
