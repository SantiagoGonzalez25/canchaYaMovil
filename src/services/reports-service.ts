import type { ReportQuery, ReportResult } from '@/types';
import { apiRequest } from './api-client';

/**
 * Reportes calculados por el servidor. La app solo envía filtros y pinta el
 * resultado; nunca recalcula reglas de negocio en el cliente.
 */

/** GET /api/reports/enrollments — profesor/admin. */
export async function getEnrollmentReport(
  query: ReportQuery = {},
  signal?: AbortSignal,
): Promise<ReportResult> {
  return apiRequest<ReportResult>('/api/reports/enrollments', { query, signal });
}

/** GET /api/reports/attendance — profesor/admin. */
export async function getAttendanceReport(
  query: ReportQuery = {},
  signal?: AbortSignal,
): Promise<ReportResult> {
  return apiRequest<ReportResult>('/api/reports/attendance', { query, signal });
}
