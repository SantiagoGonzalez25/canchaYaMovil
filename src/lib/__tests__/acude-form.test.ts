import {
  createEmptyDraft,
  draftFromInput,
  slotFieldKey,
  validateAcudeDraft,
  type AcudeDraft,
} from '@/lib/acude-form';
import type { AcudeInput, Scenario } from '@/types';

const scenario: Scenario = {
  id: 'scene-1',
  name: 'Cancha principal',
  type: 'court',
  status: 'available',
  location: 'Bloque deportivo',
  capacity: 30,
  description: '',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
};

const secondScenario: Scenario = {
  ...scenario,
  id: 'scene-2',
  name: 'Salón 201',
  type: 'room',
};

function makeDraft(overrides: Partial<AcudeDraft> = {}): AcudeDraft {
  return {
    ...createEmptyDraft([scenario, secondScenario]),
    name: '  Fútbol formativo  ',
    description: '  Grupo de iniciación  ',
    category: 'sports',
    discipline: '  Fútbol  ',
    teacherId: '  gestor-1  ',
    teacherName: '  Docente Uno  ',
    scenarioId: 'scene-1',
    maxCapacity: '30',
    semester: '2026-2',
    requirements: '  Ropa deportiva  ',
    attendanceMin: '80',
    schedule: [
      {
        key: 'slot-1',
        id: 'slot-a',
        day: 'monday',
        startTime: '08:00',
        endTime: '10:00',
        scenarioId: 'scene-1',
        maxCapacity: '15',
      },
    ],
    ...overrides,
  };
}

describe('ACUDE form validation', () => {
  it('crea un borrador vacío válido para empezar', () => {
    const draft = createEmptyDraft([scenario]);
    expect(draft.scenarioId).toBe('scene-1');
    expect(draft.schedule).toHaveLength(1);
    expect(draft.schedule[0]?.scenarioId).toBe('scene-1');
    expect(draft.semester).toMatch(/^\d{4}-[12]$/);
  });

  it('normaliza textos y conserva los ids de las franjas', () => {
    const result = validateAcudeDraft(makeDraft());
    expect(result.ok).toBe(true);
    expect(result.input).toEqual({
      name: 'Fútbol formativo',
      description: 'Grupo de iniciación',
      category: 'sports',
      discipline: 'Fútbol',
      teacherId: 'gestor-1',
      teacherName: 'Docente Uno',
      scenarioId: 'scene-1',
      schedule: [
        {
          id: 'slot-a',
          day: 'monday',
          startTime: '08:00',
          endTime: '10:00',
          scenarioId: 'scene-1',
          maxCapacity: 15,
        },
      ],
      maxCapacity: 30,
      status: 'draft',
      semester: '2026-2',
      requirements: 'Ropa deportiva',
      attendanceMin: 80,
    });
  });

  it('rechaza campos obligatorios vacíos y cupos inválidos', () => {
    const result = validateAcudeDraft(
      makeDraft({
        name: '  ',
        discipline: '',
        teacherId: '',
        teacherName: '',
        maxCapacity: '0',
        semester: '2026-3',
        attendanceMin: '101',
        imageUrl: 'ftp://imagen',
        schedule: [],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.discipline).toBeDefined();
    expect(result.errors.teacherId).toBeDefined();
    expect(result.errors.teacherName).toBeDefined();
    expect(result.errors.maxCapacity).toBeDefined();
    expect(result.errors.semester).toBeDefined();
    expect(result.errors.attendanceMin).toBeDefined();
    expect(result.errors.imageUrl).toBeDefined();
    expect(result.errors.schedule).toBeDefined();
  });

  it('valida formato y orden de las horas', () => {
    const badFormat = validateAcudeDraft(
      makeDraft({
        schedule: [
          {
            key: 'slot-1',
            day: 'monday',
            startTime: '9:00',
            endTime: '10:00',
            scenarioId: 'scene-1',
            maxCapacity: '',
          },
        ],
      }),
    );
    expect(badFormat.errors[slotFieldKey('slot-1', 'startTime')]).toContain('HH:mm');

    const badOrder = validateAcudeDraft(
      makeDraft({
        schedule: [
          {
            key: 'slot-1',
            day: 'monday',
            startTime: '10:00',
            endTime: '08:00',
            scenarioId: 'scene-1',
            maxCapacity: '',
          },
        ],
      }),
    );
    expect(badOrder.errors[slotFieldKey('slot-1', 'endTime')]).toContain('mayor');
  });

  it('bloquea cruces en el mismo escenario y día', () => {
    const result = validateAcudeDraft(
      makeDraft({
        schedule: [
          {
            key: 'slot-1',
            day: 'monday',
            startTime: '08:00',
            endTime: '10:00',
            scenarioId: 'scene-1',
            maxCapacity: '',
          },
          {
            key: 'slot-2',
            day: 'monday',
            startTime: '09:00',
            endTime: '11:00',
            scenarioId: 'scene-1',
            maxCapacity: '',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors[slotFieldKey('slot-1', 'startTime')]).toContain('se cruzan');
    expect(result.errors[slotFieldKey('slot-2', 'startTime')]).toContain('se cruzan');
  });

  it('permite el mismo horario en escenarios distintos', () => {
    const result = validateAcudeDraft(
      makeDraft({
        schedule: [
          {
            key: 'slot-1',
            day: 'monday',
            startTime: '08:00',
            endTime: '10:00',
            scenarioId: 'scene-1',
            maxCapacity: '',
          },
          {
            key: 'slot-2',
            day: 'monday',
            startTime: '08:00',
            endTime: '10:00',
            scenarioId: 'scene-2',
            maxCapacity: '',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('exige que el escenario principal aparezca en el horario', () => {
    const result = validateAcudeDraft(makeDraft({ scenarioId: 'scene-2' }));
    expect(result.ok).toBe(false);
    expect(result.errors.scenarioId).toContain('escenario principal');
  });

  it('convierte un ACUDE de la API a borrador y regresa sin perder ids', () => {
    const input: AcudeInput = {
      name: 'Teatro',
      description: 'Montaje semestral',
      category: 'cultural',
      discipline: 'Teatro',
      teacherId: 'gestor-2',
      teacherName: 'Docente Dos',
      scenarioId: 'scene-2',
      schedule: [
        {
          id: 'slot-b',
          day: 'wednesday',
          startTime: '14:00',
          endTime: '16:00',
          scenarioId: 'scene-2',
          maxCapacity: 12,
        },
      ],
      maxCapacity: 24,
      status: 'published',
      semester: '2026-2',
      imageUrl: '/images/teatro.jpg',
      requirements: 'Ropa cómoda',
      attendanceMin: 75,
    };

    const draft = draftFromInput(input);
    expect(draft.maxCapacity).toBe('24');
    expect(draft.attendanceMin).toBe('75');
    expect(draft.schedule[0]?.id).toBe('slot-b');
    expect(draft.imageUrl).toBe('/images/teatro.jpg');

    const result = validateAcudeDraft(draft);
    expect(result.ok).toBe(true);
    expect(result.input).toEqual(input);
  });
});
