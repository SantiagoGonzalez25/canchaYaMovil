/* eslint-disable import/first -- jest.mock debe declararse antes de importar los módulos simulados. */
jest.mock('@/services/api-client', () => ({
  apiRequest: jest.fn(async () => ({})),
}));

import { apiRequest } from '@/services/api-client';
import {
  createScenario,
  deleteAcudeImage,
  deleteScenario,
  updateScenario,
} from '@/services/acudes-service';
import { createManager, getManagers } from '@/services/auth-service';
import {
  getAttendanceReport,
  getEnrollmentReport,
} from '@/services/reports-service';
import type { ManagerInput, ReportResult, Scenario, ScenarioInput } from '@/types';

const managerInput: ManagerInput = {
  displayName: 'Ana Pérez',
  email: 'ana@tdea.edu.co',
  password: 'secreto123',
  sex: 'female',
};

const scenarioInput: ScenarioInput = {
  name: 'Cancha 1',
  type: 'court',
  status: 'available',
  location: 'Bloque deportivo',
  capacity: 30,
  description: '',
};

const scenario: Scenario = {
  id: 'scenario-1',
  ...scenarioInput,
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
};

const report: ReportResult = {
  kind: 'enrollments',
  groupBy: 'date',
  from: '2026-10-01',
  to: '2026-10-31',
  series: [],
  rows: [],
  summary: {
    total: 0,
    active: 0,
    canceled: 0,
    present: 0,
    absent: 0,
    attendanceRate: 0,
  },
  generatedAt: '2026-10-31T13:00:00.000Z',
  serverTime: '2026-10-31T13:00:00.000Z',
};

describe('management services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('consulta los dos reportes por su ruta y filtros', async () => {
    (apiRequest as jest.Mock).mockResolvedValue(report);
    await getEnrollmentReport({ groupBy: 'acude' });
    expect(apiRequest).toHaveBeenCalledWith('/api/reports/enrollments', {
      query: { groupBy: 'acude' },
      signal: undefined,
    });

    (apiRequest as jest.Mock).mockResolvedValue({ ...report, kind: 'attendance' });
    await getAttendanceReport({ groupBy: 'student' });
    expect(apiRequest).toHaveBeenCalledWith('/api/reports/attendance', {
      query: { groupBy: 'student' },
      signal: undefined,
    });
  });

  it('crea un gestor con el cuerpo esperado', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ manager: { uid: 'uid-1' } });
    await createManager(managerInput);
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/manager-register', {
      method: 'POST',
      body: managerInput,
    });
  });

  it('consulta el listado completo de gestores', async () => {
    const managers = [{ uid: 'uid-1', name: 'Ana', email: 'ana@tdea.edu.co' }];
    (apiRequest as jest.Mock).mockResolvedValue({ managers });
    await expect(getManagers()).resolves.toEqual(managers);
    expect(apiRequest).toHaveBeenCalledWith('/api/auth/managers', { signal: undefined });
  });

  it('crea, actualiza y elimina escenarios', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ scenario });
    await createScenario(scenarioInput);
    expect(apiRequest).toHaveBeenCalledWith('/api/scenarios', {
      method: 'POST',
      body: scenarioInput,
    });

    await updateScenario('scenario-1', scenarioInput);
    expect(apiRequest).toHaveBeenCalledWith('/api/scenarios/scenario-1', {
      method: 'PUT',
      body: scenarioInput,
    });

    (apiRequest as jest.Mock).mockResolvedValue({ deleted: true });
    await deleteScenario('scenario-1');
    expect(apiRequest).toHaveBeenCalledWith('/api/scenarios/scenario-1', {
      method: 'DELETE',
    });
  });

  it('elimina la portada global de un ACUDE', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ acude: { id: 'acude-1', imageUrl: null } });
    await expect(deleteAcudeImage('acude-1')).resolves.toMatchObject({ id: 'acude-1' });
    expect(apiRequest).toHaveBeenCalledWith('/api/acudes/acude-1/image', {
      method: 'DELETE',
    });
  });
});
