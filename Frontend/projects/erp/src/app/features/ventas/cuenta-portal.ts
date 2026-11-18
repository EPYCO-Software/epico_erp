import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { KeyRound, LoaderCircle, Send } from 'lucide';
import { Cliente, FechaZonaPipe, FieldError, Icon } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from './datos';

/** "" = sin límite; si no, un entero de 0 a 9999. */
const limiteValido = (v: string) => v.trim() === '' || (/^\d{1,4}$/.test(v.trim()));
const aLimite = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * Ficha del cliente → Portal de clientes. La cuenta es un usuario SOLO del portal (el backend no lo deja entrar al ERP):
 * se crea con un correo y el backend le manda sus credenciales; después se reenvían o se desactiva. Los límites
 * acotan cuántas cotizaciones y obras crea él mismo en el portal (Ventas no tiene límite). Un cliente puede no tener
 * cuenta; el de mostrador nunca la tiene.
 */
@Component({
  selector: 'app-cuenta-portal',
  host: { class: 'block' },
  imports: [FechaZonaPipe, FieldError, FormField, Icon],
  template: `
    <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Portal de clientes</p>
    <div class="space-y-3 rounded-xl bg-white/80 p-3">
      @if (cuenta.isLoading()) {
        <p class="text-texto-suave">Cargando la cuenta…</p>
      } @else if (cuenta.error()) {
        <p class="text-[#8E332C]">No pudimos leer la cuenta del portal: {{ mensaje(cuenta.error()) }}</p>
      } @else if (cuenta.value(); as k) {
        <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-texto-suave">Entra con</dt>
          <dd class="break-all">{{ k.correo }}</dd>
          <dt class="text-texto-suave">Estado</dt>
          <dd class="font-semibold" [class]="k.activa ? 'text-[#2E5E4A]' : 'text-[#8E332C]'">{{ k.activa ? 'Activa' : 'Desactivada' }}</dd>
          <dt class="text-texto-suave">Último acceso</dt>
          <dd>{{ k.ultimoAcceso ? (k.ultimoAcceso | fechaZona) : 'Aún no entra' }}</dd>
        </dl>
        @if (puede('ventas.clientes.editar')) {
          <div class="flex flex-wrap gap-2">
            @if (k.activa) {
              <button type="button" [class]="boton" [disabled]="ocupado()" (click)="reenviar(k.correo)">
                <ui-icon [icono]="iconos.enviar" [tamano]="15" />Reenviar credenciales
              </button>
            }
            <button type="button" [class]="boton" [disabled]="ocupado()" (click)="activar(!k.activa)">
              {{ k.activa ? 'Desactivar cuenta' : 'Activar cuenta' }}
            </button>
          </div>
        }
      } @else if (puede('ventas.clientes.crear') || puede('ventas.clientes.editar')) {
        <p class="text-texto-suave">Sin cuenta. Créala para que el cliente cotice y dé de alta sus obras en el portal; no podrá entrar al ERP.</p>
        <form class="grid gap-2 sm:grid-cols-2" novalidate (submit)="crear($event)">
          <div>
            <label for="cuenta-nombre" class="mb-1 block text-xs font-semibold">Nombre</label>
            <input id="cuenta-nombre" [class]="campo" [formField]="f.nombre" autocomplete="off" aria-describedby="cuenta-nombre-error" />
            <ui-field-error [campo]="f.nombre" errorId="cuenta-nombre-error" />
          </div>
          <div>
            <label for="cuenta-correo" class="mb-1 block text-xs font-semibold">Correo para entrar</label>
            <input id="cuenta-correo" type="email" [class]="campo" [formField]="f.correo" autocomplete="off" aria-describedby="cuenta-correo-error" />
            <ui-field-error [campo]="f.correo" errorId="cuenta-correo-error" />
          </div>
          <button type="submit" class="boton-primario inline-flex h-9 items-center justify-center gap-2 rounded-[0.625rem] px-3.5 text-sm font-semibold sm:col-span-2 sm:w-auto sm:justify-self-start" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
            <ui-icon [icono]="ocupado() ? iconos.cargando : iconos.llave" [tamano]="15" [class]="ocupado() ? 'animate-spin' : ''" />Crear cuenta y enviar credenciales
          </button>
        </form>
      } @else {
        <p class="text-texto-suave">Sin cuenta en el portal.</p>
      }

      <div class="border-t border-acero/50 pt-3">
        <p class="font-semibold">Límites en el portal</p>
        <p class="text-xs text-texto-suave">Lo que el cliente crea él mismo. Vacío = sin límite.</p>
        <form class="mt-2 flex flex-wrap items-end gap-3" novalidate (submit)="guardarLimites($event)">
          @for (l of limites; track l.id) {
            <div>
              <label [for]="'limite-' + l.id" class="mb-1 block text-xs font-semibold">{{ l.etiqueta }}</label>
              <input
                [id]="'limite-' + l.id"
                inputmode="numeric"
                [class]="campo + ' w-24'"
                [value]="l.valor()"
                [disabled]="!puede('ventas.clientes.editar')"
                [attr.aria-invalid]="!limiteValido(l.valor())"
                [attr.aria-describedby]="'limite-' + l.id + '-uso'"
                (input)="l.valor.set($any($event.target).value)"
              />
              <p [id]="'limite-' + l.id + '-uso'" class="mt-0.5 text-xs text-texto-suave">Lleva {{ l.usadas() }}</p>
            </div>
          }
          @if (puede('ventas.clientes.editar')) {
            <button type="submit" [class]="boton + ' mb-5'" [disabled]="ocupado() || !limitesValidos()">Guardar límites</button>
          }
        </form>
        @if (!limitesValidos()) {
          <p class="text-xs text-[#8E332C]">Escribe un número entero de 0 a 9999, o déjalo vacío.</p>
        }
      </div>
      <p class="text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>
    </div>
  `,
})
export class CuentaPortalCliente {
  private readonly ventas = inject(VentasService);
  readonly c = input.required<Cliente>();
  readonly nivel = input(3);

  protected readonly puede = permisosSesion();
  protected readonly iconos = { llave: KeyRound, enviar: Send, cargando: LoaderCircle };
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly campo = 'campo h-9 w-full rounded-[0.625rem] px-3 text-sm';
  protected readonly boton =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-50';
  protected readonly limiteValido = limiteValido;
  protected readonly mensaje = mensajeDe;

  private readonly id = computed(() => this.c().id);
  // Sin contacto con usuario no hay cuenta: no se pregunta (evita un 404 por cada cliente sin portal).
  protected readonly cuenta = resource({
    params: () => ({ id: this.id(), portal: this.c().portal }),
    loader: ({ params }) => (params.portal ? this.ventas.cuentaPortal(params.id) : Promise.resolve(null)),
  });
  protected readonly ocupado = signal(false);
  // Recién dado de alta (Nuevo cliente con acceso al portal): lo que pasó con su cuenta, solo para ese primer cliente.
  private readonly router = inject(Router);
  private readonly delAlta = (this.router.currentNavigation() ?? this.router.lastSuccessfulNavigation())?.extras.state?.['avisoCuenta'] as
    | { clienteId: string; texto: string; error: boolean }
    | undefined;
  private readonly avisoDelAlta = (id: string) => (this.delAlta?.clienteId === id ? this.delAlta : undefined);
  protected readonly aviso = linkedSignal({ source: this.id, computation: (id, antes) => (antes ? '' : (this.avisoDelAlta(id)?.texto ?? '')) });
  protected readonly error = linkedSignal({ source: this.id, computation: (id, antes) => (antes ? false : (this.avisoDelAlta(id)?.error ?? false)) });

  // Alta: con el contacto principal precargado.
  private readonly modelo = linkedSignal(() => {
    const k = this.c().contacto;
    return { nombre: `${k.nombre} ${k.apellidos}`.trim(), correo: k.correo };
  });
  protected readonly f = form(this.modelo, (p) => {
    required(p.nombre, { message: 'Escribe el nombre de quien entrará.' });
    required(p.correo, { message: 'Escribe el correo con el que entrará.' });
    email(p.correo, { message: 'Escribe un correo válido, por ejemplo nombre@empresa.com.' });
  });

  /** Lo que lleva, contado igual que el backend: series de cotizaciones del portal no canceladas y obras del cliente. */
  private readonly usadas = {
    // Por serie: una revisión (-R1) no cuenta como otra
    cotizaciones: computed(
      () =>
        new Set(
          this.ventas
            .cotizaciones()
            .filter((q) => q.clienteId === this.id() && q.origen === 'portal' && q.estado !== 'cancelada')
            .map((q) => q.folio.replace(/-R\d+$/, '')),
        ).size,
    ),
    obras: computed(() => this.ventas.obras().filter((o) => o.clienteId === this.id()).length),
  };
  private readonly texto = (n: number | null | undefined) => (n == null ? '' : String(n));
  protected readonly limites = [
    { id: 'cotizaciones', etiqueta: 'Cotizaciones', valor: linkedSignal(() => this.texto(this.c().limites?.cotizaciones)) },
    { id: 'obras', etiqueta: 'Obras', valor: linkedSignal(() => this.texto(this.c().limites?.obras)) },
  ].map((l) => {
    const usadas = this.usadas[l.id as 'cotizaciones' | 'obras'];
    return { ...l, usadas: computed(() => { const tope = aLimite(l.valor()); return tope == null || !limiteValido(l.valor()) ? `${usadas()}` : `${usadas()} de ${tope}`; }) };
  });
  protected readonly limitesValidos = computed(() => this.limites.every((l) => limiteValido(l.valor())));

  private async hacer(accion: () => Promise<string>): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    try {
      this.aviso.set(await accion());
      this.error.set(false);
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    } finally {
      this.ocupado.set(false);
    }
  }
  private readonly enviado = (correo: string, ok: boolean) =>
    ok ? `Credenciales enviadas a ${correo}.` : `No se pudo enviar el correo a ${correo}: revisa el servidor de correo y usa "Reenviar credenciales".`;

  protected async crear(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      const d = { nombre: this.modelo().nombre.trim(), correo: this.modelo().correo.trim().toLowerCase() };
      await this.hacer(async () => {
        const r = await this.ventas.crearCuentaPortal(this.id(), d);
        this.cuenta.reload();
        return 'Cuenta creada. ' + this.enviado(r.correo, r.correoEnviado);
      });
      return undefined;
    });
    const invalido = (['nombre', 'correo'] as const).find((c) => this.f[c]().invalid());
    if (invalido) document.getElementById('cuenta-' + invalido)?.focus();
  }

  protected reenviar(correo: string): void {
    if (!confirm(`Se genera una contraseña temporal nueva y se envía a ${correo}. La anterior deja de servir. ¿Continuar?`)) return;
    void this.hacer(async () => this.enviado(correo, (await this.ventas.reenviarCredenciales(this.id())).correoEnviado));
  }

  protected activar(activa: boolean): void {
    if (!activa && !confirm('El cliente ya no podrá entrar al portal y se cerrarán sus sesiones. ¿Desactivar la cuenta?')) return;
    void this.hacer(async () => {
      await this.ventas.activarCuentaPortal(this.id(), activa);
      this.cuenta.reload();
      return activa ? 'Cuenta activada.' : 'Cuenta desactivada.';
    });
  }

  protected guardarLimites(event: Event): void {
    event.preventDefault();
    if (!this.limitesValidos()) return;
    const [cotizaciones, obras] = this.limites.map((l) => aLimite(l.valor()));
    void this.hacer(async () => {
      await this.ventas.guardarLimites(this.id(), { cotizaciones, obras });
      return 'Límites guardados.';
    });
  }
}
