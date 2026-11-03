import { randomUUID } from 'expo-crypto';

import type { LiveAcude, LiveScheduleSlot, LocalEnrollment, User } from '@/types';
import { todayKey } from '@/lib/date';
import { evaluateEnrollment } from '@/lib/enrollment-rules';
import {
  deleteLocalEnrollment,
  insertPendingEnrollment,
} from '@/db/enrollments-repository';
import {
  cancelDedupeKey,
  createDedupeKey,
  enqueueOutbox,
  findOutboxByDedupeKey,
  removeOutbox,
} from '@/db/outbox-repository';

export interface QueueEnrollmentInput {
  acude: LiveAcude;
  slot: LiveScheduleSlot;
  user: User;
  enrollments: LocalEnrollment[];
  /** Inyectable en pruebas; en producción se genera un UUID criptográfico. */
  clientRequestId?: string;
  now?: Date;
}

export interface QueueEnrollmentResult {
  enrollment: LocalEnrollment;
}

export interface QueueCancellationResult {
  mode: 'removed' | 'queued';
  enrollment?: LocalEnrollment;
}

/** Construye la inscripción optimista que se muestra mientras no hay red. */
export function buildLocalEnrollment({
  acude,
  slot,
  user,
  clientRequestId,
  now = new Date(),
}: Omit<QueueEnrollmentInput, 'enrollments'> & { clientRequestId: string }): LocalEnrollment {
  const timestamp = now.toISOString();
  return {
    id: `local_${clientRequestId}`,
    acudeId: acude.id,
    acudeName: acude.name,
    userId: user.uid,
    userEmail: user.email,
    userName: user.name,
    userSex: user.sex ?? 'prefer_not_to_say',
    slotId: slot.id,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    scenarioId: slot.scenarioId,
    scenarioName: slot.scenarioName,
    category: acude.category,
    discipline: acude.discipline,
    teacherId: acude.teacherId,
    teacherName: acude.teacherName,
    status: 'active',
    clientRequestId,
    semester: acude.semester ?? 'N/A',
    enrolledAt: timestamp,
    enrolledOn: todayKey(now),
    canceledAt: null,
    updatedAt: timestamp,
    syncState: 'pending',
    syncError: null,
  };
}

/**
 * Valida localmente y encola una inscripción. La operación se envía después con
 * el mismo clientRequestId, por lo que reintentar nunca duplica.
 */
export async function queueEnrollment(
  input: QueueEnrollmentInput,
): Promise<QueueEnrollmentResult> {
  const decision = evaluateEnrollment({
    acude: input.acude,
    slot: input.slot,
    enrollments: input.enrollments,
  });
  if (!decision.ok) {
    throw new Error(decision.message ?? 'No es posible inscribirse en este ACUDE.');
  }

  const clientRequestId = input.clientRequestId ?? randomUUID();
  const enrollment = buildLocalEnrollment({ ...input, clientRequestId });

  try {
    await insertPendingEnrollment(enrollment);
    await enqueueOutbox({
      dedupeKey: createDedupeKey(clientRequestId),
      kind: 'create_enrollment',
      payload: {
        acudeId: input.acude.id,
        slotId: input.slot.id,
        clientRequestId,
        localEnrollmentId: enrollment.id,
        sex: enrollment.userSex,
      },
      createdAt: input.now?.toISOString(),
    });
  } catch (error) {
    // Si la cola no se pudo escribir, no dejamos una fila local huérfana.
    await deleteLocalEnrollment(enrollment.id).catch(() => undefined);
    throw error;
  }

  return { enrollment };
}

/**
 * Cancela una inscripción. Si la creación aún no se sincronizó, se elimina de la
 * cola y de la caché: nunca llegó al servidor. Si ya existe, se encola la
 * cancelación idempotente.
 */
export async function queueCancellation(
  enrollment: LocalEnrollment,
  now = new Date(),
): Promise<QueueCancellationResult> {
  const createKey = createDedupeKey(enrollment.clientRequestId);
  const pendingCreate = enrollment.syncState === 'pending'
    ? await findOutboxByDedupeKey(createKey)
    : null;

  if (pendingCreate || enrollment.id.startsWith('local_')) {
    if (pendingCreate) await removeOutbox(pendingCreate.id);
    await deleteLocalEnrollment(enrollment.id);
    return { mode: 'removed' };
  }

  const canceled: LocalEnrollment = {
    ...enrollment,
    status: 'canceled',
    canceledAt: now.toISOString(),
    updatedAt: now.toISOString(),
    syncState: 'pending',
    syncError: null,
  };
  await insertPendingEnrollment(canceled);
  await enqueueOutbox({
    dedupeKey: cancelDedupeKey(enrollment.id),
    kind: 'cancel_enrollment',
    payload: { enrollmentId: enrollment.id },
    createdAt: now.toISOString(),
  });
  return { mode: 'queued', enrollment: canceled };
}
