import { buscarSolucion } from './catalogo';
import { concretoDe, concretoExistente, concretosServidor, resistenciasDe, solucionesDisponibles, sugeridaDisponible } from './concretos';
import { SOLUCIONES } from './catalogo';
import { pedidoMinimoDe, agruparPorObra, aditivoDe, aditivosDisponibles, aditivosServidor, conceptoConcreto, etiquetas, lineasPartida, precioConcreto } from './formato';

const concreto = (id: string, precio: number, soluciones: string[]) => concretoDe({ id, precio, soluciones })!;

describe('concretos: soluciones conectadas a los productos', () => {
  afterEach(() => {
    concretosServidor.set(null);
    aditivosServidor.set(null);
  });

  it('pedido mínimo: el del producto de esa resistencia; sin backend o sin mínimo, ninguno', () => {
    const e = { tipoResistencia: 'fc' as const, resistenciaKgCm2: 200 };
    expect(pedidoMinimoDe(e)).toBeUndefined();
    concretosServidor.set([concretoDe({ id: 'fc-200', precio: 1, pedidoMinimo: 3 })!, concreto('fc-250', 1, [])]);
    expect(pedidoMinimoDe(e)).toBe(3);
    expect(pedidoMinimoDe({ ...e, resistenciaKgCm2: 250 })).toBeUndefined();
  });

  it('sin backend se ofrecen todas las soluciones y todas las resistencias del tarifario', () => {
    expect(solucionesDisponibles()).toEqual(SOLUCIONES);
    expect(resistenciasDe('pavimento').fc).toContain(250);
  });

  it('con productos: solo las soluciones que tienen concretos, y sus resistencias', () => {
    concretosServidor.set([concreto('fc-250', 3950, ['losa', 'columnas']), concreto('mr-45', 4450, ['pavimento']), concreto('fc-100', 3000, [])]);
    expect(solucionesDisponibles().map((s) => s.id)).toEqual(['pavimento', 'losa', 'columnas']);
    expect(resistenciasDe('losa')).toEqual({ fc: [250], mr: [] });
    expect(resistenciasDe('pavimento')).toEqual({ fc: [], mr: [45] });
    // Personalizado: cualquiera de los productos
    expect(resistenciasDe('personalizado')).toEqual({ fc: [100, 250], mr: [45] });
  });

  it('la sugerida de la solución se ajusta a un concreto que exista', () => {
    concretosServidor.set([concreto('fc-200', 3700, ['losa']), concreto('mr-45', 4450, ['pavimento'])]);
    // Losa sugiere f'c 250: la más cercana de losa es 200
    expect(sugeridaDisponible(buscarSolucion('losa')!).resistenciaKgCm2).toBe(200);
    // Pavimento sugiere f'c 300, pero solo hay MR 45
    const pav = sugeridaDisponible(buscarSolucion('pavimento')!);
    expect([pav.tipoResistencia, pav.resistenciaKgCm2]).toEqual(['mr', 45]);
  });

  it('pedido especial: se reconoce lo que ya existe y, sin precio, su concreto va en cero por confirmar', () => {
    concretosServidor.set([concreto('fc-250', 3950, ['losa'])]);
    expect(concretoExistente('fc', 250)?.precio).toBe(3950);
    expect(concretoExistente('fc', 280)).toBeNull();
    const partida = {
      id: 'p', nombre: 'Especial', solucionId: 'personalizado', volumenM3: 10, servicios: [], maquinaria: [], obraId: 'o', entrega: '',
      especificacion: { ...buscarSolucion('losa')!.sugerida, resistenciaKgCm2: 280, aditivos: [] },
      especial: true,
    } as never;
    const [concretoLinea] = lineasPartida(partida);
    expect(concretoLinea.concepto).toContain('precio por confirmar');
    expect(concretoLinea.importe).toBe(0);
    expect(lineasPartida({ ...(partida as object), precioM3: 4000 } as never)[0].importe).toBe(40000);
  });

  it('aditivos de Productos: los nuevos se ofrecen, se cobran y se nombran', () => {
    expect(aditivosDisponibles().map((a) => a.id)).toContain('fibra-sintetica');
    const nuevo = aditivoDe({ codigo: 'AJ-ADT-SUPERPLASTIFICANTE', nombre: 'Aditivo: superplastificante', precio: 210 })!;
    expect(nuevo).toEqual({ id: 'superplastificante', label: 'Superplastificante', precio: 210 });
    expect(aditivoDe({ codigo: 'CON-FC-250', nombre: 'x', precio: 1 })).toBeNull();
    aditivosServidor.set([nuevo, aditivoDe({ codigo: 'AJ-ADT-ACELERANTE', nombre: 'Aditivo: acelerante', precio: 130 })!]);
    const partida = (aditivos: string[]) =>
      ({ especificacion: { ...buscarSolucion('losa')!.sugerida, resistenciaKgCm2: 250, aditivos } }) as never;
    expect(precioConcreto(partida(['superplastificante', 'acelerante'])) - precioConcreto(partida([]))).toBe(340);
    expect(conceptoConcreto(partida(['superplastificante']))).toContain('con superplastificante');
    expect(etiquetas((partida(['superplastificante']) as { especificacion: never }).especificacion)).toContain('Superplastificante');
    // Uno que ya no está en Productos: no suma y se ve con su clave
    expect(precioConcreto(partida(['retardante']))).toBe(precioConcreto(partida([])));
  });

  it('una partida con una obra que no está en la lista no desaparece del resumen', () => {
    const partida = { id: 'p', obraId: 'o-x', volumenM3: 8 } as never;
    const [g] = agruparPorObra([partida], []);
    expect(g.partidas.length).toBe(1);
    expect(g.obra.nombre).toBe('Obra');
  });

  it('el precio del concreto es el de lista del producto real', () => {
    const partida = (kg: number) =>
      ({ especificacion: { ...buscarSolucion('losa')!.sugerida, resistenciaKgCm2: kg, aditivos: [] } }) as never;
    expect(precioConcreto(partida(250))).toBe(3950);
    concretosServidor.set([concreto('fc-250', 4100, ['losa'])]);
    expect(precioConcreto(partida(250))).toBe(4100);
  });
});
