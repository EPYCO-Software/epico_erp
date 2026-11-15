import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AUTH_API_URL, AUTH_STORAGE_KEY } from 'ui';
import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiInterceptor])),
    { provide: AUTH_STORAGE_KEY, useValue: 'epico.erp.sesion' },
    // En desarrollo, /api pasa por el proxy al backend (projects/erp/proxy.conf.json)
    { provide: AUTH_API_URL, useValue: '/api/v1' },
  ],
};
