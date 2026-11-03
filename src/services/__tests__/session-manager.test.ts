/* eslint-disable import/first -- jest.mock debe declararse antes de importar los módulos simulados. */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

import * as SecureStore from 'expo-secure-store';

import type { AuthResult, User } from '@/types';
import {
  clearSession,
  getSession,
  getValidIdToken,
  resetSessionCacheForTests,
  saveSession,
  subscribeSession,
  toStoredSession,
  updateSessionUser,
} from '@/services/session-manager';
import { SessionExpiredError } from '@/services/errors';

const secureStore = SecureStore as unknown as { __store: Map<string, string> };

const user: User = {
  uid: 'student-1',
  email: 'estudiante1@canchaya.demo',
  name: 'Estudiante Uno',
  role: 'student',
  sex: 'female',
};

function auth(expiresIn = 3600, idToken = 'token-1'): AuthResult {
  return {
    tokens: { idToken, refreshToken: 'refresh-1', expiresIn },
    user,
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('session manager', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    secureStore.__store.clear();
    resetSessionCacheForTests();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('guarda y recupera la sesión desde SecureStore', async () => {
    const saved = await saveSession(auth());
    expect(saved.tokens.idToken).toBe('token-1');

    resetSessionCacheForTests();
    const restored = await getSession();
    expect(restored?.user).toEqual(user);
    expect(restored?.tokens.refreshToken).toBe('refresh-1');
    expect(secureStore.__store.has('canchaya.tokens.v1')).toBe(true);
    expect(secureStore.__store.has('canchaya.user.v1')).toBe(true);
  });

  it('calcula el vencimiento del token', () => {
    const stored = toStoredSession(auth(120));
    expect(stored.tokens.expiresAt).toBeGreaterThanOrEqual(Date.now() + 119_000);
  });

  it('actualiza el perfil sin perder los tokens', async () => {
    await saveSession(auth());
    const updatedUser = { ...user, name: 'Nombre Actualizado' };
    const updated = await updateSessionUser(updatedUser);
    expect(updated?.user.name).toBe('Nombre Actualizado');
    expect(updated?.tokens.idToken).toBe('token-1');
    expect((await getSession())?.user.name).toBe('Nombre Actualizado');
  });

  it('notifica a los suscriptores y limpia la sesión', async () => {
    const listener = jest.fn();
    subscribeSession(listener);
    await saveSession(auth());
    await clearSession();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(await getSession()).toBeNull();
    expect(secureStore.__store.size).toBe(0);
  });

  it('devuelve el idToken vigente sin llamar al refresh', async () => {
    await saveSession(auth());
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(getValidIdToken()).resolves.toBe('token-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renueva el token vencido con el refreshToken', async () => {
    await saveSession(auth(0, 'token-viejo'));
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        tokens: { idToken: 'token-nuevo', refreshToken: 'refresh-2', expiresIn: 3600 },
        user,
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getValidIdToken()).resolves.toBe('token-nuevo');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect((await getSession())?.tokens.refreshToken).toBe('refresh-2');
  });

  it('lanza SessionExpiredError si no hay sesión', async () => {
    await expect(getValidIdToken()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
