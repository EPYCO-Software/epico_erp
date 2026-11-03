import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ChevronRight, Lock, MapPin, Phone, Plus, X } from 'lucide';
import { Icon, PageHeader } from 'ui';
import { NuevaObra, ObrasService } from '../../core/services/obras.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { Avatar } from './avatar';
import { ObraForm } from './obra-form';
import { ObraPanel } from './obra-panel';
import { telefonoVisible } from './telefono';

@Component({
  selector: 'app-obras',
  imports: [Avatar, Icon, ObraForm, ObraPanel, PageHeader],
  template: `
    <ui-page-header title="Mis obras" subtitle="Dónde entregamos tu concreto y a quién contactar">
      <button
        type="button"
        class="flex h-11 items-center gap-2 rounded-xl border border-acero-oscuro bg-white px-4 font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
        [attr.aria-expanded]="agregando()"
        aria-controls="obra-alta"
        (click)="alternar()"
      >
        <ui-icon [icono]="agregando() ? iconos.cerrar : iconos.agregar" [tamano]="18" />{{
          agregando() ? 'Cancelar' : 'Agregar obra'
        }}
      </button>
    </ui-page-header>

    <p class="sr-only" aria-live="polite">{{ mensaje() }}</p>
    @if (agregando()) {
      <app-obra-form
        id="obra-alta"
        class="mb-5 block"
        prefijo="alta"
        [nivelTitulo]="2"
        (guardada)="agregar($event)"
      />
    }

    <ul class="grid gap-4 md:grid-cols-2">
      @for (o of obras(); track o.id) {
        <li>
          <button
            type="button"
            class="glass group flex h-full w-full flex-col p-4 text-left transition-colors hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico sm:p-5"
            [attr.aria-label]="'Ver y editar la obra ' + o.nombre"
            (click)="abrirPanel(o.id)"
          >
            <span class="flex w-full flex-wrap items-start justify-between gap-2">
              <span class="text-lg font-bold group-hover:text-epico">{{ o.nombre }}</span>
              @if (bloqueada(o.id)) {
                <span
                  class="inline-flex items-center gap-1 rounded-md bg-[#FBF0DD] px-2 py-0.5 text-xs font-semibold text-[#7A5410]"
                >
                  <ui-icon [icono]="iconos.bloqueo" [tamano]="13" />Pedido en curso
                </span>
              }
            </span>
            <span class="mt-0.5 flex items-start gap-1.5 text-sm text-texto-suave">
              <ui-icon [icono]="iconos.pin" [tamano]="15" class="mt-0.5 shrink-0" />{{
                o.direccion
              }}
              · {{ o.municipio }}
            </span>
            <span class="mt-4 flex items-center gap-3">
              <app-avatar
                class="size-11 text-base"
                [nombre]="o.responsable.nombre"
                [foto]="o.responsable.foto"
              />
              <span class="min-w-0 text-sm">
                <span class="block text-xs text-texto-suave">Responsable</span>
                <span class="block truncate font-semibold">{{ o.responsable.nombre }}</span>
              </span>
            </span>
            <span class="mt-3 flex items-center gap-1.5 text-sm">
              <ui-icon [icono]="iconos.tel" [tamano]="15" class="text-texto-suave" />
              {{ telefono(o.contactos[0]) }}
              @if (o.contactos.length > 1) {
                <span class="text-texto-suave"
                  >· {{ o.contactos.length - 1 }} contacto{{
                    o.contactos.length > 2 ? 's' : ''
                  }}
                  más</span
                >
              }
            </span>
            <span
              class="mt-auto flex w-full items-center justify-between pt-3 text-sm text-texto-suave"
            >
              {{ pedidosTexto(o.id) }}
              <span
                class="inline-flex items-center gap-1 font-semibold text-carbon group-hover:text-epico"
              >
                Ver detalles<ui-icon [icono]="iconos.abrir" [tamano]="16" />
              </span>
            </span>
          </button>
        </li>
      }
    </ul>

    <app-obra-panel [obra]="seleccionada()" [(abierto)]="panelAbierto" />
  `,
})
export default class Obras {
  private readonly obrasService = inject(ObrasService);
  private readonly pedidos = inject(PedidosService);
  protected readonly obras = this.obrasService.obras;
  protected readonly iconos = {
    agregar: Plus,
    cerrar: X,
    bloqueo: Lock,
    pin: MapPin,
    tel: Phone,
    abrir: ChevronRight,
  };
  protected readonly agregando = signal(false);
  protected readonly panelAbierto = signal(false);
  private readonly seleccionadaId = signal<string | null>(null);
  protected readonly seleccionada = computed(() => this.obrasService.buscar(this.seleccionadaId()));
  protected readonly mensaje = signal('');
  protected readonly telefono = telefonoVisible;
  private readonly formulario = viewChild(ObraForm);

  protected bloqueada(id: string): boolean {
    return this.pedidos.obraConPedidoEnCurso(id);
  }

  protected pedidosTexto(id: string): string {
    const n = this.pedidos.deObra(id).length;
    return n ? `${n} pedido${n === 1 ? '' : 's'}` : 'Sin pedidos';
  }

  protected abrirPanel(id: string): void {
    this.seleccionadaId.set(id);
    this.panelAbierto.set(true);
  }

  protected alternar(): void {
    this.agregando.update((v) => !v);
    if (this.agregando()) setTimeout(() => this.formulario()?.enfocar());
  }

  protected agregar(datos: NuevaObra): void {
    const obra = this.obrasService.agregar(datos);
    this.agregando.set(false);
    this.mensaje.set(`Obra "${obra.nombre}" agregada.`);
  }
}
