import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lock, PencilLine, Phone } from 'lucide';
import { ContactoObra, FechaZonaPipe, Icon, Mapa } from 'ui';
import { NuevaObra, ObrasService } from '../../core/services/obras.service';
import { PedidosService, enCurso } from '../../core/services/pedidos.service';
import { EstadoCobroEtiqueta } from '../pedidos/estado-cobro';
import { EstadoPedidoEtiqueta } from '../pedidos/estado-pedido';
import { Avatar } from './avatar';
import { ObraForm } from './obra-form';
import { telefonoEnlace, telefonoVisible } from './telefono';

/** Página de una obra: datos de entrega, responsable, contactos y sus pedidos. No se edita con pedidos en curso. */
@Component({
  selector: 'app-obra',
  host: { class: 'block' },
  imports: [Avatar, EstadoCobroEtiqueta, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, Mapa, ObraForm, RouterLink],
  template: `
    <nav aria-label="Ruta de navegación" class="mb-2 text-sm">
      <ol class="flex flex-wrap items-center gap-1.5 text-texto-suave">
        <li><a routerLink="/obras" class="font-medium text-epico underline-offset-4 hover:underline">Mis obras</a></li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">{{ obra()?.nombre ?? 'Obra' }}</li>
      </ol>
    </nav>

    @if (obra(); as o) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ o.nombre }}</h1>
          <p class="mt-1 text-sm text-texto-suave">{{ o.direccion }} · {{ o.municipio }}</p>
        </div>
        @if (!editando()) {
          <div class="max-w-sm text-right">
            <button
              type="button"
              class="inline-flex h-11 items-center gap-2 rounded-xl border border-acero-oscuro bg-white px-4 font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:border-acero-oscuro"
              [attr.aria-disabled]="bloqueada() ? 'true' : null"
              [attr.aria-describedby]="bloqueada() ? 'bloqueo' : null"
              (click)="editar()"
            >
              <ui-icon [icono]="bloqueada() ? iconos.bloqueo : iconos.editar" [tamano]="18" />Editar obra
            </button>
          </div>
        }
      </header>

      @if (bloqueada()) {
        <p id="bloqueo" class="mb-4 flex items-start gap-2 rounded-xl bg-[#FBF0DD] px-4 py-3 text-sm text-[#5E400B]">
          <ui-icon [icono]="iconos.bloqueo" [tamano]="18" class="mt-px shrink-0" />
          <span>
            No se puede editar mientras tenga pedidos en curso ({{ foliosEnCurso() }}): la planta ya programó la entrega con estos datos.
            Podrás editarla cuando se entreguen; si es urgente, contacta a tu asesor.
          </span>
        </p>
      }
      <p class="sr-only" aria-live="polite">{{ mensaje() }}</p>

      @if (editando()) {
        <app-obra-form
          class="mb-5 block"
          prefijo="editar"
          [nivelTitulo]="2"
          [inicial]="o"
          [titulo]="'Editar ' + o.nombre"
          textoGuardar="Guardar cambios"
          [cancelable]="true"
          (guardada)="guardar($event)"
          (cancelada)="editando.set(false)"
        />
      } @else {
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div class="space-y-4">
            <section aria-labelledby="responsable-titulo" class="glass p-4 sm:p-5">
              <h2 id="responsable-titulo" class="text-lg font-bold">Responsable y contactos</h2>
              <div class="mt-3 flex items-center gap-4">
                <app-avatar class="size-16 text-2xl" [nombre]="o.responsable.nombre" [foto]="o.responsable.foto" />
                <p>
                  <span class="block text-xs text-texto-suave">Responsable de la obra</span>
                  <span class="block text-lg font-semibold">{{ o.responsable.nombre }}</span>
                </p>
              </div>
              <ul class="mt-4 divide-y divide-acero/40 rounded-xl bg-white/70" aria-label="Contactos">
                @for (c of o.contactos; track $index) {
                  <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                    <span class="font-medium">{{ c.nombre }}</span>
                    <a [href]="enlace(c)" class="inline-flex items-center gap-1.5 font-semibold text-epico underline-offset-4 hover:underline">
                      <ui-icon [icono]="iconos.tel" [tamano]="15" />{{ telefono(c) }}<span class="sr-only"> (llamar a {{ c.nombre }})</span>
                    </a>
                  </li>
                }
              </ul>
              @if (o.referencias) {
                <p class="mt-4 text-sm"><span class="font-medium">Referencias:</span> {{ o.referencias }}</p>
              }
            </section>

            <section aria-labelledby="pedidos-obra-titulo" class="glass p-4 sm:p-5">
              <h2 id="pedidos-obra-titulo" class="text-lg font-bold">Pedidos de esta obra</h2>
              @if (pedidos().length) {
                <ul class="mt-3 space-y-2">
                  @for (p of pedidos(); track p.id) {
                    <li class="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-white/70 px-4 py-2.5 text-sm">
                      <a [routerLink]="['/pedidos', p.folio]" class="font-semibold text-epico underline-offset-4 hover:underline">{{ p.folio }}</a>
                      <span class="text-texto-suave">{{ p.fechaHoraEntrega | fechaZona: p.zonaHoraria }}</span>
                      <span class="ml-auto flex flex-wrap gap-1.5">
                        <app-estado-pedido [estado]="p.estado" />
                        <app-estado-cobro [cobro]="p.cobro" />
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="mt-2 text-sm text-texto-suave">Esta obra aún no tiene pedidos.</p>
              }
            </section>
          </div>
          <ui-mapa class="h-72 lg:h-full lg:min-h-96" [ubicacion]="o.ubicacion" [direccion]="o.direccion + ', ' + o.municipio" [titulo]="'Mapa de la obra ' + o.nombre" />
        </div>
      }
    } @else {
      <p class="glass px-5 py-8 text-center text-texto-suave">
        No encontramos esta obra.
        <a routerLink="/obras" class="font-semibold text-epico underline underline-offset-4">Ver mis obras</a>
      </p>
    }
  `,
})
export default class ObraDetalle {
  /** Parámetro de la ruta. */
  readonly id = input.required<string>();

  private readonly obras = inject(ObrasService);
  private readonly pedidosService = inject(PedidosService);
  protected readonly iconos = { editar: PencilLine, bloqueo: Lock, tel: Phone };
  protected readonly editando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly telefono = (c: ContactoObra) => telefonoVisible(c);
  protected readonly enlace = (c: ContactoObra) => telefonoEnlace(c);
  private readonly formulario = viewChild(ObraForm);

  protected readonly obra = computed(() => this.obras.buscar(this.id()));
  protected readonly pedidos = computed(() => this.pedidosService.deObra(this.id()));
  protected readonly bloqueada = computed(() => this.pedidosService.obraConPedidoEnCurso(this.id()));
  protected readonly foliosEnCurso = computed(() => this.pedidos().filter(enCurso).map((p) => p.folio).join(', '));

  protected editar(): void {
    if (this.bloqueada()) return;
    this.editando.set(true);
    this.mensaje.set('');
    setTimeout(() => this.formulario()?.enfocar());
  }

  protected guardar(datos: NuevaObra): void {
    if (this.bloqueada()) return; // por si entró un pedido mientras editaba
    this.obras.actualizar(this.id(), datos);
    this.editando.set(false);
    this.mensaje.set('Cambios guardados.');
  }
}
