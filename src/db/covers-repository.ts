import { getDatabase } from './database';

/** Portadas elegidas por el usuario, guardadas solo en este dispositivo. */

export async function listCovers(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ acude_id: string; uri: string }>(
    'SELECT acude_id, uri FROM covers;',
  );
  return Object.fromEntries(rows.map((row) => [row.acude_id, row.uri]));
}

export async function setCoverRecord(acudeId: string, uri: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO covers (acude_id, uri, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(acude_id) DO UPDATE SET uri = excluded.uri, updated_at = excluded.updated_at;`,
    acudeId,
    uri,
    new Date().toISOString(),
  );
}

export async function removeCoverRecord(acudeId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM covers WHERE acude_id = ?;', acudeId);
}

export async function getCoverRecord(acudeId: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ uri: string }>(
    'SELECT uri FROM covers WHERE acude_id = ?;',
    acudeId,
  );
  return row?.uri ?? null;
}

export async function clearCovers(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM covers;');
}
