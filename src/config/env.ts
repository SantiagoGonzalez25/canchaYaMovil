/**
 * Configuración pública de la app.
 *
 * Expo solo expone al bundle las variables con prefijo EXPO_PUBLIC_. La URL se
 * normaliza (sin barra final) y proviene exclusivamente de `.env`; no se
 * incluyen entornos quemados en el código.
 */

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export const API_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
export const API_CONFIGURED = API_URL.length > 0;

export const API_TIMEOUT_MS = 15_000;
export const APP_NAME = 'CanchaYa';
export const APP_TAGLINE = 'ACUDES · Tecnológico de Antioquia';

/**
 * Versión de caché de las portadas estáticas de la API.
 * Incrementar cuando se reemplacen imágenes conservando el mismo nombre.
 */
export const IMAGE_CACHE_VERSION = '2';

/** Resuelve rutas relativas devueltas por la API (ej. imágenes). */
export function resolveApiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_URL) return path;
  const url = path.startsWith('/') ? `${API_URL}${path}` : `${API_URL}/${path}`;
  if (!path.includes('/images/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${IMAGE_CACHE_VERSION}`;
}
