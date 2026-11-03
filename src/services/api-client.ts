import { API_URL } from '@/config/env';
import { ApiError, SessionExpiredError } from './errors';
import { fetchJson } from './fetch-json';
import { clearSession, getValidIdToken } from './session-manager';

export function buildApiUrl(path: string, params?: object): string {
  if (!API_URL) {
    throw new Error('La aplicación no tiene configurada la dirección del servicio.');
  }
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Cuerpo multipart; tiene prioridad sobre `body`. */
  form?: FormData;
  /** Las rutas públicas (login, registro) no envían Authorization. */
  auth?: boolean;
  signal?: AbortSignal;
  query?: object;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

async function execute<T>(
  path: string,
  options: ApiRequestOptions,
  idToken?: string,
): Promise<T> {
  try {
    return await fetchJson<T>(buildApiUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      body:
        options.form ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

/**
 * Cliente único de canchaYa-API. Ante un 401 renueva la sesión una vez y repite
 * la petición; si el refresh falla, borra la sesión y propaga el error.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requiresAuth = options.auth !== false;

  if (!requiresAuth) return execute<T>(path, options);

  let token = await getValidIdToken();
  try {
    return await execute<T>(path, options, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    try {
      token = await getValidIdToken(true);
    } catch (refreshError) {
      await clearSession();
      throw refreshError instanceof SessionExpiredError
        ? refreshError
        : new SessionExpiredError();
    }
    try {
      return await execute<T>(path, options, token);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        await clearSession();
        throw new SessionExpiredError();
      }
      throw retryError;
    }
  }
}

/** Lee el mensaje del contrato de error cuando hace falta inspeccionarlo. */
export function parseErrorEnvelope(value: unknown): ErrorEnvelope {
  if (!value || typeof value !== 'object') return {};
  return value as ErrorEnvelope;
}
