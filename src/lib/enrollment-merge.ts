import type { Enrollment, LocalEnrollment } from '@/types';

/**
 * Decide si una fila local pendiente debe reemplazarse por la versión del
 * servidor durante la reconciliación.
 *
 * - Una inscripción activa pendiente que ya llegó al servidor (mismo
 *   `clientRequestId` o misma franja activa) se descarta: gana el servidor.
 * - Una cancelación pendiente se conserva aunque el servidor todavía devuelva
 *   la inscripción como activa.
 * - Un conflicto se conserva hasta que la persona lo revise y lo descarte.
 */
export function shouldPreferServerEnrollment(
  local: Pick<
    LocalEnrollment,
    'syncState' | 'status' | 'clientRequestId' | 'acudeId' | 'slotId'
  >,
  server: Pick<Enrollment, 'clientRequestId' | 'acudeId' | 'slotId' | 'status'>[],
): boolean {
  if (local.syncState !== 'pending' || local.status !== 'active') return false;
  return server.some(
    (item) =>
      item.clientRequestId === local.clientRequestId ||
      (item.acudeId === local.acudeId &&
        item.slotId === local.slotId &&
        item.status === 'active'),
  );
}
