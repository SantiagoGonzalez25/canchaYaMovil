import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_URL } from '@/config/env';
import type {
  Acude,
  AcudeCategory,
  AcudeInput,
  AcudeStatus,
  LiveAcude,
  Scenario,
  ScenarioInput,
  Weekday,
} from '@/types';
import { apiRequest } from './api-client';
import { getValidIdToken } from './session-manager';

export interface LiveAcudesQuery {
  q?: string;
  category?: AcudeCategory;
  day?: Weekday;
  updatedSince?: string;
}

export interface LiveAcudesResponse {
  acudes: LiveAcude[];
  serverTime: string;
}

/** GET /api/acudes/live — cartelera y subgrupos con cupos reales. */
export async function getLiveAcudes(
  query: LiveAcudesQuery = {},
  signal?: AbortSignal,
): Promise<LiveAcudesResponse> {
  return apiRequest<LiveAcudesResponse>('/api/acudes/live', { query, signal });
}

/** GET /api/acudes/:id — detalle del ACUDE (no incluye ocupación por franja). */
export async function getAcude(id: string, signal?: AbortSignal): Promise<Acude> {
  const result = await apiRequest<{ acude: Acude }>(`/api/acudes/${encodeURIComponent(id)}`, {
    signal,
  });
  return result.acude;
}

export interface ManageAcudesQuery {
  status?: AcudeStatus;
  category?: AcudeCategory;
  q?: string;
  updatedSince?: string;
}

/** GET /api/acudes — catálogo de gestión (profesor: solo los suyos). */
export async function listAcudes(
  query: ManageAcudesQuery = {},
  signal?: AbortSignal,
): Promise<{ acudes: Acude[]; serverTime: string }> {
  return apiRequest<{ acudes: Acude[]; serverTime: string }>('/api/acudes', { query, signal });
}

/** POST /api/acudes — solo admin. */
export async function createAcude(input: AcudeInput): Promise<Acude> {
  const result = await apiRequest<{ acude: Acude }>('/api/acudes', {
    method: 'POST',
    body: input,
  });
  return result.acude;
}

/** PUT /api/acudes/:id — solo admin. */
export async function updateAcude(id: string, input: AcudeInput): Promise<Acude> {
  const result = await apiRequest<{ acude: Acude }>(`/api/acudes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
  return result.acude;
}

/** DELETE /api/acudes/:id — archivado lógico; exige cero inscripciones activas. */
export async function archiveAcude(id: string): Promise<Acude> {
  const result = await apiRequest<{ acude: Acude }>(`/api/acudes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return result.acude;
}

/** GET /api/scenarios — escenarios disponibles para el editor de franjas. */
export async function getScenarios(signal?: AbortSignal): Promise<Scenario[]> {
  const result = await apiRequest<{ scenarios: Scenario[] }>('/api/scenarios', { signal });
  return result.scenarios;
}

/** POST /api/scenarios — solo admin. */
export async function createScenario(input: ScenarioInput): Promise<Scenario> {
  const result = await apiRequest<{ scenario: Scenario }>('/api/scenarios', {
    method: 'POST',
    body: input,
  });
  return result.scenario;
}

/** PUT /api/scenarios/:id — solo admin. */
export async function updateScenario(id: string, input: ScenarioInput): Promise<Scenario> {
  const result = await apiRequest<{ scenario: Scenario }>(
    `/api/scenarios/${encodeURIComponent(id)}`,
    { method: 'PUT', body: input },
  );
  return result.scenario;
}

/** DELETE /api/scenarios/:id — solo admin; exige que ningún ACUDE activo lo use. */
export async function deleteScenario(id: string): Promise<void> {
  await apiRequest(`/api/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface UploadableImage {
  uri: string;
  name: string;
  mimeType: string;
}

export interface AcudeImageResult {
  acude: Acude;
  image: { url: string; storagePath: string | null };
  serverTime: string;
}

async function tryNativeUpload(
  id: string,
  image: UploadableImage,
): Promise<AcudeImageResult | null> {
  if (Platform.OS === 'web' || !API_URL) return null;

  try {
    const url = `${API_URL}/api/acudes/${encodeURIComponent(id)}/image`;
    const send = (token: string) =>
      FileSystem.uploadAsync(url, image.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: image.mimeType,
        headers: { Authorization: `Bearer ${token}` },
      });

    let result = await send(await getValidIdToken());
    if (result.status === 401) result = await send(await getValidIdToken(true));
    if (result.status < 200 || result.status >= 300) return null;
    return JSON.parse(result.body) as AcudeImageResult;
  } catch {
    return null;
  }
}

/**
 * POST /api/acudes/:id/image — portada global; solo admin.
 * Envía multipart con el campo `file` (JPEG, PNG o WebP; máx. 500 KB).
 * Se intenta la subida nativa y, si falla, se usa FormData con fetch.
 */
export async function uploadAcudeImage(
  id: string,
  image: UploadableImage,
): Promise<AcudeImageResult> {
  const native = await tryNativeUpload(id, image);
  if (native) return native;

  const form = new FormData();
  form.append('file', {
    uri: image.uri,
    name: image.name,
    type: image.mimeType,
  } as unknown as Blob);

  return apiRequest<AcudeImageResult>(
    `/api/acudes/${encodeURIComponent(id)}/image`,
    { method: 'POST', form },
  );
}

/** DELETE /api/acudes/:id/image — quita la portada global; solo admin. */
export async function deleteAcudeImage(id: string): Promise<Acude> {
  const result = await apiRequest<{ acude: Acude }>(
    `/api/acudes/${encodeURIComponent(id)}/image`,
    { method: 'DELETE' },
  );
  return result.acude;
}

/** Convierte el detalle de un ACUDE al formulario de edición. */
export function toAcudeInput(acude: Acude): AcudeInput {
  return {
    name: acude.name,
    description: acude.description,
    category: acude.category,
    discipline: acude.discipline,
    teacherId: acude.teacherId,
    teacherName: acude.teacherName,
    scenarioId: acude.scenarioId,
    schedule: acude.schedule.map((slot) => ({
      id: slot.id,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      scenarioId: slot.scenarioId,
      ...(slot.maxCapacity ? { maxCapacity: slot.maxCapacity } : {}),
    })),
    maxCapacity: acude.maxCapacity,
    status: acude.status,
    semester: acude.semester,
    imageUrl: acude.imageUrl ?? undefined,
    requirements: acude.requirements,
    attendanceMin: acude.attendanceMin,
  };
}
