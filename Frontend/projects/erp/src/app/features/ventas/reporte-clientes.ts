import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Download, Search, TriangleAlert } from 'lucide';
import { Icon } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_VISTA } from '../../layout/vista-completa';
import { FiltrosReporte, FiltrosReporteBarra, filtrosIniciales, rangoComparado, textoComparado } from './filtros-reporte';
import { Grafica } from './grafica';
import { Indicador, IndicadoresReporte } from './indicadores-reporte';
import {
  MEDIDAS,
  Resumen,
  aSeries,
  agrupar,
  claseVariacion,
  descargar,
  diasEntre,
  fechaCorta,
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

/**
 * Nuevo: su primera compra cae en el periodo. Recuperado: compró antes, no en la comparación y ahora sí. Inactivo: compró
 * en la comparación y en el periodo no. Creciendo o bajando: ±10 % contra la comparación.
 */
type Estado = 'nuevo' | 'recuperado' | 'creciendo' | 'estable' | 'bajando' | 'inactivo';
const ESTADOS: Record<Estado, { nombre: string; clase: string }> = {
  nuevo: { nombre: 'Nuevo', clase: 'bg-[#E4EEF3] text-[#24485A]' },
  recuperado: { nombre: 'Recuperado', clase: 'bg-[#E4EEF3] text-[#24485A]' },
  creciendo: { nombre: 'Creciendo', clase: 'bg-[#E3EFE9] text-[#2E5E4A]' },
  estable: { nombre: 'Estable', clase: 'bg-carbon/6 text-texto-suave' },
  bajando: { nombre: 'Bajando', clase: 'bg-[#FBF2E7] text-[#7A4210]' },
  inactivo: { nombre: 'Inactivo', clase: 'bg-[#F6E3E1] text-[#8E332C]' },
};

type Modo = 'pareto' | 'activos';

interface FilaCliente extends Resumen {
  estado: Estado;
  participacion: number;
  /** % acumulado de mayor a menor (Pareto). */
  acumulado: number;
  antes: number;
  variacion: number | null;
  /** La última de toda su historia (hasta el fin del periodo), no solo del periodo. */
  ultimaCompra: string;
  diasSinComprar: number;
}

const VACIO: Omit<Resumen, 'id' | 'nombre'> = { importe: 0, m3: 0, cantidad: 0, ordenes: 0, clientes: 0, plantas: [], ticket: 0, precio: 0, lista: 0, primera: '', ultima: '' };

/**
 * Ventas → Reportes → Clientes: la cartera. Indicadores (clientes con compras, ticket promedio, concentración en los 5
 * mayores y clientes nuevos); clientes en riesgo (inactivos o bajando más de 30 %); gráfica Pareto o clientes activos
 * en el tiempo; tabla con estado, participación, % acumulado, variación, m³, órdenes, ticket, última compra, días sin
 * comprar y plantas, con búsqueda y filtro por estado; y el detalle del cliente: tendencia, mezcla de productos, plantas
 * y sus últimas órdenes, con enlace a su ficha. Hoja de cálculo: la tabla.
 */
@Component({
  selector: 'app-reporte-clientes',
  imports: [EnEncabezado, FiltrosReporteBarra, Grafica, Icon, IndicadoresReporte, RouterLink, TablaReporte],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon">Reporte de clientes</h1>
        <button type="button" [class]="botonSecundario + ' ml-auto'" (click)="exportar()">
          <ui-icon [icono]="iconos.descargar" [tamano]="16" />Hoja de cálculo
        </button>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div class="grid min-w-0 gap-4">
          <app-filtros-reporte [(filtros)]="filtros" [ocultar]="['cliente']" [resumen]="resumen()" />
          <app-indicadores-reporte [indicadores]="indicadores()" [comparado]="comparado()" />

          @if (enRiesgo().length) {
            <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="clientes-riesgo">
              <h2 id="clientes-riesgo" class="flex items-center gap-2 font-bold">
                <ui-icon [icono]="iconos.alerta" [tamano]="18" class="text-[#8E332C]" />Clientes en riesgo ({{ enRiesgo().length }})
              </h2>
              <p class="mt-1 text-sm text-texto-suave">Compraron en {{ comparado() }} y ahora no, o compraron más de 30 % menos.</p>
              <ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                @for (c of enRiesgo(); track c.id) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full flex-col items-start rounded-xl border border-acero/70 bg-white/80 px-3 py-2 text-left text-sm transition-colors hover:border-epico/60 focus-visible:outline-2 focus-visible:outline-epico"
                      (click)="verDetalle(c.id)"
                    >
                      <span class="flex w-full items-center justify-between gap-2">
                        <span class="font-semibold">{{ c.nombre }}</span>
                        <span class="rounded-md px-2 py-0.5 text-xs font-bold {{ estados[c.estado].clase }}">{{ estados[c.estado].nombre }}</span>
                      </span>
                      <span class="text-texto-suave">
                        {{ dinero(c.importe) }} ahora · {{ dinero(c.antes) }} antes · última compra {{ fecha(c.ultimaCompra) }} ({{ c.diasSinComprar }} días)
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="clientes-grafica">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <h2 id="clientes-grafica" class="font-bold">{{ modo() === 'pareto' ? 'Participación por cliente (importe)' : 'Clientes con compras en el tiempo' }}</h2>
              <div class="inline-flex rounded-xl bg-carbon/6 p-1" role="group" aria-label="Qué ver">
                <button type="button" [class]="segmento(modo() === 'pareto')" [attr.aria-pressed]="modo() === 'pareto'" (click)="modo.set('pareto')">Pareto</button>
                <button type="button" [class]="segmento(modo() === 'activos')" [attr.aria-pressed]="modo() === 'activos'" (click)="modo.set('activos')">Activos</button>
              </div>
            </div>
            @if (lineas().length) {
              @if (modo() === 'pareto') {
                <p class="mt-1 text-sm text-texto-suave">Los 5 mayores hacen {{ porcentaje(concentracion()) }} del importe.</p>
              }
              <app-grafica
                class="mt-4"
                [etiquetas]="grafica().etiquetas"
                [series]="grafica().series"
                [tipo]="modo() === 'pareto' ? 'participacion' : 'barras'"
                [formato]="modo() === 'pareto' ? dinero : contar"
                [corto]="modo() === 'pareto' ? corto : contar"
                [sumable]="modo() === 'pareto'"
                [titulo]="modo() === 'pareto' ? 'Participación por cliente' : 'Clientes con compras por periodo'"
              />
            } @else {
              <p class="py-16 text-center text-texto-suave">Sin ventas con estos filtros.</p>
            }
          </section>

          <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="clientes-tabla">
            <h2 id="clientes-tabla" class="font-bold">Cartera · {{ rango() }}</h2>
            <div class="mt-3 flex flex-wrap items-end gap-3">
              <div class="relative min-w-56">
                <label for="clientes-buscar" class="sr-only">Buscar cliente</label>
                <ui-icon [icono]="iconos.buscar" [tamano]="16" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
                <input id="clientes-buscar" type="search" placeholder="Buscar cliente…" class="campo h-9 pr-3 pl-9 text-sm" [value]="texto()" (input)="texto.set($any($event.target).value)" />
              </div>
              <div class="flex flex-wrap gap-1" role="group" aria-label="Estado">
                <button type="button" [class]="chip(!estado())" [attr.aria-pressed]="!estado()" (click)="estado.set(null)">Todos ({{ filas().length }})</button>
                @for (e of conteoEstados(); track e.id) {
                  <button type="button" [class]="chip(estado() === e.id)" [attr.aria-pressed]="estado() === e.id" (click)="estado.set(e.id)">{{ e.nombre }} ({{ e.n }})</button>
                }
              </div>
            </div>
            <app-tabla-reporte class="mt-3" titulo="Cartera de clientes" [columnas]="columnas()" [filas]="visibles()" [clave]="clave" ordenInicial="importe" [(seleccion)]="seleccion" />
          </section>

          @if (elegido(); as c) {
            <section class="glass min-w-0 p-4 sm:p-5" aria-labelledby="cliente-detalle">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="cliente-detalle" class="flex flex-wrap items-center gap-2 font-bold">
                  {{ c.nombre }}
                  <span class="rounded-md px-2 py-0.5 text-xs font-bold {{ estados[c.estado].clase }}">{{ estados[c.estado].nombre }}</span>
                </h2>
                <p class="flex flex-wrap items-baseline gap-x-3 text-sm text-texto-suave">
                  <span>{{ dinero(c.importe) }} · {{ c.ordenes }} órdenes · cliente desde {{ fecha(primeraDe(c.id)) }} · última compra {{ fecha(c.ultimaCompra) }}</span>
                  @if (tieneFicha()) {
                    <a [routerLink]="['/ventas/clientes', c.id]" class="font-semibold text-epico-oscuro underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico">Ver ficha</a>
                  }
                </p>
              </div>
              @if (c.importe) {
                <div class="mt-4 grid gap-4 lg:grid-cols-2">
                  <div [class]="tarjeta + ' lg:col-span-2'">
                    <h3 class="text-sm font-bold">Importe en el periodo</h3>
                    <app-grafica class="mt-2" [etiquetas]="detalle().tendencia.etiquetas" [series]="detalle().tendencia.series" [formato]="dinero" [corto]="corto" [altura]="240" [titulo]="'Compras de ' + c.nombre" />
                  </div>
                  <div [class]="tarjeta">
                    <h3 class="text-sm font-bold">Mezcla de productos (m³)</h3>
                    <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().productos.etiquetas" [series]="detalle().productos.series" [formato]="m3" [corto]="corto" [titulo]="'Productos de ' + c.nombre" />
                  </div>
                  <div [class]="tarjeta">
                    <h3 class="text-sm font-bold">Por planta (importe)</h3>
                    <app-grafica class="mt-2" tipo="participacion" [etiquetas]="detalle().plantas.etiquetas" [series]="detalle().plantas.series" [formato]="dinero" [corto]="corto" [titulo]="c.nombre + ' por planta'" />
                  </div>
                  <div [class]="tarjeta + ' lg:col-span-2'">
                    <h3 class="text-sm font-bold">Últimas órdenes del periodo</h3>
                    <div class="mt-2 overflow-x-auto" tabindex="0" role="region" aria-label="Últimas órdenes">
                      <table class="w-full text-left text-sm whitespace-nowrap">
                        <thead class="border-b border-acero/80">
                          <tr>
                            <th scope="col" class="py-1.5 pr-3 font-semibold">Orden</th>
                            <th scope="col" class="px-3 py-1.5 font-semibold">Entrega</th>
                            <th scope="col" class="px-3 py-1.5 font-semibold">Planta</th>
                            <th scope="col" class="px-3 py-1.5 font-semibold">Productos</th>
                            <th scope="col" class="px-3 py-1.5 text-right font-semibold">m³</th>
                            <th scope="col" class="py-1.5 pl-3 text-right font-semibold">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (o of detalle().ordenes; track o.folio) {
                            <tr class="border-b border-acero/40">
                              <th scope="row" class="py-1.5 pr-3 font-medium tabular-nums">{{ o.folio }}</th>
                              <td class="px-3 py-1.5">{{ fecha(o.fecha) }}</td>
                              <td class="px-3 py-1.5">{{ o.planta }}</td>
                              <td class="px-3 py-1.5">{{ o.productos }}</td>
                              <td class="px-3 py-1.5 text-right tabular-nums">{{ o.m3 }}</td>
                              <td class="py-1.5 pl-3 text-right tabular-nums">{{ dinero(o.importe) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              } @else {
                <p class="mt-3 text-sm text-texto-suave">
                  Sin compras en el periodo. En {{ comparado() }} compró {{ dinero(c.antes) }}; su última compra fue el {{ fecha(c.ultimaCompra) }}, hace
                  {{ c.diasSinComprar }} días.
                </p>
              }
            </section>
          }
        </div>
      </div>
    </div>
  `,
})
export default class ReporteClientes {
  private readonly fuente = inject(ReporteFuente);

  protected readonly cajas = CAJAS_VISTA;
  protected readonly iconos = { descargar: Download, buscar: Search, alerta: TriangleAlert };
  protected readonly tarjeta = 'min-w-0 rounded-2xl border border-acero/60 bg-white/70 p-4';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected segmento(activo: boolean): string {
    return (
      'h-8 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico ' +
      (activo ? 'bg-white text-carbon shadow-sm' : 'text-texto-suave hover:text-carbon')
    );
  }
  protected chip(activo: boolean): string {
    return (
      'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico ' +
      (activo ? 'border-epico bg-epico/8 text-epico-oscuro' : 'border-acero/80 bg-white/80 hover:border-carbon/40')
    );
  }
  protected readonly estados = ESTADOS;
  protected readonly porcentaje = porcentaje;
  protected readonly dinero = MEDIDAS.importe.formato;
  protected readonly corto = MEDIDAS.importe.corto;
  protected readonly m3 = MEDIDAS.m3.formato;
  protected readonly contar = MEDIDAS.clientes.formato;
  protected readonly fecha = (f: string) => (f ? fechaCorta(f) : '—');
  protected readonly clave = (f: FilaCliente) => f.id;

  protected readonly filtros = signal<FiltrosReporte>(filtrosIniciales());
  protected readonly modo = signal<Modo>('pareto');
  protected readonly texto = signal('');
  protected readonly estado = signal<Estado | null>(null);

  protected readonly lineas = computed(() => filtrar(this.fuente.lineas(), this.filtros()));
  private readonly anteriores = computed(() => filtrar(this.fuente.lineas(), { ...this.filtros(), ...rangoComparado(this.filtros()) }));
  /** Toda su historia hasta el fin del periodo (con los demás filtros): primera y última compra. */
  private readonly historia = computed(() => filtrar(this.fuente.lineas(), { ...this.filtros(), desde: '0000-01-01' }));
  private readonly extremos = computed(() => {
    const m = new Map<string, { primera: string; ultima: string }>();
    for (const l of this.historia()) {
      const e = m.get(l.clienteId);
      if (!e) m.set(l.clienteId, { primera: l.fecha, ultima: l.fecha });
      else {
        if (l.fecha < e.primera) e.primera = l.fecha;
        if (l.fecha > e.ultima) e.ultima = l.fecha;
      }
    }
    return m;
  });
  protected primeraDe(id: string): string {
    return this.extremos().get(id)?.primera ?? '';
  }

  protected readonly comparado = computed(() => textoComparado(this.filtros()));
  protected readonly rango = computed(() => textoRango(this.filtros()));
  protected readonly resumen = computed(
    () =>
      `${this.rango()} · ${this.filas().filter((f) => f.importe).length} clientes con compras · comparado con ${textoRango(rangoComparado(this.filtros()))}. Importes sin IVA.`,
  );

  // ---------- Cartera ----------

  protected readonly filas = computed<FilaCliente[]>(() => {
    const f = this.filtros();
    const nombres = this.fuente.nombres();
    const precios = this.fuente.precios();
    const actual = new Map(resumir(this.lineas(), 'cliente', nombres, precios).map((r) => [r.id, r]));
    const antes = new Map(resumir(this.anteriores(), 'cliente', nombres, precios).map((r) => [r.id, r]));
    const total = medir(this.lineas(), 'importe');
    const ids = [...new Set([...actual.keys(), ...antes.keys()])];
    const filas = ids.map((id): FilaCliente => {
      const a = actual.get(id);
      const previo = antes.get(id)?.importe ?? 0;
      const v = variacion(a?.importe ?? 0, previo);
      const { primera, ultima } = this.extremos().get(id) ?? { primera: '', ultima: '' };
      const estado: Estado = !a
        ? 'inactivo'
        : primera >= f.desde
          ? 'nuevo'
          : v === null
            ? 'recuperado'
            : v >= 10
              ? 'creciendo'
              : v <= -10
                ? 'bajando'
                : 'estable';
      return {
        ...VACIO,
        ...a,
        id,
        nombre: nombreDe('cliente', id, nombres),
        estado,
        participacion: total && a ? (a.importe / total) * 100 : 0,
        acumulado: 0,
        antes: previo,
        variacion: v,
        ultimaCompra: ultima,
        diasSinComprar: ultima ? diasEntre(ultima, f.hasta) - 1 : 0,
      };
    });
    // Pareto: % acumulado de mayor a menor importe
    let acumulado = 0;
    for (const fila of [...filas].sort((x, y) => y.importe - x.importe)) {
      acumulado += fila.participacion;
      fila.acumulado = fila.importe ? acumulado : 0;
    }
    return filas;
  });

  protected readonly conteoEstados = computed(() =>
    (Object.keys(ESTADOS) as Estado[]).map((id) => ({ id, nombre: ESTADOS[id].nombre, n: this.filas().filter((f) => f.estado === id).length })).filter((e) => e.n),
  );
  protected readonly visibles = computed(() => {
    const q = this.texto().trim().toLowerCase();
    return this.filas().filter((f) => (!this.estado() || f.estado === this.estado()) && (!q || f.nombre.toLowerCase().includes(q)));
  });
  protected readonly enRiesgo = computed(() =>
    this.filas()
      .filter((f) => f.estado === 'inactivo' || (f.variacion !== null && f.variacion <= -30))
      .sort((a, b) => b.antes - b.importe - (a.antes - a.importe)),
  );

  protected readonly columnas = computed<ColumnaReporte<FilaCliente>[]>(() => {
    const l = this.lineas();
    const total = medir(l, 'importe');
    const plantas = (f: FilaCliente) => f.plantas.map((p) => nombreDe('planta', p, this.fuente.nombres())).join(', ');
    return [
      { id: 'nombre', nombre: 'Cliente', valor: (f) => f.nombre },
      { id: 'estado', nombre: 'Estado', valor: (f) => ESTADOS[f.estado].nombre, clase: (f) => 'font-semibold ' + ESTADOS[f.estado].clase.split(' ').find((c) => c.startsWith('text-')) },
      { id: 'importe', nombre: 'Importe', numero: true, valor: (f) => f.importe, texto: (f) => this.dinero(f.importe), pie: this.dinero(total) },
      { id: 'participacion', nombre: '% del total', numero: true, valor: (f) => f.participacion, texto: (f) => (f.importe ? porcentaje(f.participacion) : '—'), pie: '100 %' },
      { id: 'acumulado', nombre: '% acumulado', numero: true, valor: (f) => f.acumulado, texto: (f) => (f.importe ? porcentaje(f.acumulado) : '—'), ayuda: 'Pareto: de mayor a menor importe' },
      {
        id: 'variacion',
        nombre: 'Variación',
        ayuda: `Contra ${this.comparado()}`,
        numero: true,
        valor: (f) => f.variacion ?? -Infinity,
        texto: (f) => textoVariacion(f.variacion, f.importe),
        clase: (f) => claseVariacion(f.variacion),
        csv: (f) => (f.variacion === null ? '' : Math.round(f.variacion * 10) / 10),
        pie: textoVariacion(variacion(total, medir(this.anteriores(), 'importe'))),
      },
      { id: 'm3', nombre: 'm³', numero: true, valor: (f) => f.m3, texto: (f) => (f.m3 ? this.m3(f.m3) : '—'), pie: this.m3(medir(l, 'm3')) },
      { id: 'ordenes', nombre: 'Órdenes', numero: true, valor: (f) => f.ordenes, pie: medir(l, 'ordenes').toLocaleString('es-MX') },
      { id: 'ticket', nombre: 'Ticket prom.', numero: true, valor: (f) => f.ticket, texto: (f) => (f.ticket ? this.dinero(f.ticket) : '—') },
      { id: 'ultima', nombre: 'Última compra', valor: (f) => f.ultimaCompra, texto: (f) => this.fecha(f.ultimaCompra) },
      { id: 'dias', nombre: 'Días sin comprar', numero: true, valor: (f) => f.diasSinComprar },
      { id: 'plantas', nombre: 'Plantas', valor: plantas },
    ];
  });

  // ---------- Indicadores ----------

  /** % del importe que hacen los 5 mayores. */
  protected readonly concentracion = computed(() => {
    const total = medir(this.lineas(), 'importe');
    const top = [...this.filas()].sort((a, b) => b.importe - a.importe).slice(0, 5);
    return total ? (top.reduce((t, f) => t + f.importe, 0) / total) * 100 : 0;
  });

  protected readonly indicadores = computed<Indicador[]>(() => {
    const l = this.lineas();
    const a = this.anteriores();
    const ticket = (x: typeof l) => (medir(x, 'ordenes') ? medir(x, 'importe') / medir(x, 'ordenes') : 0);
    const comparado = rangoComparado(this.filtros());
    const nuevos = this.filas().filter((f) => f.estado === 'nuevo').length;
    const nuevosAntes = [...this.extremos().values()].filter((e) => e.primera >= comparado.desde && e.primera <= comparado.hasta).length;
    const conCompras = this.filas().filter((f) => f.importe).length;
    return [
      { nombre: 'Clientes con compras', valor: String(conCompras), actual: conCompras, antes: medir(a, 'clientes') },
      { nombre: 'Ticket promedio por orden', valor: this.dinero(ticket(l)), actual: ticket(l), antes: ticket(a) },
      { nombre: 'Concentración en los 5 mayores', valor: porcentaje(this.concentracion()), actual: 0, antes: null, nota: 'del importe del periodo' },
      { nombre: 'Clientes nuevos', valor: String(nuevos), actual: nuevos, antes: nuevosAntes },
    ];
  });

  // ---------- Gráfica ----------

  protected readonly grafica = computed(() => {
    const f = this.filtros();
    const base = { columnas: null, rango: { desde: f.desde, hasta: f.hasta }, nombres: this.fuente.nombres(), orden: 'desc' as const };
    if (this.modo() === 'pareto') {
      const t = aSeries(agrupar(this.lineas(), { ...base, filas: 'cliente', medida: 'importe', maximo: 12 }));
      return { ...t, series: t.series.map((s) => ({ ...s, nombre: 'Importe' })) };
    }
    const t = aSeries(agrupar(this.lineas(), { ...base, filas: granularidad(f), medida: 'clientes' }));
    return { ...t, series: t.series.map((s) => ({ ...s, nombre: 'Clientes con compras' })) };
  });

  // ---------- Detalle del cliente ----------

  protected readonly seleccion = linkedSignal<FilaCliente[], string | null>({
    source: this.filas,
    computation: (filas, antes) =>
      antes?.value && filas.some((f) => f.id === antes.value) ? antes.value : ([...filas].sort((a, b) => b.importe - a.importe)[0]?.id ?? null),
  });
  protected readonly elegido = computed(() => this.filas().find((f) => f.id === this.seleccion()) ?? null);
  protected readonly tieneFicha = computed(() => this.fuente.conFicha().has(this.seleccion() ?? ''));

  protected verDetalle(id: string): void {
    this.seleccion.set(id);
    document.getElementById('cliente-detalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly detalle = computed(() => {
    const id = this.seleccion();
    const f = this.filtros();
    const nombres = this.fuente.nombres();
    const suyas = this.lineas().filter((l) => l.clienteId === id);
    const base = { columnas: null, rango: { desde: f.desde, hasta: f.hasta }, nombres, orden: 'desc' as const, maximo: 8 };
    const tendencia = aSeries(agrupar(suyas, { ...base, filas: granularidad(f), medida: 'importe' }));
    const porFolio = new Map<string, typeof suyas>();
    for (const l of suyas) porFolio.set(l.folio, [...(porFolio.get(l.folio) ?? []), l]);
    const ordenes = [...porFolio.values()]
      .map((ls) => ({
        folio: ls[0].folio,
        fecha: ls[0].fecha,
        planta: nombreDe('planta', ls[0].plantaId, nombres),
        productos: ls.map((l) => nombreDe('producto', l.productoId, nombres)).join(' + '),
        m3: medir(ls, 'm3'),
        importe: medir(ls, 'importe'),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio))
      .slice(0, 6);
    return {
      tendencia: { ...tendencia, series: tendencia.series.map((s) => ({ ...s, nombre: 'Importe' })) },
      productos: aSeries(agrupar(suyas.filter((l) => l.m3 > 0), { ...base, filas: 'producto', medida: 'm3' })),
      plantas: aSeries(agrupar(suyas, { ...base, filas: 'planta', medida: 'importe' })),
      ordenes,
    };
  });

  protected exportar(): void {
    const { desde, hasta } = this.filtros();
    descargar(`clientes_${desde}_${hasta}.csv`, csvDeTabla(this.columnas(), this.visibles()));
  }
}
