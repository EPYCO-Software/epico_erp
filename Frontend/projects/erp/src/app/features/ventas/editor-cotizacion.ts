import { Component, Injector, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormField, applyEach, form, max, min, required, submit } from '@angular/forms/signals';
import { Plus, Trash2 } from 'lucide';
import {
  Cotizacion,
  CotizacionVista,
  FieldError,
  Icon,
  PartidaCotizacion,
  RESISTENCIAS,
  SERVICIOS,
  ServicioObra,
  etiquetas,
  pesos,
  precioConcreto,
  textoResistencia,
  textoServicios,
  totalesCotizacion,
} from 'ui';
import { VentasService, especificacionBase } from './datos';

interface PartidaEditable extends PartidaCotizacion {
  /** Precio del concreto por m³ en edición: el especial o, si no hay, el del tarifario. */
  precio: number | null;
}

interface Edicion {
  partidas: PartidaEditable[];
  descuento: number | null;
}

export type CambiosCotizacion = Pick<Cotizacion, 'partidas' | 'descuento'>;

/** El precio especial se guarda solo si difiere del tarifario; el descuento, solo si hay. */
export function cambiosDe(e: Edicion): CambiosCotizacion {
  return {
    partidas: e.partidas.map(({ precio, ...p }) => {
      const tarifa = precioConcreto(p);
      return { ...p, precioM3: (precio ?? tarifa) === tarifa ? undefined : (precio ?? tarifa) };
    }),
    descuento: e.descuento || undefined,
  };
}

/** "-06:00" de la fecha de la cotización: las entregas llevan el offset de su planta. */
const offset = (iso: string) => /[+-]\d{2}:\d{2}$/.exec(iso)?.[0] ?? 'Z';

/**
 * Editar una cotización (en la vista previa o en la vista completa): precio especial del concreto de cada producto,
 * servicios, agregar o quitar productos y un descuento sobre el subtotal; los totales se ven al momento.
 * Los cambios quedan aquí hasta "Guardar cambios" (VentasService.guardar).
 */
@Component({
  selector: 'app-editor-cotizacion',
  imports: [DecimalPipe, FieldError, FormField, Icon],
  host: { class: '@container block' },
  template: `
    <form novalidate aria-labelledby="editar-titulo" (submit)="guardar($event)">
      <p id="editar-titulo" class="font-bold">Editar cotización</p>
      @if (c().estado === 'enviada') {
        <p class="mt-1 text-sm text-texto-suave">
          Ya se envió al cliente: al guardar se vuelve la revisión R{{ c().revision + 1 }} y queda en borrador hasta que
          la envíes otra vez.
        </p>
      }

      <ul class="mt-3 space-y-3">
        @for (p of modelo().partidas; track p.id; let i = $index) {
          <li class="rounded-xl bg-white/80 p-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold">{{ p.nombre }} · {{ p.volumenM3 | number: '1.0-1' }} m³</p>
                <p class="text-texto-suave">{{ obra(p.obraId) }} · {{ etiquetas(p.especificacion).join(' · ') }}</p>
              </div>
              <button
                type="button"
                class="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-critico/10 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico disabled:pointer-events-none disabled:opacity-40"
                [attr.aria-label]="'Quitar ' + p.nombre"
                [disabled]="modelo().partidas.length === 1"
                (click)="quitar(i)"
              >
                <ui-icon [icono]="iconos.quitar" [tamano]="17" />
              </button>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <label [for]="'editar-precio-' + i" class="font-medium">Precio del concreto</label>
              <span class="flex items-center gap-1.5">
                $
                <input
                  type="number"
                  step="0.01"
                  class="campo h-9 w-32 px-3 text-right tabular-nums"
                  [id]="'editar-precio-' + i"
                  [attr.aria-describedby]="'editar-precio-error-' + i + ' editar-precio-tarifa-' + i"
                  [formField]="f.partidas[i].precio"
                />
                por m³
              </span>
              <span [id]="'editar-precio-tarifa-' + i" class="text-texto-suave">Tarifa \${{ pesos(tarifa(p)) }}</span>
            </div>
            <ui-field-error [campo]="f.partidas[i].precio" [errorId]="'editar-precio-error-' + i" />

            <fieldset class="mt-3">
              <legend class="font-medium">Servicios</legend>
              <div class="mt-1 grid gap-x-4 @lg:grid-cols-2">
                @for (s of servicios; track s.id) {
                  <label class="flex min-h-8 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      class="casilla"
                      [checked]="p.servicios.includes(s.id)"
                      (change)="alternarServicio(i, s.id)"
                    />{{ s.nombre }}
                  </label>
                }
              </div>
              @if (p.maquinaria.length) {
                <p class="mt-1 text-texto-suave">Renta de maquinaria: {{ maquinaria(p) }}</p>
              }
            </fieldset>
          </li>
        }
      </ul>

      @if (agregando()) {
        <fieldset class="mt-3 rounded-xl border border-acero/60 bg-white/60 p-3 text-sm">
          <legend class="px-1 font-semibold">Agregar producto</legend>
          <div class="grid gap-3 @lg:grid-cols-2">
            <div>
              <label for="nuevo-producto" class="font-medium">Producto</label>
              <select id="nuevo-producto" class="campo mt-1 h-9 px-2" [formField]="nuevo.producto">
                <optgroup label="Concreto f´c (compresión)">
                  @for (v of resistencias.fc; track v) {
                    <option [value]="'fc-' + v">Concreto f´c {{ v }} kg/cm²</option>
                  }
                </optgroup>
                <optgroup label="Concreto MR (pavimentos)">
                  @for (v of resistencias.mr; track v) {
                    <option [value]="'mr-' + v">Concreto MR {{ v }} kg/cm²</option>
                  }
                </optgroup>
              </select>
            </div>
            <div>
              <label for="nuevo-volumen" class="font-medium">Volumen (m³)</label>
              <input
                id="nuevo-volumen"
                type="number"
                step="0.5"
                class="campo mt-1 h-9 px-3"
                aria-describedby="nuevo-volumen-error"
                [formField]="nuevo.volumen"
                (keydown.enter)="$event.preventDefault(); agregar()"
              />
              <ui-field-error [campo]="nuevo.volumen" errorId="nuevo-volumen-error" />
            </div>
            <div>
              <label for="nuevo-obra" class="font-medium">Obra</label>
              <select id="nuevo-obra" class="campo mt-1 h-9 px-2" [formField]="nuevo.obraId">
                @for (o of obrasCliente(); track o.id) {
                  <option [value]="o.id">{{ o.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="nuevo-entrega" class="font-medium">Entrega</label>
              <input
                id="nuevo-entrega"
                type="datetime-local"
                class="campo mt-1 h-9 px-3"
                aria-describedby="nuevo-entrega-error"
                [formField]="nuevo.entrega"
                (keydown.enter)="$event.preventDefault(); agregar()"
              />
              <ui-field-error [campo]="nuevo.entrega" errorId="nuevo-entrega-error" />
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" [class]="botonSecundario" (click)="agregar()">Agregar</button>
            <button type="button" [class]="botonTexto" (click)="agregando.set(false)">Cancelar</button>
          </div>
        </fieldset>
      } @else {
        <button type="button" [class]="botonTexto + ' mt-2'" (click)="abrirNuevo()">
          <ui-icon [icono]="iconos.agregar" [tamano]="17" />Agregar producto
        </button>
      }

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-acero/60 pt-4 text-sm">
        <label for="editar-descuento" class="font-semibold">Descuento sobre el subtotal</label>
        <span class="flex items-center gap-1.5">
          <input
            id="editar-descuento"
            type="number"
            step="0.5"
            class="campo h-9 w-24 px-3 text-right tabular-nums"
            aria-describedby="editar-descuento-error"
            [formField]="f.descuento"
          />%
        </span>
      </div>
      <ui-field-error [campo]="f.descuento" errorId="editar-descuento-error" />

      <dl class="mt-3 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt class="text-texto-suave">Subtotal</dt>
        <dd class="text-right">\${{ pesos(total().subtotal) }}</dd>
        @if (total().descuento) {
          <dt class="text-texto-suave">Descuento {{ modelo().descuento | number: '1.0-2' }}%</dt>
          <dd class="text-right">−\${{ pesos(total().descuento) }}</dd>
        }
        <dt class="text-texto-suave">IVA 16%</dt>
        <dd class="text-right">\${{ pesos(total().iva) }}</dd>
        <dt class="font-bold">Neto</dt>
        <dd class="text-right font-bold">\${{ pesos(total().neto) }}</dd>
      </dl>

      <div class="mt-4 flex flex-wrap gap-2">
        <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
        <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
      </div>
    </form>
  `,
})
export class EditorCotizacion implements OnInit {
  private readonly injector = inject(Injector);

  readonly c = input.required<CotizacionVista>();
  readonly listo = output<CambiosCotizacion>();
  readonly descartar = output();

  protected readonly iconos = { quitar: Trash2, agregar: Plus };
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonTexto =
    'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico';
  // La renta de maquinaria lleva días por equipo: se conserva tal cual (se ve como texto) y no se edita aquí.
  protected readonly servicios = SERVICIOS.filter((s) => s.id !== 'renta-maquinaria');
  protected readonly resistencias = RESISTENCIAS;
  protected readonly etiquetas = etiquetas;
  protected readonly pesos = pesos;
  protected readonly tarifa = precioConcreto;
  protected readonly maquinaria = (p: PartidaCotizacion) => textoServicios({ ...p, servicios: [] });
  private readonly ventas = inject(VentasService);
  protected readonly obra = (id: string) => this.ventas.obras().find((o) => o.id === id)?.nombre ?? '';
  protected readonly obrasCliente = computed(() => this.ventas.obras().filter((o) => o.clienteId === this.c().clienteId));

  protected readonly modelo = signal<Edicion>({ partidas: [], descuento: 0 });
  protected readonly f = form(this.modelo, (m) => {
    applyEach(m.partidas, (p) => {
      required(p.precio, { message: 'Escribe el precio por m³.' });
      min(p.precio, 1, { message: 'El precio debe ser mayor a cero.' });
    });
    min(m.descuento, 0, { message: 'El descuento no puede ser negativo.' });
    max(m.descuento, 100, { message: 'El descuento no puede pasar de 100 %.' });
  });
  protected readonly total = computed(() => totalesCotizacion(cambiosDe(this.modelo())));
  private inicial = '';
  /** Hay algo distinto de lo guardado (quien lo usa pregunta antes de tirarlo). */
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  protected readonly agregando = signal(false);
  protected readonly nuevo = form(
    signal<{ producto: string; volumen: number | null; obraId: string; entrega: string }>({
      producto: 'fc-200',
      volumen: null,
      obraId: '',
      entrega: '',
    }),
    (n) => {
      required(n.volumen, { message: 'Escribe el volumen.' });
      min(n.volumen, 0.5, { message: 'El mínimo es 0.5 m³.' });
      required(n.entrega, { message: 'Elige la fecha y hora de entrega.' });
    },
  );

  ngOnInit(): void {
    const c = this.c();
    this.modelo.set({
      partidas: c.partidas.map((p) => ({ ...p, precio: p.precioM3 ?? precioConcreto(p) })),
      descuento: c.descuento ?? 0,
    });
    this.inicial = JSON.stringify(this.modelo());
    this.enfocar('editar-precio-0');
  }

  protected alternarServicio(i: number, s: ServicioObra): void {
    this.modelo.update((e) => ({
      ...e,
      partidas: e.partidas.map((p, j) =>
        j === i ? { ...p, servicios: p.servicios.includes(s) ? p.servicios.filter((x) => x !== s) : [...p.servicios, s] } : p,
      ),
    }));
  }

  /** El foco pasa al precio del producto que quedó en su lugar (o al anterior, si era el último). */
  protected quitar(i: number): void {
    this.modelo.update((e) => ({ ...e, partidas: e.partidas.filter((_, j) => j !== i) }));
    this.enfocar('editar-precio-' + Math.min(i, this.modelo().partidas.length - 1));
  }

  /** Parte de la obra y la entrega del primer producto. */
  protected abrirNuevo(): void {
    const primera = this.modelo().partidas[0];
    this.nuevo().reset({ producto: 'fc-200', volumen: null, obraId: primera.obraId, entrega: primera.entrega.slice(0, 16) });
    this.agregando.set(true);
    this.enfocar('nuevo-producto');
  }

  protected async agregar(): Promise<void> {
    const valido = await submit(this.nuevo, async () => {
      const n = this.nuevo().value();
      const [tipo, kg] = n.producto.split('-');
      const especificacion = especificacionBase(tipo as 'fc' | 'mr', Number(kg));
      const p: PartidaCotizacion = {
        id: crypto.randomUUID(),
        nombre: `Concreto ${textoResistencia(especificacion)}`,
        solucionId: 'personalizado',
        especificacion,
        volumenM3: n.volumen!,
        servicios: [],
        maquinaria: [],
        obraId: n.obraId,
        entrega: `${n.entrega}:00${offset(this.c().fecha)}`,
      };
      this.modelo.update((e) => ({ ...e, partidas: [...e.partidas, { ...p, precio: precioConcreto(p) }] }));
      this.agregando.set(false);
      this.enfocar('editar-precio-' + (this.modelo().partidas.length - 1));
      return undefined;
    });
    if (!valido) this.enfocar(this.nuevo.volumen().invalid() ? 'nuevo-volumen' : 'nuevo-entrega');
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      this.listo.emit(cambiosDe(this.modelo()));
      return undefined;
    });
    if (valido) return;
    // Al enviar inválido, el foco va al primer campo con error.
    const i = this.modelo().partidas.findIndex((_, j) => this.f.partidas[j].precio().invalid());
    this.enfocar(i >= 0 ? 'editar-precio-' + i : 'editar-descuento');
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
