import { HttpClient } from '@angular/common/http';
import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_API_URL, AuthService, DatosFacturacion, DatosFacturacionEntrada, DocumentoFiscal, PerfilUsuario, TipoDocumentoFiscal, claveSat, mensajeError } from 'ui';

export interface ResultadoCargaDocumentos {
  agregados: number;
  rechazados: string[];
}

const FACTURACION_DEMO: DatosFacturacion[] = [
  {
    id: 'f-demo-1',
    alias: 'Constructora Delta',
    razonSocial: 'Constructora Delta del Caribe, S.A. de C.V.',
    rfc: 'CDC260101AA1',
    regimenFiscal: '601 · General de Ley Personas Morales',
    codigoPostal: '77600',
    usoCfdi: 'G03 · Gastos en general',
    correo: 'facturacion@constructoradelta.mx',
    direccionFiscal: 'Av. Rafael E. Melgar 120, Centro, Cozumel, Quintana Roo',
    predeterminado: true,
    documentos: [],
  },
];

let siguiente = 1;
let siguienteDocumento = 1;
const MAXIMO_DOCUMENTO = 10 * 1024 * 1024;
const EXTENSIONES_DOCUMENTO = ['pdf', 'png', 'jpg', 'jpeg'];

/** La empresa (el cliente) que representa el usuario: la administra la concretera, en el portal solo se lee. */
export interface ClientePortal {
  id: string;
  nombre: string;
  giro: string | null;
  correo: string | null;
  telefono: string | null;
  sitioWeb: string | null;
  diasCredito: number | null;
  limiteCredito: number | null;
}

interface ApiPerfil {
  usuario: { nombre: string; apellidos: string | null; correo: string; telefono: string | null; puesto: string | null; fotoArchivoId: string | null };
  cliente: ClientePortal;
  /** Lo que su asesor le permite crear en el portal (null = sin límite) y lo que lleva. */
  limites?: LimitesPortal;
  /** Su crédito con la concretera (sin límite = de contado). */
  credito?: CreditoPortal;
}

export interface CreditoPortal {
  limite: number | null;
  dias: number;
  usado: number;
  disponible: number | null;
}

export interface LimitesPortal {
  cotizaciones: number | null;
  obras: number | null;
  cotizacionesUsadas: number;
  obrasUsadas: number;
}

interface ApiDatoFiscal {
  id: string;
  alias: string | null;
  razonSocial: string;
  rfc: string;
  regimenFiscal: string | null;
  usoCfdi: string | null;
  codigoPostal: string | null;
  correo: string | null;
  direccionFiscal: string | null;
  predeterminado: boolean;
}

interface ApiArchivo {
  id: string;
  nombre: string;
  tamanoBytes: number;
  categoria: string | null;
  createdAt: string;
}

const TIPOS_DOCUMENTO: TipoDocumentoFiscal[] = ['Constancia de situación fiscal', 'Carátula bancaria', 'Comprobante de domicilio', 'Otro'];

const aDocumento = (a: ApiArchivo): DocumentoFiscal => ({
  id: a.id,
  nombre: a.nombre,
  tipo: TIPOS_DOCUMENTO.find((t) => t === a.categoria) ?? 'Otro',
  tamano: a.tamanoBytes,
  fechaCarga: a.createdAt,
  archivoId: a.id,
});

const aFacturacion = (f: ApiDatoFiscal, documentos: DocumentoFiscal[]): DatosFacturacion => ({
  id: f.id,
  alias: f.alias ?? '',
  razonSocial: f.razonSocial,
  rfc: f.rfc,
  regimenFiscal: f.regimenFiscal ?? '',
  codigoPostal: f.codigoPostal ?? '',
  usoCfdi: f.usoCfdi ?? '',
  correo: f.correo ?? '',
  direccionFiscal: f.direccionFiscal ?? '',
  predeterminado: f.predeterminado,
  documentos,
});

/**
 * Perfil del usuario, su empresa y sus receptores fiscales. Con backend: /portal/perfil (la empresa es de solo
 * lectura: es el cliente que administra la concretera), /portal/datos-fiscales y sus documentos en /portal/archivos.
 * Sin él (pruebas, demo), en memoria.
 */
@Service()
export class PerfilService {
  private readonly auth = inject(AuthService);
  private readonly base = inject(AUTH_API_URL, { optional: true });
  private readonly http = this.base ? inject(HttpClient) : null;
  readonly conServidor = !!this.base;
  /** Con backend: la empresa que representa (solo lectura). */
  readonly cliente = signal<ClientePortal | null>(null);
  readonly errorCarga = signal('');
  readonly limites = signal<LimitesPortal | null>(null);
  readonly credito = signal<CreditoPortal | null>(null);

  /** Aviso si ya llegó al límite que le puso su asesor; '' si puede crear más. Sin límites (demo), nunca. */
  tope(tipo: 'cotizaciones' | 'obras', usadas?: number): string {
    const l = this.limites();
    const max = l?.[tipo];
    if (l == null || max == null || (usadas ?? l[`${tipo}Usadas`]) < max) return '';
    return `Llegaste al límite de ${max} ${max === 1 ? { cotizaciones: 'cotización', obras: 'obra' }[tipo] : tipo}; pide a tu asesor que lo amplíe.`;
  }
  /** Tras crear una cotización nueva, sin volver a pedir el perfil. */
  contarCotizacion(): void {
    this.limites.update((l) => l && { ...l, cotizacionesUsadas: l.cotizacionesUsadas + 1 });
  }
  private readonly _usuario = signal<PerfilUsuario>({
    nombre: '',
    apellidos: '',
    correo: this.auth.sesion()?.usuario.correo ?? '',
    telefono: '',
    puesto: '',
    representaEmpresa: false,
    empresa: {
      razonSocial: '',
      nombreComercial: '',
      rfc: '',
      giro: '',
      correo: '',
      telefono: '',
      sitioWeb: '',
      domicilioFiscal: '',
      cargoRepresentante: '',
    },
  });
  private readonly _facturacion = signal<DatosFacturacion[]>(this.base ? [] : FACTURACION_DEMO);

  readonly usuario = this._usuario.asReadonly();
  readonly facturacion = this._facturacion.asReadonly();

  constructor() {
    if (!this.base) return;
    const cliente = computed(() => this.auth.sesion()?.cliente?.id ?? '');
    effect(() => {
      if (cliente()) untracked(() => void this.recargar());
    });
  }

  private get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http!.get<T>(this.base + ruta));
  }

  async recargar(): Promise<void> {
    try {
      const [perfil, fiscales] = await Promise.all([this.get<ApiPerfil>('/portal/perfil'), this.get<ApiDatoFiscal[]>('/portal/datos-fiscales')]);
      const documentos = await Promise.all(fiscales.map((f) => this.get<ApiArchivo[]>(`/portal/archivos/registro/ClienteDatoFiscal/${f.id}`).catch(() => [])));
      const u = perfil.usuario;
      this._usuario.set({
        ...this._usuario(),
        nombre: u.nombre,
        apellidos: u.apellidos ?? '',
        correo: u.correo,
        telefono: u.telefono ?? '',
        puesto: u.puesto ?? '',
        representaEmpresa: false,
      });
      this.fotoArchivoId = u.fotoArchivoId;
      this.cliente.set(perfil.cliente);
      this.limites.set(perfil.limites ?? null);
      this.credito.set(perfil.credito ?? null);
      this._facturacion.set(fiscales.map((f, i) => aFacturacion(f, documentos[i].map(aDocumento))));
      this.errorCarga.set('');
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    }
  }

  private fotoArchivoId: string | null = null;

  async actualizarUsuario(datos: PerfilUsuario): Promise<void> {
    if (this.base) {
      await firstValueFrom(
        this.http!.put(`${this.base}/portal/perfil`, {
          nombre: datos.nombre.trim(),
          apellidos: datos.apellidos.trim(),
          telefono: datos.telefono.replace(/[^\d+]/g, ''),
          puesto: datos.puesto.trim(),
          fotoArchivoId: this.fotoArchivoId,
        }),
      );
    }
    this._usuario.set({
      nombre: datos.nombre.trim(),
      apellidos: datos.apellidos.trim(),
      correo: datos.correo.trim().toLowerCase(),
      telefono: datos.telefono.replace(/[^\d+]/g, ''),
      puesto: datos.puesto.trim(),
      representaEmpresa: datos.representaEmpresa,
      empresa: {
        razonSocial: datos.empresa.razonSocial.trim(),
        nombreComercial: datos.empresa.nombreComercial.trim(),
        rfc: datos.empresa.rfc.replace(/\s/g, '').toUpperCase(),
        giro: datos.empresa.giro.trim(),
        correo: datos.empresa.correo.trim().toLowerCase(),
        telefono: datos.empresa.telefono.replace(/[^\d+]/g, ''),
        sitioWeb: datos.empresa.sitioWeb.trim(),
        domicilioFiscal: datos.empresa.domicilioFiscal.trim(),
        cargoRepresentante: datos.empresa.cargoRepresentante.trim(),
      },
    });
  }

  async guardarFacturacion(datos: DatosFacturacionEntrada, id?: string): Promise<DatosFacturacion> {
    const limpio = this.limpiarFacturacion(datos);
    let guardado: DatosFacturacion;

    if (this.base) {
      const cuerpo = {
        ...limpio,
        regimenFiscal: claveSat(limpio.regimenFiscal),
        usoCfdi: claveSat(limpio.usoCfdi),
        correo: limpio.correo || null,
        direccionFiscal: limpio.direccionFiscal || null,
        ...(id ? { id } : {}),
      };
      const r = await firstValueFrom(
        id
          ? this.http!.put<ApiDatoFiscal>(`${this.base}/portal/datos-fiscales/${id}`, cuerpo)
          : this.http!.post<ApiDatoFiscal>(`${this.base}/portal/datos-fiscales`, cuerpo),
      );
      // El predeterminado cambia los demás: se vuelve a leer la lista
      await this.recargar();
      return this.buscarFacturacion(r.id) ?? aFacturacion(r, []);
    }

    if (id) {
      const anterior = this._facturacion().find((f) => f.id === id);
      guardado = {
        ...limpio,
        id,
        predeterminado: limpio.predeterminado || !!anterior?.predeterminado,
        documentos: anterior?.documentos ?? [],
      };
      this._facturacion.update((lista) => lista.map((f) => (f.id === id ? guardado : f)));
    } else {
      guardado = {
        ...limpio,
        id: `f-${Date.now().toString(36)}-${siguiente++}`,
        predeterminado: limpio.predeterminado || this._facturacion().length === 0,
        documentos: [],
      };
      this._facturacion.update((lista) => [...lista, guardado]);
    }

    if (guardado.predeterminado) this.hacerPredeterminado(guardado.id);
    return this._facturacion().find((f) => f.id === guardado.id)!;
  }

  async hacerPredeterminado(id: string): Promise<void> {
    if (this.base) {
      const f = this.buscarFacturacion(id);
      if (!f) return;
      const { documentos: _d, ...datos } = f;
      await firstValueFrom(this.http!.put(`${this.base}/portal/datos-fiscales/${id}`, { ...datos, predeterminado: true }));
      return this.recargar();
    }
    this._facturacion.update((lista) => lista.map((f) => ({ ...f, predeterminado: f.id === id })));
  }

  buscarFacturacion(id: string | null): DatosFacturacion | null {
    return this._facturacion().find((f) => f.id === id) ?? null;
  }

  async agregarDocumentos(idFiscal: string, tipo: TipoDocumentoFiscal, archivos: File[]): Promise<ResultadoCargaDocumentos> {
    const aceptados: DocumentoFiscal[] = [];
    const rechazados: string[] = [];

    for (const archivo of archivos) {
      if (!this.documentoPermitido(archivo) || archivo.size > MAXIMO_DOCUMENTO) {
        rechazados.push(archivo.name);
        continue;
      }
      if (this.base) {
        const datos = new FormData();
        datos.append('archivo', archivo);
        datos.append('registroTipo', 'ClienteDatoFiscal');
        datos.append('registroId', idFiscal);
        datos.append('categoria', tipo);
        try {
          aceptados.push(aDocumento(await firstValueFrom(this.http!.post<ApiArchivo>(`${this.base}/portal/archivos`, datos))));
        } catch {
          rechazados.push(archivo.name);
        }
        continue;
      }
      aceptados.push({
        id: `doc-${Date.now().toString(36)}-${siguienteDocumento++}`,
        nombre: archivo.name,
        tipo,
        tamano: archivo.size,
        fechaCarga: new Date().toISOString(),
        archivo,
      });
    }

    if (aceptados.length) {
      this._facturacion.update((lista) =>
        lista.map((f) =>
          f.id === idFiscal ? { ...f, documentos: [...f.documentos, ...aceptados] } : f,
        ),
      );
    }
    return { agregados: aceptados.length, rechazados };
  }

  async eliminarDocumento(idFiscal: string, idDocumento: string): Promise<void> {
    if (this.base) await firstValueFrom(this.http!.delete(`${this.base}/portal/archivos/${idDocumento}`));
    this._facturacion.update((lista) =>
      lista.map((f) =>
        f.id === idFiscal
          ? { ...f, documentos: f.documentos.filter((d) => d.id !== idDocumento) }
          : f,
      ),
    );
  }

  /** El contenido del documento: el File elegido o, con backend, el que se descarga. */
  async contenido(d: DocumentoFiscal): Promise<Blob> {
    if (d.archivo) return d.archivo;
    return firstValueFrom(this.http!.get(`${this.base}/portal/archivos/${d.archivoId}`, { responseType: 'blob' }));
  }

  private limpiarFacturacion(datos: DatosFacturacionEntrada): DatosFacturacionEntrada {
    return {
      alias: datos.alias.trim(),
      razonSocial: datos.razonSocial.trim(),
      rfc: datos.rfc.replace(/\s/g, '').toUpperCase(),
      regimenFiscal: datos.regimenFiscal.trim(),
      codigoPostal: datos.codigoPostal.replace(/\D/g, ''),
      usoCfdi: datos.usoCfdi.trim(),
      correo: datos.correo.trim().toLowerCase(),
      direccionFiscal: datos.direccionFiscal.trim(),
      predeterminado: datos.predeterminado,
    };
  }

  private documentoPermitido(archivo: File): boolean {
    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    return EXTENSIONES_DOCUMENTO.includes(extension);
  }
}
