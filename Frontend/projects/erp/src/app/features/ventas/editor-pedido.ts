import { Component, Injector, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, min, required, submit } from '@angular/forms/signals';
import { FieldError, METODO_PAGO, MetodoPago, PedidoVista, lineasPartida, pesos, precioConcreto, totales } from 'ui';
import { CambiosPedido, VentasService } from './datos';

interface Edicion {
  /** datetime-local, en la hora de la planta. */
  entrega: string;
  volumen: number | null;
  /** Precio especial del concreto por m³; vacío, el del tarifario. */
  precio: number | null;
  metodoPago: MetodoPago;
}

/** "-06:00" de la entrega original: la nueva conserva el offset de su planta. */
const offset = (iso: string) => /[+-]\d{2}:\d{2}$/.exec(iso)?.[0] ?? 'Z';

/**
 * Editar una orden de venta (vista previa o vista completa, en Órdenes y Por cobrar): entrega, volumen, precio especial
 * del concreto y método de pago; el importe se recalcula al momento con su partida. Guardar → VentasService.editarPedido
 * (si ya estaba con planta y cambia la entrega o el volumen, se le reenvía).
 */
@Component({
  selector: 'app-editor-pedido',
  imports: [FieldError, FormField],
  host: { class: 'block' },
  template: `
    <form novalidate aria-labelledby="editar-pedido-titulo" class="text-sm" (submit)="guardar($event)">
      <p id="editar-pedido-titulo" class="font-bold">Editar orden</p>
      @if (p().estatusPlanta !== 'no_enviado' && p().estatusPlanta !== 'rechazada') {
        <p class="mt-1 text-texto-suave">Si cambias la entrega o el volumen, se reenvía a {{ p().plantaNombre }} para que lo confirme.</p>
      }
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label for="editar-entrega" class="font-medium">Entrega</label>
          <input
            id="editar-entrega"
            type="datetime-local"
            class="campo mt-1 h-9 px-3"
            aria-describedby="editar-entrega-error"
            [formField]="f.entrega"
          />
          <ui-field-error [campo]="f.entrega" errorId="editar-entrega-error" />
        </div>
        <div>
          <label for="editar-volumen" class="font-medium">Volumen (m³)</label>
          <input
            id="editar-volumen"
            type="number"
            step="0.5"
            class="campo mt-1 h-9 px-3 text-right tabular-nums"
            aria-describedby="editar-volumen-error"
            [formField]="f.volumen"
          />
          <ui-field-error [campo]="f.volumen" errorId="editar-volumen-error" />
        </div>
        <div>
          <label for="editar-precio" class="font-medium">Precio especial del concreto (por m³)</label>
          <input
            id="editar-precio"
            type="number"
            step="0.01"
            class="campo mt-1 h-9 px-3 text-right tabular-nums"
            aria-describedby="editar-precio-error editar-precio-tarifa"
            [placeholder]="tarifa() != null ? pesos(tarifa()!) : ''"
            [formField]="f.precio"
          />
          <p id="editar-precio-tarifa" class="mt-1 text-xs text-texto-suave">
            {{ tarifa() != null ? 'Vacío, la tarifa: $' + pesos(tarifa()!) : 'Sin partida: el importe no se recalcula.' }}
          </p>
          <ui-field-error [campo]="f.precio" errorId="editar-precio-error" />
        </div>
        <div>
          <label for="editar-metodo" class="font-medium">Método de pago</label>
          <select id="editar-metodo" class="campo mt-1 h-9 px-2" [formField]="f.metodoPago">
            @for (m of metodos; track m.id) {
              <option [value]="m.id">{{ m.nombre }}</option>
            }
          </select>
        </div>
      </div>
      <p class="mt-3 flex justify-between border-t border-acero/60 pt-3">
        <span class="font-semibold">Importe con IVA</span>
        <span class="font-bold tabular-nums">\${{ pesos(importe()) }}</span>
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
        <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
      </div>
    </form>
  `,
})
export class EditorPedido implements OnInit {
  private readonly ventas = inject(VentasService);
  private readonly injector = inject(Injector);

  readonly p = input.required<PedidoVista>();
  readonly listo = output<CambiosPedido>();
  readonly descartar = output();

  protected readonly pesos = pesos;
  protected readonly metodos = (Object.keys(METODO_PAGO) as MetodoPago[]).map((id) => ({ id, nombre: METODO_PAGO[id] }));
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly modelo = signal<Edicion>({ entrega: '', volumen: null, precio: null, metodoPago: 'sin_metodo' });
  protected readonly f = form(this.modelo, (m) => {
    required(m.entrega, { message: 'Elige la fecha y hora de entrega.' });
    required(m.volumen, { message: 'Escribe el volumen.' });
    min(m.volumen, 0.5, { message: 'El mínimo es 0.5 m³.' });
    min(m.precio, 1, { message: 'El precio debe ser mayor a cero.' });
  });

  private readonly base = computed(() => this.ventas.partidaDe(this.p()));
  protected readonly tarifa = computed(() => {
    const b = this.base().partida;
    return b ? precioConcreto({ ...b, precioM3: undefined }) : null;
  });
  /** El importe con lo que va escrito (mismo cálculo que guardar). */
  protected readonly importe = computed(() => {
    const { partida, descuento } = this.base();
    const e = this.modelo();
    if (!partida || !e.volumen) return this.p().importe;
    return totales(lineasPartida({ ...partida, volumenM3: e.volumen, precioM3: e.precio ?? undefined }), descuento).neto;
  });

  private inicial = '';
  /** Hay algo distinto de lo guardado (quien lo usa pregunta antes de tirarlo). */
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  ngOnInit(): void {
    const p = this.p();
    const b = this.base().partida;
    this.modelo.set({
      entrega: p.fechaHoraEntrega.slice(0, 16),
      volumen: p.volumenM3,
      precio: b?.precioM3 ?? null,
      metodoPago: p.metodoPago ?? 'sin_metodo',
    });
    this.inicial = JSON.stringify(this.modelo());
    afterNextRender(() => document.getElementById('editar-entrega')?.focus(), { injector: this.injector });
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.listo.emit({
        fechaHoraEntrega: `${m.entrega}:00${offset(this.p().fechaHoraEntrega)}`,
        volumenM3: m.volumen!,
        precioM3: m.precio ?? undefined,
        metodoPago: m.metodoPago,
      });
      return undefined;
    });
    if (valido) return;
    const id = this.f.entrega().invalid() ? 'editar-entrega' : this.f.volumen().invalid() ? 'editar-volumen' : 'editar-precio';
    document.getElementById(id)?.focus();
  }
}
