import { Service, inject, signal } from '@angular/core';
import {
  Cliente,
  Cotizacion,
  CotizacionVista,
  DatosEmpresaRepresentada,
  ESTADO_COBRO,
  ESTADO_PEDIDO,
  EspecificacionConcreto,
  EstadoCotizacion,
  Obra,
  PartidaCotizacion,
  Pedido,
  PedidoVista,
  SERVICIOS,
  ServicioObra,
  pedidoDePartida,
  pesos,
  plantaPara,
  precioConcreto,
  totalesCotizacion,
  UbicacionGps,
} from 'ui';
import { Cambio, EventoHistorial, HistorialService } from '../../core/historial';
import { normalizar } from '../../core/modulos';
import { RAZONES_SOCIALES } from '../../core/plantas';

/** En el orden del panel de filtros. Tinte + texto oscurecido (AA en texto pequeño), como los estados del dashboard. */
export const ESTADOS_COTIZACION: Record<EstadoCotizacion, { nombre: string; clase: string }> = {
  borrador: { nombre: 'Borrador', clase: 'bg-[#ECEDEE] text-[#3F4347]' },
  enviada: { nombre: 'Enviada', clase: 'bg-[#E2EEF3] text-[#285E74]' },
  pedido: { nombre: 'Pedido', clase: 'bg-[#E3EFE9] text-[#2E5E4A]' },
  cancelada: { nombre: 'Cancelada', clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

// shortcut: clientes, obras, vendedores y cotizaciones de ejemplo en memoria; vendrán del backend (las cotizaciones
// ya filtradas por las plantas del usuario). Las de operaciones@epicoconcretos.mx (el usuario del login de prueba)
// son "Mis cotizaciones".
const YO = 'operaciones@epicoconcretos.mx';
const ANA = 'ana.pech@epicoconcretos.mx';
const LUIS = 'luis.canche@epicoconcretos.mx';
const MARIA = 'maria.dzul@epicoconcretos.mx';
const JORGE = 'jorge.may@epicoconcretos.mx';
const VENDEDORES: Record<string, string> = { [YO]: 'Operaciones', [ANA]: 'Ana Pech', [LUIS]: 'Luis Canché', [MARIA]: 'María Dzul', [JORGE]: 'Jorge May' };

const MORAL = '601 · General de Ley Personas Morales';

/** Un cliente con su receptor fiscal principal: el de su empresa, como lo da de alta en Facturación del portal. */
function cliente(
  id: string,
  empresa: Omit<DatosEmpresaRepresentada, 'cargoRepresentante'>,
  contacto: Cliente['contacto'],
  fiscal: { codigoPostal: string; correo: string; regimenFiscal?: string; usoCfdi?: string },
  portal = false,
): Cliente {
  return {
    id,
    nombre: empresa.nombreComercial,
    empresa: { ...empresa, cargoRepresentante: contacto.puesto },
    contacto,
    portal,
    facturacion: [
      {
        id: 'f-' + id,
        alias: empresa.nombreComercial,
        razonSocial: empresa.razonSocial,
        rfc: empresa.rfc,
        regimenFiscal: fiscal.regimenFiscal ?? MORAL,
        codigoPostal: fiscal.codigoPostal,
        usoCfdi: fiscal.usoCfdi ?? 'G03 · Gastos en general',
        correo: fiscal.correo,
        direccionFiscal: empresa.domicilioFiscal,
        predeterminado: true,
        documentos: [],
      },
    ],
  };
}

/**
 * Los mismos datos que cada cliente captura en el portal (Mi perfil y Facturación). `portal`: ya tiene cuenta y su
 * contacto entra con ese correo. Constructora Delta es la del login de prueba del portal, con sus mismos datos fiscales.
 */
export const CLIENTES: Cliente[] = [
  cliente(
    'c-maya',
    {
      razonSocial: 'Constructora Maya del Sureste, S.A. de C.V.',
      nombreComercial: 'Constructora Maya',
      rfc: 'CMS180412KJ3',
      giro: 'Edificación residencial y comercial',
      correo: 'contacto@constructoramaya.mx',
      telefono: '9818161234',
      sitioWeb: 'constructoramaya.mx',
      domicilioFiscal: 'Calle 31 #210, Centro, Escárcega, Campeche',
    },
    { nombre: 'Rosa', apellidos: 'Ek Chan', correo: 'compras@constructoramaya.mx', telefono: '9811234567', puesto: 'Gerente de compras' },
    { codigoPostal: '24350', correo: 'facturas@constructoramaya.mx' },
  ),
  cliente(
    'c-delta',
    {
      razonSocial: 'Constructora Delta del Caribe, S.A. de C.V.',
      nombreComercial: 'Constructora Delta',
      rfc: 'CDC260101AA1',
      giro: 'Construcción turística e industrial',
      correo: 'contacto@constructoradelta.mx',
      telefono: '9878721100',
      sitioWeb: 'constructoradelta.mx',
      domicilioFiscal: 'Av. Rafael E. Melgar 120, Centro, Cozumel, Quintana Roo',
    },
    { nombre: 'Carlos', apellidos: 'Uc Balam', correo: 'compras@constructoradelta.mx', telefono: '9878721144', puesto: 'Jefe de compras' },
    { codigoPostal: '77600', correo: 'facturacion@constructoradelta.mx' },
    true,
  ),
  cliente(
    'c-habita',
    {
      razonSocial: 'Grupo Habita Desarrollos, S.A. de C.V.',
      nombreComercial: 'Grupo Habita',
      rfc: 'GHD150903TQ8',
      giro: 'Desarrollo de vivienda',
      correo: 'contacto@grupohabita.mx',
      telefono: '9818162200',
      sitioWeb: 'grupohabita.mx',
      domicilioFiscal: 'Av. Justo Sierra 45, Centro, Escárcega, Campeche',
    },
    { nombre: 'Fernando', apellidos: 'Canché Poot', correo: 'obras@grupohabita.mx', telefono: '9811987654', puesto: 'Coordinador de obras' },
    { codigoPostal: '24350', correo: 'facturacion@grupohabita.mx' },
    true,
  ),
  cliente(
    'c-infra',
    {
      razonSocial: 'Infraestructura MX, S.A.P.I. de C.V.',
      nombreComercial: 'Infraestructura MX',
      rfc: 'IMX120615RT5',
      giro: 'Obra pública e infraestructura',
      correo: 'contacto@infraestructuramx.mx',
      telefono: '9988841500',
      sitioWeb: 'infraestructuramx.mx',
      domicilioFiscal: 'Av. Bonampak 120, SM 4, Cancún, Quintana Roo',
    },
    { nombre: 'Patricia', apellidos: 'Ruiz Domínguez', correo: 'compras@infraestructuramx.mx', telefono: '9982345678', puesto: 'Compras y licitaciones' },
    { codigoPostal: '77500', correo: 'facturas@infraestructuramx.mx' },
  ),
  cliente(
    'c-sol',
    {
      razonSocial: 'Edificaciones Sol del Caribe, S. de R.L. de C.V.',
      nombreComercial: 'Edificaciones Sol',
      rfc: 'ESC170220LM2',
      giro: 'Locales y plazas comerciales',
      correo: 'contacto@edificacionessol.mx',
      telefono: '9988872030',
      sitioWeb: '',
      domicilioFiscal: 'Av. Tulum 220, SM 4, Cancún, Quintana Roo',
    },
    { nombre: 'Andrés', apellidos: 'Moo Cauich', correo: 'contacto@edificacionessol.mx', telefono: '9983456789', puesto: 'Administrador' },
    { codigoPostal: '77500', correo: 'facturas@edificacionessol.mx' },
  ),
  // Venta de mostrador: sin contacto ni cuenta; se factura a público en general.
  cliente(
    'c-particular',
    {
      razonSocial: 'Público en general',
      nombreComercial: 'Particular',
      rfc: 'XAXX010101000',
      giro: '',
      correo: '',
      telefono: '',
      sitioWeb: '',
      domicilioFiscal: '',
    },
    { nombre: '', apellidos: '', correo: '', telefono: '', puesto: '' },
    { codigoPostal: '24350', correo: '', regimenFiscal: '616 · Sin obligaciones fiscales', usoCfdi: 'S01 · Sin efectos fiscales' },
  ),
];

/** "Sin cliente" al cotizar: la venta de mostrador, que se factura a público en general (RFC genérico). */
export const PUBLICO_GENERAL = 'c-particular';

/** Alta rápida de un cliente al cotizar: lo mínimo; sus datos fiscales se completan después en su ficha. */
export interface ClienteExpress {
  nombre: string;
  contacto: string;
  telefono: string;
  correo: string;
}

/** A dónde se entrega y con quién: se guarda como obra del cliente (o de público en general). */
export interface LugarEntrega {
  nombre: string;
  direccion: string;
  municipio: string;
  referencias: string;
  contacto: string;
  telefono: string;
  /** El punto elegido en el mapa: el operador llega aunque no haya dirección formal. */
  ubicacion?: UbicacionGps;
}

export type CambiosCliente = Pick<Cliente, 'nombre' | 'empresa' | 'contacto' | 'facturacion'>;

/** Como el portal al guardar: sin espacios de más, RFC en mayúsculas, teléfonos solo con dígitos, correos en minúsculas. */
export function limpiarCliente(c: CambiosCliente): CambiosCliente {
  const texto = (t: string) => t.trim();
  const rfc = (t: string) => t.replace(/\s/g, '').toUpperCase();
  const tel = (t: string) => t.replace(/[^\d+]/g, '');
  const correo = (t: string) => t.trim().toLowerCase();
  return {
    nombre: texto(c.nombre),
    empresa: {
      razonSocial: texto(c.empresa.razonSocial),
      nombreComercial: texto(c.nombre),
      rfc: rfc(c.empresa.rfc),
      giro: texto(c.empresa.giro),
      correo: correo(c.empresa.correo),
      telefono: tel(c.empresa.telefono),
      sitioWeb: texto(c.empresa.sitioWeb),
      domicilioFiscal: texto(c.empresa.domicilioFiscal),
      cargoRepresentante: texto(c.contacto.puesto),
    },
    contacto: {
      nombre: texto(c.contacto.nombre),
      apellidos: texto(c.contacto.apellidos),
      correo: correo(c.contacto.correo),
      telefono: tel(c.contacto.telefono),
      puesto: texto(c.contacto.puesto),
    },
    facturacion: c.facturacion.map((f) => ({
      ...f,
      alias: texto(f.alias),
      razonSocial: texto(f.razonSocial),
      rfc: rfc(f.rfc),
      regimenFiscal: texto(f.regimenFiscal),
      codigoPostal: f.codigoPostal.replace(/\D/g, ''),
      usoCfdi: texto(f.usoCfdi),
      correo: correo(f.correo),
      direccionFiscal: texto(f.direccionFiscal),
    })),
  };
}

/** Lo que cambió al editar un cliente, campo por campo, como el seguimiento de Odoo (vacío se ve como "—"). */
export function cambiosCliente(antes: Cliente, despues: Cliente): { cambios: Cambio[]; detalles: string[] } {
  const cambios: Cambio[] = [];
  const detalles: string[] = [];
  const v = (t: string) => t.trim() || '—';
  const campo = (nombre: string, a: string, d: string) => {
    if (v(a) !== v(d)) cambios.push({ campo: nombre, antes: v(a), despues: v(d) });
  };
  campo('Nombre comercial', antes.nombre, despues.nombre);
  campo('Razón social', antes.empresa.razonSocial, despues.empresa.razonSocial);
  campo('RFC', antes.empresa.rfc, despues.empresa.rfc);
  campo('Giro', antes.empresa.giro, despues.empresa.giro);
  campo('Correo de la empresa', antes.empresa.correo, despues.empresa.correo);
  campo('Teléfono de la empresa', telefono(antes.empresa.telefono), telefono(despues.empresa.telefono));
  campo('Sitio web', antes.empresa.sitioWeb, despues.empresa.sitioWeb);
  campo('Domicilio fiscal', antes.empresa.domicilioFiscal, despues.empresa.domicilioFiscal);
  const nombre = (c: Cliente) => `${c.contacto.nombre} ${c.contacto.apellidos}`;
  campo('Contacto', nombre(antes), nombre(despues));
  campo('Puesto del contacto', antes.contacto.puesto, despues.contacto.puesto);
  campo('Correo del contacto', antes.contacto.correo, despues.contacto.correo);
  campo('Teléfono del contacto', telefono(antes.contacto.telefono), telefono(despues.contacto.telefono));
  for (const f of despues.facturacion) {
    const a = antes.facturacion.find((x) => x.id === f.id);
    if (!a) {
      detalles.push(`Se agregaron los datos de facturación ${f.alias}`);
      continue;
    }
    campo(`Alias de facturación · ${a.alias}`, a.alias, f.alias);
    campo(`Razón social · ${f.alias}`, a.razonSocial, f.razonSocial);
    campo(`RFC · ${f.alias}`, a.rfc, f.rfc);
    campo(`Régimen fiscal · ${f.alias}`, a.regimenFiscal, f.regimenFiscal);
    campo(`Código postal · ${f.alias}`, a.codigoPostal, f.codigoPostal);
    campo(`Uso de CFDI · ${f.alias}`, a.usoCfdi, f.usoCfdi);
    campo(`Correo de facturas · ${f.alias}`, a.correo, f.correo);
    campo(`Dirección fiscal · ${f.alias}`, a.direccionFiscal, f.direccionFiscal);
  }
  for (const a of antes.facturacion) {
    if (!despues.facturacion.some((f) => f.id === a.id)) detalles.push(`Se quitaron los datos de facturación ${a.alias}`);
  }
  const predeterminada = (c: Cliente) => c.facturacion.find((f) => f.predeterminado)?.alias ?? '';
  campo('Facturación predeterminada', predeterminada(antes), predeterminada(despues));
  return { cambios, detalles };
}

/** "981 123 4567" y, con lada, "+52 987 123 4567" (se guardan solo los dígitos, como en el portal). */
export const telefono = (numero: string, lada?: string) =>
  [lada, numero.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')].filter(Boolean).join(' ');

const obra = (id: string, clienteId: string, nombre: string, direccion: string, municipio: string): Obra => ({
  id,
  clienteId,
  nombre,
  direccion,
  municipio,
  responsable: { nombre: 'Residente de obra' },
  contactos: [{ nombre: 'Residente de obra', lada: '+52', numero: '9811000000' }],
});

export const OBRAS: Obra[] = [
  obra('o-torre-norte', 'c-maya', 'Torre Norte', 'Calle 31 x 40, Centro', 'Escárcega, Camp.'),
  obra('o-costa-azul', 'c-delta', 'Hotel Costa Azul', 'Carr. Costera Sur km 8', 'Cozumel, Q. Roo'),
  obra('o-las-lomas', 'c-habita', 'Fracc. Las Lomas', 'Av. Justo Sierra s/n', 'Escárcega, Camp.'),
  obra('o-losa', 'c-particular', 'Losa casa habitación', 'Calle 45 #210', 'Escárcega, Camp.'),
  obra('o-calakmul', 'c-habita', 'Cabañas Calakmul', 'Carr. Escárcega–Chetumal km 150', 'Xpujil, Camp.'),
  obra('o-plaza-centro', 'c-sol', 'Plaza Centro', 'Av. Tulum 220', 'Cancún, Q. Roo'),
  obra('o-muelle', 'c-delta', 'Muelle Turístico', 'Av. Rafael E. Melgar s/n', 'Cozumel, Q. Roo'),
  obra('o-periferico', 'c-infra', 'Puente Periférico', 'Periférico km 4', 'Escárcega, Camp.'),
  obra('o-distribuidor', 'c-infra', 'Distribuidor vial Kabah', 'Av. Kabah x Av. Nichupté', 'Cancún, Q. Roo'),
  obra('o-plaza-esc', 'c-sol', 'Plaza Escárcega', 'Calle 29 #105', 'Escárcega, Camp.'),
  // Las dos obras de Constructora Delta en el portal (ObrasService del portal), con los mismos datos.
  {
    id: 'o-torre-norte-czm',
    clienteId: 'c-delta',
    nombre: 'Torre Norte',
    direccion: 'Av. Rafael E. Melgar 120, Centro',
    municipio: 'Cozumel, Q. Roo',
    referencias: 'Frente al muelle fiscal; acceso de ollas por calle 3 Sur.',
    ubicacion: { lat: 20.5106, lng: -86.9495 },
    responsable: { nombre: 'Ing. Mariana Pech Canul' },
    contactos: [
      { nombre: 'Mariana Pech (residente)', lada: '+52', numero: '9871234567' },
      { nombre: 'Jorge Ek (almacén)', lada: '+52', numero: '9877654321' },
    ],
  },
  {
    id: 'o-bodega',
    clienteId: 'c-delta',
    nombre: 'Bodega Escárcega',
    direccion: 'Carretera Escárcega–Chetumal km 3',
    municipio: 'Escárcega, Camp.',
    responsable: { nombre: 'Arq. Luis Chablé Mena' },
    contactos: [
      { nombre: 'Luis Chablé', lada: '+52', numero: '9821187643' },
      { nombre: 'Kevin Rodríguez (supervisor, EE. UU.)', lada: '+1', numero: '3055550142' },
    ],
  },
];

/** f'c a 28 días, rev. 14, TMA 19, CPC 30R, colocación directa; `cambios` ajusta lo demás. */
const esp = (resistenciaKgCm2: number, cambios: Partial<EspecificacionConcreto> = {}): EspecificacionConcreto => ({
  tipoResistencia: 'fc',
  resistenciaKgCm2,
  edadDias: 28,
  revenimientoCm: 14,
  tmaMm: 19,
  cemento: 'CPC 30R',
  exposicion: 'normal',
  colocacion: 'directa',
  aditivos: [],
  ...cambios,
});
const MR = { tipoResistencia: 'mr', revenimientoCm: 10, tmaMm: 38 } as const;

/** Especificación de un producto agregado desde el ERP: la de uso general para esa resistencia. */
export const especificacionBase = (tipo: 'fc' | 'mr', resistenciaKgCm2: number) =>
  esp(resistenciaKgCm2, tipo === 'mr' ? MR : {});

const partida = (
  id: string,
  nombre: string,
  solucionId: string,
  especificacion: EspecificacionConcreto,
  volumenM3: number,
  obraId: string,
  entrega: string,
  servicios: ServicioObra[] = [],
): PartidaCotizacion => ({ id, nombre, solucionId, especificacion, volumenM3, servicios, maquinaria: [], obraId, entrega });

const PLANTAS = RAZONES_SOCIALES.flatMap((r) => r.plantas);

/** Vista con los nombres resueltos y el neto calculado como en el portal (totalesCotizacion: líneas y descuento). */
/** Dónde buscar nombres de clientes y obras: los de ejemplo o, en VentasService, los vigentes (con las altas rápidas). */
interface Catalogo {
  clientes: Cliente[];
  obras: Obra[];
}
const EJEMPLO: Catalogo = { clientes: CLIENTES, obras: OBRAS };

function vista(c: Cotizacion, cat: Catalogo = EJEMPLO): CotizacionVista {
  const planta = PLANTAS.find((p) => p.id === c.plantaId)!;
  const obras = [...new Set(c.partidas.map((p) => p.obraId))].map((id) => cat.obras.find((o) => o.id === id)!.nombre);
  return {
    ...c,
    plantaNombre: planta.nombre,
    zonaHoraria: planta.zonaHoraria,
    clienteNombre: cat.clientes.find((x) => x.id === c.clienteId)!.nombre,
    vendedorNombre: VENDEDORES[c.vendedorId],
    obrasNombre: obras.join(', '),
    total: totalesCotizacion(c).neto,
  };
}

const cotizacion = (
  folio: string,
  fecha: string,
  plantaId: string,
  clienteId: string,
  vendedorId: string,
  estado: EstadoCotizacion,
  partidas: PartidaCotizacion[],
) => vista({ id: folio, folio, fecha, serie: folio, revision: 0, partidas, plantaId, clienteId, vendedorId, estado });

/** De la más reciente a la más antigua. Cada fecha lleva el offset de su planta. */
export const COTIZACIONES: CotizacionVista[] = [
  cotizacion('EPI-PRES-ESC-26092', '2026-11-04T09:12:00-06:00', 'ESC', 'c-maya', YO, 'borrador', [
    partida('1a', 'Losas de entrepiso', 'losa', esp(250, { colocacion: 'bombeo' }), 120, 'o-torre-norte', '2026-11-18T08:00:00-06:00', ['bomba-estacionaria']),
    partida('1b', 'Columnas y trabes', 'losa', esp(300), 35, 'o-torre-norte', '2026-11-20T07:30:00-06:00'),
  ]),
  cotizacion('EPI-PRES-CZM-26041', '2026-11-04T08:20:00-05:00', 'CZM', 'c-delta', JORGE, 'borrador', [
    partida('2a', 'Losa de cimentación', 'losa', esp(300, { exposicion: 'marina', cemento: 'CPC 30R RS' }), 48, 'o-costa-azul', '2026-11-12T07:00:00-05:00', ['muestreo-laboratorio']),
  ]),
  cotizacion('EPI-PRES-ESC-26091', '2026-11-03T17:40:00-06:00', 'ESC', 'c-habita', YO, 'enviada', [
    partida('3a', 'Firmes y banquetas', 'firmes', esp(150), 24, 'o-las-lomas', '2026-11-10T08:00:00-06:00'),
  ]),
  cotizacion('EPI-PRES-ESC-26090', '2026-11-03T11:05:00-06:00', 'ESC', 'c-particular', ANA, 'enviada', [
    partida('4a', 'Losa de azotea', 'losa', esp(200), 6, 'o-losa', '2026-11-07T09:00:00-06:00'),
  ]),
  cotizacion('EPI-PRES-XPJ-26014', '2026-11-02T12:10:00-06:00', 'XPJ', 'c-habita', MARIA, 'enviada', [
    partida('5a', 'Plantillas y dalas', 'firmes', esp(150), 18, 'o-calakmul', '2026-11-09T08:00:00-06:00'),
    partida('5b', 'Losas de cabañas', 'losa', esp(200, { aditivos: ['impermeabilizante'] }), 14, 'o-calakmul', '2026-11-16T08:00:00-06:00'),
  ]),
  cotizacion('EPI-PRES-CUN-26118', '2026-11-01T10:00:00-05:00', 'CUN', 'c-sol', ANA, 'pedido', [
    partida('6a', 'Estacionamiento', 'pavimento', esp(45, MR), 60, 'o-plaza-centro', '2026-11-08T06:30:00-05:00', ['colado-nocturno']),
  ]),
  cotizacion('EPI-PRES-CZM-26040', '2026-10-31T15:45:00-05:00', 'CZM', 'c-delta', YO, 'enviada', [
    partida('7a', 'Muelle y pilotes', 'losa', esp(350, { exposicion: 'marina', cemento: 'CPC 30R RS', colocacion: 'bombeo' }), 40, 'o-muelle', '2026-11-14T07:00:00-05:00', ['bomba-pluma', 'muestreo-laboratorio']),
  ]),
  cotizacion('EPI-PRES-ESC-26089', '2026-10-30T16:22:00-06:00', 'ESC', 'c-infra', YO, 'pedido', [
    partida('8a', 'Losa del puente', 'losa', esp(300, { colocacion: 'bombeo' }), 180, 'o-periferico', '2026-11-06T07:00:00-06:00', ['bomba-estacionaria', 'muestreo-laboratorio']),
  ]),
  cotizacion('EPI-PRES-ESC-26088', '2026-10-28T10:47:00-06:00', 'ESC', 'c-delta', LUIS, 'pedido', [
    partida('9a', 'Piso industrial', 'firmes', esp(250, { aditivos: ['fibra-sintetica'] }), 50, 'o-bodega', '2026-11-05T07:00:00-06:00'),
  ]),
  cotizacion('EPI-PRES-CUN-26117', '2026-10-27T18:05:00-05:00', 'CUN', 'c-infra', YO, 'cancelada', [
    partida('10a', 'Distribuidor vial', 'pavimento', esp(45, MR), 90, 'o-distribuidor', '2026-11-03T22:00:00-05:00', ['colado-nocturno']),
  ]),
  cotizacion('EPI-PRES-ESC-26087', '2026-10-24T13:30:00-06:00', 'ESC', 'c-sol', YO, 'cancelada', [
    partida('11a', 'Locales comerciales', 'losa', esp(250), 22, 'o-plaza-esc', '2026-10-30T08:00:00-06:00'),
  ]),
  cotizacion('EPI-PRES-ESC-26086', '2026-10-21T09:55:00-06:00', 'ESC', 'c-maya', YO, 'pedido', [
    partida('12a', 'Cimentación', 'losa', esp(250), 30, 'o-torre-norte', '2026-10-27T07:30:00-06:00', ['muestreo-laboratorio']),
  ]),
];

export interface FiltroCotizaciones {
  /** Plantas elegidas en el encabezado (como las empresas de Odoo). */
  plantas: string[];
  /** "Mis cotizaciones": solo las de este vendedor. */
  vendedorId: string | null;
  /** Vacío = todos; varios se suman. */
  estados: EstadoCotizacion[];
  /** Palabras del buscador, en folio, cliente u obras (sin importar acentos ni orden). */
  texto: string;
}

/** Todas las palabras de `texto` aparecen en `donde`, sin importar acentos, mayúsculas ni el orden. */
export function coincide(texto: string, donde: string): boolean {
  const d = normalizar(donde);
  return normalizar(texto)
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => d.includes(p));
}

export function filtrarCotizaciones(cotizaciones: CotizacionVista[], f: FiltroCotizaciones): CotizacionVista[] {
  return cotizaciones.filter(
    (c) =>
      f.plantas.includes(c.plantaId) &&
      (!f.vendedorId || c.vendedorId === f.vendedorId) &&
      (!f.estados.length || f.estados.includes(c.estado)) &&
      coincide(f.texto, `${c.folio} ${c.clienteNombre} ${c.obrasNombre}`),
  );
}

/** Órdenes de las plantas elegidas por folio, cliente, obra, producto o la cotización de la que salieron. */
export const filtrarPedidos = (pedidos: PedidoVista[], plantas: string[], texto: string) =>
  pedidos.filter(
    (p) =>
      plantas.includes(p.plantaId) &&
      coincide(texto, `${p.folio} ${p.clienteNombre} ${p.obraNombre} ${p.producto} ${p.cotizacionId ?? ''}`),
  );

/** Clientes por nombre, razón social, RFC o su contacto. */
export const filtrarClientes = (clientes: Cliente[], texto: string) =>
  clientes.filter((c) =>
    coincide(texto, `${c.nombre} ${c.empresa.razonSocial} ${c.empresa.rfc} ${c.contacto.nombre} ${c.contacto.apellidos} ${c.contacto.correo}`),
  );

/** Neto de las que no están canceladas. */
export const totalVigente = (cotizaciones: CotizacionVista[]) =>
  cotizaciones.reduce((suma, c) => (c.estado === 'cancelada' ? suma : suma + c.total), 0);

/** Solo las que no son pedido ni están canceladas se pueden editar y enviar (como en Odoo). */
export const modificable = (c: Cotizacion) => c.estado === 'borrador' || c.estado === 'enviada';

/** Las plantas de la concretera (ESC, XPJ, CZM, CUN) con su zona horaria. */
export const PLANTAS_ERP = RAZONES_SOCIALES.flatMap((r) => r.plantas);

/** La planta que atiende un municipio (la del portal, más Cancún, que solo opera el ERP); null si ninguna. */
export function plantaDeMunicipio(municipio: string): string | null {
  if (/canc[uú]n/i.test(municipio)) return 'CUN';
  const clave = plantaPara({ municipio }).clave;
  return PLANTAS_ERP.some((p) => p.id === clave) ? clave : null;
}

/** "-06:00": el offset de una zona IANA en esa fecha. */
export function offsetEn(zona: string, fecha: Date): string {
  const n = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(fecha)
    .find((p) => p.type === 'timeZoneName')!.value;
  return n === 'GMT' ? '+00:00' : n.slice(3);
}

/** ISO 8601 con el offset de la zona, p. ej. 2026-11-05T10:20:00-06:00 (la hora que se muestra es la de la planta). */
export function isoEnZona(zona: string, fecha = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  );
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}:${p['second']}${offsetEn(zona, fecha)}`;
}

/** Siguiente folio de la planta en el año: EPI-PRES-ESC-26092 → EPI-PRES-ESC-26093; el primero del año, …-26001. */
export function siguienteFolio(folios: string[], plantaId: string, fechaIso: string): string {
  const anio = fechaIso.slice(2, 4);
  const prefijo = `EPI-PRES-${plantaId}-${anio}`;
  const usados = folios.filter((f) => f.startsWith(prefijo)).map((f) => Number(f.slice(prefijo.length, prefijo.length + 3)));
  return prefijo + String(Math.max(0, ...usados) + 1).padStart(3, '0');
}

export type NuevaCotizacion = Pick<Cotizacion, 'clienteId' | 'plantaId' | 'partidas' | 'descuento'>;

/** Pedido con los nombres resueltos (cliente, obra y planta) y la zona de su planta. */
function vistaPedido(p: Pedido, cat: Catalogo): PedidoVista {
  const planta = PLANTAS.find((x) => x.id === p.plantaId)!;
  return {
    ...p,
    clienteNombre: cat.clientes.find((x) => x.id === p.clienteId)!.nombre,
    obraNombre: cat.obras.find((o) => o.id === p.obraId)!.nombre,
    plantaNombre: planta.nombre,
    zonaHoraria: planta.zonaHoraria,
  };
}

const folioPedido = (consecutivo: number) => `PED-26-${String(consecutivo).padStart(4, '0')}`;

/** Un pedido por partida (pedidoDePartida, la misma regla que el portal), de la planta de la cotización. */
const pedidosDe = (c: Cotizacion, primerConsecutivo: number, cat: Catalogo = EJEMPLO): PedidoVista[] =>
  c.partidas.map((p, i) => {
    const folio = folioPedido(primerConsecutivo + i);
    return vistaPedido({
      id: folio,
      folio,
      clienteId: c.clienteId,
      plantaId: c.plantaId,
      cotizacionId: c.id,
      ...pedidoDePartida(p, c.descuento),
      estado: 'programado',
      cobro: 'por_facturar',
    }, cat);
  });

/** Los de las cotizaciones demo que ya son pedido, de la más antigua a la más reciente; los de antes del 5/11, entregados. */
const PEDIDOS: PedidoVista[] = COTIZACIONES.filter((c) => c.estado === 'pedido')
  .reverse()
  .flatMap((c, i) => pedidosDe(c, 151 + i))
  .map((p): PedidoVista => (p.fechaHoraEntrega < '2026-11-05' ? { ...p, estado: 'entregado', cobro: 'facturado' } : p))
  .reverse();

/** Clave de cada registro en el historial (HistorialService). */
export const registro = {
  cotizacion: (id: string) => 'cotizacion:' + id,
  pedido: (folio: string) => 'pedido:' + folio,
  cliente: (id: string) => 'cliente:' + id,
};

const nombreEstado = (e: EstadoCotizacion) => ESTADOS_COTIZACION[e].nombre;
const cambioEstado = (antes: EstadoCotizacion, despues: EstadoCotizacion): Cambio[] =>
  antes === despues ? [] : [{ campo: 'Estado', antes: nombreEstado(antes), despues: nombreEstado(despues) }];

/**
 * Lo que cambió al guardar una cotización, como el seguimiento de Odoo: campos antes → después (folio, estado, precio
 * del concreto de cada producto, descuento y total) y renglones con los productos y servicios agregados o quitados.
 */
export function cambiosEntre(antes: CotizacionVista, despues: CotizacionVista): { cambios: Cambio[]; detalles: string[] } {
  const cambios: Cambio[] = [];
  const detalles: string[] = [];
  const campo = (nombre: string, a: string, d: string) => {
    if (a !== d) cambios.push({ campo: nombre, antes: a, despues: d });
  };
  const precio = (p: PartidaCotizacion) => '$' + pesos(p.precioM3 ?? precioConcreto(p));
  const servicio = (id: ServicioObra) => SERVICIOS.find((s) => s.id === id)!.nombre;
  const delQueSobra = (de: ServicioObra[], en: ServicioObra[]) =>
    de.filter((id) => id !== 'renta-maquinaria' && !en.includes(id)).map(servicio);

  campo('Folio', antes.folio, despues.folio);
  cambios.push(...cambioEstado(antes.estado, despues.estado));
  for (const d of despues.partidas) {
    const a = antes.partidas.find((x) => x.id === d.id);
    if (!a) {
      detalles.push(`Se agregó ${d.nombre} · ${d.volumenM3} m³`);
      continue;
    }
    campo(`Precio del concreto · ${d.nombre}`, precio(a), precio(d));
    const servicios = [
      ...delQueSobra(d.servicios, a.servicios).map((s) => '+ ' + s),
      ...delQueSobra(a.servicios, d.servicios).map((s) => '− ' + s),
    ];
    if (servicios.length) detalles.push(`Servicios de ${d.nombre}: ${servicios.join(', ')}`);
  }
  for (const a of antes.partidas) {
    if (!despues.partidas.some((d) => d.id === a.id)) detalles.push(`Se quitó ${a.nombre} · ${a.volumenM3} m³`);
  }
  campo('Descuento', `${antes.descuento ?? 0} %`, `${despues.descuento ?? 0} %`);
  campo('Total', '$' + pesos(antes.total), '$' + pesos(despues.total));
  return { cambios, detalles };
}

const masMinutos = (iso: string, minutos: number) => new Date(Date.parse(iso) + minutos * 60_000).toISOString();

/**
 * Lo que ya pasó con los registros de ejemplo: cada cotización se creó, se envió y se confirmó o canceló según su
 * estado; sus pedidos se crearon al confirmarla y los entregados se entregaron; cada cliente se dio de alta (y los
 * conectados entraron al portal).
 */
function historialDemo(): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];
  const agregar = (r: string, fecha: string, autor: string, texto: string, extra: Partial<EventoHistorial> = {}) =>
    eventos.push({ id: 'demo-' + eventos.length, registro: r, fecha, autor, texto, ...extra });

  for (const c of COTIZACIONES) {
    const r = registro.cotizacion(c.id);
    agregar(r, c.fecha, c.vendedorNombre, 'Cotización creada', { detalles: [`${c.obrasNombre} · neto $${pesos(c.total)}`] });
    if (c.estado === 'borrador') continue;
    agregar(r, masMinutos(c.fecha, 45), c.vendedorNombre, 'Cotización enviada al cliente', {
      cambios: cambioEstado('borrador', 'enviada'),
    });
    if (c.estado === 'pedido') {
      const folios = PEDIDOS.filter((p) => p.cotizacionId === c.id).map((p) => p.folio);
      agregar(r, masMinutos(c.fecha, 24 * 60), c.vendedorNombre, 'Cotización confirmada', {
        cambios: cambioEstado('enviada', 'pedido'),
        detalles: [`Generó el pedido ${folios.join(', ')}`],
      });
    }
    if (c.estado === 'cancelada') {
      agregar(r, masMinutos(c.fecha, 48 * 60), c.vendedorNombre, 'Cotización cancelada', {
        cambios: cambioEstado('enviada', 'cancelada'),
      });
    }
  }
  for (const p of PEDIDOS) {
    const c = COTIZACIONES.find((x) => x.id === p.cotizacionId)!;
    const r = registro.pedido(p.folio);
    agregar(r, masMinutos(c.fecha, 24 * 60), c.vendedorNombre, `Orden de venta creada desde la cotización ${c.folio}`);
    if (p.estado === 'entregado') {
      agregar(r, masMinutos(p.fechaHoraEntrega, 180), 'Luis Canché', 'Entrega completada', {
        cambios: [
          { campo: 'Estado', antes: ESTADO_PEDIDO.programado, despues: ESTADO_PEDIDO.entregado },
          { campo: 'Cobro', antes: ESTADO_COBRO.por_facturar, despues: ESTADO_COBRO.facturado },
        ],
      });
    }
  }
  for (const c of CLIENTES) {
    const primera = COTIZACIONES.filter((q) => q.clienteId === c.id).map((q) => q.fecha).sort()[0];
    const alta = masMinutos(primera, -20 * 24 * 60);
    agregar(registro.cliente(c.id), alta, 'Operaciones', 'Cliente dado de alta', { detalles: [c.empresa.razonSocial] });
    if (c.portal) {
      agregar(registro.cliente(c.id), masMinutos(alta, 3 * 24 * 60), `${c.contacto.nombre} ${c.contacto.apellidos}`, 'Se conectó al portal de clientes', {
        detalles: [c.contacto.correo],
      });
    }
  }
  return eventos;
}

/** Las cotizaciones y los pedidos que generan: la lista, la vista previa y las vistas completas leen de aquí. */
@Service()
export class VentasService {
  // shortcut: en memoria (se pierde al recargar) y el envío solo cambia el estado; con backend, guardar, enviar y
  // confirmar por HTTP (que el cliente vea la cotización y sus pedidos en el portal) sin cambiar esta API.
  readonly cotizaciones = signal<CotizacionVista[]>(COTIZACIONES);
  /** El más reciente primero. */
  readonly pedidos = signal<PedidoVista[]>(PEDIDOS);
  readonly clientes = signal<Cliente[]>(CLIENTES);
  /** Las obras de los clientes; crece con los lugares de entrega que se dan de alta al cotizar. */
  readonly obras = signal<Obra[]>(OBRAS);
  private consecutivo = 150 + PEDIDOS.length;
  /** Cada acción queda en el historial de su registro, con lo que cambió. */
  private readonly historial = inject(HistorialService);

  constructor() {
    this.historial.agregar(historialDemo());
  }

  /**
   * Precios especiales, productos, servicios y descuento. Si ya estaba enviada, el cliente tiene la anterior: como
   * en el portal, se vuelve la revisión siguiente de su serie (-R1, -R2…) y queda en borrador hasta reenviarla.
   */
  guardar(id: string, cambios: Pick<Cotizacion, 'partidas' | 'descuento'>): void {
    const antes = this.buscar(id)!;
    this.cambiar(id, (c) =>
      c.estado === 'enviada'
        ? { ...c, ...cambios, revision: c.revision + 1, folio: `${c.serie}-R${c.revision + 1}`, estado: 'borrador', envio: undefined }
        : { ...c, ...cambios },
    );
    this.historial.registrar(registro.cotizacion(id), { texto: 'Cambios guardados', ...cambiosEntre(antes, this.buscar(id)!) });
  }

  /** A la cuenta del portal si el cliente está conectado; si no, al correo que se indicó. */
  enviar(id: string, correo: string, portal: boolean): void {
    const antes = this.buscar(id)!;
    this.cambiar(id, (c) => ({ ...c, estado: 'enviada', envio: { correo, portal, fecha: new Date().toISOString() } }));
    this.historial.registrar(registro.cotizacion(id), {
      texto: portal ? `Enviada al portal de ${antes.clienteNombre} (${correo})` : `Enviada por correo a ${correo}`,
      cambios: cambioEstado(antes.estado, 'enviada'),
    });
  }

  /**
   * Como "Confirmar" en Odoo: la cotización pasa a pedido y genera un pedido por partida (cada entrega es una orden de
   * venta, como al aceptarla en el portal). Devuelve los pedidos nuevos; si ya no se podía confirmar, ninguno.
   */
  confirmar(id: string): PedidoVista[] {
    const c = this.buscar(id);
    if (!c || !modificable(c)) return [];
    const nuevos = pedidosDe(c, this.consecutivo + 1, this.catalogo());
    this.consecutivo += nuevos.length;
    this.pedidos.update((lista) => [...nuevos, ...lista]);
    this.cambiar(id, (x) => ({ ...x, estado: 'pedido' }));
    const folios = nuevos.map((p) => p.folio);
    this.historial.registrar(registro.cotizacion(id), {
      texto: 'Cotización confirmada',
      cambios: cambioEstado(c.estado, 'pedido'),
      detalles: [`Generó ${folios.length === 1 ? 'el pedido' : 'los pedidos'} ${folios.join(', ')}`],
    });
    for (const p of nuevos) {
      this.historial.registrar(registro.pedido(p.folio), { texto: `Orden de venta creada desde la cotización ${c.folio}` });
    }
    return nuevos;
  }

  private readonly catalogo = (): Catalogo => ({ clientes: this.clientes(), obras: this.obras() });

  /** Alta rápida al cotizar: queda sin cuenta del portal y sin datos fiscales, y así lo dice su historial. */
  crearCliente(d: ClienteExpress): Cliente {
    const telefono = d.telefono.replace(/\D/g, '');
    const correo = d.correo.trim();
    const nuevo: Cliente = {
      id: 'c-' + crypto.randomUUID().slice(0, 8),
      nombre: d.nombre.trim(),
      empresa: {
        razonSocial: '',
        nombreComercial: d.nombre.trim(),
        rfc: '',
        giro: '',
        correo,
        telefono,
        sitioWeb: '',
        domicilioFiscal: '',
        cargoRepresentante: '',
      },
      contacto: { nombre: d.contacto.trim(), apellidos: '', correo, telefono, puesto: '' },
      facturacion: [],
      portal: false,
    };
    this.clientes.update((lista) => [...lista, nuevo]);
    this.historial.registrar(registro.cliente(nuevo.id), {
      texto: 'Cliente dado de alta al cotizar',
      detalles: ['Faltan sus datos fiscales: complétalos con Editar.'],
    });
    return nuevo;
  }

  /** El lugar de entrega como obra del cliente, con quien recibe como responsable y contacto. */
  crearObra(clienteId: string, d: LugarEntrega): Obra {
    const contacto = d.contacto.trim();
    const referencias = d.referencias.trim();
    const obra: Obra = {
      id: 'o-' + crypto.randomUUID().slice(0, 8),
      clienteId,
      nombre: d.nombre.trim() || 'Entrega a domicilio',
      direccion: d.direccion.trim(),
      municipio: d.municipio.trim(),
      ...(referencias ? { referencias } : {}),
      ...(d.ubicacion ? { ubicacion: d.ubicacion } : {}),
      responsable: { nombre: contacto },
      contactos: [{ nombre: contacto, lada: '+52', numero: d.telefono.replace(/\D/g, '') }],
    };
    this.obras.update((lista) => [...lista, obra]);
    return obra;
  }

  cliente(id: string): Cliente | undefined {
    return this.clientes().find((c) => c.id === id);
  }

  /**
   * Contacto, empresa y datos de facturación (lo mismo que el cliente captura en el portal), ya limpios. Si cambia su
   * nombre, cambia también en sus cotizaciones y pedidos. Queda en su historial con lo que cambió.
   */
  guardarCliente(id: string, cambios: CambiosCliente): void {
    const antes = this.cliente(id);
    if (!antes) return;
    const despues: Cliente = { ...antes, ...limpiarCliente(cambios) };
    this.clientes.update((lista) => lista.map((c) => (c.id === id ? despues : c)));
    if (antes.nombre !== despues.nombre) {
      this.cotizaciones.update((l) => l.map((q) => (q.clienteId === id ? { ...q, clienteNombre: despues.nombre } : q)));
      this.pedidos.update((l) => l.map((p) => (p.clienteId === id ? { ...p, clienteNombre: despues.nombre } : p)));
    }
    const diferencias = cambiosCliente(antes, despues);
    if (diferencias.cambios.length || diferencias.detalles.length) {
      this.historial.registrar(registro.cliente(id), { texto: 'Datos del cliente actualizados', ...diferencias });
    }
  }

  private buscar(id: string): CotizacionVista | undefined {
    return this.cotizaciones().find((c) => c.id === id);
  }

  /**
   * Nueva cotización hecha en el ERP: en borrador, con el siguiente folio de su planta, la fecha en la hora de la
   * planta y quien la hizo como vendedor. Queda en su historial. Devuelve la cotización creada.
   */
  crear(n: NuevaCotizacion, vendedorId: string): CotizacionVista {
    const planta = PLANTAS_ERP.find((p) => p.id === n.plantaId)!;
    const fecha = isoEnZona(planta.zonaHoraria);
    const folio = siguienteFolio(
      this.cotizaciones().map((c) => c.serie),
      n.plantaId,
      fecha,
    );
    const c = vista({ ...n, id: folio, folio, fecha, serie: folio, revision: 0, vendedorId, estado: 'borrador' }, this.catalogo());
    this.cotizaciones.update((lista) => [c, ...lista]);
    this.historial.registrar(registro.cotizacion(c.id), {
      texto: 'Cotización creada',
      detalles: [`${c.partidas.length === 1 ? '1 producto' : `${c.partidas.length} productos`}, neto $${pesos(c.total)}`],
    });
    return c;
  }

  /**
   * Orden de venta directa, sin pasar por cotización: una por producto, como al confirmar. Con `conCotizacion`, además
   * queda su cotización (creada y confirmada) como respaldo; sin ella, cada orden guarda su partida. Devuelve las órdenes.
   */
  crearOrdenes(n: NuevaCotizacion, vendedorId: string, conCotizacion: boolean): PedidoVista[] {
    if (conCotizacion) return this.confirmar(this.crear(n, vendedorId).id);
    const nuevos = n.partidas.map((p, i) => {
      const folio = folioPedido(this.consecutivo + 1 + i);
      return vistaPedido(
        {
          id: folio,
          folio,
          clienteId: n.clienteId,
          plantaId: n.plantaId,
          ...pedidoDePartida(p, n.descuento),
          estado: 'programado',
          cobro: 'por_facturar',
          partida: p,
          ...(n.descuento ? { descuento: n.descuento } : {}),
        },
        this.catalogo(),
      );
    });
    this.consecutivo += nuevos.length;
    this.pedidos.update((lista) => [...nuevos, ...lista]);
    for (const p of nuevos) {
      this.historial.registrar(registro.pedido(p.folio), {
        texto: 'Orden de venta creada directamente, sin cotización',
        detalles: [`${p.producto} · ${p.volumenM3} m³ · importe $${pesos(p.importe)}`],
      });
    }
    return nuevos;
  }

  pedidosDe(cotizacionId: string): PedidoVista[] {
    return this.pedidos().filter((p) => p.cotizacionId === cotizacionId);
  }

  private cambiar(id: string, cambio: (c: CotizacionVista) => Cotizacion): void {
    this.cotizaciones.update((lista) => lista.map((c) => (c.id === id ? vista(cambio(c), this.catalogo()) : c)));
  }
}
