import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MapPin, Maximize2, PencilLine, Phone, Trash2, X } from 'lucide';
import { AuthService, EstadoPedidoEtiqueta, Icon, Mapa, Obra, pesos, telefonoEnlace, telefonoVisible } from 'ui';
import { TODOS, tiene } from '../../core/permisos';
import { ESTADOS_COTIZACION, VentasService, mensajeDe } from './datos';
import { EditorObra, ObraLista } from './editor-obra';

/**
 * Una obra (posición de entrega): de qué cliente es o si es general, su ubicación en el mapa, responsable y contactos, y
 * las cotizaciones y pedidos que la usan. Editar con editor-obra.ts; borrar solo si nadie la usa. Igual en la vista
 * previa de Obras y en su vista completa.
 */
@Component({
  selector: 'app-detalle-obra',
  host: { class: 'block' },
  imports: [EditorObra, EstadoPedidoEtiqueta, Icon, Mapa, RouterLink],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ o().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ o().nombre }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ direccion() }}</p>
        <p class="mt-2">
          @if (cliente(); as c) {
            <a [routerLink]="['/ventas/clientes', c.id]" class="inline-flex rounded-md bg-carbon/6 px-2 py-0.5 text-sm font-semibold hover:underline">{{ c.nombre }}</a>
          } @else {
            <span class="inline-flex rounded-md bg-[#E8EEF7] px-2 py-0.5 text-sm font-semibold text-[#1F3A5F]">Obra general (sin cliente)</span>
          }
        </p>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/ventas/obras', o().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (!editando() && (puedeEditar() || puedeEliminar())) {
      <div class="mt-3 flex flex-wrap gap-2">
        @if (puedeEditar()) {
          <button #botonEditar type="button" [class]="botonSecundario" (click)="editar()">
            <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
          </button>
        }
        @if (puedeEliminar()) {
          <button type="button" [class]="botonSecundario" [disabled]="enUso()" [attr.aria-describedby]="enUso() ? 'obra-en-uso' : null" (click)="eliminar()">
            <ui-icon [icono]="iconos.eliminar" [tamano]="16" />Eliminar
          </button>
        }
      </div>
      @if (puedeEliminar() && enUso()) {
        <p id="obra-en-uso" class="mt-1 text-xs text-texto-suave">No se puede eliminar: la usan cotizaciones o pedidos.</p>
      }
    }
    <p class="mt-2 text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>

    @if (editando()) {
      <app-editor-obra class="mt-4 border-t border-acero/60 pt-4" [obra]="o()" [nivelTitulo]="nivel() + 1" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
      <div class="mt-4 grid gap-5 text-sm" [class]="completa() ? 'lg:grid-cols-2 lg:gap-x-10' : ''">
        <section [class]="completa() ? 'lg:col-span-2' : ''">
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Ubicación</p>
          @if (o().ubicacion) {
            <ui-mapa class="block h-56 overflow-hidden rounded-xl" [class.lg:h-72]="completa()" [ubicacion]="o().ubicacion" [direccion]="direccion()" [titulo]="'Ubicación de ' + o().nombre" />
          } @else {
            <p class="rounded-xl bg-white/80 p-3 text-texto-suave">Sin punto GPS: el operador se guía por la dirección y las referencias.</p>
          }
          @if (o().referencias) {
            <p class="mt-2"><span class="text-texto-suave">Referencias:</span> {{ o().referencias }}</p>
          }
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Quién recibe</p>
          <p class="font-semibold">{{ o().responsable.nombre || 'Sin responsable' }}</p>
          <ul class="mt-1.5 space-y-1">
            @for (c of o().contactos; track $index) {
              <li class="flex flex-wrap items-center gap-x-2">
                <span>{{ c.nombre }}</span>
                <a [href]="enlaceTel(c)" [class]="enlace"><ui-icon [icono]="iconos.telefono" [tamano]="15" />{{ tel(c) }}</a>
              </li>
            } @empty {
              <li class="text-texto-suave">Sin contactos.</li>
            }
          </ul>
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Cotizaciones y pedidos ({{ usos().cotizaciones.length + usos().pedidos.length }})</p>
          <ul [class]="lista">
            @for (q of usos().cotizaciones; track q.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <a [routerLink]="['/ventas/cotizaciones', q.id]" [class]="enlace + ' font-semibold'">{{ q.folio }}</a>
                <span class="inline-block rounded-md px-2 py-0.5 text-xs font-bold {{ estados[q.estado].clase }}">{{ estados[q.estado].nombre }}</span>
              </li>
            }
            @for (p of usos().pedidos; track p.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <span class="min-w-0">
                  <a [routerLink]="['/ventas/ordenes', p.folio]" [class]="enlace + ' font-semibold'">{{ p.folio }}</a>
                  <span class="ml-2 text-xs tabular-nums text-texto-suave">\${{ pesos(p.importe) }}</span>
                </span>
                <ui-estado-pedido [estado]="p.estado" />
              </li>
            }
            @if (!usos().cotizaciones.length && !usos().pedidos.length) {
              <li class="px-3 py-2 text-texto-suave">Aún no se usa en cotizaciones ni pedidos.</li>
            }
          </ul>
        </section>
      </div>
    }
  `,
})
export class DetalleObra {
  private readonly ventas = inject(VentasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly o = input.required<Obra>();
  readonly vista = input<'previa' | 'completa'>('previa');
  readonly cerrar = output();

  protected readonly iconos = { cerrar: X, completa: Maximize2, editar: PencilLine, eliminar: Trash2, telefono: Phone, obra: MapPin };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-50';
  protected readonly enlace =
    'inline-flex items-center gap-1.5 rounded underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly lista = 'divide-y divide-acero/40 rounded-xl bg-white/80';
  protected readonly estados = ESTADOS_COTIZACION;
  protected readonly pesos = pesos;
  protected readonly tel = telefonoVisible;
  protected readonly enlaceTel = telefonoEnlace;

  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly nivel = computed(() => (this.completa() ? 2 : 3));
  protected readonly direccion = computed(() => [this.o().direccion, this.o().municipio].filter(Boolean).join(', '));
  protected readonly cliente = computed(() => (this.o().clienteId ? this.ventas.cliente(this.o().clienteId) : null));
  protected readonly usos = computed(() => this.ventas.usosDeObra(this.o().id));
  protected readonly enUso = computed(() => !!(this.usos().cotizaciones.length || this.usos().pedidos.length));

  private readonly permisos = computed(() => this.auth.sesion()?.permisos ?? [TODOS]);
  protected readonly puedeEditar = computed(() => tiene(this.permisos(), 'ventas.obras.editar'));
  protected readonly puedeEliminar = computed(() => tiene(this.permisos(), 'ventas.obras.eliminar'));

  // Al pasar a otra obra (la misma ficha con otra `o`) se sale de la edición
  private readonly id = computed(() => this.o().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  readonly enEdicion = this.editando.asReadonly();
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly error = linkedSignal({ source: this.id, computation: () => false });
  private readonly editor = viewChild(EditorObra);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  readonly sinGuardar = computed(() => !!this.editor()?.sinGuardar());

  protected editar(): void {
    this.aviso.set('');
    this.error.set(false);
    this.editando.set(true);
  }

  protected async guardar(l: ObraLista): Promise<void> {
    try {
      await this.ventas.guardarObra(this.o().id, l.clienteId, l.datos);
      this.terminar('Cambios guardados.');
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    }
  }

  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    this.error.set(false);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async eliminar(): Promise<void> {
    if (!confirm(`¿Eliminar la obra "${this.o().nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.ventas.eliminarObra(this.o().id);
      if (this.completa()) void this.router.navigateByUrl('/ventas/obras');
      else this.cerrar.emit();
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    }
  }
}
