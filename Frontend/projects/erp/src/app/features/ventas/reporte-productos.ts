import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Download } from 'lucide';
import { CATEGORIAS_PRODUCTO, CategoriaProducto, Icon, pesos } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA } from '../../layout/vista-completa';
import { VentasService } from './datos';
import { FiltrosReporte, FiltrosReporteBarra, filtrosIniciales, rangoComparado, textoComparado } from './filtros-reporte';
import { Grafica, TipoGrafica } from './grafica';
import { Indicador, IndicadoresReporte } from './indicadores-reporte';
import {
  LineaVenta,
  MEDIDAS,
  Medida,
  Resumen,
  aSeries,
  agrupar,
  claseVariacion,
  conBombeo,
  contraLista,
  descargar,
  filtrar,
  granularidad,
  medir,
  porcentaje,
  resumir,
  textoRango,
  textoVariacion,
  variacion,
} from './reporte-datos';
import { ReporteFuente } from './reporte-fuente';
import { ColumnaReporte, TablaReporte, csvDeTabla } from './tabla-reporte';

type Grupo = 'concreto' | 'servicios' | 'todo';
type Modo = 'resistencias' | 'mezcla' | 'tendencia';

const GRUPOS: { id: Grupo; nombre: string; categorias: CategoriaProducto[] | null }[] = [
  { id: 'concreto', nombre: 'Concreto', categorias: ['concreto-fc', 'concreto-mr', 'concreto', 'ajuste'] },
  { id: 'servicios', nombre: 'Servicios', categorias: ['servicio', 'maquinaria'] },
  { id: 'todo', nombre: 'Todo', categorias: null },
];

const MODOS: { id: Modo; nombre: string; tipo: TipoGrafica }[] = [
  { id: 'resistencias', nombre: 'Por producto y planta', tipo: 'barras' },
  { id: 'mezcla', nombre: 'Mezcla', tipo: 'participacion' },
  { id: 'tendencia', nombre: 'Tendencia', tipo: 'barras' },
];

interface FilaProducto extends Resumen {
  categoria: CategoriaProducto;
  unidad: string;
  participacion: number;
  variacion: number | null;
  /** Importe / cantidad. */
  precioUnitario: number;
  precioLista: number;
  vsLista: number | null;
}

const sinSigno = (v: number | null) => (v === null ? '—' : textoVariacion(v));

/**
 * Ventas → Reportes → Productos: qué se vende. Concreto, servicios o todo. Indicadores (m³ de concreto, importe, precio
 * promedio por m³ y % de órdenes con bombeo); gráfica de m³ por producto y planta (en orden de resistencia), mezcla o
 * tendencia por categoría; tabla por producto (cantidad, importe, participación, variación, órdenes, clientes, precio
 * obtenido contra lista); y el detalle del producto elegido: su tendencia, por planta y sus principales clientes, con
 * enlace a su ficha. Hoja de cálculo: la tabla.
 */
@Component({
  selector: 'app-reporte-productos',
  imports: [EnEncabezado, FiltrosReporteBarra, Grafica, Icon, IndicadoresReporte, RouterLink, TablaReporte],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon">Reporte de productos</h1>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl bg-carbon/6 p-1" role="group" aria-label="Productos a ver">
            @for (g of grupos; track g.id) {
              <button type="button" [class]="segmento(grupo() === g.id)" [attr.aria-pressed]="grupo() === g.id" (click)="cambiarGrupo(g.id)">{{ g.nombre }}</button>
            }
          </div>
          <button type="button" [class]="botonSecundario" (click)="exportar()">
            <ui-icon [icono]="iconoDescargar" [tamano]="16" />Hoja de cálculo
          </button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div class="grid min-w-0 gap-4">
          <app-filtros-reporte [(filtros)]="filtros" [ocultar]="['producto']" [resumen]="resumen()" />
          <app-indicadores-reporte [indicadores]="indicadores()" [comparado]="comparado()" />

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="productos-grafica">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <h2 id="productos-grafica" class="font-bold">{{ tituloGrafica() }}</h2>
              <div class="flex flex-wrap items-end gap-3">
                @if (grupo() !== 'servicios') {
                  <div>
                    <label for="productos-medida" [class]="etiqueta">Medida</label>
                    <select id="productos-medida" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="medida.set($any($event.target).value)">
                      @for (m of medidas; track m.id) {
                        <option [value]="m.id" [selected]="medida() === m.id">{{ m.nombre }}</option>
                      }
                    </select>
                  </div>
                }
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
                [apilado]="modo() !== 'mezcla'"
                [formato]="medidaInfo().formato"
                [corto]="medidaInfo().corto"
                [titulo]="tituloGrafica()"
              />
              @if (grafica().etiquetas.at(-1) === 'Otros') {
                <p class="mt-2 text-sm text-texto-suave">Los de menos venta van en "Otros"; la tabla los tiene todos.</p>
              }
            } @else {
              <p class="py-16 text-center text-texto-suave">Sin ventas con estos filtros.</p>
            }
          </section>

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="productos-tabla">
            <h2 id="productos-tabla" class="font-bold">Por producto · {{ rango() }}</h2>
            <p class="mt-1 text-sm text-texto-suave">
              "Precio obtenido" es el importe entre la cantidad; "vs. lista", cuánto arriba (+) o abajo (−) del tarifario. Elige un
              producto para ver su detalle.
            </p>
            <app-tabla-reporte class="mt-3" titulo="Ventas por producto" [columnas]="columnas()" [filas]="filas()" [clave]="clave" ordenInicial="importe" [(seleccion)]="seleccion" />
          </section>

          @if (elegido(); as p) {
            <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="producto-detalle">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="producto-detalle" class="font-bold">{{ p.nombre }}</h2>
                <p class="flex flex-wrap items-baseline gap-x-3 text-sm text-texto-suave">
                  <span>{{ cantidad(p) }} · {{ dinero(p.importe) }} · {{ p.ordenes }} órdenes · {{ p.clientes }} clientes</span>
                  @if (tieneFicha()) {
                    <a [routerLink]="['/ventas/productos', p.id]" class="font-semibold text-epico-oscuro underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico">Ver producto</a>
                  }
                </p>
              </div>
              <div class="mt-4 grid gap-4 lg:grid-cols-2">
                <div [class]="tarjeta + ' lg:col-span-2'">
                  <h3 class="text-sm font-bold">{{ p.m3 ? 'm³ en el periodo' : 'Importe en el periodo' }}</h3>
                  <app-grafica class="mt-2" [etiquetas]="detalle().tendencia.etiquetas" [series]="detalle().tendencia.series" [formato]="p.m3 ? m3 : dinero" [corto]="p.m3 ? cortoM3 : corto" [altura]="240" [titulo]="'Tendencia de ' + p.nombre" />
                </div>
                <div [class]="tarjeta">
                  <h3 class="text-sm font-bold">Por planta (importe)</h3>
                  <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().plantas.etiquetas" [series]="detalle().plantas.series" [formato]="dinero" [corto]="corto" [titulo]="p.nombre + ' por planta'" />
                </div>
                <div [class]="tarjeta">
                  <h3 class="text-sm font-bold">Principales clientes (importe)</h3>
                  <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().clientes.etiquetas" [series]="detalle().clientes.series" [formato]="dinero" [corto]="corto" [titulo]="'Clientes de ' + p.nombre" />
                </div>
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
})
export default class ReporteProductos {
  private readonly fuente = inject(ReporteFuente);
  private readonly ventas = inject(VentasService);

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
  protected readonly grupos = GRUPOS;
  protected readonly modos = MODOS;
  protected readonly medidas = (['m3', 'importe', 'ordenes', 'clientes'] as Medida[]).map((id) => ({ id, nombre: MEDIDAS[id].nombre }));
  protected readonly dinero = MEDIDAS.importe.formato;
  protected readonly corto = MEDIDAS.importe.corto;
  protected readonly m3 = MEDIDAS.m3.formato;
  protected readonly cortoM3 = MEDIDAS.m3.corto;
  protected readonly clave = (f: FilaProducto) => f.id;

  protected readonly filtros = signal<FiltrosReporte>(filtrosIniciales());
  protected readonly grupo = signal<Grupo>('concreto');
  protected readonly modo = signal<Modo>('resistencias');
  /** En servicios no hay m³: va por importe. */
  protected readonly medida = linkedSignal<Grupo, Medida>({ source: this.grupo, computation: (g) => (g === 'servicios' ? 'importe' : 'm3') });

  protected cambiarGrupo(g: Grupo): void {
    this.grupo.set(g);
  }

  private readonly enGrupo = (ls: LineaVenta[]) => {
    const cats = GRUPOS.find((g) => g.id === this.grupo())!.categorias;
    return cats ? ls.filter((l) => cats.includes(l.categoria)) : ls;
  };
  /** Todas las del periodo (para el % con bombeo, que mira concreto y servicios juntos). */
  private readonly delPeriodo = computed(() => filtrar(this.fuente.lineas(), this.filtros()));
  private readonly delAnterior = computed(() => filtrar(this.fuente.lineas(), { ...this.filtros(), ...rangoComparado(this.filtros()) }));
  protected readonly lineas = computed(() => this.enGrupo(this.delPeriodo()));
  private readonly anteriores = computed(() => this.enGrupo(this.delAnterior()));
  protected readonly comparado = computed(() => textoComparado(this.filtros()));
  protected readonly rango = computed(() => textoRango(this.filtros()));
  protected readonly resumen = computed(
    () => `${this.rango()} · ${this.filas().length} productos con ventas · comparado con ${textoRango(rangoComparado(this.filtros()))}. Importes sin IVA.`,
  );

  // ---------- Tabla ----------

  private readonly unidades = computed(() => Object.fromEntries(this.ventas.productos().map((p) => [p.id, p.unidad])));
  protected readonly filas = computed<FilaProducto[]>(() => {
    const total = medir(this.lineas(), 'importe');
    const antes = new Map(resumir(this.anteriores(), 'producto', this.fuente.nombres(), this.fuente.precios()).map((r) => [r.id, r]));
    const categoria = new Map(this.lineas().map((l) => [l.productoId, l.categoria]));
    return resumir(this.lineas(), 'producto', this.fuente.nombres(), this.fuente.precios()).map((r) => ({
      ...r,
      categoria: categoria.get(r.id)!,
      unidad: this.unidades()[r.id] ?? 'M³',
      participacion: total ? (r.importe / total) * 100 : 0,
      variacion: variacion(r.importe, antes.get(r.id)?.importe ?? 0),
      precioUnitario: r.cantidad ? r.importe / r.cantidad : 0,
      precioLista: this.fuente.precios()[r.id] ?? 0,
      vsLista: contraLista(r),
    }));
  });

  protected cantidad(f: Pick<FilaProducto, 'cantidad' | 'unidad'>): string {
    const u = f.unidad === 'M³' ? 'm³' : f.unidad.toLowerCase();
    return `${f.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 1 })} ${u}`;
  }

  protected readonly columnas = computed<ColumnaReporte<FilaProducto>[]>(() => {
    const l = this.lineas();
    const total = medir(l, 'importe');
    const lista = this.filas().reduce((t, f) => t + f.lista, 0);
    return [
      { id: 'nombre', nombre: 'Producto', valor: (f) => f.nombre },
      { id: 'categoria', nombre: 'Categoría', valor: (f) => CATEGORIAS_PRODUCTO[f.categoria] },
      { id: 'cantidad', nombre: 'Cantidad', numero: true, valor: (f) => f.cantidad, texto: (f) => this.cantidad(f), pie: medir(l, 'm3') ? this.m3(medir(l, 'm3')) : '' },
      { id: 'importe', nombre: 'Importe', numero: true, valor: (f) => f.importe, texto: (f) => this.dinero(f.importe), pie: this.dinero(total) },
      { id: 'participacion', nombre: '% del importe', numero: true, valor: (f) => f.participacion, texto: (f) => porcentaje(f.participacion), pie: '100 %' },
      {
        id: 'variacion',
        nombre: 'Variación',
        ayuda: `Contra ${this.comparado()}`,
        numero: true,
        valor: (f) => f.variacion ?? -Infinity,
        texto: (f) => textoVariacion(f.variacion),
        clase: (f) => claseVariacion(f.variacion),
        csv: (f) => (f.variacion === null ? '' : Math.round(f.variacion * 10) / 10),
        pie: textoVariacion(variacion(total, medir(this.anteriores(), 'importe'))),
      },
      { id: 'ordenes', nombre: 'Órdenes', numero: true, valor: (f) => f.ordenes, texto: (f) => f.ordenes.toLocaleString('es-MX'), pie: medir(l, 'ordenes').toLocaleString('es-MX') },
      { id: 'clientes', nombre: 'Clientes', numero: true, valor: (f) => f.clientes, pie: String(medir(l, 'clientes')) },
      { id: 'precio', nombre: 'Precio obtenido', numero: true, valor: (f) => f.precioUnitario, texto: (f) => `$${pesos(f.precioUnitario)}`, ayuda: 'Importe entre cantidad' },
      { id: 'precioLista', nombre: 'Precio de lista', numero: true, valor: (f) => f.precioLista, texto: (f) => (f.precioLista ? `$${pesos(f.precioLista)}` : '—') },
      {
        id: 'lista',
        nombre: 'vs. lista',
        numero: true,
        valor: (f) => f.vsLista ?? -Infinity,
        texto: (f) => sinSigno(f.vsLista),
        csv: (f) => (f.vsLista === null ? '' : Math.round(f.vsLista * 10) / 10),
        pie: sinSigno(lista ? ((total - lista) / lista) * 100 : null),
      },
    ];
  });

  // ---------- Indicadores ----------

  protected readonly indicadores = computed<Indicador[]>(() => {
    const l = this.lineas();
    const a = this.anteriores();
    const bombeo = conBombeo(this.delPeriodo());
    const bombeoAntes = conBombeo(this.delAnterior());
    return [
      { nombre: 'm³ de concreto', valor: this.m3(medir(l, 'm3')), actual: medir(l, 'm3'), antes: medir(a, 'm3') },
      { nombre: 'Importe (sin IVA)', valor: this.dinero(medir(l, 'importe')), actual: medir(l, 'importe'), antes: medir(a, 'importe') },
      { nombre: 'Precio promedio por m³', valor: this.dinero(medir(l, 'precio')), actual: medir(l, 'precio'), antes: medir(a, 'precio') },
      {
        nombre: 'Órdenes de concreto con bombeo',
        valor: porcentaje(bombeo),
        actual: 0,
        antes: null,
        nota: `En ${this.comparado()}: ${porcentaje(bombeoAntes)}`,
      },
    ];
  });

  // ---------- Gráfica ----------

  protected readonly modoInfo = computed(() => MODOS.find((m) => m.id === this.modo())!);
  protected readonly medidaInfo = computed(() => MEDIDAS[this.medida()]);
  protected readonly tituloGrafica = computed(() => {
    const m = this.medidaInfo().nombre;
    return { resistencias: `${m} por producto y planta`, mezcla: `Mezcla de productos (${m.toLowerCase()})`, tendencia: `${m} por categoría en el tiempo` }[this.modo()];
  });
  protected readonly grafica = computed(() => {
    const f = this.filtros();
    const base = { medida: this.medida(), rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres() };
    switch (this.modo()) {
      case 'resistencias':
        // En orden de resistencia (fc-100, fc-150…), no de venta; sin "Otros", que cortaría por clave y no por venta
        return aSeries(agrupar(this.lineas(), { ...base, filas: 'producto', columnas: 'planta', orden: 'clave' }));
      case 'tendencia':
        return aSeries(agrupar(this.lineas(), { ...base, filas: granularidad(f), columnas: 'categoria', orden: 'desc' }));
      case 'mezcla': {
        const t = aSeries(agrupar(this.lineas(), { ...base, filas: 'producto', columnas: null, orden: 'desc', maximo: 12 }));
        return { ...t, series: t.series.map((s) => ({ ...s, nombre: this.medidaInfo().nombre })) };
      }
    }
  });

  // ---------- Detalle del producto ----------

  protected readonly seleccion = linkedSignal<FilaProducto[], string | null>({
    source: this.filas,
    computation: (filas, antes) => (antes?.value && filas.some((f) => f.id === antes.value) ? antes.value : (filas[0]?.id ?? null)),
  });
  protected readonly elegido = computed(() => this.filas().find((f) => f.id === this.seleccion()) ?? null);
  protected readonly tieneFicha = computed(() => this.ventas.productos().some((p) => p.id === this.seleccion()));
  protected readonly detalle = computed(() => {
    const id = this.seleccion();
    const f = this.filtros();
    const suyas = this.lineas().filter((l) => l.productoId === id);
    const base = { rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres(), orden: 'desc' as const, maximo: 8 };
    const enM3 = suyas.some((l) => l.m3 > 0);
    const tendencia = aSeries(agrupar(suyas, { ...base, filas: granularidad(f), columnas: null, medida: enM3 ? 'm3' : 'importe' }));
    return {
      tendencia: { ...tendencia, series: tendencia.series.map((s) => ({ ...s, nombre: enM3 ? 'm³' : 'Importe' })) },
      plantas: aSeries(agrupar(suyas, { ...base, filas: 'planta', columnas: null, medida: 'importe' })),
      clientes: aSeries(agrupar(suyas, { ...base, filas: 'cliente', columnas: null, medida: 'importe' })),
    };
  });

  protected exportar(): void {
    const { desde, hasta } = this.filtros();
    descargar(`productos-${this.grupo()}_${desde}_${hasta}.csv`, csvDeTabla(this.columnas(), this.filas()));
  }
}
