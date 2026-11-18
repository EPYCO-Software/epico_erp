import { Component, Injector, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChevronDown } from 'lucide';
import { EstatusPlantaEtiqueta, FechaZonaPipe, FieldError, Icon, PedidoVista } from 'ui';
import { ConfirmarOrden, EntregaPorConfirmar } from './confirmar-orden';
import { VentasService, mensajeDe, offsetEn, porConfirmar } from './datos';
import { permisosSesion } from '../../core/permisos';

type Respuesta = 'actualizacion' | 'rechazada';

/**
 * El requerimiento de una orden a su planta (Estatus planta): "Enviar requerimiento a planta" y, ya enviado, la
 * respuesta de la planta: confirmar, pedir actualización (nueva fecha de entrega y nota) o rechazar (motivo). Con una
 * actualización pedida se acepta la nueva fecha (cambia la entrega y queda confirmado) o se reenvía sin cambios; una
 * rechazada se puede reenviar. Todo queda en el historial de la orden.
 * shortcut: las respuestas las da quien ve la orden en el ERP; con usuarios de planta, solo ellos las verán.
 */
@Component({
  selector: 'app-planta-pedido',
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, ConfirmarOrden, EstatusPlantaEtiqueta, FechaZonaPipe, FieldError, FormField, Icon],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="planta-titulo" class="rounded-xl bg-white/70 p-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <!-- h2 en la vista completa (bajo el h1), h3 en la vista previa (bajo su h2) -->
        @if (nivel() === 2) {
          <h2 id="planta-titulo" class="font-semibold">Requerimiento a planta</h2>
        } @else {
          <h3 id="planta-titulo" class="font-semibold">Requerimiento a planta</h3>
        }
        <ui-estatus-planta [estatus]="estatus()" />
      </div>
      @if (pendiente()) {
        <p class="mt-1 flex flex-wrap items-center gap-2">
          <span class="rounded-md bg-[#FBF0DD] px-2 py-0.5 text-xs font-bold text-[#7A5410]">Orden por confirmar</span>
          @if (estatus() !== 'no_enviado' && puede('ventas.pedidos.confirmar')) {
            <button type="button" [class]="secundario" (click)="confirmando.set(true)">Confirmar orden</button>
          }
        </p>
      } @else if (p().confirmadaEn; as en) {
        <p class="mt-1 text-texto-suave">
          <span class="rounded-md bg-[#E5F0EA] px-2 py-0.5 text-xs font-bold text-[#2E5E4A]">Orden confirmada</span>
          el {{ en | fechaZona: p().zonaHoraria }}
        </p>
      }

      @switch (estatus()) {
        @case ('no_enviado') {
          <p class="mt-1 text-texto-suave">Aún no se envía a {{ p().plantaNombre }}.</p>
          <!-- Botón dividido: enviar a planta y, en la flecha, confirmar la orden sin esperar a planta -->
          <div class="mt-2 flex flex-wrap gap-2">
            @if (puede('ventas.pedidos.planta')) {
              <div class="flex">
                <button type="button" [class]="primario + (ofrecerConfirmar() ? ' rounded-r-none' : '')" (click)="cambiar('enviado')">
                  Enviar requerimiento a planta
                </button>
                @if (ofrecerConfirmar()) {
                  <button
                    type="button"
                    [class]="primario + ' rounded-l-none border-l border-white/40 px-2'"
                    [cdkMenuTriggerFor]="menuPlanta"
                  >
                    <ui-icon [icono]="iconoAbrir" [tamano]="16" /><span class="sr-only">Más opciones del requerimiento</span>
                  </button>
                }
              </div>
            } @else if (ofrecerConfirmar()) {
              <button type="button" [class]="primario" (click)="confirmando.set(true)">Confirmar orden</button>
            }
          </div>
          <ng-template #menuPlanta>
            <section aria-label="Opciones del requerimiento">
              <div cdkMenu aria-label="Opciones del requerimiento" class="glass-strong mt-1 min-w-72 p-1.5 text-[15px] text-carbon">
                <button
                  cdkMenuItem
                  type="button"
                  class="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:outline-none"
                  (cdkMenuItemTriggered)="confirmando.set(true)"
                >
                  <span class="font-semibold">Confirmar orden</span>
                  <span class="text-sm text-texto-suave">Queda confirmada sin esperar a planta; el requerimiento se puede enviar después.</span>
                </button>
              </div>
            </section>
          </ng-template>
        }
        @case ('enviado') {
          <p class="mt-1 text-texto-suave">Esperando la respuesta de {{ p().plantaNombre }}.</p>
          @if (!respondiendo()) {
            <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Respuesta de planta">
              @if (puede('ventas.pedidos.planta')) {
                <button type="button" [class]="primario" (click)="cambiar('confirmado')">Confirmar pedido</button>
              }
              @if (puede('ventas.pedidos.planta')) {
                <button type="button" [class]="secundario" (click)="responder('actualizacion')">Pedir actualización</button>
              }
              @if (puede('ventas.pedidos.planta')) {
                <button type="button" [class]="secundario" (click)="responder('rechazada')">Rechazar</button>
              }
            </div>
          }
        }
        @case ('actualizacion') {
          <!-- En una línea: así "fecha: nota" no lleva espacio antes de los dos puntos -->
          <p class="mt-1">{{ p().plantaNombre }} pide cambiar la entrega@if (p().solicitudPlanta?.fecha; as fecha) { a <span class="font-semibold">{{ fecha | fechaZona: p().zonaHoraria }}</span>}@if (p().solicitudPlanta?.nota; as nota) {: {{ nota }}}.</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @if (puede('ventas.pedidos.planta')) {
              <button type="button" [class]="primario" (click)="cambiar('confirmado')">Aceptar la nueva fecha</button>
            }
            @if (puede('ventas.pedidos.planta')) {
              <button type="button" [class]="secundario" (click)="cambiar('enviado')">Reenviar sin cambios</button>
            }
          </div>
        }
        @case ('rechazada') {
          <p class="mt-1">Rechazado{{ p().solicitudPlanta?.nota ? ': ' + p().solicitudPlanta?.nota : '.' }}</p>
          @if (puede('ventas.pedidos.planta')) {
            <button type="button" [class]="secundario + ' mt-2'" (click)="cambiar('enviado')">Reenviar a planta</button>
          }
        }
        @case ('confirmado') {
          <p class="mt-1 text-texto-suave">{{ p().plantaNombre }} confirmó el pedido.</p>
        }
      }

      @if (respondiendo() === 'actualizacion') {
        <form novalidate class="mt-3 grid gap-2" aria-label="Pedir actualización" (submit)="enviarRespuesta($event)">
          <div>
            <label for="planta-fecha" class="font-medium">Nueva fecha de entrega</label>
            <input
              id="planta-fecha"
              type="datetime-local"
              class="campo mt-1 h-9 max-w-64 px-3"
              aria-describedby="planta-fecha-error"
              [formField]="actualizacion.fecha"
            />
            <ui-field-error [campo]="actualizacion.fecha" errorId="planta-fecha-error" />
          </div>
          <div>
            <label for="planta-nota" class="font-medium">Nota para ventas</label>
            <input id="planta-nota" class="campo mt-1 h-9 px-3" [formField]="actualizacion.nota" />
          </div>
          <div class="flex gap-2">
            <button type="submit" [class]="primario">Pedir actualización</button>
            @if (puede('ventas.pedidos.planta')) {
              <button type="button" [class]="secundario" (click)="cancelar()">Cancelar</button>
            }
          </div>
        </form>
      }
      @if (respondiendo() === 'rechazada') {
        <form novalidate class="mt-3 grid gap-2" aria-label="Rechazar el pedido" (submit)="enviarRespuesta($event)">
          <div>
            <label for="planta-motivo" class="font-medium">Motivo del rechazo</label>
            <textarea
              id="planta-motivo"
              rows="2"
              class="campo mt-1 resize-y px-3 py-2"
              aria-describedby="planta-motivo-error"
              [formField]="rechazo.motivo"
            ></textarea>
            <ui-field-error [campo]="rechazo.motivo" errorId="planta-motivo-error" />
          </div>
          <div class="flex gap-2">
            <button type="submit" [class]="primario">Rechazar el pedido</button>
            @if (puede('ventas.pedidos.planta')) {
              <button type="button" [class]="secundario" (click)="cancelar()">Cancelar</button>
            }
          </div>
        </form>
      }
      <p class="mt-2 font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
    </section>
    <app-confirmar-orden
      [titulo]="'Confirmar la orden ' + p().folio"
      [entregas]="entrega()"
      [acciones]="[{ id: 'confirmar', texto: 'Confirmar orden', primaria: true }]"
      [(abierto)]="confirmando"
      (elegido)="confirmarOrden()"
    />
  `,
})
export class PlantaPedido {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly ventas = inject(VentasService);
  private readonly injector = inject(Injector);

  readonly p = input.required<PedidoVista>();
  /** Nivel del título: 2 en la vista completa, 3 en la vista previa. */
  readonly nivel = input<2 | 3>(3);

  protected readonly primario = 'boton-primario h-9 w-auto px-3.5 text-sm';
  protected readonly secundario =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly estatus = computed(() => this.p().estatusPlanta ?? 'no_enviado');
  protected readonly respondiendo = signal<Respuesta | null>(null);
  protected readonly iconoAbrir = ChevronDown;
  protected readonly pendiente = computed(() => porConfirmar(this.p()));
  protected readonly ofrecerConfirmar = computed(() => this.pendiente() && this.puede('ventas.pedidos.confirmar'));
  protected readonly confirmando = signal(false);
  protected readonly entrega = computed<EntregaPorConfirmar[]>(() => {
    const p = this.p();
    return [{ id: p.id, titulo: p.producto, fecha: p.fechaHoraEntrega, zona: p.zonaHoraria, lugar: `${p.obraNombre} · ${p.plantaNombre}`, m3: p.volumenM3 }];
  });
  protected async confirmarOrden(): Promise<void> {
    try {
      await this.ventas.confirmarOrden(this.p().id);
      this.aviso.set(`Orden ${this.p().folio} confirmada.`);
    } catch (e) {
      this.aviso.set(mensajeDe(e));
    }
  }
  protected readonly aviso = signal('');

  protected readonly actualizacion = form(signal({ fecha: '', nota: '' }), (m) => {
    required(m.fecha, { message: 'Elige la nueva fecha y hora de entrega.' });
  });
  protected readonly rechazo = form(signal({ motivo: '' }), (m) => {
    required(m.motivo, { message: 'Escribe por qué se rechaza.' });
  });

  protected async cambiar(estatus: 'enviado' | 'confirmado'): Promise<void> {
    const antes = this.estatus();
    try {
      await this.ventas.estatusPlanta(this.p().id, estatus);
    } catch (e) {
      return this.aviso.set(mensajeDe(e));
    }
    this.aviso.set(
      estatus === 'confirmado'
        ? antes === 'actualizacion'
          ? 'Nueva fecha aceptada: el pedido quedó confirmado.'
          : 'Pedido confirmado por planta.'
        : `Requerimiento ${antes === 'no_enviado' ? 'enviado' : 'reenviado'} a ${this.p().plantaNombre}.`,
    );
  }

  protected responder(r: Respuesta): void {
    this.aviso.set('');
    this.respondiendo.set(r);
    afterNextRender(() => document.getElementById(r === 'actualizacion' ? 'planta-fecha' : 'planta-motivo')?.focus(), {
      injector: this.injector,
    });
  }

  protected cancelar(): void {
    this.respondiendo.set(null);
  }

  protected async enviarRespuesta(e: Event): Promise<void> {
    e.preventDefault();
    const r = this.respondiendo();
    if (r === 'actualizacion') {
      const ok = await submit(this.actualizacion, async () => {
        const { fecha, nota } = this.actualizacion().value();
        // La fecha se captura en la hora de la planta (la que se muestra en toda la orden).
        const iso = `${fecha}:00${offsetEn(this.p().zonaHoraria, new Date())}`;
        try {
          await this.ventas.estatusPlanta(this.p().id, 'actualizacion', { fecha: iso, nota: nota.trim() });
          this.terminar('Se pidió la actualización a ventas.');
        } catch (e) {
          this.aviso.set(mensajeDe(e));
        }
        return undefined;
      });
      if (!ok) document.getElementById('planta-fecha')?.focus();
    } else if (r === 'rechazada') {
      const ok = await submit(this.rechazo, async () => {
        try {
          await this.ventas.estatusPlanta(this.p().id, 'rechazada', { nota: this.rechazo().value().motivo.trim() });
          this.terminar('Pedido rechazado por planta.');
        } catch (e) {
          this.aviso.set(mensajeDe(e));
        }
        return undefined;
      });
      if (!ok) document.getElementById('planta-motivo')?.focus();
    }
  }

  private terminar(aviso: string): void {
    this.respondiendo.set(null);
    this.actualizacion().reset({ fecha: '', nota: '' });
    this.rechazo().reset({ motivo: '' });
    this.aviso.set(aviso);
  }
}

/**
 * La planta en una fila de Órdenes o Por cobrar: sin enviar, el botón "Enviar a planta" (no hace falta abrir la orden);
 * enviada, su estatus y si aún no contesta. Las respuestas y lo demás se ven en la orden (PlantaPedido).
 */
@Component({
  selector: 'app-planta-fila',
  imports: [EstatusPlantaEtiqueta],
  template: `
    @if (estatus() === 'no_enviado') {
      <button
        type="button"
        class="inline-flex h-8 items-center rounded-[0.625rem] border border-epico bg-white px-2.5 text-sm font-semibold whitespace-nowrap text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
        [attr.aria-label]="'Enviar a planta el requerimiento de ' + p().folio"
        (click)="enviar()"
      >
        Enviar a planta
      </button>
    } @else {
      <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
        <ui-estatus-planta [estatus]="estatus()" />
        @if (estatus() === 'enviado') {
          <span class="text-xs text-texto-suave">sin respuesta</span>
        }
      </span>
    }
  `,
})
export class PlantaFila {
  private readonly ventas = inject(VentasService);

  readonly p = input.required<PedidoVista>();
  /** Lo que pasó, para anunciarlo (aria-live de quien lo usa). */
  readonly enviado = output<string>();

  protected readonly estatus = computed(() => this.p().estatusPlanta ?? 'no_enviado');

  protected async enviar(): Promise<void> {
    try {
      await this.ventas.estatusPlanta(this.p().id, 'enviado');
      this.enviado.emit(`${this.p().folio}: requerimiento enviado a ${this.p().plantaNombre}.`);
    } catch (e) {
      this.enviado.emit(`${this.p().folio}: ${mensajeDe(e)}`);
    }
  }
}
