import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { RegisterInput, User } from '@/types';
import { fetchMe, login as apiLogin, register as apiRegister } from '@/services/auth-service';
import { isApiError, NetworkError } from '@/services/errors';
import { useNetwork } from './network-provider';
import {
  clearSession,
  getSession,
  saveSession,
  subscribeSession,
  updateSessionUser,
} from '@/services/session-manager';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useNetwork();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    const applySessionUser = (next: User | null) => {
      if (!active) return;
      setUser(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    };

    const unsubscribe = subscribeSession((session) => {
      applySessionUser(session?.user ?? null);
    });

    (async () => {
      const session = await getSession();
      if (!active) return;
      if (session) {
        applySessionUser(session.user);
        try {
          const fresh = await fetchMe();
          if (!active) return;
          const updated = await updateSessionUser(fresh);
          if (updated) applySessionUser(updated.user);
        } catch (error) {
          // Sin red se conserva el perfil guardado. Un 401 ya limpia la sesión
          // mediante el listener de session-manager.
          if (isApiError(error) && error.status === 401) applySessionUser(null);
        }
      } else {
        applySessionUser(null);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isOnline) {
        throw new NetworkError('Necesitas conexión a internet para iniciar sesión.');
      }
      const result = await apiLogin({ email, password });
      await saveSession(result);
      setUser(result.user);
      setStatus('signedIn');
    },
    [isOnline],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      if (!isOnline) {
        throw new NetworkError('Necesitas conexión a internet para crear tu cuenta.');
      }
      const result = await apiRegister(input);
      await saveSession(result);
      setUser(result.user);
      setStatus('signedIn');
    },
    [isOnline],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!isOnline) {
      throw new NetworkError('Necesitas conexión a internet para actualizar tu perfil.');
    }
    const fresh = await fetchMe();
    const updated = await updateSessionUser(fresh);
    if (updated) setUser(updated.user);
  }, [isOnline]);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut, refreshProfile }),
    [status, user, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
