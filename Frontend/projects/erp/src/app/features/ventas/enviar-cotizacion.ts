import { Component, ElementRef, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { MonitorCheck, Send, X } from 'lucide';
import { CotizacionVista, FieldError, Icon } from 'ui';
import { VentasService } from './datos';

/**
 * "Enviar" una cotización, como el de Odoo. Si su cliente ya está conectado al portal, se envía a esa misma cuenta
 * (la ve en Mis cotizaciones); si no, por correo: el de su ficha, que se puede cambiar.
 */
@Component({
  selector: 'app-enviar-cotizacion',
  imports: [FieldError, FormField, Icon],
  host: { class: 'contents' },
  template: `
    <!-- Esc cierra el diálogo; que no llegue al panel de la lista, que también se cierra con Esc. -->
    <dialog
      #dialogo
      aria-labelledby="enviar-titulo"
      class="glass-strong m-auto w-[min(30rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate (submit)="enviar($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="enviar-titulo" class="text-lg font-bold">Enviar {{ c().folio }}</h2>
          <button
            type="button"
            aria-label="Cerrar sin enviar"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            (click)="abierto.set(false)"
          >
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>

        <div class="grid gap-3 px-6 py-5">
          <p class="text-texto-suave">Cliente: <span class="font-semibold text-carbon">{{ c().clienteNombre }}</span></p>
          @if (cliente().portal) {
            <div class="rounded-xl bg-[#E3EFE9] px-4 py-3 text-[#2E5E4A]">
              <p class="flex items-center gap-2 font-semibold">
                <ui-icon [icono]="iconos.portal" [tamano]="18" />Conectado al portal de clientes
              </p>
              <p class="mt-1 text-sm">
                Se envía a su cuenta {{ cliente().contacto.correo }}: la verá en Mis cotizaciones y le llegará un aviso a ese correo.
              </p>
            </div>
          } @else {
            <div>
              <label for="enviar-correo" class="font-semibold">Correo del cliente</label>
              <input
                id="enviar-correo"
                type="email"
                autocomplete="email"
                autofocus
                class="campo mt-1.5 h-10 px-3"
                aria-describedby="enviar-correo-error enviar-correo-ayuda"
                [formField]="f.correo"
              />
              <ui-field-error [campo]="f.correo" errorId="enviar-correo-error" />
              <p id="enviar-correo-ayuda" class="mt-1.5 text-sm text-texto-suave">
                {{ c().clienteNombre }} no tiene cuenta en el portal: le llegará por correo.
              </p>
            </div>
          }
        </div>

        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto gap-2 px-5">
            <ui-icon [icono]="iconos.enviar" [tamano]="18" />Enviar
          </button>
          <button
            type="button"
            class="inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
            (click)="abierto.set(false)"
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  `,
})
export class EnviarCotizacion {
  private readonly ventas = inject(VentasService);

  readonly c = input.required<CotizacionVista>();
  readonly abierto = model(false);
  /** Texto para avisar a dónde se envió. */
  readonly enviada = output<string>();

  protected readonly iconos = { cerrar: X, enviar: Send, portal: MonitorCheck };
  protected readonly cliente = computed(() => this.ventas.cliente(this.c().clienteId)!);
  protected readonly f = form(signal({ correo: '' }), (m) => {
    required(m.correo, { message: 'Escribe el correo del cliente.' });
    email(m.correo, { message: 'Escribe un correo válido, por ejemplo compras@empresa.mx.' });
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        untracked(() => this.f().reset({ correo: this.cliente().contacto.correo }));
        d.showModal();
      } else if (!this.abierto() && d.open) {
        d.close();
      }
    });
  }

  protected async enviar(e: Event): Promise<void> {
    e.preventDefault();
    const { portal, contacto: { correo } } = this.cliente();
    if (portal && correo) return this.listo(correo, true);
    await submit(this.f, async () => {
      this.listo(this.f.correo().value().trim(), false);
      return undefined;
    });
    if (this.f.correo().invalid()) document.getElementById('enviar-correo')?.focus();
  }

  private listo(correo: string, portal: boolean): void {
    this.ventas.enviar(this.c().id, correo, portal);
    this.enviada.emit(portal ? `Enviada al portal de ${this.c().clienteNombre} (${correo}).` : `Enviada por correo a ${correo}.`);
    this.abierto.set(false);
  }
}
