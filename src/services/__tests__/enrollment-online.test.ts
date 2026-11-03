/* eslint-disable import/first -- jest.mock debe declararse antes de importar los módulos simulados. */
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-online-123'),
}));

jest.mock('@/db/enrollments-repository', () => ({
  upsertSyncedEnrollment: jest.fn(async () => undefined),
}));

jest.mock('@/services/enrollments-service', () => ({
  createEnrollment: jest.fn(),
}));

import { upsertSyncedEnrollment } from '@/db/enrollments-repository';
import { enrollOnline } from '@/services/enrollment-online';
import { createEnrollment } from '@/services/enrollments-service';
import { ApiError } from '@/services/errors';
import type { Enrollment, LiveAcude, LiveScheduleSlot, User } from '@/types';

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

const serverEnrollment: Enrollment = {
  id: 'server-e1',
  acudeId: acude.id,
  acudeName: acude.name,
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
  clientRequestId: 'uuid-online-123',
  semester: '2026-2',
  enrolledAt: '2026-10-31T12:00:00.000Z',
  enrolledOn: '2026-10-31',
  canceledAt: null,
  updatedAt: '2026-10-31T12:00:00.000Z',
};

describe('online enrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('solo guarda localmente cuando la API confirma la inscripción', async () => {
    (createEnrollment as jest.Mock).mockResolvedValue({
      enrollment: serverEnrollment,
      created: true,
      serverTime: '2026-10-31T13:00:00.000Z',
    });

    const result = await enrollOnline({ acude, slot, user });

    expect(createEnrollment).toHaveBeenCalledWith({
      acudeId: acude.id,
      slotId: slot.id,
      clientRequestId: 'uuid-online-123',
      sex: 'female',
    });
    expect(upsertSyncedEnrollment).toHaveBeenCalledWith(serverEnrollment);
    expect(result.enrollment).toMatchObject({
      id: serverEnrollment.id,
      syncState: 'synced',
      syncError: null,
    });
  });

  it('no guarda nada si el servidor rechaza la inscripción', async () => {
    (createEnrollment as jest.Mock).mockRejectedValue(
      new ApiError(409, 'MAX_ACUDES', 'Solo puedes estar inscrito en 2 ACUDES por semestre.'),
    );

    await expect(enrollOnline({ acude, slot, user })).rejects.toMatchObject({
      code: 'MAX_ACUDES',
    });
    expect(upsertSyncedEnrollment).not.toHaveBeenCalled();
  });
});
