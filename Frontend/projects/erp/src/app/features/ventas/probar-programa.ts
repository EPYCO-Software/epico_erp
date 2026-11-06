import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Plus, X } from 'lucide';
import { Icon, pesos } from 'ui';
import { VentasService } from './datos';
import { ContextoOrden, Programa, evaluar } from './lealtad';

interface Linea {
  productoId: string;
  cantidad: number;
}

/** Hoy en AAAA-MM-DD (local). */
const hoy = () => new Date().toLocaleDateString('en-CA');

/**
 * Probar un programa con una orden de ejemplo: productos y cantidades (a precio de lista), y lo que pida su tipo
 * (código o cupón, puntos o sellos que ya tiene el cliente, traslado, fecha). Muestra en vivo el descuento, por qué
 * sí o no aplica, y lo que gana para después (evaluar() de lealtad.ts, la misma lógica que usará la cotización).
 */
@Component({
  selector: 'app-probar-programa',
  imports: [Icon],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="probar-titulo" class="text-sm">
      <p id="probar-titulo" role="heading" [attr.aria-level]="nivel()" class="font-bold">Probar con una orden</p>
      <p class="mt-1 text-texto-suave">Arma una orden de ejemplo para ver qué da el programa. No guarda nada.</p>

      <ul class="mt-3 grid gap-2" aria-label="Productos de la orden">
        @for (l of lineas(); track $index; let i = $index) {
          <li class="flex flex-wrap items-center gap-2">
            <label [for]="'probar-producto-' + i" class="sr-only">Producto {{ i + 1 }}</label>
            <select [id]="'probar-producto-' + i" class="campo h-9 min-w-0 flex-1 px-2" (change)="cambiar(i, { productoId: $any($event.target).value })">
              @for (p of productos(); track p.id) {
                <option [value]="p.id" [selected]="p.id === l.productoId">[{{ p.codigo }}] {{ p.nombre }}</option>
              }
            </select>
            <label [for]="'probar-cantidad-' + i" class="sr-only">Cantidad de producto {{ i + 1 }}</label>
            <input
              [id]="'probar-cantidad-' + i"
              type="number"
              min="0"
              step="1"
              class="campo h-9 w-20 px-2 text-right tabular-nums"
              [value]="l.cantidad"
              (input)="cambiar(i, { cantidad: +$any($event.target).value || 0 })"
            />
            <span class="w-28 text-right tabular-nums">\${{ pesos(importe(l)) }}</span>
            <button type="button" [attr.aria-label]="'Quitar producto ' + (i + 1)" [class]="botonIcono" [disabled]="lineas().length === 1" (click)="quitar(i)">
              <ui-icon [icono]="iconos.quitar" [tamano]="16" />
            </button>
          </li>
        }
      </ul>
      <button type="button" class="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-semibold text-epico-oscuro hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico" (click)="agregar()">
        <ui-icon [icono]="iconos.agregar" [tamano]="16" />Agregar producto
      </button>

      <div class="mt-3 flex flex-wrap gap-3">
        @if (pideCodigo()) {
          <div>
            <label for="probar-codigo" [class]="etiqueta">{{ programa().tipo === 'codigo' ? 'Código' : 'Cupón' }}</label>
            <input id="probar-codigo" class="campo mt-1 h-9 w-40 px-2 uppercase" [value]="ctx().codigo" (input)="ctx.set({ ...ctx(), codigo: $any($event.target).value })" />
          </div>
        }
        @if (programa().tipo === 'lealtad' || programa().tipo === 'sellos') {
          <div>
            <label for="probar-saldo" [class]="etiqueta">{{ programa().tipo === 'lealtad' ? 'Puntos que ya tiene' : 'Sellos que ya tiene' }}</label>
            <input id="probar-saldo" type="number" min="0" class="campo mt-1 h-9 w-32 px-2 text-right tabular-nums" [value]="ctx().saldo" (input)="ctx.set({ ...ctx(), saldo: +$any($event.target).value || 0 })" />
          </div>
        }
        @if (programa().recompensa === 'traslado' && programa().tipo !== 'compra-x') {
          <div>
            <label for="probar-traslado" [class]="etiqueta">Traslado de la orden ($)</label>
            <input id="probar-traslado" type="number" min="0" class="campo mt-1 h-9 w-32 px-2 text-right tabular-nums" [value]="ctx().traslado" (input)="ctx.set({ ...ctx(), traslado: +$any($event.target).value || 0 })" />
          </div>
        }
        <div>
          <label for="probar-fecha" [class]="etiqueta">Fecha de la orden</label>
          <input id="probar-fecha" type="date" class="campo mt-1 h-9 w-auto px-2" [value]="ctx().fecha" (input)="ctx.set({ ...ctx(), fecha: $any($event.target).value })" />
        </div>
      </div>

      <div class="mt-4 rounded-xl border p-4" [class]="r().aplica ? 'border-[#9CC5B0] bg-[#E3EFE9]' : 'border-acero/70 bg-white/70'" aria-live="polite">
        <p [class]="r().aplica ? 'font-bold text-[#2E5E4A]' : 'font-bold'">{{ r().aplica ? 'Aplica' : 'No aplica' }}: {{ r().motivo }}</p>
        <dl class="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-0.5 tabular-nums">
          <dt>Subtotal</dt>
          <dd class="text-right">\${{ pesos(subtotal()) }}</dd>
          <dt>Descuento</dt>
          <dd class="text-right">−\${{ pesos(r().descuento) }}</dd>
          <dt class="font-bold">Total</dt>
          <dd class="text-right font-bold">\${{ pesos(subtotal() - r().descuento) }}</dd>
        </dl>
        @if (r().gana) {
          <p class="mt-2">Gana para después: <span class="font-semibold">{{ r().gana }}</span></p>
        }
      </div>
    </section>
  `,
})
export class ProbarPrograma {
  private readonly ventas = inject(VentasService);

  readonly programa = input.required<Programa>();
  /** Nivel de su título (3 en la vista previa, 2 en la completa). */
  readonly nivel = input(3);

  protected readonly iconos = { quitar: X, agregar: Plus };
  protected readonly pesos = pesos;
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico disabled:opacity-40';
  protected readonly productos = this.ventas.productos;
  protected readonly pideCodigo = computed(() => ['codigo', 'cupones', 'proxima-orden'].includes(this.programa().tipo));

  /** Al pasar a otro programa, una orden de ejemplo con lo que le aplica. */
  private readonly id = computed(() => this.programa().id);
  protected readonly lineas = linkedSignal<string, Linea[]>({
    source: this.id,
    computation: () => {
      const p = this.programa();
      const producto = p.productoId || this.productos().find((x) => !p.categoria || x.categoria === p.categoria)?.id || this.productos()[0].id;
      return [{ productoId: producto, cantidad: p.tipo === 'compra-x' ? p.cantidadX + p.cantidadY : 10 }];
    },
  });
  protected readonly ctx = linkedSignal<string, ContextoOrden>({
    source: this.id,
    computation: () => ({ codigo: '', saldo: 0, traslado: 1200, fecha: hoy() }),
  });

  protected importe(l: Linea): number {
    return l.cantidad * (this.productos().find((p) => p.id === l.productoId)?.precio ?? 0);
  }

  private readonly orden = computed(() =>
    this.lineas().map((l) => {
      const p = this.productos().find((x) => x.id === l.productoId)!;
      return { productoId: p.id, categoria: p.categoria, cantidad: l.cantidad, precio: p.precio };
    }),
  );
  protected readonly subtotal = computed(() => this.orden().reduce((t, l) => t + l.cantidad * l.precio, 0));
  protected readonly r = computed(() => evaluar(this.programa(), this.orden(), this.ctx()));

  protected cambiar(i: number, c: Partial<Linea>): void {
    this.lineas.update((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));
  }
  protected agregar(): void {
    this.lineas.update((l) => [...l, { productoId: this.productos()[0].id, cantidad: 1 }]);
  }
  protected quitar(i: number): void {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }
}
