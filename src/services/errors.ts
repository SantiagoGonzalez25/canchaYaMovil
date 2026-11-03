/** Errores uniformes de la capa HTTP. */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor(message = 'No hay conexión. Revisa tu red e inténtalo de nuevo.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class SessionExpiredError extends ApiError {
  constructor(message = 'Tu sesión expiró. Inicia sesión de nuevo.') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'SessionExpiredError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Ocurrió un error inesperado.';
}

/** Códigos que representan un rechazo definitivo del servidor (no reintentar). */
export const DEFINITIVE_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'NO_CAPACITY',
  'STUDENT_OVERLAP',
  'MAX_ACUDES',
  'ALREADY_ENROLLED',
  'INVALID_STATE',
  'SCHEDULE_CONFLICT',
  'EMAIL_IN_USE',
  'INVALID_CREDENTIALS',
]);

export function isDefinitiveError(error: unknown): boolean {
  return error instanceof ApiError && DEFINITIVE_ERROR_CODES.has(error.code);
}
