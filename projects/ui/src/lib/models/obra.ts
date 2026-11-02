export interface Obra {
  id: string;
  clienteId: string;
  nombre: string;
  direccion: string;
}

export interface ObraVista extends Obra {
  clienteNombre: string;
}
