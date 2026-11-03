import { getDatabase, parsePayload } from './database';

export type OutboxKind = 'create_enrollment' | 'cancel_enrollment';

export interface OutboxItem {
  id: number;
  dedupeKey: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

interface OutboxRow {
  id: number;
  dedupe_key: string;
  kind: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

function toItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    kind: row.kind as OutboxKind,
    payload: parsePayload<Record<string, unknown>>(row.payload),
    createdAt: row.created_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}

export async function enqueueOutbox(input: {
  dedupeKey: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt?: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO outbox (dedupe_key, kind, payload, created_at)
     VALUES (?, ?, ?, ?);`,
    input.dedupeKey,
    input.kind,
    JSON.stringify(input.payload),
    input.createdAt ?? new Date().toISOString(),
  );
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY id;');
  return rows.map(toItem);
}

export async function countOutbox(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM outbox;');
  return row?.total ?? 0;
}

export async function findOutboxByDedupeKey(key: string): Promise<OutboxItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<OutboxRow>(
    'SELECT * FROM outbox WHERE dedupe_key = ?;',
    key,
  );
  return row ? toItem(row) : null;
}

export async function markOutboxAttempt(id: number, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?;',
    error,
    id,
  );
}

export async function removeOutbox(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM outbox WHERE id = ?;', id);
}

export async function removeOutboxByDedupeKey(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM outbox WHERE dedupe_key = ?;', key);
}

export async function clearOutbox(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM outbox;');
}

export function createDedupeKey(clientRequestId: string): string {
  return `create:${clientRequestId}`;
}

export function cancelDedupeKey(enrollmentId: string): string {
  return `cancel:${enrollmentId}`;
}
