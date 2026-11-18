import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FileText, X } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, Icon, PedidoVista, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { permisosSesion } from '../../core/permisos';
import { PlantasService } from '../../core/plantas';
import { VentasService, mensajeDe } from '../ventas/datos';
import { FlotaApi, Viaje } from '../flota/flota-api';
import { certificadoPdf } from '../flota/documentos-pdf';
import { CalidadApi, Ensaye, Muestra, porcentaje } from './calidad-api';

const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const fecha = (iso: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
/** Las fechas de los ensayes son días (YYYY-MM-DD), sin hora: se muestran tal cual, sin pasarlas por la zona. */
const dia = (f: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(f.slice(0, 10) + 'T12:00:00Z'));
const hoyLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };

/**
 * Calidad y laboratorio → Muestras (/laboratorio), como las listas de Ventas: cada muestra de concreto (cilindros) de una
 * orden y su remisión, con sus ensayes a 7, 14 y 28 días. En la vista previa se capturan los resultados y se descarga
 * el certificado de calidad de la orden. Arriba, cuántos ensayes ya tocan.
 */
@Component({
  selector: 'app-laboratorio',
  imports: [Buscador, EnEncabezado, Icon, PanelLateral, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('calidad.muestras.crear') && conBackend) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="nueva()">Nueva muestra</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Muestras</h1>
          @if (tocan()) {
            <button type="button" class="inline-flex h-9 items-center rounded-full bg-epico px-3.5 text-sm font-bold whitespace-nowrap text-white hover:bg-epico-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico" [attr.aria-pressed]="soloTocan()" (click)="alternarTocan()">
              {{ tocan() }} {{ tocan() === 1 ? 'ensaye toca' : 'ensayes tocan' }}
            </button>
          }
        </div>
        <ui-buscador class="min-w-0 flex-1" idBuscar="buscar-muestra" etiqueta="Buscar por muestra, orden o cliente" [(texto)]="texto" [grupos]="grupos()" [(filtros)]="filtros" />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!conBackend) {
      <section class="glass mx-auto max-w-3xl px-6 py-10 text-center"><h2 class="text-xl font-bold">El laboratorio necesita el servidor</h2></section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            @if (error()) {
              <p class="border-b border-acero/50 px-4 py-3 text-sm font-medium text-critico" role="alert">{{ error() }}</p>
            }
            <div tabindex="0" role="region" aria-label="Tabla de muestras" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-220]="!vista.abiertaId()">
                <caption class="sr-only">Muestras de concreto, la más reciente primero. Clic o Enter abre su vista previa. La casilla solo marca.</caption>
                <thead [class]="cajas.titulos">
                  <tr>
                    <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                      <input type="checkbox" class="casilla block" aria-label="Marcar todas" [checked]="casillas.todas()" [indeterminate]="casillas.algunas()" [disabled]="!filas().length" (change)="casillas.marcarTodas($any($event.target).checked)" />
                    </th>
                    <th scope="col" class="py-2.5 pr-3 pl-1 font-semibold">Muestra</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Muestreo</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Orden</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Cliente · obra</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold" [class.hidden]="vista.abiertaId()">f'c</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Ensayes</th>
                    <th scope="col" class="px-3 py-2.5 text-right font-semibold">28 días</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of filas(); track m.id) {
                    <tr
                      [id]="'fila-' + m.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="m.id === vista.abiertaId() ? 'true' : null"
                      (click)="vista.abrir(m.id!)"
                      (keydown.enter)="$event.target === $event.currentTarget && vista.abrir(m.id!)"
                    >
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input type="checkbox" class="casilla block" [attr.aria-label]="'Marcar ' + m.folio" [checked]="casillas.marcadas().includes(m.id!)" (change)="casillas.alternar(m.id!)" />
                      </td>
                      <td class="py-2.5 pr-3 pl-1 font-semibold">{{ m.folio }}</td>
                      <td class="px-3 py-2.5 whitespace-nowrap tabular-nums">{{ fecha(m.fechaMuestreo) }}</td>
                      <td class="px-3 py-2.5 whitespace-nowrap">{{ pedido(m)?.folio ?? '—' }}</td>
                      <td class="px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ pedido(m) ? pedido(m)!.clienteNombre + ' · ' + pedido(m)!.obraNombre : '—' }}</td>
                      <td class="px-3 py-2.5 text-right tabular-nums" [class.hidden]="vista.abiertaId()">{{ m.resistenciaDisenoKgCm2 ?? '—' }}</td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        {{ hechos(m) }} de {{ ensayesDe(m).length }}
                        @if (tocaDe(m)) {
                          <span class="ml-1 rounded-md bg-[#FBF0DD] px-1.5 text-xs font-bold text-[#7A5410]">Toca</span>
                        }
                      </td>
                      <td [class]="'px-3 py-2.5 text-right tabular-nums ' + tono28(m)">{{ texto28(m) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="8" class="px-3 py-12 text-center text-texto-suave">{{ datos.isLoading() ? 'Cargando…' : 'Sin muestras con esta búsqueda.' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        @if (vista.abiertaId()) {
          <aside appPanelLateral (cerrar)="vista.cerrar()">
            <div class="flex items-start justify-between gap-3">
              <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ previa()?.folio ?? 'Nueva muestra' }}</h2>
              <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="vista.cerrar()"><ui-icon [icono]="iconos.cerrar" [tamano]="18" /></button>
            </div>

            @if (previa(); as m) {
              <dl class="mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt class="text-texto-suave">Orden</dt>
                <dd>
                  @if (pedido(m); as p) {
                    <a [routerLink]="['/ventas/ordenes', p.folio]" class="font-semibold underline-offset-4 hover:text-epico hover:underline">{{ p.folio }}</a> · {{ p.clienteNombre }}
                  } @else {
                    —
                  }
                </dd>
                <dt class="text-texto-suave">Muestreo</dt>
                <dd>{{ fecha(m.fechaMuestreo) }}</dd>
                <dt class="text-texto-suave">Diseño</dt>
                <dd>{{ m.resistenciaDisenoKgCm2 ?? '—' }} kg/cm²</dd>
                <dt class="text-texto-suave">Revenimiento</dt>
                <dd>{{ m.revenimientoCm != null ? m.revenimientoCm + ' cm' : '—' }}{{ m.temperaturaC != null ? ' · ' + m.temperaturaC + ' °C' : '' }}</dd>
                <dt class="text-texto-suave">Cilindros</dt>
                <dd>{{ m.cilindros }}{{ m.laboratoristaNombre ? ' · ' + m.laboratoristaNombre : '' }}</dd>
              </dl>
              @if (pedido(m)) {
                <button type="button" [class]="botonSecundario + ' mt-3 gap-2'" [disabled]="generando()" (click)="certificado(m.pedidoId)">
                  <ui-icon [icono]="iconos.pdf" [tamano]="16" />Certificado de la orden
                </button>
              }
              <h3 class="mt-4 text-sm font-bold">Ensayes</h3>
              <ul class="mt-2 grid gap-2 text-sm">
                @for (e of ensayesDe(m); track e.id) {
                  <li class="rounded-lg bg-white/85 px-3 py-2">
                    <p class="flex flex-wrap items-baseline justify-between gap-2">
                      <span class="font-semibold">{{ e.edadDias }} días</span>
                      @if (e.resistenciaKgCm2 != null) {
                        <span class="tabular-nums">
                          <strong>{{ e.resistenciaKgCm2 }} kg/cm²</strong>
                          <span [class]="pct(e, m)! >= 100 ? 'text-[#2E5E4A]' : 'text-[#8E332C]'"> · {{ pct(e, m) }} %</span>
                        </span>
                      } @else {
                        <span [class]="toca(e) ? 'font-semibold text-[#7A5410]' : 'text-texto-suave'">{{ toca(e) ? 'Toca desde el ' : 'Programado para el ' }}{{ dia(e.fechaProgramada) }}</span>
                      }
                    </p>
                    @if (e.resistenciaKgCm2 == null && puede('calidad.ensayes.editar')) {
                      <form novalidate class="mt-2 flex flex-wrap items-end gap-2" (submit)="capturar($event, e)">
                        <div>
                          <label [for]="'ens-' + e.id" class="block text-xs font-bold text-texto-suave">Resistencia (kg/cm²)</label>
                          <input [id]="'ens-' + e.id" type="number" step="0.1" class="campo mt-1 h-9 w-32 px-2 text-right tabular-nums" />
                        </div>
                        <button type="submit" class="boton-primario h-9 w-auto px-3 text-xs" [disabled]="ocupado()">Guardar<span class="sr-only"> el ensaye a {{ e.edadDias }} días</span></button>
                      </form>
                    }
                  </li>
                }
              </ul>
            } @else {
              <form novalidate class="mt-4 grid gap-4 sm:grid-cols-2" (submit)="crear($event)">
                <div class="sm:col-span-2">
                  <label for="mue-orden" [class]="etiqueta">Orden</label>
                  <select id="mue-orden" class="campo mt-1 h-10 px-2" [attr.aria-invalid]="intento() && !pedidoId()" aria-describedby="mue-orden-error" (change)="pedidoId.set($any($event.target).value)">
                    <option value="" [selected]="!pedidoId()" disabled>Elige la orden</option>
                    @for (p of ordenes(); track p.id) {
                      <option [value]="p.id">{{ p.folio }} · {{ p.clienteNombre }} · {{ p.obraNombre }}</option>
                    }
                  </select>
                  <p id="mue-orden-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !pedidoId() ? 'Elige la orden.' : '' }}</p>
                </div>
                <div class="sm:col-span-2">
                  <label for="mue-remision" [class]="etiqueta">Remisión (viaje)</label>
                  <select id="mue-remision" class="campo mt-1 h-10 px-2" (change)="remisionId.set($any($event.target).value)">
                    <option value="">Sin remisión</option>
                    @for (v of viajes(); track v.id) {
                      <option [value]="v.id">{{ v.folio }} · {{ v.numeroEconomico ?? '' }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="mue-fecha" [class]="etiqueta">Muestreo</label>
                  <input id="mue-fecha" type="datetime-local" class="campo mt-1 h-10 px-3" [value]="fechaLocal()" (input)="fechaLocal.set($any($event.target).value)" />
                </div>
                <div>
                  <label for="mue-cilindros" [class]="etiqueta">Cilindros</label>
                  <input id="mue-cilindros" type="number" min="1" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="cilindros()" (input)="cilindros.set($any($event.target).valueAsNumber || 4)" />
                </div>
                <div>
                  <label for="mue-rev" [class]="etiqueta">Revenimiento (cm)</label>
                  <input id="mue-rev" type="number" step="0.5" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="rev() ?? ''" (input)="rev.set($any($event.target).valueAsNumber || null)" />
                </div>
                <div>
                  <label for="mue-temp" [class]="etiqueta">Temperatura (°C)</label>
                  <input id="mue-temp" type="number" step="0.5" class="campo mt-1 h-10 px-3 text-right tabular-nums" [value]="temp() ?? ''" (input)="temp.set($any($event.target).valueAsNumber || null)" />
                </div>
                <div class="sm:col-span-2">
                  <label for="mue-lab" [class]="etiqueta">Laboratorista</label>
                  <input id="mue-lab" class="campo mt-1 h-10 px-3" autocomplete="name" [value]="laboratorista()" (input)="laboratorista.set($any($event.target).value)" />
                </div>
                <p class="text-sm text-texto-suave sm:col-span-2">Se programan sus ensayes a 7, 14 y 28 días.</p>
                <div class="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="ocupado()">Registrar muestra</button>
                  <button type="button" [class]="botonSecundario" (click)="vista.cerrar()">Descartar</button>
                </div>
              </form>
            }
            <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
            <p class="mt-3 text-sm font-medium text-critico empty:hidden" role="alert">{{ errorAccion() }}</p>
          </aside>
        }
      </div>
    }
  `,
})
export default class Laboratorio {
  protected readonly puede = permisosSesion();
  private readonly api = inject(CalidadApi);
  private readonly flota = inject(FlotaApi);
  private readonly ventas = inject(VentasService);
  private readonly plantas = inject(PlantasService);
  protected readonly conBackend = this.ventas.conBackend;

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly iconos = { cerrar: X, pdf: FileText };
  protected readonly fecha = fecha;
  protected readonly dia = dia;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly datos = resource({ loader: () => (this.conBackend ? this.api.muestras() : Promise.resolve([] as Muestra[])) });
  private readonly ensayesRes = resource({ loader: () => (this.conBackend ? this.api.ensayes() : Promise.resolve([] as Ensaye[])) });
  private readonly todas = computed(() => (this.datos.hasValue() ? this.datos.value() : []));
  private readonly ensayes = computed(() => (this.ensayesRes.hasValue() ? this.ensayesRes.value() : []));
  protected readonly error = computed(() => (this.datos.error() ? mensajeDe(this.datos.error()) : ''));

  protected pedido(m: Muestra): PedidoVista | undefined {
    return this.ventas.pedidos().find((p) => p.id === m.pedidoId);
  }
  protected ensayesDe(m: Muestra): Ensaye[] {
    return this.ensayes()
      .filter((e) => e.muestraId === m.id)
      .sort((a, b) => a.edadDias - b.edadDias);
  }
  protected hechos(m: Muestra): number {
    return this.ensayesDe(m).filter((e) => e.resistenciaKgCm2 != null).length;
  }
  /** Ya toca romper el cilindro y no hay resultado. */
  protected toca(e: Ensaye): boolean {
    return e.resistenciaKgCm2 == null && e.fechaProgramada.slice(0, 10) <= hoyLocal();
  }
  protected tocaDe(m: Muestra): boolean {
    return this.ensayesDe(m).some((e) => this.toca(e));
  }
  protected pct(e: Ensaye, m: Muestra): number | null {
    return porcentaje(e.resistenciaKgCm2, m.resistenciaDisenoKgCm2);
  }
  private a28(m: Muestra): Ensaye | undefined {
    return this.ensayesDe(m).find((e) => e.edadDias === 28 && e.resistenciaKgCm2 != null);
  }
  protected texto28(m: Muestra): string {
    const e = this.a28(m);
    return e ? `${this.pct(e, m)} %` : '—';
  }
  protected tono28(m: Muestra): string {
    const e = this.a28(m);
    return !e ? 'text-texto-suave' : this.pct(e, m)! >= 100 ? 'font-semibold text-[#2E5E4A]' : 'font-semibold text-[#8E332C]';
  }

  // ---------- Lista ----------
  protected readonly texto = signal('');
  protected readonly filtros = signal<FiltrosElegidos>({});
  private readonly base = computed(() => this.todas().filter((m) => !this.pedido(m) || this.plantas.seleccion().includes(this.pedido(m)!.plantaId)));
  private estado(m: Muestra): string {
    return this.tocaDe(m) ? 'toca' : this.hechos(m) === this.ensayesDe(m).length ? 'completa' : 'en_curso';
  }
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'estado', titulo: 'Ensayes', opciones: opcionesDe(this.base(), (m) => this.estado(m), (id) => ({ toca: 'Toca ensayar', en_curso: 'En curso', completa: 'Completos' })[id] ?? id) },
    { id: 'cliente', titulo: 'Cliente', opciones: opcionesDe(this.base(), (m) => this.pedido(m)?.clienteNombre ?? '—') },
  ]);
  protected readonly filas = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const f = this.filtros();
    return this.base()
      .filter((m) => !q || `${m.folio} ${this.pedido(m)?.folio ?? ''} ${this.pedido(m)?.clienteNombre ?? ''}`.toLowerCase().includes(q))
      .filter((m) => pasaFiltro(f, 'estado', this.estado(m)) && pasaFiltro(f, 'cliente', this.pedido(m)?.clienteNombre ?? '—'))
      .sort((a, b) => Date.parse(b.fechaMuestreo) - Date.parse(a.fechaMuestreo));
  });
  protected readonly tocan = computed(() => this.base().reduce((t, m) => t + this.ensayesDe(m).filter((e) => this.toca(e)).length, 0));
  protected readonly soloTocan = computed(() => (this.filtros()['estado'] ?? []).join() === 'toca');
  protected alternarTocan(): void {
    this.filtros.update((f) => ({ ...f, estado: this.soloTocan() ? [] : ['toca'] }));
  }
  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((m) => ({ id: m.id! }))));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    return m ? `${m} de ${n} seleccionadas` : `${n} ${n === 1 ? 'muestra' : 'muestras'}`;
  });

  // ---------- Vista previa ----------
  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.todas().find((m) => m.id === this.vista.abiertaId()) ?? null);
  protected readonly ocupado = signal(false);
  protected readonly generando = signal(false);
  protected readonly aviso = signal('');
  protected readonly errorAccion = signal('');

  protected async capturar(ev: Event, e: Ensaye): Promise<void> {
    ev.preventDefault();
    const valor = (document.getElementById('ens-' + e.id) as HTMLInputElement | null)?.valueAsNumber;
    if (!valor || valor <= 0) return this.errorAccion.set('Escribe la resistencia obtenida.');
    await this.hacer(async () => {
      await this.api.guardarEnsaye({ ...e, resistenciaKgCm2: valor, fechaEnsaye: hoyLocal() });
      this.ensayesRes.reload();
      this.aviso.set(`Ensaye a ${e.edadDias} días: ${valor} kg/cm².`);
    });
  }
  protected async certificado(pedidoId: string): Promise<void> {
    this.generando.set(true);
    this.errorAccion.set('');
    try {
      await certificadoPdf(await this.api.certificado(pedidoId));
    } catch (e) {
      this.errorAccion.set(mensajeDe(e));
    } finally {
      this.generando.set(false);
    }
  }

  // ---------- Nueva ----------
  protected readonly pedidoId = signal('');
  protected readonly remisionId = signal('');
  protected readonly fechaLocal = signal(aLocal(new Date()));
  protected readonly cilindros = signal(4);
  protected readonly rev = signal<number | null>(null);
  protected readonly temp = signal<number | null>(null);
  protected readonly laboratorista = signal('');
  protected readonly intento = signal(false);
  /** Las órdenes que ya salieron o se entregaron (de donde se toman muestras), la más reciente primero. */
  protected readonly ordenes = computed(() =>
    this.ventas
      .pedidos()
      .filter((p) => ['en_ruta', 'en_obra', 'entregado', 'en_planta'].includes(p.estado) && this.plantas.seleccion().includes(p.plantaId))
      .sort((a, b) => Date.parse(b.fechaHoraEntrega) - Date.parse(a.fechaHoraEntrega)),
  );
  private readonly viajesRes = resource({ params: () => this.pedidoId() || undefined, loader: ({ params }) => this.flota.viajes(params).catch(() => [] as Viaje[]) });
  protected readonly viajes = computed(() => (this.viajesRes.hasValue() ? this.viajesRes.value() : []));

  protected nueva(): void {
    this.pedidoId.set('');
    this.remisionId.set('');
    this.fechaLocal.set(aLocal(new Date()));
    this.cilindros.set(4);
    this.rev.set(null);
    this.temp.set(null);
    this.intento.set(false);
    this.aviso.set('');
    this.errorAccion.set('');
    this.vista.abrir('nueva');
  }
  protected async crear(e: Event): Promise<void> {
    e.preventDefault();
    this.intento.set(true);
    if (!this.pedidoId()) return document.getElementById('mue-orden')?.focus();
    await this.hacer(async () => {
      const r = await this.api.guardarMuestra({
        pedidoId: this.pedidoId(),
        remisionId: this.remisionId() || null,
        fechaMuestreo: new Date(this.fechaLocal()).toISOString(),
        revenimientoCm: this.rev(),
        temperaturaC: this.temp(),
        cilindros: this.cilindros(),
        laboratoristaNombre: this.laboratorista().trim() || null,
        notas: null,
      });
      this.datos.reload();
      this.ensayesRes.reload();
      this.aviso.set(`Muestra ${r.folio ?? ''} registrada; sus ensayes quedaron programados.`);
      if (r.id) this.vista.abrir(r.id);
    });
  }

  private async hacer(f: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    this.errorAccion.set('');
    try {
      await f();
    } catch (e) {
      this.errorAccion.set(mensajeDe(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
