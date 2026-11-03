import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { authGuard, destinoSeguro, guestGuard } from './auth.guards';

const KEY = 'test.sesion';
const credenciales = { correo: 'ana@epico.mx', password: 'x', recordar: true };

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AUTH_STORAGE_KEY, useValue: KEY }] });
  });
  afterEach(() => vi.useRealTimers());

  const login = async (c = credenciales) => {
    const p = TestBed.inject(AuthService).login(c);
    await vi.runAllTimersAsync();
    return p;
  };
  const guard = (g: typeof authGuard, url = '/pedidos') =>
    TestBed.runInInjectionContext(() => g({} as never, { url } as never));

  it('login guarda la sesión: recordar → localStorage, si no → sessionStorage', async () => {
    await login();
    expect(TestBed.inject(AuthService).autenticado()).toBe(true);
    expect(localStorage.getItem(KEY)).toContain('ana@epico.mx');

    await login({ ...credenciales, recordar: false });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toContain('ana@epico.mx');
  });

  it('restaura la sesión guardada y logout la borra de ambos almacenamientos', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', usuario: { nombre: 'ana', correo: 'ana@epico.mx' } }));
    const auth = TestBed.inject(AuthService);
    expect(auth.sesion()?.usuario.correo).toBe('ana@epico.mx');
    auth.logout();
    expect(auth.autenticado()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignora una sesión corrupta', () => {
    localStorage.setItem(KEY, '{no-json');
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
  });

  it('authGuard manda a /login con returnUrl; deja pasar con sesión', async () => {
    const r = guard(authGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(r)).toBe('/login?returnUrl=%2Fpedidos');
    await login();
    expect(guard(authGuard)).toBe(true);
  });

  it('guestGuard saca de /login a quien ya tiene sesión', async () => {
    expect(guard(guestGuard)).toBe(true);
    await login();
    expect(TestBed.inject(Router).serializeUrl(guard(guestGuard) as UrlTree)).toBe('/');
  });

  it('destinoSeguro solo acepta rutas internas', () => {
    expect(destinoSeguro('/pedidos?id=1', '/obras')).toBe('/pedidos?id=1');
    for (const malo of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/login', '', null]) {
      expect(destinoSeguro(malo, '/obras')).toBe('/obras');
    }
  });
});
