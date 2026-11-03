import type {
  Enrollment,
  EnrollmentStatus,
  Sex,
} from '@/types';
import { apiRequest } from './api-client';

export interface CreateEnrollmentInput {
  acudeId: string;
  slotId: string;
  clientRequestId: string;
  sex?: Sex;
}

export interface CreateEnrollmentResponse {
  enrollment: Enrollment;
  created: boolean;
  serverTime: string;
}

/** POST /api/enrollments — idempotente por clientRequestId. */
export async function createEnrollment(
  input: CreateEnrollmentInput,
): Promise<CreateEnrollmentResponse> {
  return apiRequest<CreateEnrollmentResponse>('/api/enrollments', {
    method: 'POST',
    body: input,
  });
}

export interface CancelEnrollmentResponse {
  enrollment: Enrollment;
  alreadyCanceled: boolean;
  serverTime: string;
}

/** PATCH /api/enrollments/:id/cancel — libera cupo; idempotente. */
export async function cancelEnrollment(id: string): Promise<CancelEnrollmentResponse> {
  return apiRequest<CancelEnrollmentResponse>(
    `/api/enrollments/${encodeURIComponent(id)}/cancel`,
    { method: 'PATCH' },
  );
}

export interface MyEnrollmentsQuery {
  status?: EnrollmentStatus;
  updatedSince?: string;
}

/** GET /api/enrollments/me — historial del usuario autenticado. */
export async function getMyEnrollments(
  query: MyEnrollmentsQuery = {},
  signal?: AbortSignal,
): Promise<{ enrollments: Enrollment[]; serverTime: string }> {
  return apiRequest<{ enrollments: Enrollment[]; serverTime: string }>(
    '/api/enrollments/me',
    { query, signal },
  );
}

export interface StaffEnrollmentsQuery {
  status?: EnrollmentStatus;
  acudeId?: string;
  slotId?: string;
  updatedSince?: string;
  from?: string;
  to?: string;
}

/** GET /api/enrollments — profesor/admin. */
export async function listEnrollments(
  query: StaffEnrollmentsQuery = {},
  signal?: AbortSignal,
): Promise<{ enrollments: Enrollment[]; serverTime: string }> {
  return apiRequest<{ enrollments: Enrollment[]; serverTime: string }>(
    '/api/enrollments',
    { query, signal },
  );
}
