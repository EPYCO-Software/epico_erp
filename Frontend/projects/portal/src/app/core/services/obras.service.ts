import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_API_URL,
  ApiObra,
  ApiProducto,
  AuthService,
  type ConcretoDisponible,
  Obra,
  PlantaServidor,
  aObra,
  concretoDe,
  concretosServidor,
  aditivoDe,
  aditivosServidor,
  type AditivoDisponible,
  idFront,
  mensajeError,
  plantasServidor,
} from 'ui';

// El formulario de obra y su tipo viven en ui (también los usa el ERP)
export type { NuevaObra } from 'ui';
import type { NuevaObra } from 'ui';

// Sin backend (pruebas, demo): obras de ejemplo en memoria.
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

/** Cuerpo de POST/PUT /portal/obras (el cliente lo pone el backend). */
const obraApi = (d: NuevaObra) => ({
  nombre: d.nombre,
  direccion: d.direccion,
  municipio: d.municipio,
  referencias: d.referencias ?? null,
  lat: d.ubicacion?.lat ?? null,
  lng: d.ubicacion?.lng ?? null,
  responsableNombre: d.responsable.nombre,
  contactos: d.contactos,
});

/**
 * Obras del cliente. Con backend se leen de /portal/obras al entrar (y con ellas las plantas reales del catálogo, que
 * usa plantaPara) y cada alta o cambio se guarda allá; el backend no deja editar una obra con pedido en curso (409).
 * Sin él (pruebas, demo), en memoria con obras de ejemplo.
 * shortcut: la foto del responsable aún no se sube (/portal/archivos); se queda solo en esta sesión.
 */
@Service()
export class ObrasService {
  private readonly base = inject(AUTH_API_URL, { optional: true });
  private readonly http = this.base ? inject(HttpClient) : null;
  private readonly auth = this.base ? inject(AuthService) : null;
  private readonly _obras = signal<Obra[]>(this.base ? [] : OBRAS_DEMO);
  readonly obras = this._obras.asReadonly();
  readonly errorCarga = signal('');

  constructor() {
    if (!this.base) return;
    const cliente = computed(() => this.auth!.sesion()?.cliente?.id ?? '');
    effect(() => {
      if (cliente()) untracked(() => void this.recargar());
    });
  }

  async recargar(): Promise<void> {
    try {
      const [obras, catalogo] = await Promise.all([
        firstValueFrom(this.http!.get<ApiObra[]>(`${this.base}/portal/obras`)),
        firstValueFrom(this.http!.get<{ plantas: PlantaServidor[]; productos: ApiProducto[] }>(`${this.base}/portal/catalogo`)),
      ]);
      plantasServidor.set(catalogo.plantas);
      // shortcut: precio de lista; las reglas de la lista del cliente las aplica el backend al guardar
      concretosServidor.set(
        catalogo.productos
          .filter((p) => p.activo)
          .map((p) => concretoDe({ id: idFront(p), precio: p.precioLista, soluciones: p.soluciones ?? [] }))
          .filter((c): c is ConcretoDisponible => !!c),
      );
      aditivosServidor.set(
        catalogo.productos
          .filter((p) => p.activo)
          .map((p) => aditivoDe({ codigo: p.codigo, nombre: p.nombre, precio: p.precioLista }))
          .filter((a): a is AditivoDisponible => !!a),
      );
      this._obras.set(obras.map(aObra));
      this.errorCarga.set('');
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    }
  }

  async agregar(datos: NuevaObra): Promise<Obra> {
    const limpio = limpiar(datos);
    if (this.base) {
      const o = aObra(await firstValueFrom(this.http!.post<ApiObra>(`${this.base}/portal/obras`, obraApi(limpio))));
      const obra = limpio.responsable.foto ? { ...o, responsable: { ...o.responsable, foto: limpio.responsable.foto } } : o;
      this._obras.update((l) => [...l, obra]);
      return obra;
    }
    const obra: Obra = { ...limpio, id: `o-${Date.now().toString(36)}-${siguiente++}`, clienteId: 'c1' };
    this._obras.update((o) => [...o, obra]);
    return obra;
  }

  /** Reemplaza los datos de una obra. Con backend, una obra con pedido en curso da 409 (las pantallas tampoco lo permiten). */
  async actualizar(id: string, datos: NuevaObra): Promise<void> {
    const limpio = limpiar(datos);
    if (this.base) await firstValueFrom(this.http!.put(`${this.base}/portal/obras/${id}`, { ...obraApi(limpio), id }));
    this._obras.update((o) => o.map((x) => (x.id === id ? { ...x, ...limpio } : x)));
  }

  buscar(id: string | null): Obra | null {
    return this._obras().find((o) => o.id === id) ?? null;
  }
}
