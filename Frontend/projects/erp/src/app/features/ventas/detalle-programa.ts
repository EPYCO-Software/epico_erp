import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Maximize2, PencilLine, X } from 'lucide';
import { Icon } from 'ui';
import { VentasService } from './datos';
import { DatosPrograma, FormPrograma } from './form-programa';
import { Programa, ProgramasService, plantilla, textoPrograma } from './lealtad';
import { ProbarPrograma } from './probar-programa';

const fecha = (f: string) => f.split('-').reverse().join('/');

/**
 * Un programa, igual en la vista previa y en la vista completa: tipo, regla, vigencia y estado (Editar con
 * form-programa.ts); sus cupones si los usa (generar y marcar usados); y "Probar con una orden".
 */
@Component({
  selector: 'app-detalle-programa',
  imports: [FormPrograma, Icon, ProbarPrograma, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-epico/8 text-epico-oscuro" aria-hidden="true">
          <ui-icon [icono]="tipo().icono" [tamano]="20" />
        </span>
        <div class="min-w-0">
          @if (completa()) {
            <p class="text-sm font-semibold text-texto-suave">{{ tipo().nombre }}</p>
            <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ p().nombre }}</h1>
          } @else {
            <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ p().nombre }}</h2>
            <p class="text-sm text-texto-suave">{{ tipo().nombre }}</p>
          }
        </div>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/ventas/descuentos-y-lealtad', p().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (editando()) {
      <app-form-programa class="mt-4 border-t border-acero/60 pt-4" [programa]="p()" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
      <button #botonEditar type="button" [class]="botonSecundario + ' mt-3'" (click)="editar()">
        <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
      </button>
      <dl class="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-texto-suave">Regla</dt>
        <dd>{{ regla() }}</dd>
        <dt class="text-texto-suave">Vigencia</dt>
        <dd>{{ vigencia() }}</dd>
        <dt class="text-texto-suave">Estado</dt>
        <dd>
          <span class="rounded-md px-2 py-0.5 text-xs font-bold" [class]="p().activo ? 'bg-[#E3EFE9] text-[#2E5E4A]' : 'bg-carbon/8 text-texto-suave'">
            {{ p().activo ? 'Activo' : 'Archivado' }}
          </span>
        </dd>
      </dl>
    }
    <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>

    @if (p().tipo === 'cupones' || p().tipo === 'proxima-orden') {
      <section aria-labelledby="cupones-titulo" class="mt-5 border-t border-acero/60 pt-4 text-sm">
        <p id="cupones-titulo" role="heading" [attr.aria-level]="nivel()" class="font-bold">Cupones</p>
        <p class="mt-1 text-texto-suave">
          {{ p().tipo === 'cupones' ? 'Códigos únicos para compartir; cada uno sirve una vez.' : 'Los que ganan las órdenes; también puedes generarlos a mano.' }}
          {{ disponibles() }} de {{ p().cupones.length }} disponibles.
        </p>
        <div class="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label for="cupones-cantidad" class="block text-xs font-bold tracking-wide text-texto-suave uppercase">Cantidad</label>
            <input
              id="cupones-cantidad"
              type="number"
              min="1"
              max="100"
              class="campo mt-1 h-9 w-24 px-2 text-right tabular-nums"
              [value]="cantidad()"
              (input)="cantidad.set(+$any($event.target).value || 0)"
            />
          </div>
          <button type="button" [class]="botonSecundario" (click)="generar()">Generar cupones</button>
        </div>
        @if (p().cupones.length) {
          <ul class="mt-3 grid gap-1.5 @container sm:grid-cols-2" aria-label="Cupones">
            @for (c of p().cupones; track c.codigo) {
              <li>
                <label class="flex items-center gap-2 rounded-lg border border-acero/70 bg-white/70 px-3 py-1.5">
                  <input type="checkbox" class="casilla" [checked]="c.usado" (change)="servicio.alternarUsado(p().id, c.codigo)" />
                  <span class="font-semibold tracking-wide tabular-nums" [class.line-through]="c.usado">{{ c.codigo }}</span>
                  <span class="text-texto-suave">{{ c.usado ? 'usado' : 'disponible' }}</span>
                </label>
              </li>
            }
          </ul>
        }
      </section>
    }

    <app-probar-programa class="mt-5 block border-t border-acero/60 pt-4" [programa]="p()" [nivel]="nivel()" />
  `,
})
export class DetallePrograma {
  protected readonly servicio = inject(ProgramasService);
  private readonly ventas = inject(VentasService);
  private readonly injector = inject(Injector);

  readonly p = input.required<Programa>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = { cerrar: X, completa: Maximize2, editar: PencilLine };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly completa = computed(() => this.vista() === 'completa');
  /** Títulos de sección: h2 bajo el h1 de la vista completa, h3 bajo el h2 de la vista previa. */
  protected readonly nivel = computed(() => (this.completa() ? 2 : 3));
  protected readonly tipo = computed(() => plantilla(this.p().tipo));
  protected readonly regla = computed(() => textoPrograma(this.p(), this.ventas.productos()));
  protected readonly vigencia = computed(() => {
    const { inicio, fin } = this.p();
    if (inicio && fin) return `${fecha(inicio)} – ${fecha(fin)}`;
    return inicio ? `Desde ${fecha(inicio)}` : fin ? `Hasta ${fecha(fin)}` : 'Siempre';
  });
  protected readonly disponibles = computed(() => this.p().cupones.filter((c) => !c.usado).length);
  protected readonly cantidad = signal(5);

  private readonly id = computed(() => this.p().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  private readonly editor = viewChild(FormPrograma);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

  protected editar(): void {
    this.aviso.set('');
    this.editando.set(true);
  }

  protected guardar(d: DatosPrograma): void {
    this.servicio.editar(this.p().id, d);
    this.terminar('Cambios guardados.');
  }

  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected generar(): void {
    const n = Math.min(Math.max(Math.floor(this.cantidad()), 1), 100);
    const nuevos = this.servicio.generarCupones(this.p().id, n);
    this.aviso.set(`${nuevos.length} ${nuevos.length === 1 ? 'cupón generado' : 'cupones generados'}: ${nuevos.join(', ')}.`);
  }
}
