import { TestBed } from '@angular/core/testing';
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
  it('por ahora solo CRM, ventas y pedidos están activados', () => {
    expect(MODULOS.filter((m) => m.activo).map((m) => m.id)).toEqual(['crm', 'ventas', 'pedidos']);
  });

  it('por defecto la pantalla de inicio muestra solo los activados y la búsqueda busca dentro del filtro', () => {
    const s = TestBed.inject(ModulosService);
    const ids = () => s.resultados().map((m) => m.id);
    expect(s.filtros()).toEqual(['activados']);
    expect(ids()).toEqual(['crm', 'ventas', 'pedidos']);
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
      'crm',
      'ventas',
      'pedidos',
      'logistica',
    ]);
    expect(modulosDelFiltro(['favoritos'], favoritos).map((m) => m.id)).toEqual(['crm', 'logistica']);
  });

  describe('moduloActivoGuard', () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
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
    // Equipos de ventas está desactivado hasta que tenga su lógica
    expect(menu.flatMap(enlacesDelMenu).some((e) => e.nombre === 'Equipos de ventas')).toBe(false);
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(rutas.every((r) => r.startsWith('/ventas/'))).toBe(true);
  });
});
