/* eslint-disable import/first -- jest.mock debe declararse antes de importar los módulos simulados. */
jest.mock('@/db/acudes-repository', () => ({
  countCachedAcudes: jest.fn(async () => 1),
  listCachedAcudes: jest.fn(async () => []),
  replaceCachedAcudes: jest.fn(async () => undefined),
}));

jest.mock('@/db/enrollments-repository', () => ({
  countConflictEnrollments: jest.fn(async () => 0),
  deleteLocalEnrollment: jest.fn(async () => undefined),
  getLocalEnrollment: jest.fn(async () => null),
  listLocalEnrollments: jest.fn(async () => []),
  markEnrollmentCanceled: jest.fn(async () => undefined),
  markEnrollmentConflict: jest.fn(async () => undefined),
  replaceSyncedEnrollments: jest.fn(async () => undefined),
  upsertSyncedEnrollment: jest.fn(async () => undefined),
}));

jest.mock('@/db/meta-repository', () => ({
  metaKeys: {
    owner: 'owner_uid',
    lastSyncedAt: 'last_synced_at',
    lastSyncError: 'last_sync_error',
  },
  getMeta: jest.fn(async () => '2026-10-31T12:00:00.000Z'),
  setMeta: jest.fn(async () => undefined),
}));

jest.mock('@/db/outbox-repository', () => ({
  countOutbox: jest.fn(async () => 0),
  listOutbox: jest.fn(async () => []),
  markOutboxAttempt: jest.fn(async () => undefined),
  removeOutbox: jest.fn(async () => undefined),
}));

jest.mock('@/services/acudes-service', () => ({
  getLiveAcudes: jest.fn(),
}));

jest.mock('@/services/enrollments-service', () => ({
  createEnrollment: jest.fn(),
  cancelEnrollment: jest.fn(),
  getMyEnrollments: jest.fn(),
}));

import {
  listCachedAcudes,
  replaceCachedAcudes,
} from '@/db/acudes-repository';
import {
  countConflictEnrollments,
  deleteLocalEnrollment,
  getLocalEnrollment,
  listLocalEnrollments,
  markEnrollmentConflict,
  replaceSyncedEnrollments,
  upsertSyncedEnrollment,
} from '@/db/enrollments-repository';
import { setMeta } from '@/db/meta-repository';
import {
  countOutbox,
  listOutbox,
  markOutboxAttempt,
  removeOutbox,
} from '@/db/outbox-repository';
import { getLiveAcudes } from '@/services/acudes-service';
import {
  createEnrollment,
  getMyEnrollments,
} from '@/services/enrollments-service';
import { ApiError, NetworkError } from '@/services/errors';
import { runSync } from '@/services/sync-service';
import type { Enrollment, LiveAcude, LiveScheduleSlot, LocalEnrollment, User } from '@/types';

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
  enrolled: 1,
  available: 9,
  occupancyPct: 10,
};

const liveAcude: LiveAcude = {
  id: 'acude-1',
  name: 'Fútbol formativo',
  description: '',
  category: 'sports',
  discipline: 'Fútbol',
  scenarioId: 'scenario-1',
  teacherId: 'teacher-1',
  teacherName: 'Docente Uno',
  schedule: [slot],
  maxCapacity: 10,
  currentEnrolled: 1,
  slotEnrolled: { 'slot-1': 1 },
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
  totalAvailable: 9,
};

const serverEnrollment: Enrollment = {
  id: 'server-e1',
  acudeId: liveAcude.id,
  acudeName: liveAcude.name,
  userId: user.uid,
  userEmail: user.email,
  userName: user.name,
  userSex: 'female',
  slotId: slot.id,
  day: slot.day,
  startTime: slot.startTime,
  endTime: slot.endTime,
  scenarioId: slot.scenarioId,
  scenarioName: slot.scenarioName,
  category: 'sports',
  discipline: 'Fútbol',
  teacherId: 'teacher-1',
  teacherName: 'Docente Uno',
  status: 'active',
  clientRequestId: 'request-1',
  semester: '2026-2',
  enrolledAt: '2026-10-31T12:00:00.000Z',
  enrolledOn: '2026-10-31',
  canceledAt: null,
  updatedAt: '2026-10-31T12:00:00.000Z',
};

const localSynced: LocalEnrollment = {
  ...serverEnrollment,
  id: 'local-e1',
  clientRequestId: 'request-1',
  syncState: 'pending',
  syncError: null,
};

const createItem = {
  id: 10,
  dedupeKey: 'create:request-1',
  kind: 'create_enrollment' as const,
  payload: {
    acudeId: liveAcude.id,
    slotId: slot.id,
    clientRequestId: 'request-1',
    localEnrollmentId: 'local-e1',
    sex: 'female',
  },
  createdAt: '2026-10-31T12:00:00.000Z',
  attempts: 0,
  lastError: null,
};

describe('sync service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLiveAcudes as jest.Mock).mockResolvedValue({
      acudes: [liveAcude],
      serverTime: '2026-10-31T13:00:00.000Z',
    });
    (getMyEnrollments as jest.Mock).mockResolvedValue({
      enrollments: [serverEnrollment],
      serverTime: '2026-10-31T13:00:00.000Z',
    });
    (listCachedAcudes as jest.Mock).mockResolvedValue([liveAcude]);
    (listLocalEnrollments as jest.Mock).mockResolvedValue([localSynced]);
    (countOutbox as jest.Mock).mockResolvedValue(0);
    (countConflictEnrollments as jest.Mock).mockResolvedValue(0);
  });

  it('descarga, empuja la outbox y reconcilia inscripciones', async () => {
    (listOutbox as jest.Mock).mockResolvedValue([createItem]);
    (createEnrollment as jest.Mock).mockResolvedValue({
      enrollment: serverEnrollment,
      created: true,
      serverTime: '2026-10-31T13:00:00.000Z',
    });

    const result = await runSync(user);

    expect(replaceCachedAcudes).toHaveBeenCalledWith([liveAcude]);
    expect(createEnrollment).toHaveBeenCalledWith({
      acudeId: liveAcude.id,
      slotId: slot.id,
      clientRequestId: 'request-1',
      sex: 'female',
    });
    expect(deleteLocalEnrollment).toHaveBeenCalledWith('local-e1');
    expect(upsertSyncedEnrollment).toHaveBeenCalledWith(serverEnrollment);
    expect(removeOutbox).toHaveBeenCalledWith(10);
    expect(replaceSyncedEnrollments).toHaveBeenCalledWith([serverEnrollment]);
    expect(setMeta).toHaveBeenCalledWith('acudes_server_time', '2026-10-31T13:00:00.000Z');
    expect(setMeta).toHaveBeenCalledWith(
      'enrollments_server_time',
      '2026-10-31T13:00:00.000Z',
    );
    expect(result).toMatchObject({
      acudes: [liveAcude],
      enrollments: [localSynced],
      pendingCount: 0,
      conflictCount: 0,
      error: null,
      pushed: 1,
      fromCache: false,
    });
  });

  it('marca conflicto y quita la operación cuando el servidor la rechaza', async () => {
    (listOutbox as jest.Mock).mockResolvedValue([createItem]);
    (createEnrollment as jest.Mock).mockRejectedValue(
      new ApiError(409, 'NO_CAPACITY', 'El subgrupo ya está lleno.'),
    );
    (getLocalEnrollment as jest.Mock).mockResolvedValue(localSynced);
    (countConflictEnrollments as jest.Mock).mockResolvedValue(1);

    const result = await runSync(user);

    expect(markEnrollmentConflict).toHaveBeenCalledWith(
      'local-e1',
      'El subgrupo ya está lleno.',
    );
    expect(removeOutbox).toHaveBeenCalledWith(10);
    expect(result.conflictCount).toBe(1);
  });

  it('conserva la cola ante un error de red', async () => {
    (listOutbox as jest.Mock).mockResolvedValue([createItem]);
    (createEnrollment as jest.Mock).mockRejectedValue(new NetworkError());
    (countOutbox as jest.Mock).mockResolvedValue(1);

    const result = await runSync(user);

    expect(markOutboxAttempt).toHaveBeenCalledWith(10, expect.any(String));
    expect(removeOutbox).not.toHaveBeenCalled();
    expect(result.pendingCount).toBe(1);
    expect(result.error).toContain('No pudimos actualizar');
  });
});
