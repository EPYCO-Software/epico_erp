/** Coordenadas GPS (WGS84) del acceso a la obra. */
export interface UbicacionGps {
  lat: number;
  lng: number;
}

export interface Obra {
  id: string;
  /** '' = obra general, sin cliente (Ventas → Obras). */
  clienteId: string;
  nombre: string;
  direccion: string;
  /** Municipio y estado, p. ej. "Cozumel, Q. Roo". */
  municipio: string;
  /** Cómo llegar: entre calles, puntos de referencia, acceso para la olla. */
  referencias?: string;
  /** Muchas obras no tienen dirección formal: el punto GPS evita que el operador se pierda. */
  ubicacion?: UbicacionGps;
  /** Quién recibe el concreto en la obra. */
  responsable: ResponsableObra;
  /** Al menos uno: a quién llama el operador o el asesor. */
  contactos: ContactoObra[];
}

export interface ResponsableObra {
  nombre: string;
  /** URL o data URL de la foto (opcional). */
  foto?: string;
}

export interface ContactoObra {
  nombre: string;
  /** Lada internacional con +, p. ej. "+52" (México, por defecto). */
  lada: string;
  /** Solo dígitos, sin lada. */
  numero: string;
}

/**
 * Lugar de entrega capturado solo para una cotización (y sus pedidos), sin dar de alta una obra: a dónde va el concreto
 * y quién lo recibe. La cotización va a una obra O a un lugar, nunca a los dos.
 */
export interface LugarDeEntrega {
  direccion: string;
  municipio: string;
  referencias?: string;
  ubicacion?: UbicacionGps;
  /** Quién recibe y su teléfono (10 dígitos). */
  contacto: string;
  telefono: string;
}

/** Id con que las partidas apuntan al lugar de entrega de su cotización (o pedido): no es una obra del catálogo. */
export const idLugar = (registroId: string) => 'lugar:' + registroId;
export const esLugar = (obraId: string) => obraId.startsWith('lugar:') || obraId === 'lugar';

/**
 * El lugar como una obra de solo lectura, para que las vistas que buscan la obra de una partida (detalle, PDF, mapa,
 * traslado) lo muestren igual. No va en el catálogo de obras.
 */
export function obraDelLugar(id: string, clienteId: string, l: LugarDeEntrega): Obra {
  return {
    id,
    clienteId,
    nombre: 'Lugar de entrega',
    direccion: l.direccion,
    municipio: l.municipio,
    ...(l.referencias ? { referencias: l.referencias } : {}),
    ...(l.ubicacion ? { ubicacion: l.ubicacion } : {}),
    responsable: { nombre: l.contacto },
    contactos: l.contacto || l.telefono ? [{ nombre: l.contacto, lada: '+52', numero: l.telefono }] : [],
  };
}

/** Lo que se captura de una obra (el id y el cliente los pone quien la guarda). */
export type NuevaObra = Omit<Obra, 'id' | 'clienteId'>;

export interface ObraVista extends Obra {
  clienteNombre: string;
}
