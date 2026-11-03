import {
  emptyManagerDraft,
  validateManagerDraft,
} from '@/lib/manager-form';

describe('manager form validation', () => {
  it('normaliza el correo y elimina espacios', () => {
    const result = validateManagerDraft({
      displayName: '  Ana Pérez  ',
      email: '  ANA@TDEE.EDU.CO ',
      password: 'secreto123',
      sex: 'female',
      phone: ' 300 000 0000 ',
    });

    expect(result.ok).toBe(true);
    expect(result.input).toEqual({
      displayName: 'Ana Pérez',
      email: 'ana@tdee.edu.co',
      password: 'secreto123',
      sex: 'female',
      phone: '300 000 0000',
    });
  });

  it('omite el teléfono cuando está vacío', () => {
    const result = validateManagerDraft({
      ...emptyManagerDraft(),
      displayName: 'Carlos',
      email: 'carlos@tdea.edu.co',
      password: '123456',
      sex: 'male',
    });
    expect(result.ok).toBe(true);
    expect(result.input).not.toHaveProperty('phone');
  });

  it('rechaza símbolos o números en el nombre', () => {
    const result = validateManagerDraft({
      ...emptyManagerDraft(),
      displayName: 'Carlos 123 @TdeA',
      email: 'carlos@tdea.edu.co',
      password: '123456',
      sex: 'male',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.displayName).toContain('letras');
  });

  it('rechaza correo, contraseña y sexo inválidos', () => {
    const result = validateManagerDraft({
      displayName: 'A',
      email: 'sin-arroba',
      password: '123',
      sex: '',
      phone: '1'.repeat(31),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.displayName).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.password).toBeDefined();
    expect(result.errors.sex).toBeDefined();
    expect(result.errors.phone).toBeDefined();
  });
});
