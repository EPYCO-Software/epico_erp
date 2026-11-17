import { telefonoEnlace, telefonoVisible, validarTelefono } from './telefono';

describe('teléfonos de contacto', () => {
  it('México exige 10 dígitos y acepta espacios o guiones', () => {
    expect(validarTelefono('+52', '987 873-9361')).toBeNull();
    expect(validarTelefono('+52', '873 9361')).toBe('Un número de México tiene 10 dígitos.');
    expect(validarTelefono('+52', '')).toBe('Escribe el número de teléfono.');
    expect(validarTelefono('+52', '98787a9361')).toBe('Usa solo números.');
  });

  it('acepta números extranjeros de 6 a 14 dígitos', () => {
    expect(validarTelefono('+1', '305 555 0142')).toBeNull();
    expect(validarTelefono('+501', '6221234')).toBeNull();
    expect(validarTelefono('+34', '12345')).not.toBeNull();
  });

  it('formatea para mostrar y para marcar', () => {
    expect(telefonoVisible({ lada: '+52', numero: '9878739361' })).toBe('+52 987 873 9361');
    expect(telefonoVisible({ lada: '+1', numero: '305-555-0142' })).toBe('+1 3055550142');
    expect(telefonoEnlace({ lada: '+52', numero: '987 873 9361' })).toBe('tel:+529878739361');
  });
});
