import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cliente, FechaZonaPipe, pesos } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from './datos';

/** "" = sin crédito; si no, pesos con hasta 2 decimales. */
const montoValido = (v: string) => v.trim() === '' || /^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, '').trim());
const diasValidos = (v: string) => /^\d{1,3}$/.test(v.trim()) && Number(v) <= 365;

/**
 * Ficha del cliente → Crédito: límite en pesos y días para pagar; lo usado son sus órdenes en cobro "Crédito", cada una
 * con su vencimiento (creditoDe, la misma regla que el backend, que no deja pasar a crédito lo que exceda).
 */
@Component({
  selector: 'app-credito-cliente',
  host: { class: 'block' },
  imports: [FechaZonaPipe, RouterLink],
  template: `
    <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Crédito</p>
    <div class="space-y-3 rounded-xl bg-white/80 p-3">
      @if (credito().limite) {
        <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-texto-suave">Límite</dt>
          <dd class="tabular-nums">\${{ pesos(credito().limite!) }} · {{ credito().dias }} días</dd>
          <dt class="text-texto-suave">Usado</dt>
          <dd class="tabular-nums">\${{ pesos(credito().usado) }}</dd>
          <dt class="text-texto-suave">Disponible</dt>
          <dd class="font-semibold tabular-nums" [class]="credito().disponible! < 0 ? 'text-[#8E332C]' : 'text-[#2E5E4A]'">
            \${{ pesos(credito().disponible!) }}{{ credito().disponible! < 0 ? ' (excedido)' : '' }}
          </dd>
        </dl>
        <div
          role="meter"
          aria-label="Crédito usado"
          aria-valuemin="0"
          [attr.aria-valuemax]="credito().limite"
          [attr.aria-valuenow]="credito().usado"
          [attr.aria-valuetext]="porcentaje() + ' % usado'"
          class="h-2 overflow-hidden rounded-full bg-carbon/10"
        >
          <div class="h-full rounded-full" [class]="porcentaje() >= 100 ? 'bg-critico' : porcentaje() >= 80 ? 'bg-atencion' : 'bg-correcto'" [style.width.%]="porcentaje()"></div>
        </div>
      } @else {
        <p class="text-texto-suave">Sin crédito: sus órdenes no pueden pasar a cobro "Crédito".</p>
      }

      @if (credito().ordenes.length) {
        <ul class="divide-y divide-acero/40" aria-label="Órdenes a crédito">
          @for (o of credito().ordenes; track o.p.id) {
            <li class="flex items-center justify-between gap-3 py-1.5">
              <a [routerLink]="['/ventas/ordenes', o.p.folio]" class="rounded font-semibold underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico">{{ o.p.folio }}</a>
              <span class="text-right text-xs">
                <span class="block tabular-nums">\${{ pesos(o.p.importe) }}</span>
                <span [class]="o.vencida ? 'font-semibold text-[#8E332C]' : 'text-texto-suave'">
                  {{ o.vencida ? 'Vencida el' : 'Vence el' }} {{ o.vence | fechaZona: o.p.zonaHoraria : 'dd/MM/yyyy' }}
                </span>
              </span>
            </li>
          }
        </ul>
      }

      @if (puede('ventas.clientes.editar')) {
        <form class="flex flex-wrap items-end gap-3 border-t border-acero/50 pt-3" novalidate (submit)="guardar($event)">
          <div>
            <label for="credito-limite" class="mb-1 block text-xs font-semibold">Límite ($)</label>
            <input
              id="credito-limite"
              inputmode="decimal"
              [class]="campo + ' w-36'"
              [value]="limite()"
              [attr.aria-invalid]="!montoValido(limite())"
              aria-describedby="credito-ayuda"
              (input)="limite.set($any($event.target).value)"
            />
          </div>
          <div>
            <label for="credito-dias" class="mb-1 block text-xs font-semibold">Días para pagar</label>
            <input
              id="credito-dias"
              inputmode="numeric"
              [class]="campo + ' w-24'"
              [value]="dias()"
              [attr.aria-invalid]="!diasValidos(dias())"
              aria-describedby="credito-ayuda"
              (input)="dias.set($any($event.target).value)"
            />
          </div>
          <button type="submit" [class]="boton" [disabled]="ocupado() || !valido()">Guardar crédito</button>
          <p id="credito-ayuda" class="w-full text-xs" [class]="valido() ? 'text-texto-suave' : 'text-[#8E332C]'">
            {{ valido() ? 'Límite vacío = sin crédito.' : 'Escribe el límite en pesos (o déjalo vacío) y de 0 a 365 días.' }}
          </p>
        </form>
      }
      <p class="text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>
    </div>
  `,
})
export class CreditoCliente {
  private readonly ventas = inject(VentasService);
  readonly c = input.required<Cliente>();
  readonly nivel = input(3);

  protected readonly puede = permisosSesion();
  protected readonly pesos = pesos;
  protected readonly montoValido = montoValido;
  protected readonly diasValidos = diasValidos;
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly campo = 'campo h-9 rounded-[0.625rem] px-3 text-sm';
  protected readonly boton =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-50';

  protected readonly credito = computed(() => this.ventas.creditoDe(this.c().id));
  protected readonly porcentaje = computed(() => {
    const { limite, usado } = this.credito();
    return limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  });

  private readonly id = computed(() => this.c().id);
  protected readonly limite = linkedSignal(() => (this.c().credito?.limite ? String(this.c().credito!.limite) : ''));
  protected readonly dias = linkedSignal(() => String(this.c().credito?.dias ?? 0));
  protected readonly valido = computed(() => montoValido(this.limite()) && diasValidos(this.dias()));
  protected readonly ocupado = signal(false);
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly error = linkedSignal({ source: this.id, computation: () => false });

  protected async guardar(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.valido()) return;
    const texto = this.limite().replace(/,/g, '').trim();
    this.ocupado.set(true);
    try {
      await this.ventas.guardarCredito(this.id(), { limite: texto ? Number(texto) : null, dias: Number(this.dias()) });
      this.aviso.set('Crédito guardado.');
      this.error.set(false);
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    } finally {
      this.ocupado.set(false);
    }
  }
}
