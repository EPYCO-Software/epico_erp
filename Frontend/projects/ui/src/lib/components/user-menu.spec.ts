import { iniciales } from './user-menu';

describe('iniciales', () => {
  it('con 2 letras toma la inicial de las dos primeras palabras', () => {
    expect(iniciales('Ana Pech Canul', 2)).toBe('AP');
    expect(iniciales('mariana.pech', 2)).toBe('MP');
  });

  it('con una sola palabra toma sus primeras letras', () => {
    expect(iniciales('operaciones', 2)).toBe('OP');
    expect(iniciales('operaciones')).toBe('O');
  });

  it('sin nombre muestra un signo de interrogación', () => {
    expect(iniciales('   ', 2)).toBe('?');
  });
});
