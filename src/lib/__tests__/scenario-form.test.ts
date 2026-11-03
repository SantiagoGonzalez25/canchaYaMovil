import {
  emptyScenarioDraft,
  scenarioDraftFrom,
  validateScenarioDraft,
} from '@/lib/scenario-form';
import type { Scenario } from '@/types';

const scenario: Scenario = {
  id: 'scenario-1',
  name: 'Coliseo',
  type: 'gym',
  status: 'available',
  location: 'Campus Robledo',
  capacity: 120,
  description: 'Escenario techado',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
};

describe('scenario form validation', () => {
  it('crea un borrador editable con valores iniciales', () => {
    const draft = emptyScenarioDraft();
    expect(draft.type).toBe('court');
    expect(draft.status).toBe('available');
    expect(draft.capacity).toBe('30');
  });

  it('convierte un escenario del servidor a borrador', () => {
    expect(scenarioDraftFrom(scenario)).toEqual({
      name: 'Coliseo',
      type: 'gym',
      status: 'available',
      location: 'Campus Robledo',
      capacity: '120',
      description: 'Escenario techado',
    });
  });

  it('valida y normaliza un escenario correcto', () => {
    const result = validateScenarioDraft({
      name: '  Cancha sintética  ',
      type: 'field',
      status: 'maintenance',
      location: '  Bloque deportivo  ',
      capacity: ' 45 ',
      description: '  Césped sintético  ',
    });

    expect(result.ok).toBe(true);
    expect(result.input).toEqual({
      name: 'Cancha sintética',
      type: 'field',
      status: 'maintenance',
      location: 'Bloque deportivo',
      capacity: 45,
      description: 'Césped sintético',
    });
  });

  it('rechaza nombre, ubicación y capacidad inválidos', () => {
    const result = validateScenarioDraft({
      name: 'AB',
      type: 'court',
      status: 'available',
      location: 'X',
      capacity: '0',
      description: 'a'.repeat(601),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.location).toBeDefined();
    expect(result.errors.capacity).toBeDefined();
    expect(result.errors.description).toBeDefined();
    expect(result.input).toBeUndefined();
  });

  it('rechaza capacidades no numéricas o fuera de rango', () => {
    const base = emptyScenarioDraft();
    expect(
      validateScenarioDraft({ ...base, name: 'Cancha', location: 'Bloque', capacity: 'abc' })
        .errors.capacity,
    ).toBeDefined();
    expect(
      validateScenarioDraft({ ...base, name: 'Cancha', location: 'Bloque', capacity: '5001' })
        .errors.capacity,
    ).toBeDefined();
  });
});
