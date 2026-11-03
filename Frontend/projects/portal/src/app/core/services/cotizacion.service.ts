import { Service, computed, signal } from '@angular/core';
import {
  ConfiguracionConcreto,
  CotizacionGuardada,
  DisenoGuardado,
  EspecificacionConcreto,
  ModoEdicion,
  PartidaCotizacion,
} from 'ui';

// shortcut: diseños, partidas y cotizaciones en memoria (se pierden al recargar). Al conectar el backend,
// persistir por cliente (diseños y cotizaciones) y por solicitud (partidas) sin cambiar esta API.
const DISENOS_DEMO: DisenoGuardado[] = [
  {
    id: 'd1', nombre: 'Pavimento patio norte', solucionId: 'pavimento', favorito: true,
    especificacion: {
      tipoResistencia: 'fc', resistenciaKgCm2: 300, edadDias: 28, revenimientoCm: 10, tmaMm: 19,
      cemento: 'CPC 30R', exposicion: 'normal', colocacion: 'bombeo', aditivos: [],
    },
  },
  {
    id: 'd2', nombre: 'Losa nave 2', solucionId: 'losa', favorito: false,
    especificacion: {
      tipoResistencia: 'fc', resistenciaKgCm2: 250, edadDias: 28, revenimientoCm: 14, tmaMm: 19,
      cemento: 'CPC 30R', exposicion: 'normal', colocacion: 'directa', aditivos: ['fibra-sintetica'],
    },
  },
];

// Cotizaciones ficticias para el historial (obras demo de ObrasService). La CZM ya se aceptó: tiene el pedido
// PED-26-0141 (PedidosService).
const COTIZACIONES_DEMO: CotizacionGuardada[] = [
  {
    id: 'c-demo-2', folio: 'EPI-WEB-CZM-26002', serie: 'EPI-WEB-CZM-26002', revision: 0, fecha: '2026-10-30T09:45:00-05:00',
    partidas: [
      {
        id: 'p-demo-3', nombre: 'Pavimento', solucionId: 'pavimento', volumenM3: 35, obraId: 'o1',
        entrega: '2026-11-06T07:30:00-05:00', servicios: ['bomba-pluma'], maquinaria: [],
        especificacion: {
          tipoResistencia: 'mr', resistenciaKgCm2: 45, edadDias: 28, revenimientoCm: 10, tmaMm: 38,
          cemento: 'CPC 30R RS', exposicion: 'marina', colocacion: 'bombeo', aditivos: [],
        },
      },
    ],
  },
  {
    id: 'c-demo-1', folio: 'EPI-WEB-ESC-26001', serie: 'EPI-WEB-ESC-26001', revision: 0, fecha: '2026-10-28T11:20:00-06:00',
    partidas: [
      {
        id: 'p-demo-1', nombre: 'Losa y estructura', solucionId: 'losa', volumenM3: 20, obraId: 'o2',
        entrega: '2026-11-20T08:00:00-06:00', servicios: ['bomba-estacionaria', 'muestreo-laboratorio'], maquinaria: [],
        especificacion: {
          tipoResistencia: 'fc', resistenciaKgCm2: 200, edadDias: 28, revenimientoCm: 14, tmaMm: 19,
          cemento: 'CPC 30R', exposicion: 'normal', colocacion: 'bombeo', aditivos: [],
        },
      },
      {
        id: 'p-demo-2', nombre: 'Firmes y banquetas', solucionId: 'firmes', volumenM3: 12, obraId: 'o1',
        entrega: '2026-11-24T19:30:00-05:00', servicios: ['colado-nocturno', 'renta-maquinaria'],
        maquinaria: [{ tipo: 'allanadora', dias: 2 }],
        especificacion: {
          tipoResistencia: 'fc', resistenciaKgCm2: 150, edadDias: 28, revenimientoCm: 10, tmaMm: 19,
          cemento: 'CPC 30R', exposicion: 'humedad', colocacion: 'directa', aditivos: ['fibra-sintetica'],
        },
      },
    ],
  },
];

let siguiente = 1;
const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${siguiente++}`;

/** Diseños guardados, partidas de la cotización en curso y cotizaciones guardadas (con sus series). */
@Service()
export class CotizacionService {
  private readonly _disenos = signal<DisenoGuardado[]>(DISENOS_DEMO);
  private readonly _partidas = signal<PartidaCotizacion[]>([]);
  private readonly _cotizaciones = signal<CotizacionGuardada[]>(COTIZACIONES_DEMO);
  private readonly _edicion = signal<{ origen: CotizacionGuardada; modo: ModoEdicion } | null>(null);
  private consecutivo = COTIZACIONES_DEMO.length;

  /** Favoritos primero; dentro de cada grupo, el más reciente arriba. */
  readonly disenos = computed(() => [...this._disenos()].sort((a, b) => Number(b.favorito) - Number(a.favorito)));
  readonly partidas = this._partidas.asReadonly();
  /** Más reciente primero. */
  readonly cotizaciones = this._cotizaciones.asReadonly();
  /** Cotización guardada que se está modificando (o usando de base) en el catálogo; null si es nueva. */
  readonly edicion = this._edicion.asReadonly();
  readonly volumenTotal = computed(() => this._partidas().reduce((t, p) => t + p.volumenM3, 0));

  /** Una entrada por serie: la versión más reciente y, debajo, las anteriores (de la más nueva a la original). */
  readonly series = computed(() => {
    const series = new Map<string, CotizacionGuardada[]>();
    for (const c of this._cotizaciones()) series.set(c.serie, [...(series.get(c.serie) ?? []), c]);
    return [...series.values()].map((v) => {
      const [actual, ...anteriores] = v.sort((a, b) => b.revision - a.revision);
      return { actual, anteriores };
    });
  });

  guardarDiseno(nombre: string, solucionId: string, especificacion: EspecificacionConcreto): DisenoGuardado {
    const diseno: DisenoGuardado = { id: nuevoId('d'), nombre: nombre.trim(), solucionId, especificacion, favorito: false };
    this._disenos.update((d) => [diseno, ...d]);
    return diseno;
  }

  alternarFavorito(id: string): void {
    this._disenos.update((d) => d.map((x) => (x.id === id ? { ...x, favorito: !x.favorito } : x)));
  }

  agregarPartida(nombre: string, config: ConfiguracionConcreto): PartidaCotizacion {
    const partida: PartidaCotizacion = { ...config, id: nuevoId('p'), nombre };
    this._partidas.update((p) => [...p, partida]);
    return partida;
  }

  quitarPartida(id: string): void {
    this._partidas.update((p) => p.filter((x) => x.id !== id));
  }

  buscarCotizacion(id: string | undefined): CotizacionGuardada | null {
    return this._cotizaciones().find((c) => c.id === id) ?? null;
  }

  /**
   * Lleva una cotización guardada al catálogo para editarla. "revision" la guarda como nueva versión de su serie;
   * "base" como cotización nueva que recuerda de cuál partió. Reemplaza lo que hubiera en el carrito.
   */
  editar(origen: CotizacionGuardada, modo: ModoEdicion): void {
    this._partidas.set(origen.partidas.map((p) => ({ ...structuredClone(p), id: nuevoId('p') })));
    this._edicion.set({ origen, modo });
  }

  /** Deja de editar y vacía el carrito (la cotización guardada no cambia). */
  cancelarEdicion(): void {
    this._edicion.set(null);
    this._partidas.set([]);
  }

  /**
   * Folio provisional del portal: EPI-WEB-{planta}-{AA}{consecutivo}. El prefijo WEB lo distingue de los folios
   * oficiales (EPI-PRES-…) que asigna el ERP. Una revisión usa el de su serie: EPI-WEB-ESC-26001-R2.
   */
  nuevoFolio(clavePlanta: string, fecha = new Date()): string {
    const e = this._edicion();
    if (e?.modo === 'revision') return `${e.origen.serie}-R${this.siguienteRevision(e.origen.serie)}`;
    this.consecutivo++;
    return `EPI-WEB-${clavePlanta}-${String(fecha.getFullYear()).slice(-2)}${String(this.consecutivo).padStart(3, '0')}`;
  }

  /** Guarda la cotización en curso con su folio y deja el carrito vacío para empezar otra. */
  guardarCotizacion(folio: string, fecha = new Date()): CotizacionGuardada {
    const e = this._edicion();
    const revision = e?.modo === 'revision';
    const cot: CotizacionGuardada = {
      id: nuevoId('c'),
      folio,
      fecha: fecha.toISOString(),
      partidas: this._partidas(),
      serie: revision ? e.origen.serie : folio,
      revision: revision ? this.siguienteRevision(e.origen.serie) : 0,
      baseId: e?.origen.id,
    };
    this._cotizaciones.update((c) => [cot, ...c]);
    this._partidas.set([]);
    this._edicion.set(null);
    return cot;
  }

  /** Cómo se relaciona con su serie u origen ("Revisión 1 de EPI-WEB-ESC-26001", "Basada en EPI-…"); null si es original. */
  referencia(c: Pick<CotizacionGuardada, 'revision' | 'serie' | 'baseId'>): string | null {
    if (c.revision > 0) return `Revisión ${c.revision} de ${c.serie}`;
    const base = this.buscarCotizacion(c.baseId);
    return base ? `Basada en ${base.folio}` : null;
  }

  /** La referencia que tendrá la cotización en edición al guardarse. */
  readonly referenciaEdicion = computed(() => {
    const e = this._edicion();
    if (!e) return null;
    return e.modo === 'revision'
      ? this.referencia({ revision: this.siguienteRevision(e.origen.serie), serie: e.origen.serie })
      : this.referencia({ revision: 0, serie: '', baseId: e.origen.id });
  });

  private siguienteRevision(serie: string): number {
    return Math.max(...this._cotizaciones().filter((c) => c.serie === serie).map((c) => c.revision)) + 1;
  }
}
