import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, Sesion } from 'ui';
import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  const sesion = signal<Sesion | null>({ usuario: { nombre: 'Yumil', correo: 'y@e.mx' }, token: 'viejo', refreshToken: 'r1' });
  const refrescar = vi.fn();
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    refrescar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { sesion, refrescar } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('pone el token solo en /api', () => {
    void firstValueFrom(http.get('/api/v1/empresas'));
    void firstValueFrom(http.get('/ui/fondos/x.webp'));
    expect(backend.expectOne('/api/v1/empresas').request.headers.get('Authorization')).toBe('Bearer viejo');
    expect(backend.expectOne('/ui/fondos/x.webp').request.headers.has('Authorization')).toBe(false);
  });

  it('con 401 renueva el token una vez y reintenta con el nuevo', async () => {
    refrescar.mockResolvedValue({ ...sesion(), token: 'nuevo' });
    const p = firstValueFrom(http.get('/api/v1/empresas'));
    backend.expectOne('/api/v1/empresas').flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await Promise.resolve();
    const reintento = backend.expectOne('/api/v1/empresas');
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush([{ id: 'e1' }]);
    expect(await p).toEqual([{ id: 'e1' }]);
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('si no se puede renovar, manda al login y devuelve el 401', async () => {
    refrescar.mockResolvedValue(null);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const p = firstValueFrom(http.get('/api/v1/empresas')).catch((e) => e.status);
    backend.expectOne('/api/v1/empresas').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await p).toBe(401);
    expect(navegar).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('un 403 (falta permiso) no intenta renovar', async () => {
    const p = firstValueFrom(http.get('/api/v1/roles')).catch((e) => e.status);
    backend.expectOne('/api/v1/roles').flush({ detail: 'Falta el permiso x' }, { status: 403, statusText: 'Forbidden' });
    expect(await p).toBe(403);
    expect(refrescar).not.toHaveBeenCalled();
  });
});
