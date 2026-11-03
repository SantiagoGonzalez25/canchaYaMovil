import { formatTimeInput, isCompleteTime } from '@/lib/time-input';

describe('time input mask', () => {
  it('completa una hora de un solo dígito', () => {
    expect(formatTimeInput('9')).toBe('09');
  });

  it('inserta los dos puntos automáticamente', () => {
    expect(formatTimeInput('0830')).toBe('08:30');
    expect(formatTimeInput('08:30')).toBe('08:30');
  });

  it('limita horas y minutos al rango válido', () => {
    expect(formatTimeInput('2359')).toBe('23:59');
    expect(formatTimeInput('2460')).toBe('23:59');
    expect(formatTimeInput('9999')).toBe('23:59');
  });

  it('descarta caracteres no numéricos', () => {
    expect(formatTimeInput('-141111111')).toBe('14:11');
    expect(formatTimeInput('abc')).toBe('');
    expect(formatTimeInput('1a2b3')).toBe('12:3');
  });

  it('reconoce solo horas completas', () => {
    expect(isCompleteTime('08:30')).toBe(true);
    expect(isCompleteTime('23:59')).toBe(true);
    expect(isCompleteTime('24:00')).toBe(false);
    expect(isCompleteTime('08:3')).toBe(false);
  });
});
