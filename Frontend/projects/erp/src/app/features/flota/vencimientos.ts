import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Buscador, FiltrosElegidos, GrupoFiltro, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { VentasService, mensajeDe } from '../ventas/datos';
import { FlotaApi, Vencimiento, fechaCorta, textoVence } from './flota-api';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const TIPO = { documento: 'Documento de unidad', licencia: 'Licencia de operador', mantenimiento: 'Servicio programado', combustible: 'Carga y odómetro' } as const;
/** Lo que se avisa con anticipación. */
const DIAS = 60;

/**
 * Logística → Vencimientos (/flota/vencimientos): lo vencido y lo que vence en los próximos 60 días — documentos de las
 * unidades (seguro, verificación…), licencias de operadores y servicios programados — con liga a donde se renueva.
 */
@Component({
  selector: 'app-vencimientos',
  imports: [Buscador, EnEncabezado, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Vencimientos</h1>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-vencimiento" etiqueta="Buscar por unidad, operador o documento" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ vencidos().length }} vencidos · {{ proximos().length }} por vencer</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">Los vencimientos necesitan el servidor</h2></section>
    } @else {
      @if (error()) {
        <p class="glass mb-4 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
      }
      <div class="mx-auto grid max-w-5xl gap-4">
        @for (g of grupos2(); track g.id) {
          <section class="glass px-5 py-4" [attr.aria-labelledby]="'venc-' + g.id">
            <h2 [id]="'venc-' + g.id" class="font-bold">{{ g.titulo }} <span class="text-texto-suave tabular-nums">({{ g.lista.length }})</span></h2>
            <ul class="mt-2 grid gap-2">
              @for (v of g.lista; track v.tipo + v.registroId) {
                <li class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/85 px-4 py-2.5 text-sm">
                  <span class="min-w-0">
                    <a [routerLink]="ruta(v)" [queryParams]="params(v)" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ v.titulo }}</a>
                    <span class="block text-xs text-texto-suave">{{ tipo[v.tipo] }} · {{ corta(v.vence) }}</span>
                  </span>
                  <span [class]="vence(v).tono">{{ vence(v).texto }}</span>
                </li>
              } @empty {
                <li class="py-3 text-sm text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : g.vacio }}</li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
})
export default class Vencimientos {
  private readonly api = inject(FlotaApi);
  protected readonly conBackend = inject(VentasService).conBackend;
  protected readonly tipo = TIPO;
  protected readonly corta = fechaCorta;

  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.vencimientos(DIAS) : Promise.resolve([] as Vencimiento[])) });
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));
  private readonly todos = computed(() => (this.datos.hasValue() ? this.datos.value() : []));

  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [{ id: 'tipo', titulo: 'Qué vence', opciones: opcionesDe(this.todos(), (v) => v.tipo, (id) => TIPO[id as keyof typeof TIPO]) }]);
  private readonly visibles = computed(() => {
    const q = normalizar(this.texto().trim());
    return this.todos()
      .filter((v) => (!q || normalizar(v.titulo).includes(q)) && pasaFiltro(this.filtros(), 'tipo', v.tipo))
      .sort((a, b) => a.vence.localeCompare(b.vence));
  });
  protected readonly vencidos = computed(() => this.visibles().filter((v) => v.vencido));
  protected readonly proximos = computed(() => this.visibles().filter((v) => !v.vencido));
  protected readonly grupos2 = computed(() => [
    { id: 'vencidos', titulo: 'Vencidos', lista: this.vencidos(), vacio: 'Nada vencido.' },
    { id: 'proximos', titulo: `Vencen en los próximos ${DIAS} días`, lista: this.proximos(), vacio: 'Nada por vencer.' },
  ]);

  protected vence(v: Vencimiento) {
    return textoVence(v.vence);
  }
  protected ruta(v: Vencimiento): string | string[] {
    if (v.tipo === 'licencia') return '/flota/operadores';
    if (v.tipo === 'mantenimiento') return '/flota/mantenimiento';
    if (v.tipo === 'combustible') return '/flota/combustible';
    return ['/flota/unidades', v.equipoId ?? ''];
  }
  protected params(v: Vencimiento): Record<string, string> | null {
    return (v.tipo === 'mantenimiento' || v.tipo === 'combustible') && v.equipoId ? { unidad: v.equipoId } : null;
  }
}
