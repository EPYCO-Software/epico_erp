import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AUTH_API_URL, AUTH_STORAGE_KEY, AuthService, ErrorAuth } from './auth.service';
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
    const r = (await guard(authGuard)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(r)).toBe('/login?returnUrl=%2Fpedidos');
    await login();
    expect(await guard(authGuard)).toBe(true);
  });

  it('guestGuard saca de /login a quien ya tiene sesión', async () => {
    expect(await guard(guestGuard)).toBe(true);
    await login();
    expect(TestBed.inject(Router).serializeUrl((await guard(guestGuard)) as UrlTree)).toBe('/');
  });

  it('destinoSeguro solo acepta rutas internas', () => {
    expect(destinoSeguro('/pedidos?id=1', '/obras')).toBe('/pedidos?id=1');
    for (const malo of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/login', '', null]) {
      expect(destinoSeguro(malo, '/obras')).toBe('/obras');
    }
  });
});

describe('auth con backend (AUTH_API_URL)', () => {
  const respuesta = (token: string, refreshToken: string) => ({
    usuario: { id: 'u1', nombre: 'Yumil', correo: 'yumilrf@hotmail.com' },
    empresaId: 'e1',
    token,
    tokenExpira: '2026-11-14T20:00:00Z',
    refreshToken,
    empresas: [{ id: 'e1', nombre: 'EPICO Concretos del Sureste', plantas: [] }],
    permisos: ['*'],
  });
  const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AUTH_STORAGE_KEY, useValue: KEY }, { provide: AUTH_API_URL, useValue: '/api/v1' }],
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('login llama al backend y guarda token, refresh token, empresas y permisos', async () => {
    fetchMock.mockResolvedValueOnce(json(200, respuesta('t1', 'r1')));
    const s = await TestBed.inject(AuthService).login({ correo: 'yumilrf@hotmail.com', password: 'x', recordar: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ correo: 'yumilrf@hotmail.com', password: 'x', app: 'erp' });
    expect(s).toMatchObject({ token: 't1', refreshToken: 'r1', permisos: ['*'] });
    expect(JSON.parse(localStorage.getItem(KEY)!).empresas[0].nombre).toBe('EPICO Concretos del Sureste');
  });

  it('un error del backend llega como ErrorAuth con su status y detalle', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { detail: 'Cuenta bloqueada 15 minutos.' }));
    const e = await TestBed.inject(AuthService).login({ correo: 'a@b.mx', password: 'x', recordar: false }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorAuth);
    expect([e.status, e.message]).toEqual([429, 'Cuenta bloqueada 15 minutos.']);
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
  });

  it('refrescar rota el token una sola vez aunque lo pidan dos a la vez, y conserva dónde se guardó', async () => {
    fetchMock.mockResolvedValueOnce(json(200, respuesta('t1', 'r1')));
    const auth = TestBed.inject(AuthService);
    await auth.login({ correo: 'yumilrf@hotmail.com', password: 'x', recordar: false });
    fetchMock.mockResolvedValueOnce(json(200, respuesta('t2', 'r2')));
    const [a, b] = await Promise.all([auth.refrescar(), auth.refrescar()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refreshToken: 'r1' });
    expect([a?.token, b?.token, auth.sesion()?.refreshToken]).toEqual(['t2', 't2', 'r2']);
    expect(sessionStorage.getItem(KEY)).toContain('r2');
  });

  it('si el refresh ya no sirve, cierra la sesión (y avisa el logout al backend)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, respuesta('t1', 'r1')));
    const auth = TestBed.inject(AuthService);
    await auth.login({ correo: 'yumilrf@hotmail.com', password: 'x', recordar: true });
    fetchMock.mockResolvedValueOnce(json(401, { detail: 'Sesión expirada.' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await auth.refrescar()).toBeNull();
    expect(auth.autenticado()).toBe(false);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/auth/logout');
  });

  it('authGuard valida la sesión guardada con el servidor una sola vez antes de entrar', async () => {
    localStorage.setItem(KEY, JSON.stringify(respuesta('t1', 'r1')));
    fetchMock.mockResolvedValueOnce(json(200, { ...respuesta('t2', 'r2'), permisos: ['ventas.*'] }));
    const g = () => TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/ventas' } as never));
    expect(await Promise.all([g(), g()])).toEqual([true, true]);
    expect(await g()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/refresh');
    // Llegan los permisos al día
    expect(TestBed.inject(AuthService).sesion()?.permisos).toEqual(['ventas.*']);
  });

  it('authGuard: si el servidor rechaza la sesión guardada, la borra y manda al login', async () => {
    localStorage.setItem(KEY, JSON.stringify(respuesta('t1', 'r1')));
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValue(new Response(null, { status: 204 }));
    const r = (await TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/ventas' } as never))) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(r)).toBe('/login?returnUrl=%2Fventas');
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('si el servidor no responde (red o 5xx) no borra la sesión ni deja entrar; reintenta en la siguiente', async () => {
    localStorage.setItem(KEY, JSON.stringify(respuesta('t1', 'r1')));
    const auth = TestBed.inject(AuthService);
    fetchMock.mockRejectedValueOnce(new TypeError('red')).mockResolvedValueOnce(json(503, {}));
    expect(await auth.validar()).toBe(false);
    expect(await auth.validar()).toBe(false);
    expect([auth.autenticado(), auth.sinConexion()]).toEqual([true, true]);
    fetchMock.mockResolvedValueOnce(json(200, respuesta('t2', 'r2')));
    expect(await auth.validar()).toBe(true);
    expect([auth.sesion()?.token, auth.sinConexion()]).toEqual(['t2', false]);
  });

  it('si otra pestaña ya rotó el refresh token, usa el que dejó guardado en vez de cerrar la sesión', async () => {
    localStorage.setItem(KEY, JSON.stringify(respuesta('t1', 'r1')));
    const auth = TestBed.inject(AuthService);
    // La otra pestaña renovó: en localStorage ya está r2 y r1 dejó de servir
    localStorage.setItem(KEY, JSON.stringify(respuesta('t2', 'r2')));
    fetchMock.mockResolvedValueOnce(json(401, {}));
    expect((await auth.refrescar())?.token).toBe('t2');
    expect(auth.autenticado()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
