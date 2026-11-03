/**
 * Estado de una lista con caché local. Centraliza la decisión de qué mostrar en
 * los cuatro estados de pantalla: carga, error, vacío y contenido (con o sin
 * conexión).
 */

export type ListStatus = 'loading' | 'error' | 'empty' | 'offline' | 'refreshing' | 'ready';

export interface ListStatusInput {
  /** Primera carga sin datos en pantalla. */
  loading: boolean;
  /** Recarga en segundo plano con datos ya visibles. */
  refreshing: boolean;
  error: string | null;
  hasData: boolean;
  online: boolean;
}

export function resolveListStatus({
  loading,
  refreshing,
  error,
  hasData,
  online,
}: ListStatusInput): ListStatus {
  if (hasData) return refreshing ? 'refreshing' : 'ready';
  if (loading) return 'loading';
  if (error) return 'error';
  if (!online) return 'offline';
  return 'empty';
}

export function listStatusHeadline(status: ListStatus): string {
  switch (status) {
    case 'loading':
      return 'Cargando información…';
    case 'error':
      return 'No pudimos cargar la información';
    case 'empty':
      return 'Todavía no hay resultados';
    case 'offline':
      return 'Sin conexión y sin datos guardados';
    case 'refreshing':
      return 'Actualizando…';
    default:
      return 'Todo al día';
  }
}

/** Texto corto para el banner de sincronización. */
export function syncHeadline(input: {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}): string {
  if (!input.online) {
    return input.pending > 0
      ? `Sin conexión · ${input.pending} cambio(s) guardado(s)`
      : 'Sin conexión · mostrando información guardada';
  }
  if (input.syncing) return 'Actualizando…';
  if (input.error) return 'No pudimos actualizar';
  if (input.pending > 0) return `${input.pending} cambio(s) guardado(s)`;
  if (input.lastSyncedAt) return 'Al día';
  return 'En línea';
}
