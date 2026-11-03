import {
  addDays,
  formatDateKey,
  formatTimeRange,
  minutesOf,
  nowMinutesBogota,
  relativeDayLabel,
  sessionPhase,
  startOfWeek,
  todayKey,
  weekdayOf,
  weekDates,
} from '@/lib/date';

describe('date helpers', () => {
  it('convierte instantes a la fecha local de Bogotá', () => {
    expect(formatDateKey(new Date('2026-10-31T15:00:00Z'))).toBe('2026-10-31');
    expect(formatDateKey(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10-31');
    expect(formatDateKey('2026-10-31')).toBe('2026-10-31');
  });

  it('suma días respetando meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('calcula la semana y el día de la semana', () => {
    expect(startOfWeek('2026-10-31')).toBe('2026-10-26');
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(weekdayOf('2026-10-31')).toBe('saturday');
    expect(weekdayOf('2026-11-01')).toBe('sunday');
  });

  it('etiqueta hoy, mañana y ayer', () => {
    const now = new Date('2026-10-31T15:00:00Z');
    expect(relativeDayLabel('2026-10-31', now)).toBe('Hoy');
    expect(relativeDayLabel('2026-11-01', now)).toBe('Mañana');
    expect(relativeDayLabel('2026-10-30', now)).toBe('Ayer');
  });

  it('convierte minutos y muestra rangos de 12 horas', () => {
    expect(minutesOf('08:30')).toBe(510);
    expect(minutesOf('23:59')).toBe(1439);
    expect(formatTimeRange('08:00', '13:30')).toBe('8:00 a. m. – 1:30 p. m.');
    expect(formatTimeRange('12:00', '00:00')).toBe('12:00 p. m. – 12:00 a. m.');
  });

  it('calcula la hora actual en Bogotá', () => {
    expect(nowMinutesBogota(new Date('2026-10-31T15:30:00Z'))).toBe(10 * 60 + 30);
  });

  it('determina la fase de una sesión', () => {
    const now = new Date('2026-10-31T15:00:00Z'); // sábado 10:00 en Bogotá
    expect(todayKey(now)).toBe('2026-10-31');

    expect(
      sessionPhase({ day: 'saturday', startTime: '09:00', endTime: '11:00' }, '2026-10-31', now),
    ).toBe('in_session');
    expect(
      sessionPhase({ day: 'saturday', startTime: '11:00', endTime: '12:00' }, '2026-10-31', now),
    ).toBe('upcoming');
    expect(
      sessionPhase({ day: 'saturday', startTime: '08:00', endTime: '09:00' }, '2026-10-31', now),
    ).toBe('finished');
    expect(
      sessionPhase({ day: 'saturday', startTime: '09:00', endTime: '11:00' }, '2026-10-30', now),
    ).toBe('finished');
    expect(
      sessionPhase({ day: 'saturday', startTime: '09:00', endTime: '11:00' }, '2026-11-07', now),
    ).toBe('scheduled');
  });
});
