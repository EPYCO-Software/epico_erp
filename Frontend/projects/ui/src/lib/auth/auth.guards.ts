import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege rutas privadas: antes de cargarlas valida la sesión con el servidor (una vez por carga de la app). Sin
 * sesión, o si ya no es válida (se borra), manda a /login conservando a dónde quería ir.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.validar()) || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Para /login: con una sesión válida no tiene sentido volver a entrar. Si se guardó una que el servidor rechaza, se
 * borra al validarla; si el servidor no responde, se queda en el login (que avisa con sinConexion).
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return !(await auth.validar()) || router.createUrlTree(['/']);
};

/** Solo acepta rutas internas de la app (evita redirecciones abiertas con returnUrl=//sitio.com o http://…). */
export function destinoSeguro(returnUrl: string | null | undefined, porDefecto = '/'): string {
  return returnUrl && /^\/(?![/\\])/.test(returnUrl) && !returnUrl.startsWith('/login') ? returnUrl : porDefecto;
}
