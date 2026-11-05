import { TestBed } from '@angular/core/testing';
import { PlantasService, RAZONES_SOCIALES, alternarGrupo, alternarPlanta, estadoGrupo } from './plantas';

describe('selección de plantas', () => {
  it('alternarPlanta agrega y quita, pero nunca deja la selección vacía', () => {
    expect(alternarPlanta(['ESC'], 'CZM')).toEqual(['ESC', 'CZM']);
    expect(alternarPlanta(['ESC', 'CZM'], 'ESC')).toEqual(['CZM']);
    expect(alternarPlanta(['ESC'], 'ESC')).toEqual(['ESC']);
  });

  it('alternarGrupo completa el grupo o lo quita completo', () => {
    expect(alternarGrupo(['ESC'], ['CZM', 'CUN'])).toEqual(['ESC', 'CZM', 'CUN']);
    expect(alternarGrupo(['ESC', 'CZM'], ['CZM', 'CUN'])).toEqual(['ESC', 'CZM', 'CUN']);
    expect(alternarGrupo(['ESC', 'CZM', 'CUN'], ['CZM', 'CUN'])).toEqual(['ESC']);
    // si quitar el grupo dejaría todo vacío, no cambia
    expect(alternarGrupo(['CZM', 'CUN'], ['CZM', 'CUN'])).toEqual(['CZM', 'CUN']);
  });

  it('estadoGrupo distingue todas, algunas y ninguna', () => {
    expect(estadoGrupo(['CZM', 'CUN'], ['CZM', 'CUN'])).toBe('todas');
    expect(estadoGrupo(['CZM'], ['CZM', 'CUN'])).toBe('algunas');
    expect(estadoGrupo(['ESC'], ['CZM', 'CUN'])).toBe('ninguna');
  });

  describe('PlantasService', () => {
    const servicio = () => TestBed.inject(PlantasService);
    const [sureste, caribe] = RAZONES_SOCIALES;

    it('empieza con una sola planta, que es la principal', () => {
      const s = servicio();
      expect(s.seleccion()).toEqual(['ESC']);
      expect(s.actual().nombre).toBe('Planta Escárcega');
      expect(s.otras()).toBe(0);
    });

    it('clic en el nombre deja solo esa planta como principal', () => {
      const s = servicio();
      s.alternar('CZM');
      s.soloEsta('CUN');
      expect(s.seleccion()).toEqual(['CUN']);
      expect(s.actualId()).toBe('CUN');
    });

    it('al quitar la principal, la siguiente seleccionada pasa a ser la principal', () => {
      const s = servicio();
      s.alternarRazon(caribe);
      expect(s.otras()).toBe(2);
      s.alternar('ESC');
      expect(s.actualId()).toBe('CZM');
      expect(s.estado(sureste)).toBe('ninguna');
      expect(s.estado(caribe)).toBe('todas');
    });

    it('clic en una razón social trabaja con todas sus plantas', () => {
      const s = servicio();
      s.soloRazon(caribe);
      expect(s.seleccion()).toEqual(['CZM', 'CUN']);
      expect(s.actualId()).toBe('CZM');
    });
  });
});
