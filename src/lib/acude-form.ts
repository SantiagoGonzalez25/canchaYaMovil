import { CURRENT_SEMESTER, minutesOf } from './date';
import type {
  AcudeCategory,
  AcudeInput,
  AcudeStatus,
  Scenario,
  ScheduleSlotInput,
  Weekday,
} from '@/types';

/**
 * Borrador editable del formulario de ACUDES.
 *
 * Los cupos y porcentajes se guardan como texto para respetar lo que la persona
 * escribe. `validateAcudeDraft` es la única fuente de verdad antes de llamar a
 * la API y replica las reglas de `acudeSchema` del servidor.
 */

export interface AcudeDraftSlot {
  /** Clave local de React; no se envía a la API. */
  key: string;
  /** Se conserva al editar para no cambiar los subgrupos existentes. */
  id?: string;
  day: Weekday;
  startTime: string;
  endTime: string;
  scenarioId: string;
  maxCapacity: string;
}

export interface AcudeDraft {
  name: string;
  description: string;
  category: AcudeCategory;
  discipline: string;
  teacherId: string;
  teacherName: string;
  scenarioId: string;
  schedule: AcudeDraftSlot[];
  maxCapacity: string;
  status: AcudeStatus;
  semester: string;
  imageUrl: string;
  requirements: string;
  attendanceMin: string;
}

export type AcudeDraftErrors = Record<string, string>;

export interface AcudeValidationResult {
  ok: boolean;
  errors: AcudeDraftErrors;
  input?: AcudeInput;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEMESTER_PATTERN = /^\d{4}-[12]$/;

export function slotFieldKey(key: string, field: keyof AcudeDraftSlot): string {
  return `slot:${key}:${field}`;
}

function text(value: string): string {
  return value.trim();
}

function parseInteger(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+$/.test(clean)) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstScenarioId(scenarios: Scenario[]): string {
  return scenarios.find((scenario) => scenario.status === 'available')?.id ?? scenarios[0]?.id ?? '';
}

export function createEmptyDraft(scenarios: Scenario[]): AcudeDraft {
  const scenarioId = firstScenarioId(scenarios);
  return {
    name: '',
    description: '',
    category: 'sports',
    discipline: '',
    teacherId: '',
    teacherName: '',
    scenarioId,
    schedule: [
      {
        key: 'new-0',
        day: 'monday',
        startTime: '08:00',
        endTime: '10:00',
        scenarioId,
        maxCapacity: '',
      },
    ],
    maxCapacity: '30',
    status: 'draft',
    semester: CURRENT_SEMESTER.name,
    imageUrl: '',
    requirements: '',
    attendanceMin: '80',
  };
}

export function draftFromInput(input: AcudeInput): AcudeDraft {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    discipline: input.discipline,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    scenarioId: input.scenarioId,
    schedule: input.schedule.map((slot, index) => ({
      key: slot.id ?? `new-${index}`,
      id: slot.id,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      scenarioId: slot.scenarioId,
      maxCapacity: slot.maxCapacity ? String(slot.maxCapacity) : '',
    })),
    maxCapacity: String(input.maxCapacity),
    status: input.status,
    semester: input.semester,
    imageUrl: input.imageUrl ?? '',
    requirements: input.requirements,
    attendanceMin: String(input.attendanceMin),
  };
}

export function validateAcudeDraft(draft: AcudeDraft): AcudeValidationResult {
  const errors: AcudeDraftErrors = {};

  const name = text(draft.name);
  if (name.length < 3) errors.name = 'El nombre debe tener al menos 3 caracteres.';
  else if (name.length > 120) errors.name = 'El nombre no puede superar 120 caracteres.';

  if (text(draft.description).length > 1500) {
    errors.description = 'La descripción no puede superar 1500 caracteres.';
  }

  const discipline = text(draft.discipline);
  if (discipline.length < 2) errors.discipline = 'Indica la disciplina.';
  else if (discipline.length > 80) errors.discipline = 'La disciplina no puede superar 80 caracteres.';

  const teacherId = text(draft.teacherId);
  if (teacherId.length < 2) errors.teacherId = 'Indica el UID del docente.';
  else if (teacherId.length > 120) errors.teacherId = 'El UID no puede superar 120 caracteres.';

  const teacherName = text(draft.teacherName);
  if (teacherName.length < 2) errors.teacherName = 'Indica el nombre del docente.';
  else if (teacherName.length > 120) {
    errors.teacherName = 'El nombre del docente no puede superar 120 caracteres.';
  }

  if (!text(draft.scenarioId) && draft.status === 'published') {
    errors.scenarioId = 'Asigna un escenario antes de publicar.';
  }

  const maxCapacity = parseInteger(draft.maxCapacity);
  if (maxCapacity === null || maxCapacity < 1 || maxCapacity > 500) {
    errors.maxCapacity = 'El cupo debe ser un entero entre 1 y 500.';
  }

  const semester = text(draft.semester);
  if (!SEMESTER_PATTERN.test(semester)) {
    errors.semester = 'Usa el formato AAAA-1 o AAAA-2 (por ejemplo, 2026-2).';
  }

  const imageUrl = text(draft.imageUrl);
  if (imageUrl && !(imageUrl.startsWith('/') || /^https?:\/\//i.test(imageUrl))) {
    errors.imageUrl = 'Usa una ruta interna (“/…”) o una URL http(s).';
  } else if (imageUrl.length > 500) {
    errors.imageUrl = 'La URL no puede superar 500 caracteres.';
  }

  if (text(draft.requirements).length > 800) {
    errors.requirements = 'Los requisitos no pueden superar 800 caracteres.';
  }

  const attendanceMin = parseInteger(draft.attendanceMin);
  if (attendanceMin === null || attendanceMin < 0 || attendanceMin > 100) {
    errors.attendanceMin = 'La asistencia mínima debe estar entre 0 y 100.';
  }

  if (draft.schedule.length === 0) {
    errors.schedule = 'Agrega al menos una franja horaria.';
  } else if (draft.schedule.length > 30) {
    errors.schedule = 'Un ACUDE no puede tener más de 30 franjas.';
  }

  const validSlots: { index: number; slot: ScheduleSlotInput }[] = [];

  draft.schedule.forEach((slot, index) => {
    const label = `Franja ${index + 1}`;
    const startTime = text(slot.startTime);
    const endTime = text(slot.endTime);
    const slotScenarioId = text(slot.scenarioId);

    if (!TIME_PATTERN.test(startTime)) {
      errors[slotFieldKey(slot.key, 'startTime')] = `${label}: usa HH:mm (00:00 a 23:59).`;
    }
    if (!TIME_PATTERN.test(endTime)) {
      errors[slotFieldKey(slot.key, 'endTime')] = `${label}: usa HH:mm (00:00 a 23:59).`;
    }
    if (
      TIME_PATTERN.test(startTime) &&
      TIME_PATTERN.test(endTime) &&
      minutesOf(startTime) >= minutesOf(endTime)
    ) {
      errors[slotFieldKey(slot.key, 'endTime')] = `${label}: la hora de fin debe ser mayor.`;
    }
    if (!slotScenarioId && draft.status === 'published') {
      errors[slotFieldKey(slot.key, 'scenarioId')] = `${label}: asigna un escenario antes de publicar.`;
    }

    let slotCapacity: number | undefined;
    if (text(slot.maxCapacity)) {
      const parsed = parseInteger(slot.maxCapacity);
      if (parsed === null || parsed < 1 || parsed > 500) {
        errors[slotFieldKey(slot.key, 'maxCapacity')] = `${label}: cupo entre 1 y 500.`;
      } else {
        slotCapacity = parsed;
      }
    }

    if (
      TIME_PATTERN.test(startTime) &&
      TIME_PATTERN.test(endTime) &&
      minutesOf(startTime) < minutesOf(endTime) &&
      (draft.status !== 'published' || Boolean(slotScenarioId))
    ) {
      validSlots.push({
        index,
        slot: {
          ...(slot.id ? { id: slot.id } : {}),
          day: slot.day,
          startTime,
          endTime,
          scenarioId: slotScenarioId,
          ...(slotCapacity ? { maxCapacity: slotCapacity } : {}),
        },
      });
    }
  });

  if (
    text(draft.scenarioId) &&
    draft.schedule.length > 0 &&
    !draft.schedule.some((slot) => text(slot.scenarioId) === text(draft.scenarioId))
  ) {
    errors.scenarioId = 'El escenario principal debe aparecer en al menos una franja.';
  }

  for (let i = 0; i < validSlots.length; i += 1) {
    for (let j = i + 1; j < validSlots.length; j += 1) {
      const a = validSlots[i];
      const b = validSlots[j];
      if (!a || !b) continue;
      if (
        a.slot.scenarioId &&
        a.slot.scenarioId === b.slot.scenarioId &&
        a.slot.day === b.slot.day &&
        minutesOf(a.slot.startTime) < minutesOf(b.slot.endTime) &&
        minutesOf(b.slot.startTime) < minutesOf(a.slot.endTime)
      ) {
        const firstKey = draft.schedule[a.index]?.key;
        const secondKey = draft.schedule[b.index]?.key;
        const message = `Las franjas ${a.index + 1} y ${b.index + 1} se cruzan en el mismo escenario y día.`;
        if (firstKey) errors[slotFieldKey(firstKey, 'startTime')] = message;
        if (secondKey) errors[slotFieldKey(secondKey, 'startTime')] = message;
      }
    }
  }

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors };

  return {
    ok,
    errors,
    input: {
      name,
      description: text(draft.description),
      category: draft.category,
      discipline,
      teacherId,
      teacherName,
      scenarioId: text(draft.scenarioId),
      schedule: validSlots.map((entry) => entry.slot),
      maxCapacity: maxCapacity as number,
      status: draft.status,
      semester,
      ...(imageUrl ? { imageUrl } : {}),
      requirements: text(draft.requirements),
      attendanceMin: attendanceMin as number,
    },
  };
}
