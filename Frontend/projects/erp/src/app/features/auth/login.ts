import { Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  CircleX,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  Lock,
  Mail,
  Shield,
} from 'lucide';
import { AuthService, FieldError, Icon, destinoSeguro } from 'ui';
import { CapasGlass } from './capas-glass';
import { EMPRESAS } from '../../core/empresas';

interface LoginErp {
  correo: string;
  password: string;
  empresaId: string;
  recordar: boolean;
}

// shortcut: mientras el login es estático el formulario viene lleno para entrar con un clic.
// Al conectar el backend, dejar correo y password vacíos.
const DEMO: LoginErp = { correo: 'operaciones@epicoconcretos.mx', password: 'demo-epico', empresaId: 'demo', recordar: true };



@Component({
  selector: 'app-login',
  imports: [NgOptimizedImage, FormField, FieldError, Icon, CapasGlass],
  templateUrl: './login.html',
})
export default class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly empresas = EMPRESAS;
  protected readonly iconos = {
    correo: Mail,
    candado: Lock,
    ver: Eye,
    ocultar: EyeOff,
    empresa: Building2,
    abajo: ChevronDown,
    error: CircleX,
    info: Info,
    flecha: ArrowRight,
    cargando: LoaderCircle,
    escudo: Shield,
  };
  protected readonly verPassword = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');

  protected readonly modelo = signal<LoginErp>({ ...DEMO });
  protected readonly f = form(this.modelo, (p) => {
    required(p.correo, { message: 'Escribe tu correo corporativo.' });
    email(p.correo, { message: 'Escribe un correo válido, por ejemplo nombre@empresa.com.' });
    required(p.password, { message: 'Escribe tu contraseña.' });
    required(p.empresaId, { message: 'Selecciona tu empresa.' });
  });

  protected async entrar(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    await submit(this.f, async () => {
      try {
        await this.auth.login(this.modelo());
        await this.router.navigateByUrl(destinoSeguro(this.route.snapshot.queryParamMap.get('returnUrl'), '/inicio'));
      } catch {
        // Mensaje genérico: no revelar si falló el correo, la contraseña o la empresa.
        this.error.set('No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.');
      }
      return undefined;
    });
    // Lleva el foco al primer campo con error para que teclado y lector de pantalla lo encuentren.
    const invalido = (['correo', 'password', 'empresaId'] as const).find((c) => this.f[c]().invalid());
    if (invalido) document.getElementById(invalido === 'empresaId' ? 'empresa' : invalido)?.focus();
  }
}
