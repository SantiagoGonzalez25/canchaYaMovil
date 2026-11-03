import { API_TIMEOUT_MS } from '@/config/env';
import { ApiError, NetworkError } from './errors';

interface RequestInitLike {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData;
  signal?: AbortSignal;
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * fetch con timeout, parseo JSON y traducción de errores al contrato
 * `{ error: { code, message } }` de canchaYa-API.
 */
export async function fetchJson<T>(url: string, init: RequestInitLike = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        // fetch calcula el boundary de multipart; nunca fijar JSON aquí.
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new NetworkError('La solicitud tardó demasiado. Revisa tu conexión.');
    }
    throw new NetworkError(
      error instanceof Error && /network|fetch|failed/i.test(error.message)
        ? 'No hay conexión. Revisa tu red e inténtalo de nuevo.'
        : 'No pudimos conectar. Inténtalo de nuevo.',
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text().catch(() => '');

  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = text ? (JSON.parse(text) as ErrorBody) : {};
    } catch {
      body = {};
    }
    throw new ApiError(
      response.status,
      body.error?.code ?? `HTTP_${response.status}`,
      body.error?.message ?? 'No pudimos completar la solicitud. Inténtalo de nuevo.',
      body.error?.details,
    );
  }

  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(502, 'INVALID_RESPONSE', 'No pudimos completar la solicitud. Inténtalo de nuevo.');
  }
}
