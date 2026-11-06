import { Component, computed, inject, signal } from '@angular/core';
import { ArrowDown, ArrowUp, ArrowUpDown, ChartColumn, Download, List, Table2, Zap } from 'lucide';
import { Icon, fechaHoraCorta } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA } from '../../layout/vista-completa';
import { FiltrosReporte, FiltrosReporteBarra, filtrosIniciales, rangoComparado, textoComparado } from './filtros-reporte';
import { Grafica, Serie, TipoGrafica } from './grafica';
import { IndicadoresReporte } from './indicadores-reporte';
import {
  DE_TIEMPO,
  DIMENSIONES,
  Dimension,
  DimensionSerie,
  LineaVenta,
  MEDIDAS,
  Medida,
  Periodo,
  Rango,
  agrupar,
  csv,
  descargar,
  fechaCorta,
  filtrar,
  granularidad,
  medir,
  nombreDe,
  textoRango,
} from './reporte-datos';
import { ReporteFuente } from './reporte-fuente';

type Vista = 'grafica' | 'tabla' | 'lista';
type ColumnaLista = 'fecha' | 'folio' | 'planta' | 'cliente' | 'producto' | 'm3' | 'importe' | 'vendedor';

/** Cómo se ve el análisis (los filtros van aparte, en FiltrosReporte). */
interface Analisis {
  medida: Medida;
  filas: Dimension;
  columnas: DimensionSerie | '';
  tipo: TipoGrafica;
  apilado: boolean;
  orden: 'desc' | 'asc';
}

interface Rapido {
  nombre: string;
  vista: Vista;
  periodo: Exclude<Periodo, 'personalizado'>;
  analisis: Partial<Analisis>;
}

/** Los reportes que más se piden, a un clic. */
const RAPIDOS: Rapido[] = [
  { nombre: 'Ventas por planta, este mes', vista: 'grafica', periodo: 'este-mes', analisis: { filas: 'planta', columnas: '', medida: 'importe', tipo: 'participacion' } },
  { nombre: 'Tendencia por planta, 12 meses', vista: 'grafica', periodo: 'ultimos-12', analisis: { filas: 'mes', columnas: 'planta', medida: 'importe', tipo: 'lineas' } },
  { nombre: 'm³ por producto, este año', vista: 'grafica', periodo: 'este-anio', analisis: { filas: 'producto', columnas: '', medida: 'm3', tipo: 'participacion' } },
  { nombre: 'Mejores clientes, 12 meses', vista: 'grafica', periodo: 'ultimos-12', analisis: { filas: 'cliente', columnas: '', medida: 'importe', tipo: 'participacion' } },
  { nombre: 'Vendedores por planta, trimestre', vista: 'tabla', periodo: 'este-trimestre', analisis: { filas: 'vendedor', columnas: 'planta', medida: 'importe', tipo: 'barras' } },
  { nombre: 'Precio por m³ por planta, 12 meses', vista: 'grafica', periodo: 'ultimos-12', analisis: { filas: 'mes', columnas: 'planta', medida: 'precio', tipo: 'lineas' } },
];

const ANALISIS_INICIAL: Analisis = { medida: 'importe', filas: 'mes', columnas: '', tipo: 'barras', apilado: true, orden: 'desc' };

/**
 * Ventas → Reportes → Ventas: el Análisis de ventas, como en Odoo, con tres vistas del mismo cálculo: Gráfica (barras,
 * líneas o participación), Tabla dinámica (filas × columnas con totales) y Lista (cada línea, ordenable). Reportes
 * rápidos a un clic; filtros (filtros-reporte.ts); indicadores con su variación; y descarga a hoja de cálculo (CSV)
 * de lo que se ve.
 */
@Component({
  selector: 'app-reporte-ventas',
  imports: [EnEncabezado, FiltrosReporteBarra, Grafica, Icon, IndicadoresReporte],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon">Análisis de ventas</h1>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl bg-carbon/6 p-1" role="group" aria-label="Vista">
            @for (v of vistas; track v.id) {
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico"
                [class]="vista() === v.id ? 'bg-white text-carbon shadow-sm' : 'text-texto-suave hover:text-carbon'"
                [attr.aria-pressed]="vista() === v.id"
                (click)="vista.set(v.id)"
              >
                <ui-icon [icono]="v.icono" [tamano]="16" /><span class="max-sm:sr-only">{{ v.nombre }}</span>
              </button>
            }
          </div>
          <button type="button" [class]="botonSecundario" (click)="exportar()">
            <ui-icon [icono]="iconos.descargar" [tamano]="16" />Hoja de cálculo
          </button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div class="grid min-w-0 gap-4">
          <app-filtros-reporte [(filtros)]="filtros" [resumen]="resumen()" (rangoCambiado)="ajustarGranularidad($event)">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="mr-1 inline-flex items-center gap-1 text-xs font-bold tracking-wide text-texto-suave uppercase">
                <ui-icon [icono]="iconos.rapido" [tamano]="14" />Reportes rápidos
              </span>
              @for (r of rapidos; track r.nombre) {
                <button type="button" [class]="chip" (click)="aplicarRapido(r)">{{ r.nombre }}</button>
              }
            </div>
          </app-filtros-reporte>

          <app-indicadores-reporte [indicadores]="indicadores()" [comparado]="comparado()" />

          <section class="glass min-w-0 p-4 sm:p-5" [attr.aria-label]="tituloVista()">
            <div class="flex flex-wrap items-end gap-3">
              <div>
                <label for="reporte-medida" [class]="etiqueta">Medida</label>
                <select id="reporte-medida" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ medida: $any($event.target).value })">
                  @for (m of medidas; track m.id) {
                    <option [value]="m.id" [selected]="a().medida === m.id">{{ m.nombre }}</option>
                  }
                </select>
              </div>
              @if (vista() !== 'lista') {
                <div>
                  <label for="reporte-filas" [class]="etiqueta">{{ vista() === 'grafica' ? 'Agrupar por' : 'Filas' }}</label>
                  <select id="reporte-filas" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ filas: $any($event.target).value })">
                    @for (d of dimensiones; track d.id) {
                      <option [value]="d.id" [selected]="a().filas === d.id">{{ d.nombre }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="reporte-columnas" [class]="etiqueta">{{ vista() === 'grafica' ? 'Separar por' : 'Columnas' }}</label>
                  <select id="reporte-columnas" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ columnas: $any($event.target).value })">
                    <option value="" [selected]="!a().columnas">Sin separar</option>
                    @for (d of series; track d.id) {
                      <option [value]="d.id" [selected]="a().columnas === d.id">{{ d.nombre }}</option>
                    }
                  </select>
                </div>
                @if (!deTiempo()) {
                  <div>
                    <label for="reporte-orden" [class]="etiqueta">Orden</label>
                    <select id="reporte-orden" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ orden: $any($event.target).value })">
                      <option value="desc" [selected]="a().orden === 'desc'">De mayor a menor</option>
                      <option value="asc" [selected]="a().orden === 'asc'">De menor a mayor</option>
                    </select>
                  </div>
                }
              }
              @if (vista() === 'grafica') {
                <div>
                  <p id="reporte-tipo" [class]="etiqueta">Tipo</p>
                  <div class="mt-1 inline-flex rounded-xl bg-carbon/6 p-1" role="group" aria-labelledby="reporte-tipo">
                    @for (t of tipos; track t.id) {
                      <button
                        type="button"
                        class="h-7 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico"
                        [class]="a().tipo === t.id ? 'bg-white text-carbon shadow-sm' : 'text-texto-suave hover:text-carbon'"
                        [attr.aria-pressed]="a().tipo === t.id"
                        (click)="poner({ tipo: t.id })"
                      >
                        {{ t.nombre }}
                      </button>
                    }
                  </div>
                </div>
                @if (puedeApilar()) {
                  <label class="flex h-9 items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" class="casilla" [checked]="a().apilado" (change)="poner({ apilado: $any($event.target).checked })" />Apilar
                  </label>
                }
              }
            </div>

            <h2 class="mt-5 font-bold">{{ tituloVista() }}</h2>

            @if (!lineas().length) {
              <p class="py-16 text-center text-texto-suave">Sin ventas con estos filtros. Prueba otro periodo o quita filtros.</p>
            } @else {
              @switch (vista()) {
                @case ('grafica') {
                  <app-grafica
                    class="mt-3"
                    [etiquetas]="etiquetas()"
                    [series]="seriesGrafica()"
                    [tipo]="a().tipo"
                    [apilado]="a().apilado && puedeApilar()"
                    [formato]="medidaInfo().formato"
                    [corto]="medidaInfo().corto"
                    [sumable]="medidaInfo().sumable"
                    [titulo]="tituloVista()"
                  />
                  @if (tabla().filas.at(-1)?.nombre === 'Otros') {
                    <p class="mt-2 text-sm text-texto-suave">Se muestran los primeros {{ maximo - 1 }}; el resto va en "Otros" (la tabla dinámica los tiene todos).</p>
                  }
                }
                @case ('tabla') {
                  <div class="mt-3 overflow-x-auto" tabindex="0" role="region" [attr.aria-label]="'Tabla: ' + tituloVista()">
                    <table class="w-full text-left text-sm whitespace-nowrap">
                      <caption class="sr-only">{{ tituloVista() }}, con totales.</caption>
                      <thead class="border-b border-acero/80">
                        <tr>
                          <th scope="col" class="py-2 pr-4 font-semibold">{{ dimensionNombre() }}</th>
                          @for (c of tablaCompleta().columnas; track c.id) {
                            <th scope="col" class="px-3 py-2 text-right font-semibold">
                              @if (a().columnas) {
                                <span class="mr-1.5 inline-block size-2.5 rounded-sm align-middle" [style.background]="c.color" aria-hidden="true"></span>
                              }
                              {{ c.nombre }}
                            </th>
                          }
                          @if (a().columnas) {
                            <th scope="col" class="px-3 py-2 text-right font-semibold">Total</th>
                          }
                          @if (medidaInfo().sumable) {
                            <th scope="col" class="py-2 pl-3 text-right font-semibold">% del total</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (f of tablaCompleta().filas; track f.id; let i = $index) {
                          <tr class="border-b border-acero/40 hover:bg-carbon/3">
                            <th scope="row" class="py-1.5 pr-4 font-medium">{{ f.nombre }}</th>
                            @for (v of tablaCompleta().celdas[i]; track $index) {
                              <td class="px-3 py-1.5 text-right tabular-nums" [class.text-texto-suave]="!v">{{ v ? formato(v) : '—' }}</td>
                            }
                            @if (a().columnas) {
                              <td class="px-3 py-1.5 text-right font-semibold tabular-nums">{{ formato(tablaCompleta().totalFila[i]) }}</td>
                            }
                            @if (medidaInfo().sumable) {
                              <td class="py-1.5 pl-3 text-right text-texto-suave tabular-nums">{{ porcentaje(tablaCompleta().totalFila[i]) }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                      <tfoot class="border-t-2 border-acero-oscuro/60 font-bold">
                        <tr>
                          <th scope="row" class="py-2 pr-4">Total</th>
                          @for (v of tablaCompleta().totalColumna; track $index) {
                            <td class="px-3 py-2 text-right tabular-nums">{{ formato(v) }}</td>
                          }
                          @if (a().columnas) {
                            <td class="px-3 py-2 text-right tabular-nums">{{ formato(tablaCompleta().total) }}</td>
                          }
                          @if (medidaInfo().sumable) {
                            <td class="py-2 pl-3 text-right tabular-nums">100 %</td>
                          }
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                }
                @case ('lista') {
                  <div class="mt-3 overflow-x-auto" tabindex="0" role="region" aria-label="Líneas de venta">
                    <table class="w-full text-left text-sm whitespace-nowrap">
                      <caption class="sr-only">Cada línea de venta del periodo. Los encabezados ordenan.</caption>
                      <thead class="border-b border-acero/80">
                        <tr>
                          @for (c of columnasLista; track c.id) {
                            <th scope="col" class="py-1" [class.text-right]="c.numero" [attr.aria-sort]="orden().columna === c.id ? (orden().asc ? 'ascending' : 'descending') : null">
                              <button type="button" class="inline-flex h-8 items-center gap-1 rounded px-2 font-semibold hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico" (click)="ordenarPor(c.id)">
                                {{ c.nombre }}
                                <ui-icon [icono]="orden().columna === c.id ? (orden().asc ? iconos.arriba : iconos.abajo) : iconos.ordenar" [tamano]="14" class="text-texto-suave" />
                              </button>
                            </th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (l of listaVisible(); track $index) {
                          <tr class="border-b border-acero/40 hover:bg-carbon/3">
                            <td class="px-2 py-1.5 tabular-nums">{{ fechaCorta(l.fecha) }}</td>
                            <td class="px-2 py-1.5 tabular-nums">{{ l.folio }}</td>
                            <td class="px-2 py-1.5">{{ nombre('planta', l.plantaId) }}</td>
                            <td class="px-2 py-1.5">{{ nombre('cliente', l.clienteId) }}</td>
                            <td class="px-2 py-1.5">{{ nombre('producto', l.productoId) }}</td>
                            <td class="px-2 py-1.5 text-right tabular-nums">{{ l.m3 ? l.m3 : '—' }}</td>
                            <td class="px-2 py-1.5 text-right tabular-nums">{{ dinero(l.importe) }}</td>
                            <td class="px-2 py-1.5">{{ nombre('vendedor', l.vendedorId) }}</td>
                          </tr>
                        }
                      </tbody>
                      <tfoot class="border-t-2 border-acero-oscuro/60 font-bold">
                        <tr>
                          <th scope="row" colspan="5" class="px-2 py-2">Total · {{ lineas().length.toLocaleString('es-MX') }} líneas</th>
                          <td class="px-2 py-2 text-right tabular-nums">{{ m3(totalM3()) }}</td>
                          <td class="px-2 py-2 text-right tabular-nums">{{ dinero(totalImporte()) }}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  @if (listaVisible().length < lineas().length) {
                    <button type="button" class="mt-3 inline-flex h-9 items-center rounded-lg px-3 font-semibold text-epico-oscuro hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico" (click)="limite.set(limite() + 100)">
                      Mostrar 100 más ({{ listaVisible().length }} de {{ lineas().length.toLocaleString('es-MX') }})
                    </button>
                  }
                }
              }
            }
          </section>
          <p class="px-1 text-xs text-texto-suave">Actualizado {{ actualizado }}. Las órdenes canceladas no cuentan.</p>
        </div>
      </div>
    </div>
  `,
})
export default class ReporteVentas {
  private readonly fuente = inject(ReporteFuente);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly iconos = { descargar: Download, rapido: Zap, arriba: ArrowUp, abajo: ArrowDown, ordenar: ArrowUpDown };
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly chip =
    'inline-flex h-8 items-center rounded-full border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-epico/60 hover:text-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly vistas = [
    { id: 'grafica' as const, nombre: 'Gráfica', icono: ChartColumn },
    { id: 'tabla' as const, nombre: 'Tabla dinámica', icono: Table2 },
    { id: 'lista' as const, nombre: 'Lista', icono: List },
  ];
  protected readonly tipos: { id: TipoGrafica; nombre: string }[] = [
    { id: 'barras', nombre: 'Barras' },
    { id: 'lineas', nombre: 'Líneas' },
    { id: 'participacion', nombre: 'Participación' },
  ];
  protected readonly rapidos = RAPIDOS;
  protected readonly medidas = (Object.keys(MEDIDAS) as Medida[]).map((id) => ({ id, ...MEDIDAS[id] }));
  protected readonly dimensiones = (Object.keys(DIMENSIONES) as Dimension[]).map((id) => ({ id, nombre: DIMENSIONES[id] }));
  protected readonly series: { id: DimensionSerie; nombre: string }[] = [
    { id: 'planta', nombre: 'Planta' },
    { id: 'categoria', nombre: 'Categoría' },
    { id: 'vendedor', nombre: 'Vendedor' },
  ];
  protected readonly columnasLista: { id: ColumnaLista; nombre: string; numero?: boolean }[] = [
    { id: 'fecha', nombre: 'Fecha' },
    { id: 'folio', nombre: 'Orden' },
    { id: 'planta', nombre: 'Planta' },
    { id: 'cliente', nombre: 'Cliente' },
    { id: 'producto', nombre: 'Producto' },
    { id: 'm3', nombre: 'm³', numero: true },
    { id: 'importe', nombre: 'Importe', numero: true },
    { id: 'vendedor', nombre: 'Vendedor' },
  ];
  protected readonly fechaCorta = fechaCorta;
  protected readonly actualizado = fechaHoraCorta(new Date().toISOString());
  /** En la gráfica, las primeras N filas (que no sean de tiempo) y el resto en "Otros". */
  protected readonly maximo = 12;

  // ---------- Estado ----------

  protected readonly vista = signal<Vista>('grafica');
  protected readonly filtros = signal<FiltrosReporte>(filtrosIniciales());
  protected readonly a = signal<Analisis>(ANALISIS_INICIAL);

  protected poner(c: Partial<Analisis>): void {
    this.a.update((a) => ({ ...a, ...c }));
    this.limite.set(100);
  }

  /** Al cambiar de periodo, si se agrupa por tiempo, al mes, semana o día que le queda. */
  protected ajustarGranularidad(r: Rango): void {
    if (DE_TIEMPO.includes(this.a().filas)) this.poner({ filas: granularidad(r) });
  }

  protected aplicarRapido(r: Rapido): void {
    this.filtros.set({ ...filtrosIniciales(r.periodo), comparar: this.filtros().comparar });
    this.a.set({ ...ANALISIS_INICIAL, ...r.analisis });
    this.vista.set(r.vista);
  }

  // ---------- Datos ----------

  protected readonly lineas = computed(() => filtrar(this.fuente.lineas(), this.filtros()));
  private readonly anteriores = computed(() => filtrar(this.fuente.lineas(), { ...this.filtros(), ...rangoComparado(this.filtros()) }));
  protected readonly comparado = computed(() => textoComparado(this.filtros()));
  protected readonly resumen = computed(() => {
    const f = this.filtros();
    return `${textoRango(f)} · ${this.lineas().length.toLocaleString('es-MX')} líneas de ${medir(this.lineas(), 'ordenes').toLocaleString('es-MX')} órdenes · comparado con ${textoRango(rangoComparado(f))}. Importes sin IVA, por fecha de entrega.`;
  });

  protected readonly indicadores = computed(() =>
    (['importe', 'm3', 'ordenes', 'precio'] as Medida[]).map((medida) => {
      const actual = medir(this.lineas(), medida);
      return { nombre: MEDIDAS[medida].nombre, valor: MEDIDAS[medida].formato(actual), actual, antes: medir(this.anteriores(), medida) };
    }),
  );

  protected readonly medidaInfo = computed(() => MEDIDAS[this.a().medida]);
  protected readonly deTiempo = computed(() => DE_TIEMPO.includes(this.a().filas));
  protected readonly puedeApilar = computed(() => this.a().tipo === 'barras' && !!this.a().columnas && this.medidaInfo().sumable);
  protected readonly dimensionNombre = computed(() => DIMENSIONES[this.a().filas]);
  protected readonly tituloVista = computed(() => {
    const a = this.a();
    const rango = textoRango(this.filtros());
    if (this.vista() === 'lista') return `Líneas de venta · ${rango}`;
    const por = a.columnas ? ` y ${DIMENSIONES[a.columnas].toLowerCase()}` : '';
    return `${MEDIDAS[a.medida].nombre} por ${DIMENSIONES[a.filas].toLowerCase()}${por} · ${rango}`;
  });

  private opciones(maximo?: number) {
    const a = this.a();
    const f = this.filtros();
    return { filas: a.filas, columnas: a.columnas || null, medida: a.medida, rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres(), orden: a.orden, maximo };
  }
  /** Para la gráfica: las primeras N y "Otros". */
  protected readonly tabla = computed(() => agrupar(this.lineas(), this.opciones(this.maximo)));
  /** Para la tabla dinámica y el CSV: todas las filas. */
  protected readonly tablaCompleta = computed(() => agrupar(this.lineas(), this.opciones()));
  protected readonly etiquetas = computed(() => this.tabla().filas.map((f) => f.nombre));
  protected readonly seriesGrafica = computed<Serie[]>(() => {
    const t = this.tabla();
    return t.columnas.map((c, j) => ({ id: c.id, nombre: c.nombre, color: c.color!, valores: t.celdas.map((fila) => fila[j]) }));
  });

  protected formato(n: number): string {
    return this.medidaInfo().formato(n);
  }
  protected dinero(n: number): string {
    return MEDIDAS.importe.formato(n);
  }
  protected m3(n: number): string {
    return MEDIDAS.m3.formato(n);
  }
  protected porcentaje(n: number): string {
    const total = this.tablaCompleta().total;
    return total ? `${((n / total) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %` : '—';
  }
  protected nombre(d: Dimension, id: string): string {
    return nombreDe(d, id, this.fuente.nombres());
  }

  // ---------- Lista ----------

  protected readonly orden = signal<{ columna: ColumnaLista; asc: boolean }>({ columna: 'fecha', asc: false });
  protected readonly limite = signal(100);
  protected ordenarPor(c: ColumnaLista): void {
    const o = this.orden();
    this.orden.set({ columna: c, asc: o.columna === c ? !o.asc : c !== 'fecha' && c !== 'importe' && c !== 'm3' });
  }
  private readonly listaOrdenada = computed(() => {
    const { columna, asc } = this.orden();
    const valor = (l: LineaVenta): string | number => {
      switch (columna) {
        case 'm3':
          return l.m3;
        case 'importe':
          return l.importe;
        case 'fecha':
          return l.fecha + l.folio;
        case 'folio':
          return l.folio;
        default:
          return this.nombre(columna, columna === 'planta' ? l.plantaId : columna === 'cliente' ? l.clienteId : columna === 'producto' ? l.productoId : l.vendedorId);
      }
    };
    return [...this.lineas()].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const dif = typeof va === 'number' ? va - (vb as number) : va.localeCompare(vb as string);
      return asc ? dif : -dif;
    });
  });
  protected readonly listaVisible = computed(() => this.listaOrdenada().slice(0, this.limite()));
  protected readonly totalM3 = computed(() => medir(this.lineas(), 'm3'));
  protected readonly totalImporte = computed(() => medir(this.lineas(), 'importe'));

  // ---------- Hoja de cálculo ----------

  /** La lista (cada línea) o la tabla dinámica completa, según la vista. */
  protected exportar(): void {
    const { desde, hasta } = this.filtros();
    if (this.vista() === 'lista') {
      const filas = this.listaOrdenada().map((l) => [
        l.fecha,
        l.folio,
        this.nombre('planta', l.plantaId),
        this.nombre('cliente', l.clienteId),
        this.nombre('producto', l.productoId),
        this.nombre('categoria', l.categoria),
        l.cantidad,
        l.unidad,
        l.m3,
        l.importe,
        this.nombre('vendedor', l.vendedorId),
      ]);
      const encabezados = ['Fecha', 'Orden', 'Planta', 'Cliente', 'Producto', 'Categoría', 'Cantidad', 'Unidad', 'm³', 'Importe sin IVA', 'Vendedor'];
      return descargar(`ventas-lineas_${desde}_${hasta}.csv`, csv(encabezados, filas));
    }
    const t = this.tablaCompleta();
    const conColumnas = !!this.a().columnas;
    const encabezados = [this.dimensionNombre(), ...t.columnas.map((c) => c.nombre), ...(conColumnas ? ['Total'] : [])];
    const filas = t.filas.map((f, i) => [f.nombre, ...t.celdas[i], ...(conColumnas ? [t.totalFila[i]] : [])]);
    filas.push(['Total', ...t.totalColumna, ...(conColumnas ? [t.total] : [])]);
    descargar(`ventas-${this.a().medida}-por-${this.a().filas}_${desde}_${hasta}.csv`, csv(encabezados, filas));
  }
}
