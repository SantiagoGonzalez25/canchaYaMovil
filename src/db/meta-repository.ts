import { getDatabase } from './database';

const OWNER_KEY = 'owner_uid';
const LAST_SYNC_KEY = 'last_synced_at';
const LAST_ERROR_KEY = 'last_sync_error';

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    key,
    value,
  );
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM app_meta WHERE key = ?;', key);
}

export const metaKeys = {
  owner: OWNER_KEY,
  lastSyncedAt: LAST_SYNC_KEY,
  lastSyncError: LAST_ERROR_KEY,
} as const;
