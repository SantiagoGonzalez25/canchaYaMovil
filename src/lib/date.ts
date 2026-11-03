import type { SessionPhase, Weekday } from '@/types';
import { WEEKDAY_BY_JS_DAY, WEEKDAY_LABELS } from './labels';

/**
 * Utilidades de fecha del dominio CanchaYa.
 *
 * La API trabaja con la zona horaria America/Bogota (UTC-5, sin horario de
 * verano) y claves YYYY-MM-DD. Para evitar saltos de día usamos aritmética UTC
 * sobre las claves y el desplazamiento fijo de Bogotá al obtener "hoy".
 */

export const TIMEZONE = 'America/Bogota';
export const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const CURRENT_SEMESTER = {
  name: '2026-2',
  start: '2026-08-03',
  end: '2026-11-22',
} as const;

export const SEMESTER_LABEL = `Semestre ${CURRENT_SEMESTER.name}`;

export const SEMESTER_RANGE_LABEL = '03 ago – 22 nov 2026';

/** Fecha YYYY-MM-DD en la zona de Bogotá. */
export function formatDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return formatDateKey(parsed);
  }
  const bogota = new Date(value.getTime() - BOGOTA_OFFSET_MS);
  const year = bogota.getUTCFullYear();
  const month = String(bogota.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bogota.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return formatDateKey(now);
}

function parseKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(parseKey(value).getTime());
}

export function addDays(dateKey: string, days: number): string {
  const date = parseKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(dateKey: string): string {
  const date = parseKey(dateKey);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

export function weekDates(startDateKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startDateKey, index));
}

export function weekdayOf(dateKey: string): Weekday {
  const day = parseKey(dateKey).getUTCDay();
  return WEEKDAY_BY_JS_DAY[day] ?? 'monday';
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return '—';
  const date = isDateKey(value) ? parseKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateNumeric(value: string | null | undefined): string {
  if (!value) return '—';
  const date = isDateKey(value) ? parseKey(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: isDateKey(value) ? 'UTC' : TIMEZONE,
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(date);
}

export function formatWeekdayDate(dateKey: string): string {
  return `${WEEKDAY_LABELS[weekdayOf(dateKey)]} ${formatDateLong(dateKey)}`;
}

export function formatDayMonth(dateKey: string): string {
  const date = parseKey(dateKey);
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function relativeDayLabel(dateKey: string, now: Date = new Date()): string {
  const today = todayKey(now);
  if (dateKey === today) return 'Hoy';
  if (dateKey === addDays(today, 1)) return 'Mañana';
  if (dateKey === addDays(today, -1)) return 'Ayer';
  return formatWeekdayDate(dateKey);
}

export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeLabel(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${timeLabel(startTime)} – ${timeLabel(endTime)}`;
}

/** Minutos desde medianoche en Bogotá. */
export function nowMinutesBogota(now: Date = new Date()): number {
  const bogota = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  return bogota.getUTCHours() * 60 + bogota.getUTCMinutes();
}

interface SessionLike {
  day: Weekday;
  startTime: string;
  endTime: string;
}

/** Fase de una sesión para una fecha concreta (misma semántica que la API). */
export function sessionPhase(
  session: SessionLike,
  dateKey: string,
  now: Date = new Date(),
): SessionPhase {
  const today = todayKey(now);
  if (dateKey < today) return 'finished';
  if (dateKey > today) return 'scheduled';
  if (session.day !== weekdayOf(today)) return 'scheduled';
  const current = nowMinutesBogota(now);
  if (current < minutesOf(session.startTime)) return 'upcoming';
  if (current >= minutesOf(session.endTime)) return 'finished';
  return 'in_session';
}

export function isWithinSemester(dateKey: string): boolean {
  return dateKey >= CURRENT_SEMESTER.start && dateKey <= CURRENT_SEMESTER.end;
}

export function isToday(dateKey: string): boolean {
  return dateKey === todayKey();
}

/** Rango legible "03 ago – 09 ago 2026" para la cabecera del calendario. */
export function formatWeekRange(startDateKey: string): string {
  const end = addDays(startDateKey, 6);
  const start = parseKey(startDateKey);
  const endDate = parseKey(end);
  const startMonth = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' }).format(
    start,
  );
  const endLabel = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(endDate);
  return `${start.getUTCDate()} ${startMonth} – ${endLabel}`;
}
