import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const conToken = (req: HttpRequest<unknown>, token: string) => req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Peticiones a /api (ERP y portal): llevan el token de la sesión. Con 401 se renueva el token una vez (refresh) y se reintenta; si
 * el servidor ya no la acepta, se cierra la sesión y se manda al login; si no responde, el error llega a quien llamó
 * (la sesión se conserva). El 403 (falta un permiso) llega tal cual a quien llamó.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.sesion()?.token;
  if (!req.url.startsWith('/api/') || !token) return next(req);

  return next(conToken(req, token)).pipe(
    catchError((e: unknown) => {
      if (!(e instanceof HttpErrorResponse) || e.status !== 401 || req.url.includes('/auth/')) return throwError(() => e);
      return from(auth.refrescar()).pipe(
        switchMap((s) => {
          if (s) return next(conToken(req, s.token));
          if (!auth.sinConexion()) void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => e);
        }),
      );
    }),
  );
};
