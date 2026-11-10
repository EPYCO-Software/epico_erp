import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Download } from 'lucide';
import { Icon } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA } from '../../layout/vista-completa';
import { FiltrosReporte, FiltrosReporteBarra, filtrosIniciales, rangoComparado, textoComparado } from './filtros-reporte';
import { Grafica, TipoGrafica } from './grafica';
import { Indicador, IndicadoresReporte } from './indicadores-reporte';
import {
  MEDIDAS,
  Medida,
  Resumen,
  aSeries,
  agrupar,
  claseVariacion,
  colorDe,
  contraLista,
  descargar,
  filtrar,
  granularidad,
  medir,
  nombreDe,
  porcentaje,
  resumir,
  textoRango,
  textoVariacion,
  variacion,
} from './reporte-datos';
import { ReporteFuente } from './reporte-fuente';
import { ColumnaReporte, TablaReporte, csvDeTabla } from './tabla-reporte';

type Modo = 'evolucion' | 'plantas' | 'participacion';

interface FilaVendedor extends Resumen {
  participacion: number;
  variacion: number | null;
  vsLista: number | null;
}

const MODOS: { id: Modo; nombre: string; tipo: TipoGrafica }[] = [
  { id: 'evolucion', nombre: 'Evolución', tipo: 'lineas' },
  { id: 'plantas', nombre: 'Por planta', tipo: 'barras' },
  { id: 'participacion', nombre: 'Participación', tipo: 'participacion' },
];

const sinSigno = (v: number | null) => (v === null ? '—' : textoVariacion(v));

/**
 * Ventas → Reportes → Vendedores: desempeño del equipo comercial. Indicadores (importe, vendedores con ventas, ticket
 * promedio, precio obtenido contra lista); gráfica de evolución por vendedor, por planta o su participación; ranking
 * ordenable (importe, participación, variación contra la comparación, m³, órdenes, ticket, clientes, precio por m³ y
 * descuento contra lista); y el detalle del vendedor elegido: su tendencia, sus principales clientes y su mezcla de
 * productos. Hoja de cálculo: el ranking.
 */
@Component({
  selector: 'app-reporte-vendedores',
  imports: [EnEncabezado, FiltrosReporteBarra, Grafica, Icon, IndicadoresReporte, TablaReporte],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon">Reporte de vendedores</h1>
        <button type="button" [class]="botonSecundario + ' ml-auto'" (click)="exportar()">
          <ui-icon [icono]="iconoDescargar" [tamano]="16" />Hoja de cálculo
        </button>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div class="grid min-w-0 gap-4">
          <app-filtros-reporte [(filtros)]="filtros" [ocultar]="['vendedor']" [resumen]="resumen()" />
          <app-indicadores-reporte [indicadores]="indicadores()" [comparado]="comparado()" />

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="vendedores-grafica">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <h2 id="vendedores-grafica" class="font-bold">{{ tituloGrafica() }}</h2>
              <div class="flex flex-wrap items-end gap-3">
                <div>
                  <label for="vendedores-medida" [class]="etiqueta">Medida</label>
                  <select id="vendedores-medida" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="medida.set($any($event.target).value)">
                    @for (m of medidas; track m.id) {
                      <option [value]="m.id" [selected]="medida() === m.id">{{ m.nombre }}</option>
                    }
                  </select>
                </div>
                <div class="inline-flex rounded-xl bg-carbon/6 p-1" role="group" aria-label="Qué ver">
                  @for (m of modos; track m.id) {
                    <button type="button" [class]="segmento(modo() === m.id)" [attr.aria-pressed]="modo() === m.id" (click)="modo.set(m.id)">{{ m.nombre }}</button>
                  }
                </div>
              </div>
            </div>
            @if (lineas().length) {
              <app-grafica
                class="mt-4"
                [etiquetas]="grafica().etiquetas"
                [series]="grafica().series"
                [tipo]="modoInfo().tipo"
                [apilado]="modo() === 'plantas' && medidaInfo().sumable"
                [formato]="medidaInfo().formato"
                [corto]="medidaInfo().corto"
                [sumable]="medidaInfo().sumable"
                [titulo]="tituloGrafica()"
              />
            } @else {
              <p class="py-16 text-center text-texto-suave">Sin ventas con estos filtros.</p>
            }
          </section>

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="vendedores-ranking">
            <h2 id="vendedores-ranking" class="font-bold">Ranking · {{ rango() }}</h2>
            <p class="mt-1 text-sm text-texto-suave">
              "vs. lista": cuánto arriba (+) o abajo (−) del precio de lista se vendió. Elige un vendedor para ver su detalle.
            </p>
            <app-tabla-reporte class="mt-3" titulo="Ranking de vendedores" [columnas]="columnas()" [filas]="filas()" [clave]="clave" ordenInicial="importe" [(seleccion)]="seleccion" />
          </section>

          @if (elegido(); as v) {
            <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="vendedor-detalle">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="vendedor-detalle" class="flex items-center gap-2 font-bold">
                  <span class="size-3 rounded-sm" [style.background]="colorVendedor()" aria-hidden="true"></span>{{ v.nombre }}
                </h2>
                <p class="text-sm text-texto-suave">
                  {{ dinero(v.importe) }} · {{ v.ordenes }} órdenes · {{ v.clientes }} clientes · {{ porcentaje(v.participacion) }} del total
                </p>
              </div>
              <div class="mt-4 grid gap-4 lg:grid-cols-2">
                <div [class]="tarjeta + ' lg:col-span-2'">
                  <h3 class="text-sm font-bold">Importe en el periodo</h3>
                  <app-grafica class="mt-2" [etiquetas]="detalle().tendencia.etiquetas" [series]="detalle().tendencia.series" [formato]="dinero" [corto]="corto" [altura]="240" [titulo]="'Importe de ' + v.nombre" />
                </div>
                <div [class]="tarjeta">
                  <h3 class="text-sm font-bold">Sus principales clientes</h3>
                  <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().clientes.etiquetas" [series]="detalle().clientes.series" [formato]="dinero" [corto]="corto" [titulo]="'Clientes de ' + v.nombre" />
                </div>
                <div [class]="tarjeta">
                  <h3 class="text-sm font-bold">Mezcla de productos (m³)</h3>
                  <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().productos.etiquetas" [series]="detalle().productos.series" [formato]="m3" [corto]="corto" [titulo]="'Productos de ' + v.nombre" />
                </div>
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
})
export default class ReporteVendedores {
  private readonly fuente = inject(ReporteFuente);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly iconoDescargar = Download;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly tarjeta = 'min-w-0 rounded-2xl border border-acero/60 bg-white/70 p-4';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected segmento(activo: boolean): string {
    return (
      'h-8 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico ' +
      (activo ? 'bg-white text-carbon shadow-sm' : 'text-texto-suave hover:text-carbon')
    );
  }
  protected readonly modos = MODOS;
  protected readonly medidas = (['importe', 'm3', 'ordenes', 'clientes'] as Medida[]).map((id) => ({ id, nombre: MEDIDAS[id].nombre }));
  protected readonly porcentaje = porcentaje;
  protected readonly dinero = MEDIDAS.importe.formato;
  protected readonly m3 = MEDIDAS.m3.formato;
  protected readonly corto = MEDIDAS.importe.corto;
  protected readonly clave = (f: FilaVendedor) => f.id;

  protected readonly filtros = signal<FiltrosReporte>(filtrosIniciales());
  protected readonly modo = signal<Modo>('evolucion');
  protected readonly medida = signal<Medida>('importe');

  protected readonly lineas = computed(() => filtrar(this.fuente.lineas(), this.filtros()));
  private readonly anteriores = computed(() => filtrar(this.fuente.lineas(), { ...this.filtros(), ...rangoComparado(this.filtros()) }));
  protected readonly comparado = computed(() => textoComparado(this.filtros()));
  protected readonly rango = computed(() => textoRango(this.filtros()));
  protected readonly resumen = computed(
    () => `${this.rango()} · ${this.filas().length} vendedores con ventas · comparado con ${textoRango(rangoComparado(this.filtros()))}. Importes sin IVA.`,
  );

  // ---------- Ranking ----------

  private readonly actual = computed(() => resumir(this.lineas(), 'vendedor', this.fuente.nombres(), this.fuente.precios()));
  private readonly antes = computed(() => new Map(resumir(this.anteriores(), 'vendedor', this.fuente.nombres(), this.fuente.precios()).map((r) => [r.id, r])));
  protected readonly filas = computed<FilaVendedor[]>(() => {
    const total = medir(this.lineas(), 'importe');
    return this.actual().map((r) => ({
      ...r,
      participacion: total ? (r.importe / total) * 100 : 0,
      variacion: variacion(r.importe, this.antes().get(r.id)?.importe ?? 0),
      vsLista: contraLista(r),
    }));
  });

  protected readonly columnas = computed<ColumnaReporte<FilaVendedor>[]>(() => {
    const l = this.lineas();
    const total = { importe: medir(l, 'importe'), m3: medir(l, 'm3'), ordenes: medir(l, 'ordenes'), clientes: medir(l, 'clientes') };
    const lista = this.filas().reduce((t, f) => t + f.lista, 0);
    return [
      { id: 'nombre', nombre: 'Vendedor', valor: (f) => f.nombre },
      { id: 'importe', nombre: 'Importe', numero: true, valor: (f) => f.importe, texto: (f) => this.dinero(f.importe), pie: this.dinero(total.importe) },
      { id: 'participacion', nombre: '% del total', numero: true, valor: (f) => f.participacion, texto: (f) => porcentaje(f.participacion), pie: '100 %' },
      {
        id: 'variacion',
        nombre: 'Variación',
        ayuda: `Contra ${this.comparado()}`,
        numero: true,
        valor: (f) => f.variacion ?? -Infinity,
        texto: (f) => textoVariacion(f.variacion),
        clase: (f) => claseVariacion(f.variacion),
        csv: (f) => (f.variacion === null ? '' : Math.round(f.variacion * 10) / 10),
        pie: textoVariacion(variacion(total.importe, medir(this.anteriores(), 'importe'))),
      },
      { id: 'm3', nombre: 'm³', numero: true, valor: (f) => f.m3, texto: (f) => this.m3(f.m3), pie: this.m3(total.m3) },
      { id: 'ordenes', nombre: 'Órdenes', numero: true, valor: (f) => f.ordenes, texto: (f) => f.ordenes.toLocaleString('es-MX'), pie: total.ordenes.toLocaleString('es-MX') },
      { id: 'ticket', nombre: 'Ticket prom.', numero: true, valor: (f) => f.ticket, texto: (f) => this.dinero(f.ticket), ayuda: 'Importe entre órdenes', pie: this.dinero(total.ordenes ? total.importe / total.ordenes : 0) },
      { id: 'clientes', nombre: 'Clientes', numero: true, valor: (f) => f.clientes, pie: String(total.clientes) },
      { id: 'precio', nombre: 'Precio por m³', numero: true, valor: (f) => f.precio, texto: (f) => this.dinero(f.precio), pie: this.dinero(medir(l, 'precio')) },
      {
        id: 'lista',
        nombre: 'vs. lista',
        numero: true,
        valor: (f) => f.vsLista ?? -Infinity,
        texto: (f) => sinSigno(f.vsLista),
        csv: (f) => (f.vsLista === null ? '' : Math.round(f.vsLista * 10) / 10),
        ayuda: 'Precio obtenido contra el precio de lista',
        pie: sinSigno(lista ? ((total.importe - lista) / lista) * 100 : null),
      },
    ];
  });

  // ---------- Indicadores ----------

  protected readonly indicadores = computed<Indicador[]>(() => {
    const l = this.lineas();
    const a = this.anteriores();
    const ticket = (x: typeof l) => (medir(x, 'ordenes') ? medir(x, 'importe') / medir(x, 'ordenes') : 0);
    const listaDe = (x: typeof l) => contraLista({ importe: medir(x, 'importe'), lista: x.reduce((t, y) => t + (this.fuente.precios()[y.productoId] ?? 0) * y.cantidad, 0) });
    const vsLista = listaDe(l);
    const vsListaAntes = listaDe(a);
    const vendedores = new Set(l.map((x) => x.vendedorId)).size;
    return [
      { nombre: 'Importe vendido (sin IVA)', valor: this.dinero(medir(l, 'importe')), actual: medir(l, 'importe'), antes: medir(a, 'importe') },
      { nombre: 'Vendedores con ventas', valor: String(vendedores), actual: vendedores, antes: new Set(a.map((x) => x.vendedorId)).size },
      { nombre: 'Ticket promedio por orden', valor: this.dinero(ticket(l)), actual: ticket(l), antes: ticket(a) },
      {
        nombre: 'Precio obtenido vs. lista',
        valor: sinSigno(vsLista),
        actual: 0,
        antes: null,
        nota: `En ${this.comparado()}: ${sinSigno(vsListaAntes)}`,
      },
    ];
  });

  // ---------- Gráfica ----------

  protected readonly modoInfo = computed(() => MODOS.find((m) => m.id === this.modo())!);
  protected readonly medidaInfo = computed(() => MEDIDAS[this.medida()]);
  protected readonly tituloGrafica = computed(() => {
    const m = this.medidaInfo().nombre;
    return { evolucion: `${m} por vendedor en el tiempo`, plantas: `${m} por vendedor y planta`, participacion: `Participación de cada vendedor (${m.toLowerCase()})` }[this.modo()];
  });
  protected readonly grafica = computed(() => {
    const f = this.filtros();
    const base = { medida: this.medida(), rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres(), orden: 'desc' as const };
    const modo = this.modo();
    if (modo === 'evolucion') return aSeries(agrupar(this.lineas(), { ...base, filas: granularidad(f), columnas: 'vendedor' }));
    if (modo === 'plantas') return aSeries(agrupar(this.lineas(), { ...base, filas: 'vendedor', columnas: 'planta' }));
    const t = aSeries(agrupar(this.lineas(), { ...base, filas: 'vendedor', columnas: null }));
    return { ...t, series: t.series.map((s) => ({ ...s, nombre: this.medidaInfo().nombre })) };
  });

  // ---------- Detalle del vendedor ----------

  /** El elegido; al inicio (o si deja de aparecer con los filtros), el primero del ranking. */
  protected readonly seleccion = linkedSignal<FilaVendedor[], string | null>({
    source: this.filas,
    computation: (filas, antes) => (antes?.value && filas.some((f) => f.id === antes.value) ? antes.value : (filas[0]?.id ?? null)),
  });
  protected readonly elegido = computed(() => this.filas().find((f) => f.id === this.seleccion()) ?? null);
  protected readonly colorVendedor = computed(() => colorDe('vendedor', this.seleccion() ?? ''));
  protected readonly detalle = computed(() => {
    const id = this.seleccion();
    const f = this.filtros();
    const suyas = this.lineas().filter((l) => l.vendedorId === id);
    const base = { columnas: null, rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres(), orden: 'desc' as const, maximo: 8 };
    const tendencia = aSeries(agrupar(suyas, { ...base, filas: granularidad(f), medida: 'importe' }));
    return {
      tendencia: { ...tendencia, series: tendencia.series.map((s) => ({ ...s, nombre: 'Importe', color: this.colorVendedor() })) },
      clientes: aSeries(agrupar(suyas, { ...base, filas: 'cliente', medida: 'importe' })),
      productos: aSeries(agrupar(suyas.filter((l) => l.m3 > 0), { ...base, filas: 'producto', medida: 'm3' })),
    };
  });

  protected nombre(id: string): string {
    return nombreDe('vendedor', id, this.fuente.nombres());
  }

  protected exportar(): void {
    const { desde, hasta } = this.filtros();
    descargar(`vendedores_${desde}_${hasta}.csv`, csvDeTabla(this.columnas(), this.filas()));
  }
}
