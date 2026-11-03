import {
  MAX_ACUDES_PER_SEMESTER,
  countActiveInSemester,
  evaluateEnrollment,
  hasReachedSemesterLimit,
  slotsOverlap,
} from '@/lib/enrollment-rules';
import type { LiveAcude, LiveScheduleSlot, LocalEnrollment } from '@/types';

function makeSlot(overrides: Partial<LiveScheduleSlot> = {}): LiveScheduleSlot {
  return {
    id: 'slot-1',
    day: 'monday',
    startTime: '10:00',
    endTime: '12:00',
    scenarioId: 'scenario-1',
    maxCapacity: 10,
    scenarioName: 'Cancha principal',
    capacity: 10,
    enrolled: 0,
    available: 10,
    occupancyPct: 0,
    ...overrides,
  };
}

function makeAcude(overrides: Partial<LiveAcude> = {}): LiveAcude {
  const schedule = overrides.schedule ?? [makeSlot()];
  const totalCapacity = schedule.reduce((sum, slot) => sum + slot.capacity, 0);
  const totalAvailable = schedule.reduce((sum, slot) => sum + slot.available, 0);
  return {
    id: 'acude-1',
    name: 'Fútbol formativo',
    description: '',
    category: 'sports',
    discipline: 'Fútbol',
    scenarioId: 'scenario-1',
    teacherId: 'teacher-1',
    teacherName: 'Docente Uno',
    schedule,
    maxCapacity: 20,
    currentEnrolled: 0,
    slotEnrolled: {},
    status: 'published',
    semester: '2026-2',
    imageUrl: null,
    imageStoragePath: null,
    requirements: '',
    attendanceMin: 80,
    createdBy: 'admin-1',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    totalCapacity,
    totalAvailable,
    ...overrides,
  };
}

function makeEnrollment(overrides: Partial<LocalEnrollment> = {}): LocalEnrollment {
  return {
    id: 'enrollment-1',
    acudeId: 'other-acude',
    acudeName: 'Otro ACUDE',
    userId: 'student-1',
    userEmail: 'estudiante@tdea.edu.co',
    userName: 'Estudiante Uno',
    userSex: 'female',
    slotId: 'other-slot',
    day: 'monday',
    startTime: '08:00',
    endTime: '10:00',
    scenarioId: 'scenario-2',
    scenarioName: 'Cancha 2',
    category: 'training',
    discipline: 'Ajedrez',
    teacherId: 'teacher-2',
    teacherName: 'Docente Dos',
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

describe('enrollment rules', () => {
  it('acepta una inscripción publicada con cupo', () => {
    const acude = makeAcude();
    expect(
      evaluateEnrollment({ acude, slot: acude.schedule[0]!, enrollments: [] }),
    ).toEqual({ ok: true });
  });

  it('rechaza ACUDES no publicados', () => {
    const acude = makeAcude({ status: 'draft' });
    expect(evaluateEnrollment({ acude, slot: acude.schedule[0]!, enrollments: [] }).code).toBe(
      'INVALID_STATE',
    );
  });

  it('rechaza franjas que ya no existen o están llenas', () => {
    const acude = makeAcude();
    expect(evaluateEnrollment({ acude, slot: makeSlot({ id: 'otra' }), enrollments: [] }).code).toBe(
      'NOT_FOUND',
    );
    const full = makeAcude({ schedule: [makeSlot({ available: 0 })] });
    expect(
      evaluateEnrollment({ acude: full, slot: full.schedule[0]!, enrollments: [] }).code,
    ).toBe('NO_CAPACITY');
  });

  it('evita dos inscripciones en el mismo ACUDE', () => {
    const acude = makeAcude();
    expect(
      evaluateEnrollment({
        acude,
        slot: acude.schedule[0]!,
        enrollments: [makeEnrollment({ acudeId: acude.id, day: 'friday' })],
      }).code,
    ).toBe('ALREADY_ENROLLED');
  });

  it('detecta cruces de horario y permite extremos que se tocan', () => {
    const acude = makeAcude({
      schedule: [makeSlot({ id: 'slot-2', startTime: '11:00', endTime: '13:00' })],
    });
    const overlapping = makeEnrollment({ day: 'monday', startTime: '10:00', endTime: '12:00' });
    expect(
      evaluateEnrollment({ acude, slot: acude.schedule[0]!, enrollments: [overlapping] }).code,
    ).toBe('STUDENT_OVERLAP');

    const touching = makeAcude({
      schedule: [makeSlot({ id: 'slot-3', startTime: '10:00', endTime: '12:00' })],
    });
    const earlier = makeEnrollment({ day: 'monday', startTime: '08:00', endTime: '10:00' });
    expect(
      evaluateEnrollment({ acude: touching, slot: touching.schedule[0]!, enrollments: [earlier] })
        .ok,
    ).toBe(true);
  });

  it('aplica el máximo de ACUDES por semestre', () => {
    const acude = makeAcude();
    const active = [
      makeEnrollment({ id: 'e1', acudeId: 'a1', day: 'tuesday' }),
      makeEnrollment({ id: 'e2', acudeId: 'a2', day: 'wednesday' }),
    ];
    expect(
      evaluateEnrollment({ acude, slot: acude.schedule[0]!, enrollments: active }).code,
    ).toBe('MAX_ACUDES');
    expect(MAX_ACUDES_PER_SEMESTER).toBe(2);
  });

  it('no cuenta inscripciones canceladas ni de otro semestre', () => {
    const acude = makeAcude();
    const canceled = makeEnrollment({ id: 'e1', status: 'canceled', day: 'tuesday' });
    const oldSemester = makeEnrollment({ id: 'e2', semester: '2025-2', day: 'wednesday' });
    expect(
      evaluateEnrollment({ acude, slot: acude.schedule[0]!, enrollments: [canceled, oldSemester] })
        .ok,
    ).toBe(true);
    expect(countActiveInSemester([canceled, oldSemester], '2026-2')).toBe(0);
    expect(hasReachedSemesterLimit([canceled, oldSemester], '2026-2')).toBe(false);
  });

  it('compara franjas por día y minutos', () => {
    expect(
      slotsOverlap(
        { day: 'monday', startTime: '10:00', endTime: '12:00' },
        { day: 'monday', startTime: '11:59', endTime: '13:00' },
      ),
    ).toBe(true);
    expect(
      slotsOverlap(
        { day: 'monday', startTime: '10:00', endTime: '12:00' },
        { day: 'tuesday', startTime: '10:00', endTime: '12:00' },
      ),
    ).toBe(false);
  });
});
