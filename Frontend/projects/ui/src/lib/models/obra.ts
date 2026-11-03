/** Coordenadas GPS (WGS84) del acceso a la obra. */
export interface UbicacionGps {
  lat: number;
  lng: number;
}

export interface Obra {
  id: string;
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

export interface ObraVista extends Obra {
  clienteNombre: string;
}
