import { PartidaCotizacion } from '../models/cotizacion';
import { Obra } from '../models/obra';
import { agruparPorObra, fechaHoraCorta, lineasPartida, pesos, totales } from './formato';
import { fechaLarga, plantaPara } from './plantas';

export interface DatosPdf {
  folio: string;
  fecha: Date;
  cliente: { nombre: string; correo: string };
  partidas: PartidaCotizacion[];
  obras: Obra[];
  /** Línea bajo el folio, p. ej. "Sustituye a: EPI-WEB-ESC-26001" o "Basada en: …". */
  referencia?: string;
  /** % de descuento que dio la concretera (CotizacionGuardada.descuento). */
  descuento?: number;
  /** El documento: la cotización (por omisión) o la orden de venta de un pedido, con el mismo formato. */
  tipo?: 'cotizacion' | 'orden';
  /** La emite la concretera (ERP): sin la nota de "precios de referencia generados en el portal". */
  emitida?: boolean;
}

// Colores de la cotización impresa (EPI-PRES-ESC-26085).
const ROJO: [number, number, number] = [255, 0, 0];
const AMARILLO: [number, number, number] = [255, 255, 0];
const GRIS: [number, number, number] = [217, 217, 217];
const AZUL: [number, number, number] = [0, 0, 238];
const MAPA_ESC = 'https://maps.app.goo.gl/DUH3paUAPfZHiCk59';

/** Descarga el PDF como {folio}.pdf. */
export async function descargarCotizacionPdf(d: DatosPdf): Promise<void> {
  (await generar(d)).save(`${d.folio}.pdf`);
}

/**
 * Muestra el PDF en una pestaña nueva. La pestaña se abre antes de generar (aún dentro del clic) para que el
 * navegador no la bloquee como ventana emergente.
 */
export async function abrirCotizacionPdf(d: DatosPdf): Promise<void> {
  const pestana = window.open('', '_blank');
  try {
    const url = (await generar(d)).output('bloburl').toString();
    if (pestana) pestana.location.href = url;
    else window.location.href = url;
  } catch (e) {
    pestana?.close();
    throw e;
  }
}

/**
 * Genera el PDF con el formato de la cotización impresa de EPICO (sin logos por ahora), igual en el portal y el ERP.
 * jsPDF se carga solo aquí, al generar, para no pesar en la carga de las apps.
 */
async function generar(d: DatosPdf) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const m = 56;
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const grupos = agruparPorObra(d.partidas, d.obras);
  const planta = plantaPara(grupos[0]?.obra);

  // Fecha y folio (arriba a la derecha; el espacio de los logos queda libre para después)
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(0);
  doc.text(fechaLarga(d.fecha), ancho - m, 110, { align: 'right' });
  doc.text('Folio: ', ancho - m - doc.setFont('helvetica', 'bold').getTextWidth(d.folio), 124, { align: 'right' });
  doc.setFont('helvetica', 'bold').text(d.folio, ancho - m, 124, { align: 'right' });
  if (d.referencia) doc.setFont('helvetica', 'normal').setFontSize(9).text(d.referencia, ancho - m, 137, { align: 'right' }).setFont('helvetica', 'bold').setFontSize(11);

  // Destinatario
  const obraTitulo = grupos.length === 1 ? `OBRA ${grupos[0].obra.nombre.toUpperCase()}` : 'OBRAS VARIAS';
  doc.setTextColor(...ROJO).text(obraTitulo, m, 150);
  doc.setTextColor(0).text(d.cliente.nombre.toUpperCase(), m, 163);
  doc.setFont('helvetica', 'normal').setFontSize(9).text(d.cliente.correo, m, 175);

  // Introducción
  const obrasTexto = grupos.map((g) => `"${g.obra.nombre.toUpperCase()}", ubicada en ${g.obra.municipio.replace(/\.$/, '')}`).join('; ');
  const orden = d.tipo === 'orden';
  const para = `para ${grupos.length === 1 ? 'la obra' : 'las obras'} ${obrasTexto}.`;
  const intro = orden
    ? `Estimado cliente por este medio le confirmamos su orden de venta para el suministro de Concreto Premezclado, ${para}`
    : `Estimado cliente por este medio sometemos a su consideración nuestra propuesta para el suministro de Concreto Premezclado, ${para}`;
  doc.setFontSize(11);
  const lineasIntro = doc.splitTextToSize(intro, ancho - 2 * m);
  doc.text(lineasIntro, m, 200, { lineHeightFactor: 1.35 });
  let y = 200 + lineasIntro.length * 15 + 14;

  // Una tabla por obra
  const todas = grupos.flatMap((g) => g.partidas.flatMap(lineasPartida));
  grupos.forEach((g, i) => {
    const titulo = `${i + 1}.- ${orden ? 'ORDEN DE VENTA' : 'COTIZACIÓN'} DE CONCRETO${grupos.length > 1 ? ` - OBRA ${g.obra.nombre.toUpperCase()}` : ''}`;
    doc.setFont('helvetica', 'bold').setFontSize(11);
    if (y > alto - 160) {
      doc.addPage();
      y = 72;
    }
    doc.setFillColor(...GRIS).rect(m, y - 10, doc.getTextWidth(titulo) + 4, 14, 'F');
    doc.text(titulo, m + 2, y);
    doc.setFont('helvetica', 'normal').setFontSize(9).text(`Entrega en: ${g.obra.direccion}, ${g.obra.municipio}`, m, y + 14);

    const filas = g.partidas.flatMap((p) =>
      lineasPartida(p).map((l, j) => [
        j === 0 ? `${l.concepto}\nEntrega ${orden ? 'programada' : 'estimada'}: ${fechaHoraCorta(p.entrega)}` : l.concepto,
        l.unidad,
        pesos(l.precio),
        l.cantidad.toFixed(2),
        pesos(l.importe),
      ]),
    );
    autoTable(doc, {
      startY: y + 22,
      margin: { left: m, right: m, bottom: 90 },
      head: [['Concepto', 'Unidad', 'Precio', 'Cantidad', 'Importe']],
      body: filas,
      theme: 'grid',
      styles: { font: 'times', fontSize: 11, textColor: 0, lineColor: 0, lineWidth: 0.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
      headStyles: { fillColor: ROJO, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 52 },
        2: { halign: 'center', cellWidth: 70 },
        3: { halign: 'center', cellWidth: 62 },
        4: { halign: 'center', cellWidth: 100 },
      },
    });
    y = finalY() + 24;
  });

  // Totales (alineados a la columna de importe, como en la impresa)
  const t = totales(todas, d.descuento);
  autoTable(doc, {
    startY: y - 14,
    margin: { left: ancho - m - 170, right: m, bottom: 90 },
    body: [
      ['Subtotal', `$  ${pesos(t.subtotal)}`],
      ...(t.descuento ? [[`Descuento ${d.descuento}%`, `−$  ${pesos(t.descuento)}`]] : []),
      ['IVA 16%', `$  ${pesos(t.iva)}`],
      ['Neto', `$  ${pesos(t.neto)}`],
    ],
    theme: 'grid',
    styles: { font: 'times', fontSize: 11, textColor: 0, lineColor: 0, lineWidth: 0.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 } },
    columnStyles: { 0: { halign: 'center', cellWidth: 70 }, 1: { halign: 'right', fontStyle: 'bold', cellWidth: 100 } },
    didParseCell: (c) => {
      if (c.row.index === c.table.body.length - 1) c.cell.styles.fillColor = AMARILLO;
    },
  });
  y = finalY() + 26;

  // Condiciones generales
  const condiciones: { texto: string; negrita?: boolean; enlace?: string }[] = [
    { texto: 'Pago por adelantado.' },
    { texto: 'Precios antes de IVA.' },
    { texto: 'Precios en Moneda Nacional (MXN).' },
    { texto: `Precios válidos hasta ${d.partidas.find((p) => p.traslado)?.traslado?.incluidosKm ?? 20} km de la ubicación de la planta.` },
    ...(planta.clave === 'ESC' ? [{ texto: MAPA_ESC, enlace: MAPA_ESC }] : []),
    { texto: 'En caso de ocupar a una distancia mayor se negociarán costos por traslado adicional.' },
    { texto: `Precios válidos hasta el 31 de diciembre del ${d.fecha.getFullYear()}`, negrita: true },
    { texto: 'Nuestros concretos se encuentran regulados bajo la Norma Mexicana NMX C-155.' },
    ...(d.emitida ? [] : [{ texto: 'Precios de referencia generados en el portal; sujetos a confirmación de su asesor.', negrita: true }]),
    orden
      ? { texto: 'Fecha de entrega programada; cualquier cambio, con su asesor. Entregas de 18:00 a 07:00 se cotizan como colado nocturno.' }
      : { texto: 'Fechas de entrega estimadas, sujetas a confirmación de disponibilidad. Entregas de 18:00 a 07:00 se cotizan como colado nocturno.' },
  ];
  if (y > alto - 230) {
    doc.addPage();
    y = 72;
  }
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Condiciones Generales', m, y);
  y += 16;
  for (const c of condiciones) {
    const sangria = c.enlace ? 40 : 22;
    doc.setFont('helvetica', c.negrita ? 'bold' : 'normal').setFontSize(11);
    const lineas = doc.splitTextToSize(c.texto, ancho - 2 * m - sangria);
    doc.text(c.enlace ? 'o' : '•', m + sangria - 12, y);
    if (c.enlace) {
      doc.setTextColor(...AZUL).textWithLink(c.texto, m + sangria, y, { url: c.enlace });
      doc.setDrawColor(...AZUL).line(m + sangria, y + 1.5, m + sangria + doc.getTextWidth(c.texto), y + 1.5);
      doc.setTextColor(0).setDrawColor(0);
    } else {
      doc.text(lineas, m + sangria, y);
    }
    y += lineas.length * 14;
  }

  // Firma (sin firma ni nombre: la cotización formal la emite la concretera)
  y = Math.min(y + 50, alto - 150);
  doc.setLineWidth(0.5).line(ancho / 2 - 110, y, ancho / 2 + 110, y);
  doc.setFont('helvetica', 'normal').setFontSize(10).text('Departamento de Ventas', ancho / 2, y + 13, { align: 'center' });
  doc.text(planta.nombre, ancho / 2, y + 26, { align: 'center' });

  // Pie en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
    doc.text(`EPICO CONCRETOS - ${planta.nombre}`, ancho / 2, alto - 66, { align: 'center' });
    doc.text(planta.telefonos, ancho / 2, alto - 53, { align: 'center' });
    const correo = `Email: ${planta.correos}`;
    doc.text(correo, ancho / 2, alto - 40, { align: 'center' });
    if (paginas > 1) doc.setFont('helvetica', 'normal').setFontSize(8).text(`${i} / ${paginas}`, ancho - m, alto - 24, { align: 'right' });
  }

  return doc;
}
