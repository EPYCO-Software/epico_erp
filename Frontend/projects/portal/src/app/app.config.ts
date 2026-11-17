import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { AUTH_API_URL, AUTH_APP, AUTH_STORAGE_KEY, apiInterceptor } from 'ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([apiInterceptor])),
    { provide: AUTH_STORAGE_KEY, useValue: 'epico.portal.sesion' },
    { provide: AUTH_APP, useValue: 'portal' },
    // En desarrollo, /api pasa por el proxy al backend (projects/portal/proxy.conf.json)
    { provide: AUTH_API_URL, useValue: '/api/v1' },
  ],
};
