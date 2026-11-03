import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ListFilter } from 'lucide';
import { Icon } from 'ui';

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}

const POSICIONES: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
];

let siguienteId = 0;

@Component({
  selector: 'app-filtro-multiple',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Icon],
  host: { class: 'contents' },
  template: `
    <span class="flex w-full min-w-28 items-center justify-between gap-3">
      <span>{{ etiqueta() }}</span>
      <button
        #disparador
        cdkOverlayOrigin
        #origen="cdkOverlayOrigin"
        type="button"
        class="relative inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-carbon"
        [class]="
          activo()
            ? 'bg-[#F8DADB] text-epico-oscuro ring-1 ring-epico/15 hover:bg-[#F4CBCD]'
            : 'text-texto-suave hover:bg-carbon/5 hover:text-carbon'
        "
        [attr.aria-label]="nombreAccesible()"
        aria-haspopup="dialog"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="abierto() ? panelId : null"
        (click)="alternarPanel()"
      >
        <ui-icon [icono]="iconoFiltro" [tamano]="16" />
        @if (activo()) {
          <span
            class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-carbon px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white"
            aria-hidden="true"
          >
            {{ seleccionados().size }}
          </span>
        }
      </button>
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="abierto()"
      [cdkConnectedOverlayPositions]="posiciones"
      [cdkConnectedOverlayPush]="true"
      (attach)="enfocarPanel()"
      (overlayOutsideClick)="cerrarSinDevolverFoco()"
    >
      <section
        [id]="panelId"
        role="dialog"
        [attr.aria-labelledby]="tituloId"
        class="glass-strong w-72 overflow-hidden text-sm text-carbon normal-case tracking-normal"
      >
        <header class="flex items-start justify-between gap-3 border-b border-acero/40 px-4 py-3">
          <div>
            <h2 [id]="tituloId" class="font-semibold">
              Filtrar por {{ etiqueta().toLowerCase() }}
            </h2>
            <p class="mt-0.5 text-xs text-texto-suave">{{ resumenSeleccion() }}</p>
          </div>
          <button
            data-filtro-inicial
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-epico hover:bg-epico/10 focus-visible:outline-2 focus-visible:outline-epico"
            (click)="alternarTodos()"
          >
            {{ todosSeleccionados() ? 'Deseleccionar todos' : 'Seleccionar todos' }}
          </button>
        </header>

        <div
          class="max-h-72 overflow-y-auto p-2"
          [attr.aria-label]="'Opciones de ' + etiqueta().toLowerCase()"
        >
          @for (opcion of opciones(); track opcion.valor) {
            <label
              class="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-carbon/5"
            >
              <input
                #casilla
                type="checkbox"
                class="casilla"
                [checked]="seleccionados().has(opcion.valor)"
                (change)="alternarOpcion(opcion.valor, casilla.checked)"
              />
              <span class="font-medium">{{ opcion.etiqueta }}</span>
            </label>
          }
        </div>

        <footer class="flex justify-end border-t border-acero/40 bg-white/35 px-3 py-2.5">
          <button
            type="button"
            class="h-9 rounded-lg bg-carbon px-4 text-sm font-semibold text-white hover:bg-carbon/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            (click)="cerrarYDevolverFoco()"
          >
            Listo
          </button>
        </footer>
      </section>
    </ng-template>
  `,
})
export class FiltroMultiple {
  private readonly injector = inject(Injector);
  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');

  readonly etiqueta = input.required<string>();
  readonly opciones = input.required<readonly OpcionFiltro[]>();
  readonly seleccionados = input.required<ReadonlySet<string>>();
  readonly seleccionadosChange = output<Set<string>>();

  protected readonly panelId = `filtro-multiple-${siguienteId++}`;
  protected readonly tituloId = `${this.panelId}-titulo`;
  protected readonly iconoFiltro = ListFilter;
  protected readonly posiciones = POSICIONES;
  protected readonly abierto = signal(false);
  protected readonly todosSeleccionados = computed(
    () => this.opciones().length > 0 && this.seleccionados().size === this.opciones().length,
  );
  protected readonly activo = computed(() => !this.todosSeleccionados());
  protected readonly resumenSeleccion = computed(
    () => `${this.seleccionados().size} de ${this.opciones().length} seleccionados`,
  );
  protected readonly nombreAccesible = computed(
    () => `Filtrar por ${this.etiqueta().toLowerCase()}. ${this.resumenSeleccion()}`,
  );

  protected alternarPanel(): void {
    this.abierto.update((valor) => !valor);
  }

  protected alternarTodos(): void {
    this.seleccionadosChange.emit(
      this.todosSeleccionados()
        ? new Set<string>()
        : new Set(this.opciones().map((opcion) => opcion.valor)),
    );
  }

  protected alternarOpcion(valor: string, seleccionado: boolean): void {
    const siguientes = new Set(this.seleccionados());
    if (seleccionado) siguientes.add(valor);
    else siguientes.delete(valor);
    this.seleccionadosChange.emit(siguientes);
  }

  protected enfocarPanel(): void {
    afterNextRender(
      () =>
        document
          .querySelector<HTMLElement>(`#${this.panelId} [data-filtro-inicial]`)
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  protected cerrarSinDevolverFoco(): void {
    this.abierto.set(false);
  }

  protected cerrarYDevolverFoco(): void {
    this.abierto.set(false);
    afterNextRender(() => this.disparador().nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected cerrarConEscape(event: Event): void {
    if (!this.abierto()) return;
    event.preventDefault();
    this.cerrarYDevolverFoco();
  }
}

@Component({
  selector: 'app-filtro-fecha',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Icon],
  host: { class: 'contents' },
  template: `
    <span class="flex w-full min-w-28 items-center justify-between gap-3">
      <span>{{ etiqueta() }}</span>
      <button
        #disparador
        cdkOverlayOrigin
        #origen="cdkOverlayOrigin"
        type="button"
        class="relative inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-carbon"
        [class]="
          fecha()
            ? 'bg-[#F8DADB] text-epico-oscuro ring-1 ring-epico/15 hover:bg-[#F4CBCD]'
            : 'text-texto-suave hover:bg-carbon/5 hover:text-carbon'
        "
        [attr.aria-label]="
          fecha() ? 'Cambiar filtro de fecha de entrega' : 'Filtrar por fecha de entrega'
        "
        aria-haspopup="dialog"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="abierto() ? panelId : null"
        (click)="alternarPanel()"
      >
        <ui-icon [icono]="iconoFiltro" [tamano]="16" />
        @if (fecha()) {
          <span
            class="absolute -top-1 -right-1 size-2.5 rounded-full bg-carbon ring-2 ring-white"
            aria-hidden="true"
          ></span>
        }
      </button>
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="abierto()"
      [cdkConnectedOverlayPositions]="posiciones"
      [cdkConnectedOverlayPush]="true"
      (attach)="enfocarPanel()"
      (overlayOutsideClick)="cerrarSinDevolverFoco()"
    >
      <section
        [id]="panelId"
        role="dialog"
        [attr.aria-labelledby]="tituloId"
        class="glass-strong w-72 overflow-hidden text-sm text-carbon normal-case tracking-normal"
      >
        <header class="border-b border-acero/40 px-4 py-3">
          <h2 [id]="tituloId" class="font-semibold">Filtrar por fecha</h2>
          <p class="mt-0.5 text-xs text-texto-suave">Fecha exacta de entrega</p>
        </header>

        <div class="p-4">
          <label [attr.for]="campoId" class="mb-1.5 block text-xs font-semibold text-texto-suave"
            >Fecha de entrega</label
          >
          <input
            #campoFecha
            data-filtro-inicial
            [id]="campoId"
            type="date"
            class="campo h-10 px-3 text-sm"
            [value]="fecha()"
            (change)="fechaChange.emit(campoFecha.value)"
          />
        </div>

        <footer
          class="flex items-center justify-between border-t border-acero/40 bg-white/35 px-3 py-2.5"
        >
          <button
            type="button"
            class="h-9 rounded-lg px-3 text-sm font-semibold text-epico hover:bg-epico/10 focus-visible:outline-2 focus-visible:outline-epico disabled:cursor-not-allowed disabled:text-texto-suave disabled:opacity-60"
            [disabled]="!fecha()"
            (click)="fechaChange.emit('')"
          >
            Limpiar fecha
          </button>
          <button
            type="button"
            class="h-9 rounded-lg bg-carbon px-4 text-sm font-semibold text-white hover:bg-carbon/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            (click)="cerrarYDevolverFoco()"
          >
            Listo
          </button>
        </footer>
      </section>
    </ng-template>
  `,
})
export class FiltroFecha {
  private readonly injector = inject(Injector);
  private readonly disparador = viewChild.required<ElementRef<HTMLButtonElement>>('disparador');

  readonly etiqueta = input('Entrega');
  readonly fecha = input.required<string>();
  readonly fechaChange = output<string>();

  protected readonly panelId = `filtro-fecha-${siguienteId++}`;
  protected readonly tituloId = `${this.panelId}-titulo`;
  protected readonly campoId = `${this.panelId}-campo`;
  protected readonly iconoFiltro = ListFilter;
  protected readonly posiciones = POSICIONES;
  protected readonly abierto = signal(false);

  protected alternarPanel(): void {
    this.abierto.update((valor) => !valor);
  }

  protected enfocarPanel(): void {
    afterNextRender(
      () =>
        document
          .querySelector<HTMLElement>(`#${this.panelId} [data-filtro-inicial]`)
          ?.focus({ preventScroll: true }),
      { injector: this.injector },
    );
  }

  protected cerrarSinDevolverFoco(): void {
    this.abierto.set(false);
  }

  protected cerrarYDevolverFoco(): void {
    this.abierto.set(false);
    afterNextRender(() => this.disparador().nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected cerrarConEscape(event: Event): void {
    if (!this.abierto()) return;
    event.preventDefault();
    this.cerrarYDevolverFoco();
  }
}
