import { Component, computed, inject, input, model, output } from '@angular/core';
import { RotateCcw } from 'lucide';
import { CATEGORIAS_PRODUCTO, CategoriaProducto, Icon } from 'ui';
import { RAZONES_SOCIALES } from '../../core/plantas';
import { VENDEDORES } from './datos';
import { COMPARAR, Comparar, Filtro, PERIODOS, Periodo, Rango, hoy, rangoAnioAnterior, rangoAnterior, rangoDe } from './reporte-datos';
import { ReporteFuente } from './reporte-fuente';

export interface FiltrosReporte extends Filtro {
  periodo: Periodo;
  comparar: Comparar;
}

export const filtrosIniciales = (periodo: Exclude<Periodo, 'personalizado'> = 'ultimos-12'): FiltrosReporte => ({
  periodo,
  ...rangoDe(periodo, hoy()),
  plantas: [],
  aplica: '',
  vendedor: '',
  cliente: '',
  comparar: 'anterior',
});

/** Contra qué se compara: el periodo anterior del mismo largo o las mismas fechas del año pasado. */
export const rangoComparado = (f: FiltrosReporte): Rango => (f.comparar === 'anio' ? rangoAnioAnterior : rangoAnterior)({ desde: f.desde, hasta: f.hasta });
export const textoComparado = (f: FiltrosReporte) => (f.comparar === 'anio' ? 'el año pasado' : 'el periodo anterior');

type Opcional = 'producto' | 'vendedor' | 'cliente';

/**
 * La barra de filtros de los reportes, igual en todos: periodo (rápido o fechas), plantas, producto o categoría,
 * vendedor, cliente y contra qué comparar; "Quitar filtros". Cada reporte oculta el filtro de lo que analiza (en
 * Vendedores no se filtra por vendedor). Arriba, lo que proyecte el reporte (los reportes rápidos de Ventas); abajo, su
 * resumen.
 */
@Component({
  selector: 'app-filtros-reporte',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <section class="glass grid gap-4 p-4 sm:p-5" aria-label="Filtros">
      <ng-content />
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="reporte-periodo" [class]="etiqueta">Periodo</label>
          <select id="reporte-periodo" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="cambiarPeriodo($any($event.target).value)">
            @for (p of periodos; track p.id) {
              <option [value]="p.id" [selected]="p.id === f().periodo">{{ p.nombre }}</option>
            }
          </select>
        </div>
        @if (f().periodo === 'personalizado') {
          <div>
            <label for="reporte-desde" [class]="etiqueta">Desde</label>
            <input id="reporte-desde" type="date" class="campo mt-1 h-9 w-auto px-2 text-sm" [value]="f().desde" [max]="f().hasta" (change)="cambiarRango({ desde: $any($event.target).value })" />
          </div>
          <div>
            <label for="reporte-hasta" [class]="etiqueta">Hasta</label>
            <input id="reporte-hasta" type="date" class="campo mt-1 h-9 w-auto px-2 text-sm" [value]="f().hasta" [min]="f().desde" (change)="cambiarRango({ hasta: $any($event.target).value })" />
          </div>
        }
        <fieldset>
          <legend [class]="etiqueta">Plantas</legend>
          <div class="mt-1 flex flex-wrap gap-1">
            <label [class]="chipCasilla"><input type="checkbox" class="sr-only" [checked]="!f().plantas.length" (change)="poner({ plantas: [] })" />Todas</label>
            @for (p of plantas; track p.id) {
              <label [class]="chipCasilla">
                <input type="checkbox" class="sr-only" [checked]="f().plantas.includes(p.id)" (change)="alternarPlanta(p.id)" />{{ p.nombre }}
              </label>
            }
          </div>
        </fieldset>
        @if (!ocultar().includes('producto')) {
          <div class="min-w-48">
            <label for="reporte-producto" [class]="etiqueta">Producto</label>
            <select id="reporte-producto" class="campo mt-1 h-9 px-2 text-sm" (change)="poner({ aplica: $any($event.target).value })">
              <option value="" [selected]="!f().aplica">Todos</option>
              <optgroup label="Categorías">
                @for (c of categorias; track c.id) {
                  <option [value]="'cat:' + c.id" [selected]="f().aplica === 'cat:' + c.id">{{ c.nombre }}</option>
                }
              </optgroup>
              <optgroup label="Productos">
                @for (p of fuente.productos(); track p.id) {
                  <option [value]="'prod:' + p.id" [selected]="f().aplica === 'prod:' + p.id">{{ p.nombre }}</option>
                }
              </optgroup>
            </select>
          </div>
        }
        @if (!ocultar().includes('vendedor')) {
          <div>
            <label for="reporte-vendedor" [class]="etiqueta">Vendedor</label>
            <select id="reporte-vendedor" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ vendedor: $any($event.target).value })">
              <option value="" [selected]="!f().vendedor">Todos</option>
              @for (v of vendedores; track v.id) {
                <option [value]="v.id" [selected]="f().vendedor === v.id">{{ v.nombre }}</option>
              }
            </select>
          </div>
        }
        @if (!ocultar().includes('cliente')) {
          <div class="min-w-48">
            <label for="reporte-cliente" [class]="etiqueta">Cliente</label>
            <select id="reporte-cliente" class="campo mt-1 h-9 px-2 text-sm" (change)="poner({ cliente: $any($event.target).value })">
              <option value="" [selected]="!f().cliente">Todos</option>
              @for (c of fuente.clientes(); track c.id) {
                <option [value]="c.id" [selected]="f().cliente === c.id">{{ c.nombre }}</option>
              }
            </select>
          </div>
        }
        <div>
          <label for="reporte-comparar" [class]="etiqueta">Comparar con</label>
          <select id="reporte-comparar" class="campo mt-1 h-9 w-auto px-2 text-sm" (change)="poner({ comparar: $any($event.target).value })">
            @for (c of comparaciones; track c.id) {
              <option [value]="c.id" [selected]="f().comparar === c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>
        @if (hayFiltros()) {
          <button
            type="button"
            class="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-epico-oscuro hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
            (click)="poner({ plantas: [], aplica: '', vendedor: '', cliente: '' })"
          >
            <ui-icon [icono]="iconoLimpiar" [tamano]="15" />Quitar filtros
          </button>
        }
      </div>
      <p class="text-sm text-texto-suave" aria-live="polite">{{ resumen() }}</p>
    </section>
  `,
})
export class FiltrosReporteBarra {
  protected readonly fuente = inject(ReporteFuente);

  readonly f = model.required<FiltrosReporte>({ alias: 'filtros' });
  /** Los filtros que este reporte no muestra (los de lo que analiza). */
  readonly ocultar = input<Opcional[]>([]);
  readonly resumen = input('');
  /** Cambió el periodo (para que el reporte ajuste día, semana o mes). */
  readonly rangoCambiado = output<Rango>();

  protected readonly iconoLimpiar = RotateCcw;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly chipCasilla =
    'inline-flex h-9 cursor-pointer items-center rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-carbon/40 has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico';
  protected readonly periodos = (Object.keys(PERIODOS) as Periodo[]).map((id) => ({ id, nombre: PERIODOS[id] }));
  protected readonly comparaciones = (Object.keys(COMPARAR) as Comparar[]).map((id) => ({ id, nombre: COMPARAR[id] }));
  protected readonly plantas = RAZONES_SOCIALES.flatMap((r) => r.plantas).map((p) => ({ id: p.id, nombre: p.nombre.replace('Planta ', '') }));
  protected readonly categorias = (Object.keys(CATEGORIAS_PRODUCTO) as CategoriaProducto[]).map((id) => ({ id, nombre: CATEGORIAS_PRODUCTO[id] }));
  protected readonly vendedores = Object.entries(VENDEDORES).map(([id, nombre]) => ({ id, nombre }));

  protected readonly hayFiltros = computed(() => {
    const f = this.f();
    return !!(f.plantas.length || f.aplica || f.vendedor || f.cliente);
  });

  protected poner(c: Partial<FiltrosReporte>): void {
    this.f.update((f) => ({ ...f, ...c }));
  }

  protected cambiarPeriodo(p: Periodo): void {
    const rango = p === 'personalizado' ? { desde: this.f().desde, hasta: this.f().hasta } : rangoDe(p, hoy());
    this.poner({ periodo: p, ...rango });
    this.rangoCambiado.emit(rango);
  }

  protected cambiarRango(c: Partial<Rango>): void {
    const rango = { desde: this.f().desde, hasta: this.f().hasta, ...c };
    if (rango.desde > rango.hasta) return;
    this.poner(rango);
    this.rangoCambiado.emit(rango);
  }

  protected alternarPlanta(id: string): void {
    const p = this.f().plantas;
    this.poner({ plantas: p.includes(id) ? p.filter((x) => x !== id) : [...p, id] });
  }
}
