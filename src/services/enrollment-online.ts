import { randomUUID } from 'expo-crypto';

import { upsertSyncedEnrollment } from '@/db/enrollments-repository';
import type { LocalEnrollment, LiveAcude, LiveScheduleSlot, User } from '@/types';
import { createEnrollment } from './enrollments-service';

export interface EnrollOnlineInput {
  acude: LiveAcude;
  slot: LiveScheduleSlot;
  user: User;
  clientRequestId?: string;
}

export interface EnrollOnlineResult {
  enrollment: LocalEnrollment;
  clientRequestId: string;
}

/**
 * Inscripción en línea: la API es la fuente de verdad. Solo se guarda en la
 * caché local cuando el servidor confirmó la operación, evitando que un
 * rechazo (por ejemplo, máximo de ACUDES) deje una fila local como si hubiera
 * sido procesada.
 */
export async function enrollOnline(input: EnrollOnlineInput): Promise<EnrollOnlineResult> {
  const clientRequestId = input.clientRequestId ?? randomUUID();
  const response = await createEnrollment({
    acudeId: input.acude.id,
    slotId: input.slot.id,
    clientRequestId,
    sex: input.user.sex ?? undefined,
  });

  await upsertSyncedEnrollment(response.enrollment);

  return {
    clientRequestId,
    enrollment: {
      ...response.enrollment,
      syncState: 'synced',
      syncError: null,
    },
  };
}
