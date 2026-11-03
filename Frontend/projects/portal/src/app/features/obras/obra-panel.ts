import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { Lock, MapPin, PencilLine, Phone, X } from 'lucide';
import { ContactoObra, Icon, Mapa, Obra } from 'ui';
import { NuevaObra, ObrasService } from '../../core/services/obras.service';
import { PedidosService, enCurso } from '../../core/services/pedidos.service';
import { Avatar } from './avatar';
import { ObraForm } from './obra-form';
import { telefonoEnlace, telefonoVisible } from './telefono';

@Component({
  selector: 'app-obra-panel',
  imports: [Avatar, Icon, Mapa, ObraForm],
  host: { class: 'contents' },
  template: `
    <dialog
      #dialogo
      class="glass-strong fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[46rem] max-w-full rounded-r-none p-0 text-carbon backdrop:bg-carbon/35 backdrop:backdrop-blur-[2px]"
      aria-labelledby="obra-panel-titulo"
      (close)="cerrar()"
      (click)="cerrarSiFondo($event)"
    >
      @if (obra(); as o) {
        <div class="flex min-h-full flex-col">
          <header
            class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-acero/40 bg-white/80 px-4 py-4 backdrop-blur-xl sm:px-6"
          >
            <div class="min-w-0">
              <p class="text-xs font-semibold tracking-wide text-texto-suave uppercase">Obra</p>
              <h2 id="obra-panel-titulo" class="truncate text-xl font-bold">{{ o.nombre }}</h2>
            </div>
            <button
              type="button"
              class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
              aria-label="Cerrar panel de obra"
              (click)="abierto.set(false)"
            >
              <ui-icon [icono]="iconos.cerrar" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <p class="sr-only" aria-live="polite">{{ mensaje() }}</p>

            @if (editando()) {
              <app-obra-form
                prefijo="panel-editar"
                [nivelTitulo]="3"
                [inicial]="o"
                [titulo]="'Editar ' + o.nombre"
                textoGuardar="Guardar cambios"
                [cancelable]="true"
                (guardada)="guardar($event)"
                (cancelada)="editando.set(false)"
              />
            } @else {
              <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                <p class="flex max-w-xl items-start gap-2 text-sm text-texto-suave">
                  <ui-icon [icono]="iconos.pin" [tamano]="17" class="mt-0.5 shrink-0" />
                  <span>{{ o.direccion }} · {{ o.municipio }}</span>
                </p>

                <span
                  class="group relative inline-flex"
                  [attr.tabindex]="bloqueada() ? 0 : null"
                  [attr.aria-describedby]="bloqueada() ? 'obra-edicion-bloqueada' : null"
                >
                  <button
                    type="button"
                    class="inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:cursor-not-allowed disabled:border-acero disabled:bg-acero/15 disabled:text-texto-suave"
                    [disabled]="bloqueada()"
                    (click)="editar()"
                  >
                    <ui-icon
                      [icono]="bloqueada() ? iconos.bloqueo : iconos.editar"
                      [tamano]="17"
                    />Editar obra
                  </button>
                  @if (bloqueada()) {
                    <span
                      id="obra-edicion-bloqueada"
                      role="tooltip"
                      class="pointer-events-none absolute top-full right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] translate-y-1 rounded-xl bg-carbon px-3.5 py-3 text-left text-xs leading-relaxed font-medium text-white opacity-0 shadow-xl transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    >
                      No puedes editarla porque {{ foliosEnCurso() }}
                      {{
                        pedidosEnCurso().length === 1
                          ? 'tiene una entrega en proceso'
                          : 'tienen entregas en proceso'
                      }}. Podrás hacerlo cuando finalicen.
                    </span>
                  }
                </span>
              </div>

              <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
                <section
                  aria-labelledby="obra-responsable-titulo"
                  class="rounded-2xl bg-white/55 p-4"
                >
                  <h3 id="obra-responsable-titulo" class="font-bold">Responsable y contactos</h3>
                  <div class="mt-3 flex items-center gap-3">
                    <app-avatar
                      class="size-14 text-xl"
                      [nombre]="o.responsable.nombre"
                      [foto]="o.responsable.foto"
                    />
                    <p class="min-w-0">
                      <span class="block text-xs text-texto-suave">Responsable de la obra</span>
                      <span class="block truncate font-semibold">{{ o.responsable.nombre }}</span>
                    </p>
                  </div>
                  <ul class="mt-4 divide-y divide-acero/40" aria-label="Contactos de la obra">
                    @for (contacto of o.contactos; track $index) {
                      <li class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <span class="font-medium">{{ contacto.nombre }}</span>
                        <a
                          [href]="enlace(contacto)"
                          class="inline-flex items-center gap-1.5 font-semibold text-epico underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                        >
                          <ui-icon [icono]="iconos.telefono" [tamano]="14" />{{
                            telefono(contacto)
                          }}
                        </a>
                      </li>
                    }
                  </ul>
                  @if (o.referencias) {
                    <p class="mt-3 border-t border-acero/40 pt-3 text-sm">
                      <span class="font-semibold">Referencias:</span> {{ o.referencias }}
                    </p>
                  }
                </section>

                <ui-mapa
                  class="h-64 md:h-full md:min-h-72"
                  [ubicacion]="o.ubicacion"
                  [direccion]="o.direccion + ', ' + o.municipio"
                  [titulo]="'Mapa de la obra ' + o.nombre"
                />
              </div>

              <section
                aria-labelledby="obra-pedidos-titulo"
                class="mt-4 rounded-2xl bg-white/55 p-4"
              >
                <h3 id="obra-pedidos-titulo" class="font-bold">Actividad de la obra</h3>
                <p class="mt-1 text-sm text-texto-suave">
                  {{
                    pedidos().length
                      ? pedidos().length +
                        (pedidos().length === 1 ? ' pedido relacionado' : ' pedidos relacionados')
                      : 'Todavía no tiene pedidos relacionados.'
                  }}
                </p>
              </section>
            }
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ObraPanel {
  readonly obra = input<Obra | null>(null);
  readonly abierto = model(false);

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly obras = inject(ObrasService);
  private readonly pedidosService = inject(PedidosService);
  protected readonly editando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly iconos = {
    cerrar: X,
    editar: PencilLine,
    bloqueo: Lock,
    pin: MapPin,
    telefono: Phone,
  };
  protected readonly telefono = (contacto: ContactoObra) => telefonoVisible(contacto);
  protected readonly enlace = (contacto: ContactoObra) => telefonoEnlace(contacto);
  protected readonly pedidos = computed(() => this.pedidosService.deObra(this.obra()?.id ?? ''));
  protected readonly pedidosEnCurso = computed(() => this.pedidos().filter(enCurso));
  protected readonly bloqueada = computed(() => this.pedidosEnCurso().length > 0);
  protected readonly foliosEnCurso = computed(() =>
    this.pedidosEnCurso()
      .map((pedido) => pedido.folio)
      .join(', '),
  );

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.abierto() && this.obra() && !dialogo.open) dialogo.showModal();
      else if ((!this.abierto() || !this.obra()) && dialogo.open) dialogo.close();
    });
  }

  protected editar(): void {
    if (!this.bloqueada()) this.editando.set(true);
  }

  protected guardar(datos: NuevaObra): void {
    const obra = this.obra();
    if (!obra || this.bloqueada()) return;
    this.obras.actualizar(obra.id, datos);
    this.editando.set(false);
    this.mensaje.set('Cambios guardados.');
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.editando.set(false);
    this.mensaje.set('');
  }

  protected cerrarSiFondo(event: MouseEvent): void {
    if (event.target === this.dialogo().nativeElement) this.abierto.set(false);
  }
}
