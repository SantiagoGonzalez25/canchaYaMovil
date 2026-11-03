import * as SecureStore from 'expo-secure-store';

import { API_URL } from '@/config/env';
import type { AuthResult, TokenSet, User } from '@/types';
import { ApiError, SessionExpiredError } from './errors';
import { fetchJson } from './fetch-json';

/**
 * Sesión segura: los tokens viven en expo-secure-store, nunca en SQLite ni en
 * AsyncStorage. El refreshToken permite renovar el idToken sin volver a pedir la
 * contraseña.
 */

const TOKENS_KEY = 'canchaya.tokens.v1';
const USER_KEY = 'canchaya.user.v1';
const EXPIRY_MARGIN_MS = 60_000;

export interface StoredTokens {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StoredSession {
  tokens: StoredTokens;
  user: User;
}

type SessionListener = (session: StoredSession | null) => void;

let cached: StoredSession | null | undefined;
let refreshPromise: Promise<StoredSession> | null = null;
const listeners = new Set<SessionListener>();

function notify(session: StoredSession | null): void {
  for (const listener of listeners) {
    try {
      listener(session);
    } catch {
      // Un listener no debe romper la sesión.
    }
  }
}

function isValidUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<User>;
  return (
    typeof user.uid === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    (user.role === 'student' || user.role === 'manager' || user.role === 'admin')
  );
}

function isValidSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<StoredSession>;
  return (
    isValidUser(session.user) &&
    !!session.tokens &&
    typeof session.tokens.idToken === 'string' &&
    typeof session.tokens.refreshToken === 'string' &&
    typeof session.tokens.expiresAt === 'number'
  );
}

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deleteSecure(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Si el almacenamiento ya no existe, no hay nada que borrar.
  }
}

export function toStoredSession(auth: AuthResult): StoredSession {
  return {
    tokens: {
      idToken: auth.tokens.idToken,
      refreshToken: auth.tokens.refreshToken,
      expiresAt: Date.now() + Math.max(0, auth.tokens.expiresIn) * 1000,
    },
    user: auth.user,
  };
}

async function persist(session: StoredSession): Promise<void> {
  await Promise.all([
    writeSecure(TOKENS_KEY, JSON.stringify(session.tokens)),
    writeSecure(USER_KEY, JSON.stringify(session.user)),
  ]);
  cached = session;
  notify(session);
}

export async function getSession(): Promise<StoredSession | null> {
  if (cached !== undefined) return cached;

  const [tokensRaw, userRaw] = await Promise.all([
    readSecure(TOKENS_KEY),
    readSecure(USER_KEY),
  ]);
  if (!tokensRaw || !userRaw) {
    cached = null;
    return null;
  }
  try {
    const session = {
      tokens: JSON.parse(tokensRaw) as StoredTokens,
      user: JSON.parse(userRaw) as User,
    };
    cached = isValidSession(session) ? session : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveSession(auth: AuthResult): Promise<StoredSession> {
  const session = toStoredSession(auth);
  await persist(session);
  return session;
}

export async function saveTokens(tokens: TokenSet, user: User): Promise<StoredSession> {
  return saveSession({ tokens, user });
}

export async function updateSessionUser(user: User): Promise<StoredSession | null> {
  const session = await getSession();
  if (!session) return null;
  const updated = { ...session, user };
  await persist(updated);
  return updated;
}

export async function clearSession(): Promise<void> {
  cached = null;
  refreshPromise = null;
  await Promise.all([deleteSecure(TOKENS_KEY), deleteSecure(USER_KEY)]);
  notify(null);
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Solo para pruebas: limpia la caché en memoria sin tocar SecureStore. */
export function resetSessionCacheForTests(): void {
  cached = undefined;
  refreshPromise = null;
  listeners.clear();
}

interface RefreshResponse {
  tokens: TokenSet;
  user: User;
}

async function performRefresh(refreshToken: string): Promise<StoredSession> {
  try {
    const data = await fetchJson<RefreshResponse>(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    const session = toStoredSession(data);
    await persist(session);
    return session;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.code === 'UNAUTHENTICATED')) {
      await clearSession();
      throw new SessionExpiredError();
    }
    throw error;
  }
}

/**
 * Devuelve un idToken fresco. Si está por vencer, renueva con el refreshToken.
 * Varias peticiones concurrentes comparten una sola renovación.
 */
export async function getValidIdToken(forceRefresh = false): Promise<string> {
  const session = await getSession();
  if (!session) throw new SessionExpiredError();

  const fresh = session.tokens.expiresAt - EXPIRY_MARGIN_MS > Date.now();
  if (!forceRefresh && fresh) return session.tokens.idToken;

  if (!refreshPromise) {
    refreshPromise = performRefresh(session.tokens.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  const refreshed = await refreshPromise;
  return refreshed.tokens.idToken;
}

export async function refreshSession(): Promise<StoredSession> {
  await getValidIdToken(true);
  const session = await getSession();
  if (!session) throw new SessionExpiredError();
  return session;
}

/** Solo pruebas del proveedor de sesión. */
export const sessionInternals = {
  TOKENS_KEY,
  USER_KEY,
  EXPIRY_MARGIN_MS,
};
