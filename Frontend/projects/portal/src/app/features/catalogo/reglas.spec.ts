import { EspecificacionConcreto } from 'ui';
import { avisos, colocacionParaServicios, etiquetas, serviciosParaColocacion, textoResistencia } from './reglas';

const e: EspecificacionConcreto = {
  tipoResistencia: 'fc',
  resistenciaKgCm2: 300,
  edadDias: 28,
  revenimientoCm: 10,
  tmaMm: 19,
  cemento: 'CPC 30R',
  exposicion: 'normal',
  colocacion: 'directa',
  aditivos: [],
};

describe('reglas del cotizador', () => {
  it('formatea f\'c y MR', () => {
    expect(textoResistencia(e)).toBe("f'c 300 kg/cm²");
    expect(textoResistencia({ tipoResistencia: 'mr', resistenciaKgCm2: 45 })).toBe('MR 45 kg/cm²');
  });

  it('etiquetas: solo muestra lo que se sale de lo estándar', () => {
    expect(etiquetas(e)).toEqual(["f'c 300 kg/cm²", 'Rev. 10 cm', 'TMA 19 mm']);
    expect(etiquetas({ ...e, edadDias: 7, cemento: 'CPC 30R RS', exposicion: 'marina', aditivos: ['fibra-sintetica'] })).toEqual([
      "f'c 300 kg/cm²",
      'Resistencia a 7 días',
      'Rev. 10 cm',
      'TMA 19 mm',
      'CPC 30R RS',
      'Ambiente marino',
      'Fibra sintética',
    ]);
  });

  it('sin combinaciones de riesgo no hay avisos', () => {
    expect(avisos(e)).toEqual([]);
  });

  it('ambiente marino sugiere cemento RS e impermeabilizante, con arreglo aplicable', () => {
    const r = avisos({ ...e, exposicion: 'marina' });
    expect(r.map((a) => a.arreglo)).toEqual([{ cemento: 'CPC 30R RS' }, { aditivos: ['impermeabilizante'] }]);
    expect(avisos({ ...e, exposicion: 'marina', cemento: 'CPC 30R RS', aditivos: ['impermeabilizante'] })).toEqual([]);
  });

  it('bombeo con agregado grande o revenimiento bajo genera aviso', () => {
    expect(avisos({ ...e, colocacion: 'bombeo', tmaMm: 38 })[0].arreglo).toEqual({ tmaMm: 19 });
    expect(avisos({ ...e, colocacion: 'bombeo', revenimientoCm: 6 })[0].arreglo).toEqual({ revenimientoCm: 10 });
    expect(avisos({ ...e, colocacion: 'directa', tmaMm: 38, revenimientoCm: 6 })).toEqual([]);
  });

  it('acelerante + retardante avisa sin arreglo automático', () => {
    expect(avisos({ ...e, aditivos: ['acelerante', 'retardante'] })[0].arreglo).toBeUndefined();
  });

  it('colocación ↔ servicios de bombeo se mantienen sincronizados', () => {
    expect(serviciosParaColocacion(['muestreo-laboratorio'], 'bombeo')).toEqual(['muestreo-laboratorio', 'bomba-estacionaria']);
    expect(serviciosParaColocacion(['bomba-pluma'], 'bombeo')).toEqual(['bomba-pluma']);
    expect(serviciosParaColocacion(['bomba-pluma', 'colado-nocturno'], 'directa')).toEqual(['colado-nocturno']);
    expect(colocacionParaServicios(['bomba-pluma'])).toBe('bombeo');
    expect(colocacionParaServicios(['asesoria-tecnica'])).toBe('directa');
  });
});
