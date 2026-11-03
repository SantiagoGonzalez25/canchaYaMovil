const MAX_HOUR = 23;
const MAX_MINUTE = 59;

/**
 * Máscara de hora en formato 24 h (HH:mm).
 *
 * Acepta solo dígitos, inserta los dos puntos automáticamente y limita la hora
 * a 23 y los minutos a 59. Evita entradas como "-141111111" o "99:99" antes de
 * que lleguen a la validación del formulario.
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';

  let hour = digits.slice(0, 2);

  if (digits.length === 1) {
    hour = Number(digits) > 2 ? `0${digits}` : digits;
  } else if (Number(hour) > MAX_HOUR) {
    hour = String(MAX_HOUR);
  }

  if (digits.length <= 2) return hour;

  let minute = digits.slice(2, 4);
  if (minute.length === 1 && Number(minute) > 5) minute = '5';
  if (minute.length === 2 && Number(minute) > MAX_MINUTE) minute = String(MAX_MINUTE);

  return `${hour}:${minute}`;
}

/** true cuando el valor ya es una hora completa y válida (HH:mm). */
export function isCompleteTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
