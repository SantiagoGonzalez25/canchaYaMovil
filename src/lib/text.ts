/** Utilidades de texto sin dependencias de React Native. */

/** Solo letras latinas (incluidas tildes, ñ y ç) separadas por un espacio simple. */
const PERSON_NAME_CHARS = 'A-Za-zÁÉÍÓÚÜÑÇáéíóúüñç';
const PERSON_NAME_PATTERN = new RegExp(`^[${PERSON_NAME_CHARS}]+(?: [${PERSON_NAME_CHARS}]+)*$`);

/** Une espacios repetidos y elimina los extremos del nombre. */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Quita en tiempo real números y símbolos del campo de nombre. */
export function sanitizePersonNameInput(value: string): string {
  return value.replace(new RegExp(`[^${PERSON_NAME_CHARS} ]`, 'g'), '').replace(/\s{2,}/g, ' ');
}

/** Valida nombres de personas sin caracteres especiales ni números. */
export function isValidPersonName(value: string): boolean {
  const normalized = normalizePersonName(value);
  return normalized.length >= 2 && normalized.length <= 80 && PERSON_NAME_PATTERN.test(normalized);
}

/** Minúsculas y sin tildes: búsquedas tolerantes a mayúsculas y acentos. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function foldForSearch(...parts: (string | null | undefined)[]): string {
  return normalizeText(parts.filter(Boolean).join(' '));
}

export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** "1 cupo disponible" / "3 cupos disponibles". */
export function availableLabel(count: number): string {
  return `${count} ${pluralize(count, 'cupo disponible', 'cupos disponibles')}`;
}

export function enrolledLabel(count: number): string {
  return `${count} ${pluralize(count, 'inscrito', 'inscritos')}`;
}

/** Correo institucional: se muestra sin dominio cuando es largo. */
export function compactEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.length > 18 ? `${user.slice(0, 16)}…` : user}@${domain}`;
}
