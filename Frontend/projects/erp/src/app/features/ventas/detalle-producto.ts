import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { FormField, form, min, required, submit, validate } from '@angular/forms/signals';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Maximize2, PencilLine, X } from 'lucide';
import { CATEGORIAS_PRODUCTO, EstadoPedidoEtiqueta, FechaZonaPipe, FieldError, Icon, ProductoTarifa, TIPOS_PRODUCTO, TIPO_DE_CATEGORIA, pesos } from 'ui';
import { ESTADOS_COTIZACION, NuevoProducto, VentasService, delTarifario, existenciasBajas, textoEquipo } from './datos';
import { FormProducto } from './form-producto';

/**
 * Un producto, igual en la vista previa de Productos y en su vista completa: tipo, código, categoría, unidad, precio de
 * lista (el del tarifario es el mismo que usa la cotización) y mínimo; si es producto general, sus existencias con el
 * registro de entradas y salidas (historial); y su uso: en qué cotizaciones y órdenes va, con los m³.
 */
@Component({
  selector: 'app-detalle-producto',
  imports: [DecimalPipe, FormProducto, EstadoPedidoEtiqueta, FechaZonaPipe, FieldError, FormField, Icon, RouterLink],
  // Bloque: un host en línea con bloques adentro hace que el navegador lo ponga encima de sus botones al apuntar.
  host: { class: 'block' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <p class="text-sm font-semibold text-texto-suave">{{ categoria() }}</p>
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ p().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ p().nombre }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ p().codigo }}{{ completa() ? '' : ' · ' + categoria() }}</p>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/ventas/productos', p().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (!editando()) {
      <button #botonEditar type="button" [class]="botonSecundario + ' mt-3'" (click)="editar()">
        <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
      </button>
    }
    <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ avisoEdicion() }}</p>

    @if (editando()) {
      <app-form-producto class="mt-4 border-t border-acero/60 pt-4" [producto]="p()" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
      <dl class="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-texto-suave">Tipo</dt>
        <dd>{{ tipo() }}</dd>
        <dt class="text-texto-suave">Código</dt>
        <dd>{{ p().codigo }}</dd>
        <dt class="text-texto-suave">Categoría</dt>
        <dd>{{ categoria() }}</dd>
        <dt class="text-texto-suave">Unidad</dt>
        <dd>{{ p().unidad }}</dd>
        @if (p().equipo; as e) {
          <dt class="text-texto-suave">Renta de</dt>
          <dd>{{ textoEquipo(e) }}</dd>
        }
        @if (p().minimo; as minimo) {
          <dt class="text-texto-suave">Mínimo</dt>
          <dd>{{ minimo }} m³ (se cobra al menos eso)</dd>
        }
      </dl>
      <p class="shrink-0 text-right">
        <span class="block text-xs tracking-wide text-texto-suave uppercase">Precio de lista</span>
        <span class="text-lg font-bold">\${{ pesos(p().precio) }}</span>
        <span class="block text-xs text-texto-suave">por {{ p().unidad === 'M³' ? 'm³' : p().unidad.toLowerCase() }}, antes de IVA</span>
      </p>
    </div>
    <p class="mt-3 text-sm">{{ p().descripcion }}</p>
    @if (tarifario()) {
      <p class="mt-2 text-xs text-texto-suave">
        Es el precio del tarifario, el mismo con que se cotiza; los precios especiales se dan en cada cotización.
      </p>
    }

    @if (p().existencias != null) {
      <section aria-labelledby="existencias-titulo" class="mt-5 border-t border-acero/60 pt-4 text-sm">
        @if (completa()) {
          <h2 id="existencias-titulo" class="font-bold">Existencias</h2>
        } @else {
          <h3 id="existencias-titulo" class="font-bold">Existencias</h3>
        }
        <p class="mt-1 flex flex-wrap items-center gap-2">
          <span class="text-2xl font-bold tabular-nums">{{ p().existencias }}</span>
          <span>{{ p().unidad.toLowerCase() }}</span>
          @if (bajas()) {
            <span class="rounded-md bg-[#F6E3E1] px-2 py-0.5 text-xs font-bold text-[#8E332C]">Pocas existencias</span>
          }
        </p>
        <p class="text-texto-suave">Aviso con {{ p().minimoExistencias }} o menos.</p>

        <!-- Control: entradas (compras, devoluciones) y salidas (ventas, mermas); cada una queda en el historial -->
        <form novalidate class="mt-3 grid gap-2 sm:grid-cols-[auto_8rem_minmax(0,1fr)_auto] sm:items-end" aria-label="Registrar movimiento" (submit)="mover($event)">
          <fieldset class="flex gap-3">
            <legend class="sr-only">Movimiento</legend>
            <label class="flex min-h-9 items-center gap-1.5"><input type="radio" class="casilla rounded-full" value="entrada" [formField]="movimiento.tipo" />Entrada</label>
            <label class="flex min-h-9 items-center gap-1.5"><input type="radio" class="casilla rounded-full" value="salida" [formField]="movimiento.tipo" />Salida</label>
          </fieldset>
          <div>
            <label for="movimiento-cantidad" class="font-medium">Cantidad</label>
            <input
              id="movimiento-cantidad"
              type="number"
              step="1"
              class="campo mt-1 h-9 px-3 text-right tabular-nums"
              aria-describedby="movimiento-cantidad-error"
              [formField]="movimiento.cantidad"
            />
          </div>
          <div>
            <label for="movimiento-nota" class="font-medium">Nota (opcional)</label>
            <input id="movimiento-nota" class="campo mt-1 h-9 px-3" placeholder="Compra, venta de mostrador, merma…" [formField]="movimiento.nota" />
          </div>
          <button type="submit" class="boton-primario h-9 w-auto px-3.5 text-sm">Registrar movimiento</button>
        </form>
        <ui-field-error [campo]="movimiento.cantidad" errorId="movimiento-cantidad-error" />
        <p class="mt-2 font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
      </section>
    }
    }

    <section aria-labelledby="uso-titulo" class="mt-5 border-t border-acero/60 pt-4 text-sm">
      <!-- h2 en la vista completa (bajo el h1), h3 en la vista previa (bajo su h2) -->
      @if (completa()) {
        <h2 id="uso-titulo" class="font-bold">Uso</h2>
      } @else {
        <h3 id="uso-titulo" class="font-bold">Uso</h3>
      }
      <p class="mt-1 text-texto-suave">
        En {{ uso().cotizaciones.length }} {{ uso().cotizaciones.length === 1 ? 'cotización' : 'cotizaciones' }} y
        {{ uso().pedidos.length }} {{ uso().pedidos.length === 1 ? 'orden' : 'órdenes' }}
        @if (uso().m3) {
          · {{ uso().m3 | number: '1.0-1' }} m³ cotizados (sin canceladas)
        }
      </p>
      @if (uso().cotizaciones.length) {
        <ul class="mt-2 space-y-1" aria-label="Cotizaciones que lo llevan">
          @for (c of uso().cotizaciones.slice(0, limite()); track c.id) {
            <li class="flex flex-wrap items-baseline gap-x-2">
              <a [routerLink]="['/ventas/cotizaciones', c.id]" [class]="enlace">{{ c.folio }}</a>
              <span>{{ c.clienteNombre }}</span>
              <span class="text-texto-suave">{{ c.fecha | fechaZona: c.zonaHoraria }}</span>
              <span class="rounded-md px-2 py-0.5 text-xs font-bold {{ estados[c.estado].clase }}">{{ estados[c.estado].nombre }}</span>
            </li>
          }
        </ul>
      }
      @if (uso().pedidos.length) {
        <ul class="mt-2 space-y-1" aria-label="Órdenes que lo llevan">
          @for (o of uso().pedidos.slice(0, limite()); track o.id) {
            <li class="flex flex-wrap items-center gap-x-2">
              <a [routerLink]="['/ventas/ordenes', o.folio]" [class]="enlace">{{ o.folio }}</a>
              <span>{{ o.clienteNombre }}</span>
              <ui-estado-pedido [estado]="o.estado" />
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DetalleProducto {
  private readonly ventas = inject(VentasService);

  readonly p = input.required<ProductoTarifa>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = { cerrar: X, completa: Maximize2, editar: PencilLine };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly enlace =
    'rounded font-semibold text-epico-oscuro underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly pesos = pesos;
  protected readonly textoEquipo = textoEquipo;
  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly categoria = computed(() => CATEGORIAS_PRODUCTO[this.p().categoria]);
  protected readonly tipo = computed(() => TIPOS_PRODUCTO[TIPO_DE_CATEGORIA[this.p().categoria]]);
  protected readonly bajas = computed(() => existenciasBajas(this.p()));
  protected readonly tarifario = computed(() => delTarifario(this.p()));

  // Movimiento de existencias (productos generales). Al pasar a otro producto se limpia.
  private readonly id = computed(() => this.p().id);
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });

  // Edición: al pasar a otro producto se sale de ella; guardar no la reinicia.
  private readonly injector = inject(Injector);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly avisoEdicion = linkedSignal({ source: this.id, computation: () => '' });
  private readonly editor = viewChild(FormProducto);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

  protected editar(): void {
    this.avisoEdicion.set('');
    this.editando.set(true);
  }

  protected guardar(cambios: NuevoProducto): void {
    this.ventas.editarProducto(this.p().id, cambios);
    this.terminar('Cambios guardados.');
  }

  /** Al salir de la edición el foco vuelve a "Editar". */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.avisoEdicion.set(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }
  private readonly modeloMovimiento = signal<{ tipo: 'entrada' | 'salida'; cantidad: number | null; nota: string }>({
    tipo: 'entrada',
    cantidad: null,
    nota: '',
  });
  protected readonly movimiento = form(this.modeloMovimiento, (m) => {
    required(m.cantidad, { message: 'Escribe la cantidad.' });
    min(m.cantidad, 1, { message: 'La cantidad mínima es 1.' });
    validate(m.cantidad, ({ value, valueOf }) =>
      valueOf(m.tipo) === 'salida' && (value() ?? 0) > (this.p().existencias ?? 0)
        ? { kind: 'sin-existencias', message: `Solo hay ${this.p().existencias} ${this.p().unidad.toLowerCase()}.` }
        : undefined,
    );
  });

  protected async mover(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.movimiento, async () => {
      const { tipo, cantidad, nota } = this.modeloMovimiento();
      this.ventas.moverExistencias(this.p().id, tipo, cantidad!, nota);
      // Del servicio: el producto de la entrada se actualiza hasta el siguiente ciclo.
      const quedan = this.ventas.productos().find((x) => x.id === this.p().id)?.existencias;
      this.aviso.set(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${cantidad} registrada: quedan ${quedan}.`);
      this.movimiento().reset({ tipo, cantidad: null, nota: '' });
      return undefined;
    });
    if (!valido) document.getElementById('movimiento-cantidad')?.focus();
  }
  protected readonly uso = computed(() => this.ventas.usoDe(this.p().id));
  /** En la vista previa, las 5 más recientes; en la vista completa, todas. */
  protected readonly limite = computed(() => (this.completa() ? undefined : 5));
}
