/* eslint-disable import/first -- jest.mock debe declararse antes de importar los módulos simulados. */
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-generado-123'),
}));

jest.mock('@/db/enrollments-repository', () => ({
  insertPendingEnrollment: jest.fn(async () => undefined),
  deleteLocalEnrollment: jest.fn(async () => undefined),
}));

jest.mock('@/db/outbox-repository', () => ({
  enqueueOutbox: jest.fn(async () => undefined),
  findOutboxByDedupeKey: jest.fn(async () => null),
  removeOutbox: jest.fn(async () => undefined),
  createDedupeKey: (id: string) => `create:${id}`,
  cancelDedupeKey: (id: string) => `cancel:${id}`,
}));

import {
  deleteLocalEnrollment,
  insertPendingEnrollment,
} from '@/db/enrollments-repository';
import {
  enqueueOutbox,
  findOutboxByDedupeKey,
  removeOutbox,
} from '@/db/outbox-repository';
import { todayKey } from '@/lib/date';
import {
  buildLocalEnrollment,
  queueCancellation,
  queueEnrollment,
} from '@/services/enrollment-service';
import type { LiveAcude, LiveScheduleSlot, LocalEnrollment, User } from '@/types';

const user: User = {
  uid: 'student-1',
  email: 'estudiante1@canchaya.demo',
  name: 'Estudiante Uno',
  role: 'student',
  sex: 'female',
};

const slot: LiveScheduleSlot = {
  id: 'slot-1',
  day: 'monday',
  startTime: '10:00',
  endTime: '12:00',
  scenarioId: 'scenario-1',
  maxCapacity: 10,
  scenarioName: 'Cancha principal',
  capacity: 10,
  enrolled: 3,
  available: 7,
  occupancyPct: 30,
};

const acude: LiveAcude = {
  id: 'acude-1',
  name: 'Fútbol formativo',
  description: '',
  category: 'sports',
  discipline: 'Fútbol',
  scenarioId: 'scenario-1',
  teacherId: 'teacher-1',
  teacherName: 'Docente Uno',
  schedule: [slot],
  maxCapacity: 20,
  currentEnrolled: 3,
  slotEnrolled: { 'slot-1': 3 },
  status: 'published',
  semester: '2026-2',
  imageUrl: null,
  imageStoragePath: null,
  requirements: '',
  attendanceMin: 80,
  createdBy: 'admin-1',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  totalCapacity: 10,
  totalAvailable: 7,
};

function localEnrollment(overrides: Partial<LocalEnrollment> = {}): LocalEnrollment {
  return {
    id: 'enrollment-1',
    acudeId: 'acude-1',
    acudeName: 'Fútbol formativo',
    userId: user.uid,
    userEmail: user.email,
    userName: user.name,
    userSex: 'female',
    slotId: 'slot-1',
    day: 'monday',
    startTime: '10:00',
    endTime: '12:00',
    scenarioId: 'scenario-1',
    scenarioName: 'Cancha principal',
    category: 'sports',
    discipline: 'Fútbol',
    teacherId: 'teacher-1',
    teacherName: 'Docente Uno',
    status: 'active',
    clientRequestId: 'request-1',
    semester: '2026-2',
    enrolledAt: '2026-08-02T12:00:00.000Z',
    enrolledOn: '2026-08-02',
    canceledAt: null,
    updatedAt: '2026-08-02T12:00:00.000Z',
    syncState: 'synced',
    syncError: null,
    ...overrides,
  };
}

describe('enrollment offline service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('construye una inscripción optimista con datos del usuario y la franja', () => {
    const now = new Date('2026-10-31T15:00:00Z');
    const enrollment = buildLocalEnrollment({
      acude,
      slot,
      user,
      clientRequestId: 'request-123',
      now,
    });

    expect(enrollment).toMatchObject({
      id: 'local_request-123',
      clientRequestId: 'request-123',
      acudeId: acude.id,
      slotId: slot.id,
      userId: user.uid,
      userSex: 'female',
      status: 'active',
      syncState: 'pending',
      enrolledOn: todayKey(now),
    });
  });

  it('usa un fallback de semestre cuando la API no lo envía', () => {
    const enrollment = buildLocalEnrollment({
      acude: { ...acude, semester: undefined as unknown as string },
      slot,
      user,
      clientRequestId: 'request-123',
    });
    expect(enrollment.semester).toBe('N/A');
  });

  it('usa prefer_not_to_say cuando el perfil no registra sexo', () => {
    const enrollment = buildLocalEnrollment({
      acude,
      slot,
      user: { ...user, sex: null },
      clientRequestId: 'request-123',
    });
    expect(enrollment.userSex).toBe('prefer_not_to_say');
  });

  it('encola la inscripción con dedupe y clientRequestId', async () => {
    const result = await queueEnrollment({
      acude,
      slot,
      user,
      enrollments: [],
      clientRequestId: 'request-abc',
    });

    expect(result.enrollment.id).toBe('local_request-abc');
    expect(insertPendingEnrollment).toHaveBeenCalledWith(result.enrollment);
    expect(enqueueOutbox).toHaveBeenCalledWith({
      dedupeKey: 'create:request-abc',
      kind: 'create_enrollment',
      payload: {
        acudeId: acude.id,
        slotId: slot.id,
        clientRequestId: 'request-abc',
        localEnrollmentId: 'local_request-abc',
        sex: 'female',
      },
      createdAt: undefined,
    });
  });

  it('no encola si la validación local falla', async () => {
    await expect(
      queueEnrollment({
        acude: { ...acude, schedule: [{ ...slot, available: 0 }] },
        slot: { ...slot, available: 0 },
        user,
        enrollments: [],
      }),
    ).rejects.toThrow('lleno');

    expect(insertPendingEnrollment).not.toHaveBeenCalled();
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it('elimina una creación aún no sincronizada al cancelar', async () => {
    const pending = localEnrollment({ id: 'local_request-1', syncState: 'pending' });
    (findOutboxByDedupeKey as jest.Mock).mockResolvedValueOnce({ id: 7 });

    const result = await queueCancellation(pending);

    expect(result.mode).toBe('removed');
    expect(removeOutbox).toHaveBeenCalledWith(7);
    expect(deleteLocalEnrollment).toHaveBeenCalledWith(pending.id);
    expect(enqueueOutbox).not.toHaveBeenCalled();
  });

  it('encola la cancelación de una inscripción ya sincronizada', async () => {
    const synced = localEnrollment();
    const now = new Date('2026-10-31T15:00:00Z');

    const result = await queueCancellation(synced, now);

    expect(result.mode).toBe('queued');
    expect(result.enrollment).toMatchObject({
      status: 'canceled',
      syncState: 'pending',
      canceledAt: now.toISOString(),
    });
    expect(insertPendingEnrollment).toHaveBeenCalledWith(result.enrollment);
    expect(enqueueOutbox).toHaveBeenCalledWith({
      dedupeKey: 'cancel:enrollment-1',
      kind: 'cancel_enrollment',
      payload: { enrollmentId: 'enrollment-1' },
      createdAt: now.toISOString(),
    });
  });
});
