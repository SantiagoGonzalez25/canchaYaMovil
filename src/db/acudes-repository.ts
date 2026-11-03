import type { LiveAcude } from '@/types';
import { foldForSearch } from '@/lib/text';
import { getDatabase, parsePayload } from './database';

interface AcudeRow {
  payload: string;
}

/** Reemplaza la cartelera local completa: la API devuelve todos los publicados. */
export async function replaceCachedAcudes(
  acudes: LiveAcude[],
  cachedAt = new Date().toISOString(),
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM acudes_cache;');
    for (const acude of acudes) {
      await db.runAsync(
        `INSERT INTO acudes_cache
          (id, name, category, status, semester, search_text, payload, server_updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        acude.id,
        acude.name,
        acude.category,
        acude.status,
        acude.semester,
        foldForSearch(acude.name, acude.discipline, acude.teacherName, acude.description),
        JSON.stringify(acude),
        acude.updatedAt,
        cachedAt,
      );
    }
  });
}

export async function listCachedAcudes(): Promise<LiveAcude[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AcudeRow>('SELECT payload FROM acudes_cache ORDER BY name;');
  return rows.flatMap((row) => {
    try {
      return [parsePayload<LiveAcude>(row.payload)];
    } catch {
      return [];
    }
  });
}

export async function getCachedAcude(id: string): Promise<LiveAcude | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AcudeRow>(
    'SELECT payload FROM acudes_cache WHERE id = ?;',
    id,
  );
  if (!row) return null;
  try {
    return parsePayload<LiveAcude>(row.payload);
  } catch {
    return null;
  }
}

export async function countCachedAcudes(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM acudes_cache;');
  return row?.total ?? 0;
}

export async function clearCachedAcudes(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM acudes_cache;');
}
