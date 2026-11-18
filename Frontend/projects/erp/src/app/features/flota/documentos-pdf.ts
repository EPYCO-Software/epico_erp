import type { Certificado } from '../laboratorio/calidad-api';
import type { DatosRemision } from './flota-api';

const ROJO: [number, number, number] = [211, 24, 30];
const fechaHora = (iso: string | null, zona?: string) =>
  iso ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', ...(zona ? { timeZone: zona } : {}) }).format(new Date(iso)) : '—';
const fecha = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const m3 = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} m³`;

async function abrirPdf() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  return { doc, autoTable, finalY, ancho: doc.internal.pageSize.getWidth(), m: 48 };
}

/**
 * La remisión de un viaje (lo que firma quien recibe en obra): planta, cliente, obra, producto, m³ del viaje y
 * acumulado, unidad y operador, horas reales y la firma (imagen) con el nombre de quien recibió.
 */
export async function remisionPdf(d: DatosRemision, firma: string | null): Promise<void> {
  const { doc, autoTable, finalY, ancho, m } = await abrirPdf();
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...ROJO).text('REMISIÓN', m, m + 6);
  doc.setTextColor(0).setFontSize(12).text(`Folio ${d.folio}`, ancho - m, m, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).text(fecha(d.fecha), ancho - m, m + 14, { align: 'right' });
  doc.text(`Orden ${d.pedidoFolio}`, ancho - m, m + 28, { align: 'right' });
  doc.setFontSize(10).text(
    [d.empresa.nombreComercial ?? d.empresa.razonSocial, d.empresa.rfc ? `RFC ${d.empresa.rfc}` : '', `${d.planta.nombre}${d.planta.direccion ? ' · ' + d.planta.direccion : ''}`, d.planta.telefono ? `Tel. ${d.planta.telefono}` : ''].filter(Boolean),
    m,
    m + 24,
  );

  autoTable(doc, {
    startY: m + 74,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120, fillColor: [242, 242, 242] } },
    body: [
      ['Cliente', d.clienteNombre],
      ['Obra', [d.obra.nombre, d.obra.direccion, d.obra.municipio].filter(Boolean).join(' — ')],
      ['Producto', d.producto],
      ['Volumen de este viaje', m3(d.m3)],
      ['Acumulado de la orden', `${m3(d.m3Acumulado)} de ${m3(d.m3Pedido)}`],
      ['Unidad', [d.numeroEconomico ?? '—', d.placas ? `placas ${d.placas}` : ''].filter(Boolean).join(' · ')],
      ['Operador', d.operador ?? '—'],
      ['Sello', d.sello ?? '—'],
    ],
    margin: { left: m, right: m },
  });
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Horarios', m, finalY() + 22);
  autoTable(doc, {
    startY: finalY() + 28,
    head: [['Cargó', 'Salió de planta', 'Llegó a obra', 'Salió de obra', 'Regresó']],
    body: [[d.horas.cargandoEn, d.horas.salidaEn, d.horas.llegadaEn, d.horas.regresandoEn, d.horas.terminadaEn].map((x) => fechaHora(x))],
    styles: { fontSize: 9, halign: 'center' },
    headStyles: { fillColor: [26, 26, 28] },
    margin: { left: m, right: m },
  });
  const y = finalY() + 40;
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Recibió de conformidad', m, y);
  if (firma) doc.addImage(firma, 'PNG', m, y + 8, 200, 60);
  doc.setDrawColor(120).line(m, y + 74, m + 240, y + 74);
  doc.setFont('helvetica', 'normal').setFontSize(10).text(d.recibeNombre ?? 'Nombre y firma', m, y + 88);
  doc.save(`remision-${d.folio}.pdf`);
}

/**
 * Certificado de calidad de una orden: el concreto pedido (f'c y edad), cada muestra con sus ensayes (resistencia y %
 * del diseño), el resumen a 28 días y el dictamen (criterio simplificado del backend).
 */
export async function certificadoPdf(c: Certificado): Promise<void> {
  const { doc, autoTable, finalY, ancho, m } = await abrirPdf();
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...ROJO).text('CERTIFICADO DE CALIDAD', m, m + 6);
  doc.setTextColor(0).setFontSize(11).text(`Orden ${c.pedido.folio}`, ancho - m, m, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).text(`Emitido el ${fecha(c.emitidoEn)}`, ancho - m, m + 14, { align: 'right' });
  autoTable(doc, {
    startY: m + 32,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140, fillColor: [242, 242, 242] } },
    body: [
      ['Cliente', c.cliente.nombre],
      ['Obra', [c.obra.nombre, c.obra.direccion].filter(Boolean).join(' — ')],
      ['Producto', c.producto],
      ["Resistencia de diseño (f'c)", `${c.fc} kg/cm² a ${c.edadDias} días`],
    ],
    margin: { left: m, right: m },
  });
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Muestras y ensayes', m, finalY() + 22);
  autoTable(doc, {
    startY: finalY() + 28,
    head: [['Muestra', 'Remisión', 'Muestreo', 'Rev. (cm)', 'Edad', 'Ensaye', 'kg/cm²', '% diseño']],
    body: c.muestras.flatMap((mu) =>
      (mu.ensayes.length ? mu.ensayes : [null]).map((e, i) => [
        i ? '' : mu.folio,
        i ? '' : (mu.remisionFolio ?? '—'),
        i ? '' : fechaHora(mu.fechaMuestreo),
        i ? '' : (mu.revenimientoCm?.toString() ?? '—'),
        e ? `${e.edadDias} días` : '—',
        e?.fechaEnsaye ? e.fechaEnsaye.slice(0, 10).split('-').reverse().join('/') : 'Pendiente',
        e?.resistenciaKgCm2 != null ? e.resistenciaKgCm2.toFixed(0) : '—',
        e?.porcentaje != null ? `${e.porcentaje.toFixed(0)} %` : '—',
      ]),
    ),
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [26, 26, 28] },
    margin: { left: m, right: m },
  });
  const r = c.resumen28;
  const dictamen = { cumple: 'CUMPLE', no_cumple: 'NO CUMPLE', pendiente: 'PENDIENTE (faltan ensayes a 28 días)' }[c.dictamen];
  doc.setFont('helvetica', 'bold').setFontSize(11).text(`A 28 días: ${r.n ? `promedio ${r.promedio?.toFixed(0)} kg/cm², mínimo ${r.minimo?.toFixed(0)} kg/cm² (${r.n} ensayes)` : 'sin ensayes aún'}`, m, finalY() + 24);
  doc.setTextColor(...(c.dictamen === 'no_cumple' ? ROJO : ([26, 26, 28] as [number, number, number]))).setFontSize(13).text(`Dictamen: ${dictamen}`, m, finalY() + 44);
  doc.setTextColor(0).setFont('helvetica', 'normal').setFontSize(8.5).text(
    "Criterio: promedio a 28 días igual o mayor que f'c y ningún ensaye menor que f'c − 35 kg/cm².",
    m,
    finalY() + 60,
  );
  doc.save(`certificado-${c.pedido.folio}.pdf`);
}

/** Una imagen (blob) como data URL para incrustarla en el PDF. */
export function aDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = mal;
    r.readAsDataURL(b);
  });
}
