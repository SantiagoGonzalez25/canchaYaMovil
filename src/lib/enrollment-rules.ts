import type { LiveAcude, LiveScheduleSlot, LocalEnrollment } from '@/types';
import { minutesOf } from './date';

/** Mismas reglas que la API; se validan localmente para poder trabajar offline. */
export const MAX_ACUDES_PER_SEMESTER = 2;

export type EnrollmentErrorCode =
  | 'NO_CAPACITY'
  | 'STUDENT_OVERLAP'
  | 'MAX_ACUDES'
  | 'ALREADY_ENROLLED'
  | 'INVALID_STATE'
  | 'NOT_FOUND';

export interface EnrollmentDecision {
  ok: boolean;
  code?: EnrollmentErrorCode;
  message?: string;
}

interface SlotLike {
  day: string;
  startTime: string;
  endTime: string;
}

/** Los extremos que se tocan (10:00–12:00 y 12:00–14:00) no se cruzan. */
export function slotsOverlap(a: SlotLike, b: SlotLike): boolean {
  if (a.day !== b.day) return false;
  return minutesOf(a.startTime) < minutesOf(b.endTime) && minutesOf(b.startTime) < minutesOf(a.endTime);
}

export function activeEnrollments(enrollments: LocalEnrollment[]): LocalEnrollment[] {
  return enrollments.filter((item) => item.status === 'active');
}

export function countActiveInSemester(
  enrollments: Pick<LocalEnrollment, 'status' | 'semester'>[],
  semester: string,
): number {
  return enrollments.filter(
    (item) => item.status === 'active' && (!item.semester || item.semester === semester),
  ).length;
}

export function hasReachedSemesterLimit(
  enrollments: Pick<LocalEnrollment, 'status' | 'semester'>[],
  semester: string,
): boolean {
  return countActiveInSemester(enrollments, semester) >= MAX_ACUDES_PER_SEMESTER;
}

/**
 * Decide si una inscripción puede encolarse sin conexión. No muta nada: el
 * servicio de inscripciones usa esta decisión para crear la fila local y la
 * operación de la outbox.
 */
export function evaluateEnrollment(input: {
  acude: LiveAcude;
  slot: LiveScheduleSlot;
  enrollments: LocalEnrollment[];
}): EnrollmentDecision {
  const { acude, slot } = input;
  const active = activeEnrollments(input.enrollments);

  if (acude.status !== 'published') {
    return {
      ok: false,
      code: 'INVALID_STATE',
      message: 'El ACUDE no está abierto para inscripciones.',
    };
  }
  if (!acude.schedule.some((item) => item.id === slot.id)) {
    return { ok: false, code: 'NOT_FOUND', message: 'La franja horaria ya no existe.' };
  }
  if (slot.available <= 0) {
    return { ok: false, code: 'NO_CAPACITY', message: 'El subgrupo ya está lleno.' };
  }
  if (active.some((item) => item.acudeId === acude.id)) {
    return {
      ok: false,
      code: 'ALREADY_ENROLLED',
      message: 'Ya tienes una inscripción activa en este ACUDE.',
    };
  }
  if (
    active.some((item) =>
      slotsOverlap(
        { day: item.day, startTime: item.startTime, endTime: item.endTime },
        { day: slot.day, startTime: slot.startTime, endTime: slot.endTime },
      ),
    )
  ) {
    return {
      ok: false,
      code: 'STUDENT_OVERLAP',
      message: 'Ya tienes otra actividad que se cruza en el mismo horario.',
    };
  }
  if (hasReachedSemesterLimit(active, acude.semester)) {
    return {
      ok: false,
      code: 'MAX_ACUDES',
      message: `Solo puedes estar inscrito en ${MAX_ACUDES_PER_SEMESTER} ACUDES por semestre. Cancela uno para inscribirte en otro.`,
    };
  }
  return { ok: true };
}

/** Una inscripción pendiente o con conflicto necesita explicación en la UI. */
export function enrollmentNeedsAttention(enrollment: LocalEnrollment): boolean {
  return enrollment.syncState === 'pending' || enrollment.syncState === 'conflict';
}

export function canCancelEnrollment(enrollment: LocalEnrollment): boolean {
  return enrollment.status === 'active' && enrollment.syncState !== 'conflict';
}
