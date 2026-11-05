import { Service, inject, signal } from '@angular/core';
import { AuthService, DatosFacturacion, DatosFacturacionEntrada, DocumentoFiscal, PerfilUsuario, TipoDocumentoFiscal } from 'ui';

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

/** Perfil del cliente y receptores fiscales. En memoria hasta conectar la API. */
@Service()
export class PerfilService {
  private readonly auth = inject(AuthService);
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
  private readonly _facturacion = signal<DatosFacturacion[]>(FACTURACION_DEMO);

  readonly usuario = this._usuario.asReadonly();
  readonly facturacion = this._facturacion.asReadonly();

  actualizarUsuario(datos: PerfilUsuario): void {
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

  guardarFacturacion(datos: DatosFacturacionEntrada, id?: string): DatosFacturacion {
    const limpio = this.limpiarFacturacion(datos);
    let guardado: DatosFacturacion;

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

  hacerPredeterminado(id: string): void {
    this._facturacion.update((lista) => lista.map((f) => ({ ...f, predeterminado: f.id === id })));
  }

  buscarFacturacion(id: string | null): DatosFacturacion | null {
    return this._facturacion().find((f) => f.id === id) ?? null;
  }

  agregarDocumentos(
    idFiscal: string,
    tipo: TipoDocumentoFiscal,
    archivos: File[],
  ): ResultadoCargaDocumentos {
    const aceptados: DocumentoFiscal[] = [];
    const rechazados: string[] = [];

    for (const archivo of archivos) {
      if (!this.documentoPermitido(archivo) || archivo.size > MAXIMO_DOCUMENTO) {
        rechazados.push(archivo.name);
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

  eliminarDocumento(idFiscal: string, idDocumento: string): void {
    this._facturacion.update((lista) =>
      lista.map((f) =>
        f.id === idFiscal
          ? { ...f, documentos: f.documentos.filter((d) => d.id !== idDocumento) }
          : f,
      ),
    );
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
