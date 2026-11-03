import type { Enrollment, LocalEnrollment, SyncState } from '@/types';
import { shouldPreferServerEnrollment } from '@/lib/enrollment-merge';
import { getDatabase, parsePayload } from './database';

interface EnrollmentRow {
  id: string;
  payload: string;
  sync_state: string;
  sync_error: string | null;
}

function toLocalEnrollment(row: EnrollmentRow): LocalEnrollment | null {
  try {
    const payload = parsePayload<Enrollment>(row.payload);
    return {
      ...payload,
      id: row.id,
      semester: payload.semester ?? 'N/A',
      syncState: (row.sync_state as SyncState) ?? 'synced',
      syncError: row.sync_error,
    };
  } catch {
    return null;
  }
}

export async function listLocalEnrollments(): Promise<LocalEnrollment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EnrollmentRow>(
    'SELECT id, payload, sync_state, sync_error FROM enrollments_cache ORDER BY json_extract(payload, "$.enrolledAt") DESC;',
  );
  return rows.flatMap((row) => {
    const item = toLocalEnrollment(row);
    return item ? [item] : [];
  });
}

export async function getLocalEnrollment(id: string): Promise<LocalEnrollment | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EnrollmentRow>(
    'SELECT id, payload, sync_state, sync_error FROM enrollments_cache WHERE id = ?;',
    id,
  );
  return row ? toLocalEnrollment(row) : null;
}

async function upsert(
  enrollment: Enrollment,
  syncState: SyncState,
  syncError: string | null,
  cachedAt: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO enrollments_cache
      (id, acude_id, slot_id, status, semester, user_id, client_request_id, payload,
       sync_state, sync_error, server_updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       acude_id = excluded.acude_id,
       slot_id = excluded.slot_id,
       status = excluded.status,
       semester = excluded.semester,
       user_id = excluded.user_id,
       client_request_id = excluded.client_request_id,
       payload = excluded.payload,
       sync_state = excluded.sync_state,
       sync_error = excluded.sync_error,
       server_updated_at = excluded.server_updated_at,
       cached_at = excluded.cached_at;`,
    enrollment.id,
    enrollment.acudeId,
    enrollment.slotId,
    enrollment.status,
    enrollment.semester ?? 'N/A',
    enrollment.userId,
    enrollment.clientRequestId ?? null,
    JSON.stringify(enrollment),
    syncState,
    syncError,
    enrollment.updatedAt,
    cachedAt,
  );
}

export async function upsertSyncedEnrollment(enrollment: Enrollment): Promise<void> {
  await upsert(enrollment, 'synced', null, new Date().toISOString());
}

export async function insertPendingEnrollment(enrollment: Enrollment): Promise<void> {
  await upsert(enrollment, 'pending', null, new Date().toISOString());
}

export async function markEnrollmentConflict(id: string, message: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE enrollments_cache
       SET sync_state = 'conflict', sync_error = ?, cached_at = ?
     WHERE id = ?;`,
    message,
    new Date().toISOString(),
    id,
  );
}

export async function markEnrollmentPending(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE enrollments_cache
       SET sync_state = 'pending', sync_error = NULL, cached_at = ?
     WHERE id = ?;`,
    new Date().toISOString(),
    id,
  );
}

export async function markEnrollmentCanceled(
  id: string,
  canceled: Enrollment,
): Promise<void> {
  await upsert({ ...canceled, status: 'canceled' }, 'synced', null, new Date().toISOString());
}

export async function deleteLocalEnrollment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM enrollments_cache WHERE id = ?;', id);
}

/**
 * Reemplaza las filas sincronizadas con las del servidor, preservando los
 * cambios locales pendientes y los conflictos.
 *
 * Una inscripción pendiente que ya aparece en el servidor (mismo
 * `clientRequestId` o la misma franja activa) deja de ser local: gana el
 * servidor. Una cancelación pendiente NO se descarta, porque el servidor
 * todavía puede devolver la fila como activa hasta que la outbox se vacíe; en
 * ese caso se restaura el estado local de cancelación.
 */
export async function replaceSyncedEnrollments(server: Enrollment[]): Promise<void> {
  const db = await getDatabase();
  const cachedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const pendingRows = await db.getAllAsync<EnrollmentRow>(
      `SELECT id, payload, sync_state, sync_error
         FROM enrollments_cache
        WHERE sync_state IN ('pending', 'conflict');`,
    );

    await db.runAsync("DELETE FROM enrollments_cache WHERE sync_state = 'synced';");

    for (const enrollment of server) {
      await upsert(enrollment, 'synced', null, cachedAt);
    }

    for (const row of pendingRows) {
      const local = toLocalEnrollment(row);
      if (!local) continue;

      if (shouldPreferServerEnrollment(local, server)) {
        await db.runAsync('DELETE FROM enrollments_cache WHERE id = ?;', row.id);
        continue;
      }

      // El upsert del servidor pudo sobrescribir esta fila por id; se restaura
      // el estado local (cancelación pendiente o conflicto) sin perder la cola.
      const { syncState, syncError, ...payload } = local;
      await upsert(payload, syncState, syncError, cachedAt);
    }
  });
}

export async function countConflictEnrollments(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM enrollments_cache WHERE sync_state = 'conflict';",
  );
  return row?.total ?? 0;
}

export async function clearLocalEnrollments(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM enrollments_cache;');
}
