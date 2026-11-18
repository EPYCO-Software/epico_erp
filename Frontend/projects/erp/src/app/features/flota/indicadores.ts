import { Component, computed, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Download, FileText } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, Icon, textoDuracion } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA } from '../../layout/vista-completa';
import { VentasService, mensajeDe } from '../ventas/datos';
import { Grafica } from '../ventas/grafica';
import { csv, descargar } from '../ventas/reporte-datos';
import { FlotaApi, Indicadores as Datos, MINUTOS_PROLONGADO } from './flota-api';
import { plantasFlota } from './plantas-flota';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const dia = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const min = (n: number | null | undefined) => (n == null ? '—' : textoDuracion(Math.round(n)));
const m3 = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 });

interface Tabla {
  id: string;
  titulo: string;
  columnas: string[];
  /** La primera es el nombre (texto); las demás, cifras. */
  filas: string[][];
}

/**
 * Logística → Informes → Indicadores (/flota/indicadores), como los tableros de Loop4: en el periodo (por la entrega;
 * por omisión los últimos 30 días) y la planta elegidos en el buscador, remisiones, m³, ciclo promedio (de cargar a
 * regresar), tiempo promedio en obra y viajes prolongados en obra (> 90 min); m³ por día y tablas por unidad, conductor,
 * cliente y vendedor, y la lista de prolongados. Se exporta a CSV o PDF. La búsqueda filtra los renglones de las tablas.
 */
@Component({
  selector: 'app-indicadores-logistica',
  imports: [Buscador, DecimalPipe, EnEncabezado, Grafica, Icon],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Indicadores de logística</h1>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-indicadores" etiqueta="Buscar unidad, conductor, cliente o vendedor" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <div class="flex items-center justify-end gap-2">
          <button type="button" [class]="boton" [disabled]="!d()" (click)="exportarCsv()"><ui-icon [icono]="iconos.csv" [tamano]="16" />CSV</button>
          <button type="button" [class]="boton" [disabled]="!d() || generando()" (click)="exportarPdf()"><ui-icon [icono]="iconos.pdf" [tamano]="16" />PDF</button>
        </div>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">Los indicadores necesitan el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <article [class]="cajas.hoja">
            <p class="text-sm text-texto-suave">{{ textoPeriodo() }}{{ plantaElegida() ? ' · ' + plantaElegida()!.nombre : ' · todas las plantas' }}</p>
            @if (datos.error()) {
              <p class="mt-3 text-sm font-medium text-critico" role="alert">{{ mensaje(datos.error()) }}</p>
            } @else if (d(); as d) {
              <dl class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div [class]="kpi"><dt [class]="etiqueta">Remisiones</dt><dd class="text-2xl font-bold tabular-nums">{{ d.totales.remisiones | number }}</dd></div>
                <div [class]="kpi"><dt [class]="etiqueta">m³ entregados</dt><dd class="text-2xl font-bold tabular-nums">{{ d.totales.m3 | number: '1.0-1' }}</dd></div>
                <div [class]="kpi"><dt [class]="etiqueta">Viajes terminados</dt><dd class="text-2xl font-bold tabular-nums">{{ d.totales.viajesTerminados | number }}</dd></div>
                <div [class]="kpi"><dt [class]="etiqueta">Ciclo promedio</dt><dd class="text-2xl font-bold tabular-nums">{{ minutos(d.totales.cicloPromMin) }}</dd></div>
                <div [class]="kpi"><dt [class]="etiqueta">Tiempo en obra</dt><dd class="text-2xl font-bold tabular-nums">{{ minutos(d.totales.tiempoObraPromMin) }}</dd></div>
                <div [class]="kpi + (d.totales.prolongados ? ' bg-[#FBF0DD]' : '')">
                  <dt [class]="etiqueta">Prolongados en obra</dt>
                  <dd [class]="'text-2xl font-bold tabular-nums' + (d.totales.prolongados ? ' text-[#7A5410]' : '')">{{ d.totales.prolongados }}</dd>
                </div>
              </dl>

              <section class="mt-6" aria-labelledby="ind-dias">
                <h2 id="ind-dias" class="text-base font-bold">m³ y viajes por día</h2>
                @if (d.porDia.length) {
                  <app-grafica
                    class="mt-2"
                    [etiquetas]="etiquetasDias()"
                    [series]="seriesDias()"
                    tipo="barras"
                    [formato]="formatoM3"
                    [corto]="formatoM3"
                    titulo="m³ entregados por día"
                    [altura]="240"
                  />
                } @else {
                  <p class="mt-1 text-sm text-texto-suave">Sin viajes en el periodo.</p>
                }
              </section>

              @for (t of tablas(); track t.id) {
                <section class="mt-6" [attr.aria-labelledby]="'ind-' + t.id">
                  <h2 [id]="'ind-' + t.id" class="text-base font-bold">{{ t.titulo }}</h2>
                  @if (t.filas.length) {
                    <div tabindex="0" role="region" [attr.aria-label]="'Tabla: ' + t.titulo" class="mt-2 overflow-x-auto">
                      <table class="w-full min-w-160 text-left text-sm">
                        <thead class="text-texto-suave">
                          <tr>
                            @for (c of t.columnas; track c; let primera = $first) {
                              <th scope="col" class="py-1.5 pr-3 font-semibold" [class.text-right]="!primera">{{ c }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (f of t.filas; track $index) {
                            <tr class="border-t border-acero/50">
                              @for (c of f; track $index; let primera = $first) {
                                @if (primera) {
                                  <th scope="row" class="py-1.5 pr-3 font-medium">{{ c }}</th>
                                } @else {
                                  <td class="py-1.5 pr-3 text-right tabular-nums">{{ c }}</td>
                                }
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <p class="mt-1 text-sm text-texto-suave">Nada con esta búsqueda.</p>
                  }
                </section>
              }
            } @else {
              <p class="mt-3 text-sm text-texto-suave">Calculando…</p>
            }
          </article>
        </div>
      </div>
    }
  `,
})
export default class Indicadores {
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  private readonly plantas = plantasFlota();
  protected readonly cajas = CAJAS_VISTA;
  protected readonly iconos = { csv: Download, pdf: FileText };
  protected readonly mensaje = mensajeDe;
  protected readonly minutos = min;
  protected readonly formatoM3 = (n: number) => `${m3(n)} m³`;
  protected readonly kpi = 'rounded-xl bg-white/80 px-4 py-3';
  protected readonly etiqueta = 'text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly boton =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3 text-sm font-semibold transition-colors hover:border-carbon disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  // ---------- Filtros (en el buscador) ----------
  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'periodo', titulo: 'Periodo (entrega)', rango: 'fecha' },
    { id: 'planta', titulo: 'Planta', opciones: this.plantas.lista().map((p) => ({ id: p.id, nombre: p.nombre })) },
  ]);
  /** Una sola planta marcada: esa; ninguna o varias: todas. */
  protected readonly plantaElegida = computed(() => {
    const ids = this.filtros()['planta'] ?? [];
    return ids.length === 1 ? (this.plantas.lista().find((p) => p.id === ids[0]) ?? null) : null;
  });
  private readonly periodo = computed(() => {
    const [d = '', h = ''] = this.filtros()['periodo'] ?? [];
    const hasta = h || dia(new Date());
    const desde = d || dia(new Date(Date.parse(hasta + 'T12:00:00') - 30 * 86_400_000));
    return { desde, hasta };
  });
  protected readonly textoPeriodo = computed(() => {
    const f = (s: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s + 'T12:00:00'));
    return `Del ${f(this.periodo().desde)} al ${f(this.periodo().hasta)}`;
  });

  protected readonly datos = resource({
    params: () => (this.conBackend ? { ...this.periodo(), sucursalId: this.plantaElegida()?.id } : undefined),
    // hasta incluye todo su día
    loader: ({ params }) =>
      this.api.indicadores(new Date(params.desde + 'T00:00:00').toISOString(), new Date(params.hasta + 'T23:59:59').toISOString(), params.sucursalId),
  });
  protected readonly d = computed<Datos | null>(() => (this.datos.hasValue() ? this.datos.value() : null));

  protected readonly etiquetasDias = computed(() =>
    (this.d()?.porDia ?? []).map((x) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(x.dia + 'T12:00:00'))),
  );
  protected readonly seriesDias = computed(() => [{ id: 'm3', nombre: 'm³', color: '#D3181E', valores: (this.d()?.porDia ?? []).map((x) => x.m3) }]);

  /** Las tablas (en pantalla y en las exportaciones), con la búsqueda aplicada a su primera columna. */
  protected readonly tablas = computed<Tabla[]>(() => {
    const d = this.d();
    if (!d) return [];
    const q = normalizar(this.texto().trim());
    const pasa = (nombre: string) => !q || normalizar(nombre).includes(q);
    const orden = <T extends { m3: number }>(xs: T[]) => [...xs].sort((a, b) => b.m3 - a.m3);
    return [
      {
        id: 'unidad',
        titulo: 'Por unidad',
        columnas: ['Unidad', 'Viajes', 'm³', 'Ciclo promedio', 'Tiempo en obra'],
        filas: orden(d.porUnidad).filter((x) => pasa(x.numeroEconomico)).map((x) => [x.numeroEconomico, String(x.viajes), m3(x.m3), min(x.cicloPromMin), min(x.tiempoObraPromMin)]),
      },
      {
        id: 'conductor',
        titulo: 'Por conductor',
        columnas: ['Conductor', 'Viajes', 'm³', 'Ciclo promedio'],
        filas: orden(d.porConductor).filter((x) => pasa(x.nombre)).map((x) => [x.nombre, String(x.viajes), m3(x.m3), min(x.cicloPromMin)]),
      },
      {
        id: 'cliente',
        titulo: 'Por cliente',
        columnas: ['Cliente', 'Viajes', 'm³', 'Ciclo promedio', 'Tiempo en obra'],
        filas: orden(d.porCliente).filter((x) => pasa(x.nombre)).map((x) => [x.nombre, String(x.viajes), m3(x.m3), min(x.cicloPromMin), min(x.tiempoObraPromMin)]),
      },
      {
        id: 'vendedor',
        titulo: 'Por vendedor',
        columnas: ['Vendedor', 'Viajes', 'm³'],
        filas: orden(d.porVendedor).filter((x) => pasa(x.nombre)).map((x) => [x.nombre, String(x.viajes), m3(x.m3)]),
      },
      {
        id: 'prolongados',
        titulo: `Prolongados en obra (más de ${MINUTOS_PROLONGADO} min)`,
        columnas: ['Viaje', 'Orden', 'Unidad', 'Cliente · obra', 'Llegó', 'En obra'],
        filas: [...d.prolongados]
          .sort((a, b) => b.minutos - a.minutos)
          .filter((x) => pasa(`${x.folio} ${x.pedidoFolio} ${x.numeroEconomico} ${x.clienteNombre}`))
          .map((x) => [x.folio, x.pedidoFolio, x.numeroEconomico, `${x.clienteNombre} · ${x.obraNombre}`, this.fechaHora(x.llegadaEn), min(x.minutos)]),
      },
    ];
  });
  private fechaHora(iso: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }

  // ---------- Exportar ----------
  protected readonly generando = signal(false);
  protected exportarCsv(): void {
    const d = this.d()!;
    const resumen = [
      ['Remisiones', String(d.totales.remisiones)],
      ['m³ entregados', m3(d.totales.m3)],
      ['Viajes terminados', String(d.totales.viajesTerminados)],
      ['Ciclo promedio', min(d.totales.cicloPromMin)],
      ['Tiempo en obra promedio', min(d.totales.tiempoObraPromMin)],
      ['Prolongados en obra', String(d.totales.prolongados)],
    ];
    const partes = [csv(['Indicador', 'Valor'], resumen), ...this.tablas().map((t) => csv([t.titulo, ...t.columnas.slice(1)], t.filas))];
    // Un solo archivo: cada tabla con su encabezado (sin repetir el BOM)
    descargar(`indicadores-logistica-${this.periodo().desde}-${this.periodo().hasta}.csv`, partes.map((p, i) => (i ? p.replace(/^﻿/, '') : p)).join('\r\n\r\n'));
  }

  protected async exportarPdf(): Promise<void> {
    const d = this.d()!;
    this.generando.set(true);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const m = 48;
      const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      doc.setFont('helvetica', 'bold').setFontSize(16).text('Indicadores de logística', m, m);
      doc.setFont('helvetica', 'normal').setFontSize(10).text(`${this.textoPeriodo()} · ${this.plantaElegida()?.nombre ?? 'Todas las plantas'}`, m, m + 16);
      autoTable(doc, {
        startY: m + 28,
        head: [['Remisiones', 'm³', 'Viajes', 'Ciclo prom.', 'En obra prom.', 'Prolongados']],
        body: [[String(d.totales.remisiones), m3(d.totales.m3), String(d.totales.viajesTerminados), min(d.totales.cicloPromMin), min(d.totales.tiempoObraPromMin), String(d.totales.prolongados)]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [26, 26, 28] },
        margin: { left: m, right: m },
      });
      for (const t of this.tablas()) {
        if (!t.filas.length) continue;
        doc.setFont('helvetica', 'bold').setFontSize(11).text(t.titulo, m, finalY() + 24);
        autoTable(doc, {
          startY: finalY() + 30,
          head: [t.columnas],
          body: t.filas,
          styles: { fontSize: 8.5 },
          headStyles: { fillColor: [211, 24, 30] },
          margin: { left: m, right: m },
        });
      }
      doc.save(`indicadores-logistica-${this.periodo().desde}-${this.periodo().hasta}.pdf`);
    } finally {
      this.generando.set(false);
    }
  }
}
