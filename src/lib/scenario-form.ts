import type { Scenario, ScenarioInput, ScenarioStatus, ScenarioType } from '@/types';

/** Borrador del formulario de escenarios (capacidad como texto editable). */

export interface ScenarioDraft {
  name: string;
  type: ScenarioType;
  status: ScenarioStatus;
  location: string;
  capacity: string;
  description: string;
}

export type ScenarioDraftErrors = Record<string, string>;

export interface ScenarioValidationResult {
  ok: boolean;
  errors: ScenarioDraftErrors;
  input?: ScenarioInput;
}

export function emptyScenarioDraft(): ScenarioDraft {
  return {
    name: '',
    type: 'court',
    status: 'available',
    location: '',
    capacity: '30',
    description: '',
  };
}

export function scenarioDraftFrom(scenario: Scenario): ScenarioDraft {
  return {
    name: scenario.name,
    type: scenario.type,
    status: scenario.status,
    location: scenario.location,
    capacity: String(scenario.capacity),
    description: scenario.description,
  };
}

export function validateScenarioDraft(draft: ScenarioDraft): ScenarioValidationResult {
  const errors: ScenarioDraftErrors = {};
  const name = draft.name.trim();
  const location = draft.location.trim();
  const description = draft.description.trim();
  const capacityText = draft.capacity.trim();
  const capacity = /^\d+$/.test(capacityText) ? Number(capacityText) : NaN;

  if (name.length < 3) errors.name = 'El nombre debe tener al menos 3 caracteres.';
  else if (name.length > 100) errors.name = 'El nombre no puede superar 100 caracteres.';

  if (location.length < 3) errors.location = 'Indica la ubicación del escenario.';
  else if (location.length > 160) {
    errors.location = 'La ubicación no puede superar 160 caracteres.';
  }

  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) {
    errors.capacity = 'La capacidad debe ser un entero entre 1 y 5000.';
  }

  if (description.length > 600) {
    errors.description = 'La descripción no puede superar 600 caracteres.';
  }

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors };

  return {
    ok,
    errors,
    input: {
      name,
      type: draft.type,
      status: draft.status,
      location,
      capacity,
      description,
    },
  };
}
