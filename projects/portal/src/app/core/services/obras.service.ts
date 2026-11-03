import { Service, signal } from '@angular/core';
import { Obra } from 'ui';

export type NuevaObra = Omit<Obra, 'id' | 'clienteId'>;

// shortcut: obras en memoria con clienteId fijo. Al conectar el backend, cargarlas del cliente en sesión
// y guardar las nuevas por HTTP sin cambiar esta API.
const OBRAS_DEMO: Obra[] = [
  {
    id: 'o1', clienteId: 'c1', nombre: 'Torre Norte', direccion: 'Av. Rafael E. Melgar 120, Centro', municipio: 'Cozumel, Q. Roo',
    referencias: 'Frente al muelle fiscal; acceso de ollas por calle 3 Sur.', ubicacion: { lat: 20.5106, lng: -86.9495 },
    responsable: { nombre: 'Ing. Mariana Pech Canul' },
    contactos: [
      { nombre: 'Mariana Pech (residente)', lada: '+52', numero: '9871234567' },
      { nombre: 'Jorge Ek (almacén)', lada: '+52', numero: '9877654321' },
    ],
  },
  {
    id: 'o2', clienteId: 'c1', nombre: 'Bodega Escárcega', direccion: 'Carretera Escárcega–Chetumal km 3', municipio: 'Escárcega, Camp.',
    responsable: { nombre: 'Arq. Luis Chablé Mena' },
    contactos: [
      { nombre: 'Luis Chablé', lada: '+52', numero: '9821187643' },
      { nombre: 'Kevin Rodríguez (supervisor, EE. UU.)', lada: '+1', numero: '3055550142' },
    ],
  },
];

let siguiente = 1;

/** Limpia espacios y descarta lo vacío (referencias, foto). */
function limpiar(datos: NuevaObra): NuevaObra {
  return {
    ...datos,
    nombre: datos.nombre.trim(),
    direccion: datos.direccion.trim(),
    municipio: datos.municipio.trim(),
    referencias: datos.referencias?.trim() || undefined,
    responsable: { nombre: datos.responsable.nombre.trim(), foto: datos.responsable.foto || undefined },
    contactos: datos.contactos.map((c) => ({ nombre: c.nombre.trim(), lada: c.lada, numero: c.numero.replace(/\D/g, '') })),
  };
}

@Service()
export class ObrasService {
  private readonly _obras = signal<Obra[]>(OBRAS_DEMO);
  readonly obras = this._obras.asReadonly();

  agregar(datos: NuevaObra): Obra {
    const obra: Obra = { ...limpiar(datos), id: `o-${Date.now().toString(36)}-${siguiente++}`, clienteId: 'c1' };
    this._obras.update((o) => [...o, obra]);
    return obra;
  }

  /**
   * Reemplaza los datos de una obra. Las pantallas no lo permiten si la obra tiene un pedido en curso
   * (PedidosService.enCurso); shortcut: el backend debe validar esa misma regla al conectar.
   */
  actualizar(id: string, datos: NuevaObra): void {
    this._obras.update((o) => o.map((x) => (x.id === id ? { ...x, ...limpiar(datos) } : x)));
  }

  buscar(id: string | null): Obra | null {
    return this._obras().find((o) => o.id === id) ?? null;
  }
}
