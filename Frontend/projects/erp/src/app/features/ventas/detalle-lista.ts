import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Maximize2, PencilLine, Plus, Trash2, X } from 'lucide';
import { Icon } from 'ui';
import { VentasService } from './datos';
import { EditorLista } from './editor-lista';
import { DatosLista, ListaPrecios, ListasPreciosService, MONEDAS, ReglaPrecio, textoAplicaEn, textoPlantas, textoPrecio, textoVigencia } from './precios';
import { ReglaPrecioDialogo } from './regla-precio';

/**
 * Una lista de precios, igual en la vista previa y en la vista completa: moneda y plantas (Editar las cambia con el
 * nombre) y sus líneas (Precios de venta): aplicar en, precio, cantidad mínima y vigencia. "Agregar una línea" o clic en
 * una abre su diálogo (regla-precio.ts); el bote la quita, con confirmación.
 */
@Component({
  selector: 'app-detalle-lista',
  imports: [EditorLista, Icon, ReglaPrecioDialogo, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <p class="text-sm font-semibold text-texto-suave">Lista de precios</p>
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ l().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ l().nombre }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ l().moneda }} · {{ plantas() }}</p>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/ventas/listas-de-precios', l().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (editando()) {
      <app-editor-lista class="mt-4 border-t border-acero/60 pt-4" [lista]="l()" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
      <button #botonEditar type="button" [class]="botonSecundario + ' mt-3'" (click)="editar()">
        <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
      </button>
      <dl class="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-texto-suave">Moneda</dt>
        <dd>{{ monedas[l().moneda] }} ({{ l().moneda }})</dd>
        <dt class="text-texto-suave">Plantas</dt>
        <dd>{{ plantas() }}</dd>
      </dl>
    }
    <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>

    <section aria-labelledby="reglas-titulo" class="mt-5 border-t border-acero/60 pt-4 text-sm">
      @if (completa()) {
        <h2 id="reglas-titulo" class="font-bold">Precios de venta</h2>
      } @else {
        <h3 id="reglas-titulo" class="font-bold">Precios de venta</h3>
      }
      <p class="mt-1 text-texto-suave">
        {{ l().reglas.length ? '' : 'Sin líneas: se cobra el precio de lista de cada producto.' }}
      </p>
      <div class="mt-2 overflow-x-auto">
        <table class="w-full text-left">
          <caption class="sr-only">Líneas de {{ l().nombre }}. El nombre de una abre su edición.</caption>
          <thead class="border-b border-acero/70 text-xs tracking-wide text-texto-suave uppercase">
            <tr>
              <th scope="col" class="py-2 pr-3 font-semibold">Aplicar en</th>
              <th scope="col" class="px-3 py-2 font-semibold">Precio</th>
              <th scope="col" class="px-3 py-2 text-right font-semibold">Cant. mín.</th>
              <th scope="col" class="px-3 py-2 font-semibold">Vigencia</th>
              <th scope="col" class="w-10 py-2"><span class="sr-only">Quitar</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of l().reglas; track r.id) {
              <tr class="cursor-pointer border-b border-acero/50 align-top transition-colors hover:bg-carbon/3" (click)="abrirRegla(r)">
                <td class="py-2 pr-3">
                  <button type="button" class="text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico" (click)="$event.stopPropagation(); abrirRegla(r)">
                    {{ aplicaEn(r) }}
                  </button>
                </td>
                <td class="px-3 py-2 tabular-nums">{{ precio(r) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ r.cantidadMinima || '—' }}</td>
                <td class="px-3 py-2 whitespace-nowrap">{{ vigencia(r) }}</td>
                <td class="py-1 text-right" (click)="$event.stopPropagation()">
                  <button type="button" [attr.aria-label]="'Quitar la línea de ' + aplicaEn(r)" [class]="botonIcono" (click)="quitar(r)">
                    <ui-icon [icono]="iconos.quitar" [tamano]="16" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <button #botonAgregar type="button" class="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico" (click)="abrirRegla(null)">
        <ui-icon [icono]="iconos.agregar" [tamano]="16" />Agregar una línea
      </button>
    </section>

    <app-regla-precio [listaId]="l().id" [moneda]="l().moneda" [regla]="reglaAbierta()" [(abierto)]="dialogo" />
  `,
})
export class DetalleLista {
  private readonly servicio = inject(ListasPreciosService);
  private readonly ventas = inject(VentasService);
  private readonly injector = inject(Injector);

  readonly l = input.required<ListaPrecios>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = { cerrar: X, completa: Maximize2, editar: PencilLine, quitar: Trash2, agregar: Plus };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly monedas = MONEDAS;
  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly plantas = computed(() => textoPlantas(this.l().plantas));

  protected aplicaEn(r: ReglaPrecio): string {
    return textoAplicaEn(r, this.ventas.productos());
  }
  protected precio(r: ReglaPrecio): string {
    return textoPrecio(r, this.l().moneda);
  }
  protected readonly vigencia = textoVigencia;

  // Al pasar a otra lista se sale de la edición y se borra el aviso
  private readonly id = computed(() => this.l().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  private readonly editor = viewChild(EditorLista);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  private readonly botonAgregar = viewChild.required<ElementRef<HTMLButtonElement>>('botonAgregar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

  protected readonly dialogo = signal(false);
  protected readonly reglaAbierta = signal<ReglaPrecio | null>(null);

  protected editar(): void {
    this.aviso.set('');
    this.editando.set(true);
  }

  protected guardar(d: DatosLista): void {
    this.servicio.editar(this.l().id, d);
    this.terminar('Cambios guardados.');
  }

  /** Al salir de la edición el foco vuelve a "Editar". */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected abrirRegla(r: ReglaPrecio | null): void {
    this.reglaAbierta.set(r);
    this.dialogo.set(true);
  }

  protected quitar(r: ReglaPrecio): void {
    if (!confirm(`¿Quitar la línea de ${this.aplicaEn(r)} (${this.precio(r)})?`)) return;
    this.servicio.quitarRegla(this.l().id, r.id);
    this.aviso.set('Línea quitada.');
    this.botonAgregar().nativeElement.focus();
  }
}
