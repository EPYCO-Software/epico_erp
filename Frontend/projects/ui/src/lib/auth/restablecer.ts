import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormField, email, form, minLength, required, submit, validate } from '@angular/forms/signals';
import { CircleCheck, CircleX } from 'lucide';
import { FieldError } from '../components/field-error';
import { Icon } from '../components/icon';
import { AuthService, ErrorAuth } from './auth.service';

/**
 * Página /restablecer de ERP y portal. Sin ?token pide el correo y manda el enlace (POST /auth/olvide); con el token
 * del enlace pide la contraseña nueva (POST /auth/restablecer). El enlace vence en 30 min y sirve una vez.
 */
@Component({
  selector: 'ui-restablecer',
  imports: [FormField, FieldError, Icon, RouterLink],
  host: { class: 'flex min-h-dvh items-center justify-center p-4' },
  template: `
    <main class="glass w-full max-w-md rounded-[1.75rem] border-white bg-white/60 px-6 py-8 shadow-2xl shadow-carbon/10 sm:px-9">
      <h1 class="text-2xl font-bold tracking-[-0.02em] text-carbon">{{ token ? 'Nueva contraseña' : 'Recuperar contraseña' }}</h1>

      @if (listo(); as mensaje) {
        <p class="mt-4 flex items-start gap-2 text-carbon" role="status">
          <ui-icon [icono]="iconos.ok" [tamano]="20" class="mt-0.5 shrink-0 text-correcto" />{{ mensaje }}
        </p>
      } @else if (!auth.conServidor) {
        <p class="mt-4 text-carbon">La recuperación de contraseña aún no está disponible aquí. Contacta a quien te dio tu acceso.</p>
      } @else if (token) {
        <form class="mt-5 space-y-4" novalidate (submit)="restablecer($event)">
          <p class="text-sm text-texto-suave">Escribe tu contraseña nueva. Al guardarla se cerrarán tus sesiones abiertas.</p>
          <div>
            <label for="nueva" class="mb-1.5 block font-medium text-carbon">Contraseña nueva</label>
            <input
              id="nueva"
              type="password"
              autocomplete="new-password"
              class="campo h-11 px-4"
              [formField]="fp.password"
              [attr.aria-invalid]="fp.password().touched() && fp.password().invalid()"
              aria-describedby="nueva-error"
            />
            <ui-field-error [campo]="fp.password" errorId="nueva-error" />
          </div>
          <div>
            <label for="confirmar" class="mb-1.5 block font-medium text-carbon">Confirma la contraseña</label>
            <input
              id="confirmar"
              type="password"
              autocomplete="new-password"
              class="campo h-11 px-4"
              [formField]="fp.confirmar"
              [attr.aria-invalid]="fp.confirmar().touched() && fp.confirmar().invalid()"
              aria-describedby="confirmar-error"
            />
            <ui-field-error [campo]="fp.confirmar" errorId="confirmar-error" />
          </div>
          @if (error()) {
            <p class="flex items-center gap-2 text-sm font-medium text-critico" role="alert"><ui-icon [icono]="iconos.error" [tamano]="18" />{{ error() }}</p>
          }
          <button type="submit" class="boton-primario h-11" [disabled]="fp().submitting()" [attr.aria-busy]="fp().submitting()">Guardar contraseña</button>
        </form>
      } @else {
        <form class="mt-5 space-y-4" novalidate (submit)="olvide($event)">
          <p class="text-sm text-texto-suave">Te mandaremos un enlace para crear una contraseña nueva. Vence en 30 minutos.</p>
          <div>
            <label for="correo" class="mb-1.5 block font-medium text-carbon">Correo</label>
            <input
              id="correo"
              type="email"
              autocomplete="username"
              class="campo h-11 px-4"
              [formField]="fc.correo"
              [attr.aria-invalid]="fc.correo().touched() && fc.correo().invalid()"
              aria-describedby="correo-error"
            />
            <ui-field-error [campo]="fc.correo" errorId="correo-error" />
          </div>
          @if (error()) {
            <p class="flex items-center gap-2 text-sm font-medium text-critico" role="alert"><ui-icon [icono]="iconos.error" [tamano]="18" />{{ error() }}</p>
          }
          <button type="submit" class="boton-primario h-11" [disabled]="fc().submitting()" [attr.aria-busy]="fc().submitting()">Enviar enlace</button>
        </form>
      }

      <p class="mt-6 border-t border-acero/50 pt-4 text-sm">
        <a routerLink="/login" class="font-semibold text-epico underline underline-offset-4 hover:text-epico-oscuro">Volver a iniciar sesión</a>
      </p>
    </main>
  `,
})
export class Restablecer {
  protected readonly auth = inject(AuthService);
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly iconos = { ok: CircleCheck, error: CircleX };
  protected readonly error = signal('');
  protected readonly listo = signal('');

  protected readonly correo = signal({ correo: '' });
  protected readonly fc = form(this.correo, (p) => {
    required(p.correo, { message: 'Escribe tu correo.' });
    email(p.correo, { message: 'Escribe un correo válido, por ejemplo nombre@empresa.com.' });
  });

  protected readonly nueva = signal({ password: '', confirmar: '' });
  protected readonly fp = form(this.nueva, (p) => {
    required(p.password, { message: 'Escribe la contraseña nueva.' });
    minLength(p.password, 8, { message: 'Usa al menos 8 caracteres.' });
    validate(p.confirmar, ({ value, valueOf }) =>
      value() === valueOf(p.password) ? undefined : { kind: 'distinta', message: 'Las contraseñas no coinciden.' },
    );
  });

  private fallo(e: unknown): string {
    if (e instanceof ErrorAuth && e.status === 429) return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    return (e instanceof ErrorAuth && e.message) || 'No se pudo completar. Intenta de nuevo en un momento.';
  }

  protected async olvide(e: Event): Promise<void> {
    e.preventDefault();
    this.error.set('');
    await submit(this.fc, async () => {
      try {
        await this.auth.olvide(this.correo().correo.trim());
        this.listo.set('Si el correo está registrado, te llegará un enlace para crear tu contraseña nueva. Revisa también tu carpeta de spam.');
      } catch (err) {
        this.error.set(this.fallo(err));
      }
      return undefined;
    });
    if (this.fc.correo().invalid()) document.getElementById('correo')?.focus();
  }

  protected async restablecer(e: Event): Promise<void> {
    e.preventDefault();
    this.error.set('');
    await submit(this.fp, async () => {
      try {
        await this.auth.restablecer(this.token!, this.nueva().password);
        this.listo.set('Listo: tu contraseña cambió. Ya puedes iniciar sesión con ella.');
      } catch (err) {
        this.error.set(this.fallo(err));
      }
      return undefined;
    });
    const invalido = (['password', 'confirmar'] as const).find((c) => this.fp[c]().invalid());
    if (invalido) document.getElementById(invalido === 'password' ? 'nueva' : 'confirmar')?.focus();
  }
}
