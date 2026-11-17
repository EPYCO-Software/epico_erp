import { TestBed } from '@angular/core/testing';
import { AUTH_STORAGE_KEY } from 'ui';
import { puedeVerModulo, puedeVerRuta } from './permisos';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { MODULOS, ModulosService, buscarModulo, enlacesDelMenu, filtrarModulos, moduloActivoGuard, modulosDelFiltro } from './modulos';

describe('filtrarModulos', () => {
  const ids = (texto: string) => filtrarModulos(MODULOS, texto).map((m) => m.id);

  it('sin texto devuelve los 17 módulos', () => {
    expect(ids('  ')).toHaveLength(17);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(ids('PLANEACION')).toEqual(['planeacion']);
    expect(ids('analítica')).toEqual(['analitica']);
  });

  it('acepta varias palabras en cualquier orden', () => {
    expect(ids('flota logistica')).toEqual(['logistica']);
    expect(ids('iot e')).toEqual(['integraciones']);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(ids('nómina')).toEqual([]);
  });

  it('cada módulo tiene id único y se puede buscar por id', () => {
    expect(new Set(MODULOS.map((m) => m.id)).size).toBe(MODULOS.length);
    expect(buscarModulo('calidad')?.ruta).toBe('/laboratorio');
    expect(buscarModulo('no-existe')).toBeUndefined();
  });
});

describe('módulos activos', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: AUTH_STORAGE_KEY, useValue: 'test.modulos' }] }));
  it('por ahora solo Seguridad, CRM, ventas y pedidos están activados', () => {
    expect(MODULOS.filter((m) => m.activo).map((m) => m.id)).toEqual(['seguridad', 'crm', 'ventas', 'pedidos']);
  });

  it('por defecto la pantalla de inicio muestra solo los activados y la búsqueda busca dentro del filtro', () => {
    const s = TestBed.inject(ModulosService);
    const ids = () => s.resultados().map((m) => m.id);
    expect(s.filtros()).toEqual(['activados']);
    expect(ids()).toEqual(['seguridad', 'crm', 'ventas', 'pedidos']);
    s.busqueda.set('flota');
    expect(ids()).toEqual([]);
    s.alternarFiltro('todos');
    expect(ids()).toEqual(['logistica']);
    s.busqueda.set('');
    expect(ids()).toHaveLength(17);
  });

  it('los filtros se suman; "todos" va solo y sin ninguno se vuelve a "todos"', () => {
    const s = TestBed.inject(ModulosService);
    s.alternarFiltro('favoritos');
    expect(s.filtros()).toEqual(['activados', 'favoritos']);
    expect(s.descripcion()).toBe('activados y favoritos');
    s.alternarFiltro('todos');
    expect(s.filtros()).toEqual(['todos']);
    s.alternarFiltro('todos');
    expect(s.filtros()).toEqual(['todos']);
    s.alternarFiltro('activados');
    expect(s.filtros()).toEqual(['activados']);
    s.alternarFiltro('activados');
    expect(s.filtros()).toEqual(['todos']);
    // suma de verdad: un favorito no activado se agrega a los activados, en el orden del catálogo
    const favoritos = [buscarModulo('logistica')!, buscarModulo('crm')!];
    expect(modulosDelFiltro(['activados', 'favoritos'], favoritos).map((m) => m.id)).toEqual([
      'seguridad',
      'crm',
      'ventas',
      'pedidos',
      'logistica',
    ]);
    expect(modulosDelFiltro(['favoritos'], favoritos).map((m) => m.id)).toEqual(['crm', 'logistica']);
  });

  describe('moduloActivoGuard', () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AUTH_STORAGE_KEY, useValue: 'test.modulos' }] }));
    const correr = (modulo?: string) =>
      TestBed.runInInjectionContext(() =>
        moduloActivoGuard({ data: modulo ? { modulo } : {} } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

    it('deja pasar rutas de módulos activos y rutas sin módulo', () => {
      expect(correr('pedidos')).toBe(true);
      expect(correr()).toBe(true);
    });

    it('manda las de módulos no activados al aviso /modulos/:id', () => {
      const r = correr('logistica');
      expect(r instanceof UrlTree && r.toString()).toBe('/modulos/logistica');
    });
  });
});

describe('menú de Ventas', () => {
  const menu = buscarModulo('ventas')!.menu!;

  it('tiene los menús de Odoo y cada opción su propia ruta dentro de /ventas', () => {
    expect(menu.map((m) => m.nombre)).toEqual(['Órdenes', 'Por cobrar', 'Productos', 'Reportes', 'Configuración']);
    const rutas = menu.flatMap(enlacesDelMenu).map((e) => e.ruta);
    expect(rutas).toHaveLength(26);
    // Equipos de ventas está desactivado hasta que tenga su lógica; Tarjetas de regalo, desactivado
    expect(menu.flatMap(enlacesDelMenu).some((e) => e.nombre === 'Equipos de ventas')).toBe(false);
    expect(rutas).not.toContain('/ventas/tarjetas-de-regalo');
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(rutas.every((r) => r.startsWith('/ventas/'))).toBe(true);
  });
});

describe('qué ve cada usuario (permisos de su rol)', () => {
  const KEY = 'test.modulos.permisos';
  const entrar = (permisos: string[]) => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', usuario: { nombre: 'Ana', correo: 'a@x.mx' }, permisos }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AUTH_STORAGE_KEY, useValue: KEY }] });
    return TestBed.inject(ModulosService);
  };
  afterEach(() => localStorage.removeItem(KEY));

  it('reglas: módulo por cualquier permiso suyo (también por comodín) y página por su permiso "ver"', () => {
    expect(puedeVerModulo(['ventas.cotizaciones.ver'], 'ventas')).toBe(true);
    expect(puedeVerModulo(['ventas.cotizaciones.ver'], 'seguridad')).toBe(false);
    expect(puedeVerModulo(['ventas.*'], 'pedidos')).toBe(true);
    expect(puedeVerModulo(['ventas.cotizaciones.*'], 'pedidos')).toBe(false);
    // Sin permisos en el backend para ese módulo: solo root
    expect(puedeVerModulo(['ventas.*'], 'calidad')).toBe(false);
    expect(puedeVerModulo(['*'], 'calidad')).toBe(true);
    // Sin permisos en la sesión (demo sin backend): todo
    expect(puedeVerModulo(undefined, 'seguridad')).toBe(true);
    expect(puedeVerRuta(['ventas.cotizaciones.ver'], '/ventas/cotizaciones/recibidas?x=1')).toBe(true);
    expect(puedeVerRuta(['ventas.cotizaciones.ver'], '/ventas/listas-de-precios')).toBe(false);
    expect(puedeVerRuta(['ventas.cotizaciones.ver'], '/ventas/configuracion/ajustes')).toBe(true);
    // Las altas piden "crear", no solo "ver"
    expect(puedeVerRuta(['ventas.cotizaciones.ver'], '/ventas/cotizaciones/nueva?base=1')).toBe(false);
    expect(puedeVerRuta(['ventas.cotizaciones.*'], '/ventas/cotizaciones/nueva')).toBe(true);
    expect(puedeVerRuta(['ventas.productos.ver'], '/ventas/productos/nuevo')).toBe(false);
  });

  it('un vendedor solo ve Ventas y CRM, y en Ventas solo sus opciones', () => {
    const s = entrar(['ventas.cotizaciones.*', 'ventas.clientes.ver', 'crm.*']);
    expect(s.visibles().map((m) => m.id)).toEqual(['crm', 'ventas']);
    expect(s.favoritos().map((m) => m.id)).toEqual(['crm', 'ventas']);
    const menu = s.menuDe(buscarModulo('ventas')!);
    expect(menu.find((g) => g.nombre === 'Órdenes')!.enlaces.map((e) => e.nombre)).toEqual(['Cotizaciones', 'Cotizaciones recibidas', 'Clientes']);
    expect(menu.map((g) => g.nombre)).not.toContain('Productos');
  });

  it('el guard manda a /inicio un módulo o una página sin permiso', () => {
    entrar(['ventas.cotizaciones.ver']);
    const correr = (modulo: string, url: string) =>
      TestBed.runInInjectionContext(() => moduloActivoGuard({ data: { modulo } } as unknown as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
    expect(correr('ventas', '/ventas/cotizaciones')).toBe(true);
    expect(String(correr('ventas', '/ventas/listas-de-precios'))).toBe('/inicio');
    expect(String(correr('seguridad', '/configuracion/usuarios'))).toBe('/inicio');
  });
});
