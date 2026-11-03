import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { ArrowRight, CircleX, Eye, EyeOff, Info, LoaderCircle, Lock, Mail, MessagesSquare } from 'lucide';
import { AuthService, FieldError, Icon, destinoSeguro } from 'ui';

interface LoginPortal {
  correo: string;
  password: string;
  recordar: boolean;
}

// shortcut: mientras el login es estático el formulario viene lleno para entrar con un clic.
// Al conectar el backend, dejar correo y password vacíos.
const DEMO: LoginPortal = { correo: 'compras@constructoradelta.mx', password: 'demo-cliente', recordar: true };

const AVISOS = {
  recuperar: 'La recuperación de contraseña estará disponible pronto. Mientras tanto, contacta a Atención al cliente.',
  acceso: 'Pide tu acceso al asesor comercial de EPICO que atiende tu obra.',
  atencion: 'Atención al cliente: comunícate con tu asesor comercial de EPICO.',
};

@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, FormField, FieldError, Icon],
  templateUrl: './login.html',
})
export default class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly iconos = {
    correo: Mail,
    candado: Lock,
    ver: Eye,
    ocultar: EyeOff,
    error: CircleX,
    info: Info,
    flecha: ArrowRight,
    cargando: LoaderCircle,
    atencion: MessagesSquare,
  };
  private readonly route = inject(ActivatedRoute);

  protected readonly avisos = AVISOS;
  protected readonly verPassword = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');

  protected readonly modelo = signal<LoginPortal>({ ...DEMO });
  protected readonly f = form(this.modelo, (p) => {
    required(p.correo, { message: 'Escribe tu correo electrónico.' });
    email(p.correo, { message: 'Escribe un correo válido, por ejemplo nombre@empresa.com.' });
    required(p.password, { message: 'Escribe tu contraseña.' });
  });

  protected async entrar(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    await submit(this.f, async () => {
      try {
        await this.auth.login(this.modelo());
        await this.router.navigateByUrl(destinoSeguro(this.route.snapshot.queryParamMap.get('returnUrl'), '/catalogo'));
      } catch {
        // Mensaje genérico: no revelar si falló el correo o la contraseña.
        this.error.set('No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.');
      }
      return undefined;
    });
    // Lleva el foco al primer campo con error para que teclado y lector de pantalla lo encuentren.
    const invalido = (['correo', 'password'] as const).find((c) => this.f[c]().invalid());
    if (invalido) document.getElementById(invalido)?.focus();
  }
}
