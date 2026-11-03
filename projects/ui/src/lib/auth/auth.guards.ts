import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Protege rutas privadas: sin sesión manda a /login conservando a dónde quería ir. */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).autenticado() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

/** Para /login: con sesión activa no tiene sentido volver a entrar. */
export const guestGuard: CanActivateFn = () => !inject(AuthService).autenticado() || inject(Router).createUrlTree(['/']);

/** Solo acepta rutas internas de la app (evita redirecciones abiertas con returnUrl=//sitio.com o http://…). */
export function destinoSeguro(returnUrl: string | null | undefined, porDefecto = '/'): string {
  return returnUrl && /^\/(?![/\\])/.test(returnUrl) && !returnUrl.startsWith('/login') ? returnUrl : porDefecto;
}
