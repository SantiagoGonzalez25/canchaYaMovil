import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  OccupationResult,
  Weekday,
} from '@/types';
import { apiRequest } from './api-client';

export interface OccupationQuery {
  date?: string;
  day?: Weekday;
}

/** GET /api/scenarios/occupation — profesor/admin. */
export async function getOccupation(
  query: OccupationQuery = {},
  signal?: AbortSignal,
): Promise<OccupationResult> {
  return apiRequest<OccupationResult>('/api/scenarios/occupation', { query, signal });
}

export interface AttendanceQuery {
  acudeId?: string;
  slotId?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  updatedSince?: string;
}

/** GET /api/attendance — profesor/admin. */
export async function listAttendance(
  query: AttendanceQuery = {},
  signal?: AbortSignal,
): Promise<{ attendance: AttendanceRecord[]; serverTime: string }> {
  return apiRequest<{ attendance: AttendanceRecord[]; serverTime: string }>('/api/attendance', {
    query,
    signal,
  });
}

export interface AttendanceSessionsQuery {
  from?: string;
  to?: string;
  acudeId?: string;
  status?: 'scheduled' | 'pending' | 'saved';
}

/** GET /api/attendance/sessions — sesiones reales calculadas desde el horario. */
export async function getAttendanceSessions(
  query: AttendanceSessionsQuery = {},
  signal?: AbortSignal,
): Promise<{ sessions: AttendanceSession[]; serverTime: string }> {
  return apiRequest<{ sessions: AttendanceSession[]; serverTime: string }>(
    '/api/attendance/sessions',
    { query, signal },
  );
}

export interface AttendanceEntryInput {
  enrollmentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface SaveAttendanceInput {
  acudeId: string;
  slotId: string;
  date: string;
  records: AttendanceEntryInput[];
}

/** POST /api/attendance — guardado masivo e idempotente por fecha. */
export async function saveAttendance(
  input: SaveAttendanceInput,
): Promise<{ attendance: AttendanceRecord[]; saved: number; serverTime: string }> {
  return apiRequest('/api/attendance', { method: 'POST', body: input });
}
