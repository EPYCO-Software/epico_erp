import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import {
  ArrowRight,
  CircleX,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  Lock,
  Mail,
  Shield,
} from 'lucide';
import { AuthService, ErrorAuth, FieldError, Icon, destinoSeguro } from 'ui';
import { CapasGlass } from './capas-glass';

interface LoginErp {
  correo: string;
  password: string;
  recordar: boolean;
}

// La razón social no se elige aquí: el backend entra con la predeterminada del usuario y devuelve a cuáles tiene acceso.

@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, FormField, FieldError, Icon, CapasGlass, RouterLink],
  templateUrl: './login.html',
})
export default class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly iconos = {
    correo: Mail,
    candado: Lock,
    ver: Eye,
    ocultar: EyeOff,
    error: CircleX,
    info: Info,
    flecha: ArrowRight,
    cargando: LoaderCircle,
    escudo: Shield,
  };
  protected readonly verPassword = signal(false);
  // Hay una sesión guardada pero el servidor no respondió al validarla (authGuard/guestGuard).
  protected readonly error = signal(
    this.auth.sinConexion() ? 'No pudimos validar tu sesión: no hay conexión con el servidor. Intenta de nuevo en un momento.' : '',
  );
  protected readonly aviso = signal('');

  protected readonly modelo = signal<LoginErp>({ correo: '', password: '', recordar: true });
  protected readonly f = form(this.modelo, (p) => {
    required(p.correo, { message: 'Escribe tu correo corporativo.' });
    email(p.correo, { message: 'Escribe un correo válido, por ejemplo nombre@empresa.com.' });
    required(p.password, { message: 'Escribe tu contraseña.' });
  });

  protected async entrar(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    await submit(this.f, async () => {
      try {
        await this.auth.login(this.modelo());
        // Una cuenta del portal de clientes (la sesión trae su cliente) no entra al ERP
        if (this.auth.sesion()?.cliente) {
          this.auth.logout();
          this.error.set('Esta cuenta es del portal de clientes: entra desde el portal.');
          return undefined;
        }
        await this.router.navigateByUrl(destinoSeguro(this.route.snapshot.queryParamMap.get('returnUrl'), '/inicio'));
      } catch (e) {
        // Credenciales malas: mensaje genérico (no revelar si falló el correo o la contraseña). Bloqueo, sin acceso o
        // sin conexión: el mensaje del backend, que dice qué hacer.
        const conDetalle = e instanceof ErrorAuth && e.status !== 401 && e.message;
        this.error.set(conDetalle || 'No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.');
      }
      return undefined;
    });
    // Lleva el foco al primer campo con error para que teclado y lector de pantalla lo encuentren.
    const invalido = (['correo', 'password'] as const).find((c) => this.f[c]().invalid());
    if (invalido) document.getElementById(invalido)?.focus();
  }
}
