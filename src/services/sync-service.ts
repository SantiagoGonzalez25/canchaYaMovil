import type { LocalEnrollment, Sex, User } from '@/types';
import {
  countCachedAcudes,
  listCachedAcudes,
  replaceCachedAcudes,
} from '@/db/acudes-repository';
import {
  countConflictEnrollments,
  deleteLocalEnrollment,
  getLocalEnrollment,
  listLocalEnrollments,
  markEnrollmentCanceled,
  markEnrollmentConflict,
  replaceSyncedEnrollments,
  upsertSyncedEnrollment,
} from '@/db/enrollments-repository';
import { metaKeys, getMeta, setMeta } from '@/db/meta-repository';
import {
  countOutbox,
  listOutbox,
  markOutboxAttempt,
  removeOutbox,
} from '@/db/outbox-repository';
import { getLiveAcudes } from './acudes-service';
import {
  cancelEnrollment as apiCancelEnrollment,
  createEnrollment as apiCreateEnrollment,
  getMyEnrollments,
} from './enrollments-service';
import {
  ApiError,
  errorMessage,
  isDefinitiveError,
  isNetworkError,
} from './errors';

/**
 * Sincronización offline-first:
 *  1. Baja la cartelera (fuente de cupos).
 *  2. Empuja la outbox (inscripciones/cancelaciones) con idempotencia.
 *  3. Baja "mis inscripciones" y reconcilia la caché.
 *
 * Si falla la red se conserva lo último descargado y la cola queda intacta. Si
 * el servidor rechaza una operación (cupo, cruce, límite), gana el servidor y la
 * fila local se marca como conflicto.
 */

export interface SyncResult {
  acudes: Awaited<ReturnType<typeof listCachedAcudes>>;
  enrollments: LocalEnrollment[];
  pendingCount: number;
  conflictCount: number;
  error: string | null;
  lastSyncedAt: string | null;
  pushed: number;
  fromCache: boolean;
}

interface PushResult {
  pushed: number;
  conflictCount: number;
  transientError: string | null;
}

function shouldStopForSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

async function pushOutbox(): Promise<PushResult> {
  const items = await listOutbox();
  let pushed = 0;
  let conflictCount = 0;

  for (const item of items) {
    try {
      if (item.kind === 'create_enrollment') {
        const payload = item.payload as {
          acudeId?: string;
          slotId?: string;
          clientRequestId?: string;
          localEnrollmentId?: string;
          sex?: Sex;
        };
        if (!payload.acudeId || !payload.slotId || !payload.clientRequestId) {
          await removeOutbox(item.id);
          continue;
        }
        const response = await apiCreateEnrollment({
          acudeId: payload.acudeId,
          slotId: payload.slotId,
          clientRequestId: payload.clientRequestId,
          sex: payload.sex,
        });
        const localId = payload.localEnrollmentId;
        if (localId && localId !== response.enrollment.id) {
          await deleteLocalEnrollment(localId);
        }
        await upsertSyncedEnrollment(response.enrollment);
        await removeOutbox(item.id);
        pushed += 1;
        continue;
      }

      if (item.kind === 'cancel_enrollment') {
        const payload = item.payload as { enrollmentId?: string };
        if (!payload.enrollmentId) {
          await removeOutbox(item.id);
          continue;
        }
        const response = await apiCancelEnrollment(payload.enrollmentId);
        await markEnrollmentCanceled(payload.enrollmentId, response.enrollment);
        await removeOutbox(item.id);
        pushed += 1;
      }
    } catch (error) {
      if (shouldStopForSession(error)) throw error;

      const message = errorMessage(error);
      if (isNetworkError(error) || (error instanceof ApiError && error.status >= 500)) {
        await markOutboxAttempt(item.id, message).catch(() => undefined);
        return { pushed, conflictCount, transientError: message };
      }

      if (isDefinitiveError(error)) {
        if (item.kind === 'create_enrollment') {
          const localId = (item.payload as { localEnrollmentId?: string }).localEnrollmentId;
          if (localId && (await getLocalEnrollment(localId))) {
            await markEnrollmentConflict(localId, message);
          }
        } else {
          const enrollmentId = (item.payload as { enrollmentId?: string }).enrollmentId;
          if (enrollmentId) await markEnrollmentConflict(enrollmentId, message);
        }
        await removeOutbox(item.id);
        conflictCount += 1;
        continue;
      }

      // Error inesperado: se conserva la operación para el próximo intento.
      await markOutboxAttempt(item.id, message).catch(() => undefined);
      return { pushed, conflictCount, transientError: message };
    }
  }

  return { pushed, conflictCount, transientError: null };
}

export async function runSync(user: User): Promise<SyncResult> {
  const errors: string[] = [];
  let fromCache = false;

  // 1. Cartelera fresca (incluye cupos reales para validar en línea).
  try {
    const live = await getLiveAcudes();
    await replaceCachedAcudes(live.acudes);
    await setMeta('acudes_server_time', live.serverTime);
  } catch (error) {
    if (shouldStopForSession(error)) throw error;
    fromCache = true;
    errors.push(`Cartelera: ${errorMessage(error)}`);
  }

  // 2. Outbox (solo estudiantes generan operaciones).
  let push: PushResult = { pushed: 0, conflictCount: 0, transientError: null };
  if (user.role === 'student') {
    try {
      push = await pushOutbox();
      if (push.transientError) errors.push(`Cola: ${push.transientError}`);
    } catch (error) {
      if (shouldStopForSession(error)) throw error;
      errors.push(`Cola: ${errorMessage(error)}`);
    }

    // 3. Mis inscripciones.
    try {
      const mine = await getMyEnrollments();
      await replaceSyncedEnrollments(mine.enrollments);
      await setMeta('enrollments_server_time', mine.serverTime);
    } catch (error) {
      if (shouldStopForSession(error)) throw error;
      fromCache = true;
      errors.push(`Inscripciones: ${errorMessage(error)}`);
    }
  }

  const [acudes, enrollments, pendingCount, conflictCount] = await Promise.all([
    listCachedAcudes(),
    listLocalEnrollments(),
    countOutbox(),
    countConflictEnrollments(),
  ]);

  // Los detalles de red/HTTP se registran internamente, pero la UI recibe un
  // mensaje único y comprensible (sin mostrar "servidor", "API" o códigos).
  if (errors.length > 0) {
    console.warn('[sync] no se pudo completar la sincronización:', errors.join(' · '));
  }
  const error =
    errors.length > 0
      ? 'No pudimos actualizar toda la información. Inténtalo de nuevo.'
      : null;
  const now = new Date().toISOString();
  if (!error) await setMeta(metaKeys.lastSyncedAt, now);
  await setMeta(metaKeys.lastSyncError, error);
  const lastSyncedAt = await getMeta(metaKeys.lastSyncedAt);

  return {
    acudes,
    enrollments,
    pendingCount,
    conflictCount: Math.max(conflictCount, push.conflictCount),
    error,
    lastSyncedAt,
    pushed: push.pushed,
    fromCache: fromCache && (await countCachedAcudes()) > 0,
  };
}
