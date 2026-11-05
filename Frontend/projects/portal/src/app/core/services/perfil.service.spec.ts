import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY, DatosFacturacionEntrada } from 'ui';
import { PerfilService } from './perfil.service';

const fiscal = (alias: string, predeterminado = false): DatosFacturacionEntrada => ({
  alias,
  razonSocial: `${alias}, S.A. de C.V.`,
  rfc: 'ABC010101AA1',
  regimenFiscal: '601 · General de Ley Personas Morales',
  codigoPostal: '01234',
  usoCfdi: 'G03 · Gastos en general',
  correo: 'facturas@empresa.mx',
  direccionFiscal: 'Domicilio fiscal',
  predeterminado,
});

describe('PerfilService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'perfil-test' }],
    }),
  );

  it('permite guardar varios receptores fiscales', () => {
    const servicio = TestBed.inject(PerfilService);
    servicio.guardarFacturacion(fiscal('Empresa alterna'));
    expect(servicio.facturacion()).toHaveLength(2);
  });

  it('mantiene un solo receptor predeterminado', () => {
    const servicio = TestBed.inject(PerfilService);
    const nuevo = servicio.guardarFacturacion(fiscal('Empresa alterna', true));
    expect(servicio.facturacion().filter((f) => f.predeterminado)).toEqual([
      expect.objectContaining({ id: nuevo.id }),
    ]);
  });

  it('normaliza RFC, correo y código postal', () => {
    const servicio = TestBed.inject(PerfilService);
    const guardado = servicio.guardarFacturacion({
      ...fiscal('Empresa alterna'),
      rfc: ' abc010101aa1 ',
      correo: ' FACTURAS@EMPRESA.MX ',
      codigoPostal: '01 234',
    });
    expect(guardado).toMatchObject({
      rfc: 'ABC010101AA1',
      correo: 'facturas@empresa.mx',
      codigoPostal: '01234',
    });
  });

  it('guarda los datos de la empresa representada', () => {
    const servicio = TestBed.inject(PerfilService);
    servicio.actualizarUsuario({
      ...servicio.usuario(),
      nombre: 'Mariana',
      apellidos: 'Pech',
      telefono: '+52 987 123 4567',
      representaEmpresa: true,
      empresa: {
        razonSocial: ' Constructora Delta, S.A. de C.V. ',
        nombreComercial: 'Delta',
        rfc: ' cdc260101aa1 ',
        giro: 'Construcción',
        correo: ' CONTACTO@DELTA.MX ',
        telefono: '+52 987 111 2233',
        sitioWeb: 'https://delta.mx',
        domicilioFiscal: 'Domicilio fiscal',
        cargoRepresentante: 'Compras',
      },
    });

    expect(servicio.usuario()).toMatchObject({
      representaEmpresa: true,
      empresa: {
        razonSocial: 'Constructora Delta, S.A. de C.V.',
        rfc: 'CDC260101AA1',
        correo: 'contacto@delta.mx',
      },
    });
  });

  it('agrega y elimina documentos de un receptor fiscal', () => {
    const servicio = TestBed.inject(PerfilService);
    const receptor = servicio.facturacion()[0];
    const archivo = new File(['contenido'], 'constancia.pdf', { type: 'application/pdf' });

    expect(
      servicio.agregarDocumentos(receptor.id, 'Constancia de situación fiscal', [archivo]),
    ).toEqual({ agregados: 1, rechazados: [] });

    const documento = servicio.buscarFacturacion(receptor.id)!.documentos[0];
    expect(documento).toMatchObject({
      nombre: 'constancia.pdf',
      tipo: 'Constancia de situación fiscal',
    });

    servicio.eliminarDocumento(receptor.id, documento.id);
    expect(servicio.buscarFacturacion(receptor.id)!.documentos).toEqual([]);
  });

  it('rechaza documentos con un formato no permitido', () => {
    const servicio = TestBed.inject(PerfilService);
    const receptor = servicio.facturacion()[0];
    const archivo = new File(['contenido'], 'datos.exe');

    expect(servicio.agregarDocumentos(receptor.id, 'Otro', [archivo])).toEqual({
      agregados: 0,
      rechazados: ['datos.exe'],
    });
  });
});
