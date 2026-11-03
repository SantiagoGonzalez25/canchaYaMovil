import * as SQLite from 'expo-sqlite';

import type { LocalEnrollment } from '@/types';

/**
 * Base local (offline-first). Guarda la cartelera, las inscripciones y la cola
 * de operaciones pendientes. La API sigue siendo la fuente de verdad: esta base
 * solo permite consultar y operar sin conexión.
 */

const DATABASE_NAME = 'canchaya.db';
const DATABASE_VERSION = 2;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS acudes_cache (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  semester TEXT NOT NULL,
  search_text TEXT NOT NULL,
  payload TEXT NOT NULL,
  server_updated_at TEXT NOT NULL,
  cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acudes_category ON acudes_cache(category);
CREATE INDEX IF NOT EXISTS idx_acudes_name ON acudes_cache(name);

CREATE TABLE IF NOT EXISTS enrollments_cache (
  id TEXT PRIMARY KEY NOT NULL,
  acude_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  /* Nullable: algunas respuestas históricas de la API no traen semestre. */
  semester TEXT,
  user_id TEXT NOT NULL,
  client_request_id TEXT,
  payload TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT,
  server_updated_at TEXT,
  cached_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enrollments_acude ON enrollments_cache(acude_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments_cache(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments_cache(user_id);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);

CREATE TABLE IF NOT EXISTS covers (
  acude_id TEXT PRIMARY KEY NOT NULL,
  uri TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const MIGRATION_V2 = `
CREATE TABLE IF NOT EXISTS enrollments_cache_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  acude_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  semester TEXT,
  user_id TEXT NOT NULL,
  client_request_id TEXT,
  payload TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  sync_error TEXT,
  server_updated_at TEXT,
  cached_at TEXT NOT NULL
);
INSERT OR REPLACE INTO enrollments_cache_v2
  (id, acude_id, slot_id, status, semester, user_id, client_request_id, payload,
   sync_state, sync_error, server_updated_at, cached_at)
SELECT
  id, acude_id, slot_id, status, semester, user_id, client_request_id, payload,
  sync_state, sync_error, server_updated_at, cached_at
FROM enrollments_cache;
DROP TABLE enrollments_cache;
ALTER TABLE enrollments_cache_v2 RENAME TO enrollments_cache;
CREATE INDEX IF NOT EXISTS idx_enrollments_acude ON enrollments_cache(acude_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments_cache(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments_cache(user_id);
`;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    return;
  }

  if (version < 2) {
    const columns = await db.getAllAsync<{ name: string; notnull: number }>(
      'PRAGMA table_info(enrollments_cache);',
    );
    const semester = columns.find((column) => column.name === 'semester');
    if (semester?.notnull === 1) {
      await db.execAsync(MIGRATION_V2);
    }
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return databasePromise;
}

/** Borra todos los datos locales. Se usa al cerrar sesión o cambiar de usuario. */
export async function clearLocalDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM acudes_cache;
    DELETE FROM enrollments_cache;
    DELETE FROM outbox;
    DELETE FROM covers;
    DELETE FROM app_meta;
  `);
}

/** Solo para pruebas: cierra la conexión en memoria. */
export async function resetDatabaseForTests(): Promise<void> {
  if (!databasePromise) return;
  const db = await databasePromise;
  await db.closeAsync();
  databasePromise = null;
}

export function parsePayload<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

export function serializeEnrollment(enrollment: LocalEnrollment): string {
  return JSON.stringify(enrollment);
}

export { SCHEMA_V1, DATABASE_NAME };
