import { randomUUID } from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { resolveApiUrl } from '@/config/env';
import { clearLocalDatabase } from '@/db/database';
import { listCachedAcudes } from '@/db/acudes-repository';
import {
  countConflictEnrollments,
  deleteLocalEnrollment,
  getLocalEnrollment,
  listLocalEnrollments,
} from '@/db/enrollments-repository';
import { metaKeys, getMeta, setMeta } from '@/db/meta-repository';
import {
  listCovers,
  removeCoverRecord,
  setCoverRecord,
} from '@/db/covers-repository';
import { countOutbox } from '@/db/outbox-repository';
import { errorMessage, isApiError, isNetworkError } from '@/services/errors';
import { clearCoverFiles, deleteCoverFile, persistCover } from '@/services/cover-service';
import { enrollOnline } from '@/services/enrollment-online';
import { queueCancellation, queueEnrollment } from '@/services/enrollment-service';
import { runSync } from '@/services/sync-service';
import type { LiveAcude, LiveScheduleSlot, LocalEnrollment, User } from '@/types';
import { useAuth } from './auth-provider';
import { useNetwork } from './network-provider';

export interface EnrollmentActionResult {
  ok: boolean;
  queued?: boolean;
  message: string;
}

interface DataState {
  ready: boolean;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  acudes: LiveAcude[];
  enrollments: LocalEnrollment[];
  covers: Record<string, string>;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
}

interface DataContextValue extends DataState {
  activeEnrollments: LocalEnrollment[];
  refresh: () => Promise<void>;
  enroll: (acude: LiveAcude, slot: LiveScheduleSlot) => Promise<EnrollmentActionResult>;
  cancel: (enrollment: LocalEnrollment) => Promise<EnrollmentActionResult>;
  clearConflict: (enrollmentId: string) => Promise<void>;
  applyCover: (acudeId: string, sourceUri: string) => Promise<void>;
  removeCover: (acudeId: string) => Promise<void>;
  coverUri: (acude: Pick<LiveAcude, 'id' | 'imageUrl'> | null | undefined) => string | undefined;
}

const initialState: DataState = {
  ready: false,
  loading: true,
  syncing: false,
  error: null,
  acudes: [],
  enrollments: [],
  covers: {},
  pendingCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
};

const DataContext = createContext<DataContextValue | null>(null);

interface LocalSnapshot {
  acudes: LiveAcude[];
  enrollments: LocalEnrollment[];
  covers: Record<string, string>;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
}

async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const [acudes, enrollments, covers, pendingCount, conflictCount, lastSyncedAt] =
    await Promise.all([
      listCachedAcudes(),
      listLocalEnrollments(),
      listCovers(),
      countOutbox(),
      countConflictEnrollments(),
      getMeta(metaKeys.lastSyncedAt),
    ]);
  return { acudes, enrollments, covers, pendingCount, conflictCount, lastSyncedAt };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const [state, setState] = useState<DataState>(initialState);

  const userRef = useRef<User | null>(user);
  const onlineRef = useRef(isOnline);
  const enrollmentsRef = useRef<LocalEnrollment[]>([]);
  const coversRef = useRef<Record<string, string>>({});
  const syncPromise = useRef<Promise<void> | null>(null);
  const wasOnline = useRef(isOnline);

  userRef.current = user;
  onlineRef.current = isOnline;

  const commitSnapshot = useCallback((snapshot: Partial<LocalSnapshot>) => {
    if (snapshot.enrollments) enrollmentsRef.current = snapshot.enrollments;
    if (snapshot.covers) coversRef.current = snapshot.covers;
    setState((prev) => ({ ...prev, ...snapshot }));
  }, []);

  const reloadLocal = useCallback(async () => {
    const snapshot = await loadLocalSnapshot();
    commitSnapshot(snapshot);
    return snapshot;
  }, [commitSnapshot]);

  /** Sincroniza con la API; si no hay red, solo recarga la caché local. */
  const performSync = useCallback(
    async (silent = false): Promise<void> => {
      const current = userRef.current;
      if (!current) return;
      if (syncPromise.current) return syncPromise.current;

      const promise = (async () => {
        setState((prev) => ({ ...prev, syncing: true, error: silent ? prev.error : null }));

        if (!onlineRef.current) {
          try {
            await reloadLocal();
          } finally {
            setState((prev) => ({ ...prev, syncing: false, ready: true, loading: false }));
          }
          return;
        }

        try {
          const result = await runSync(current);
          commitSnapshot({
            acudes: result.acudes,
            enrollments: result.enrollments,
            pendingCount: result.pendingCount,
            conflictCount: result.conflictCount,
            lastSyncedAt: result.lastSyncedAt,
          });
          setState((prev) => ({
            ...prev,
            syncing: false,
            ready: true,
            loading: false,
            error: result.error,
          }));
        } catch (error) {
          if (isApiError(error) && error.status === 401) {
            // El listener de sesión redirige al login; no mostramos un error rojo.
            setState((prev) => ({ ...prev, syncing: false, loading: false, ready: true }));
            return;
          }
          setState((prev) => ({
            ...prev,
            syncing: false,
            loading: false,
            ready: true,
            error: 'No pudimos actualizar la información. Inténtalo de nuevo.',
          }));
        }
      })().finally(() => {
        syncPromise.current = null;
      });

      syncPromise.current = promise;
      return promise;
    },
    [commitSnapshot, reloadLocal],
  );

  // Carga inicial de la caché y sincronización al entrar con una cuenta.
  useEffect(() => {
    let cancelled = false;

    if (status === 'loading') return;

    if (status === 'signedOut') {
      enrollmentsRef.current = [];
      coversRef.current = {};
      setState({ ...initialState, loading: false, ready: false });
      void Promise.all([clearLocalDatabase(), clearCoverFiles()]).catch(() => undefined);
      return;
    }

    const current = userRef.current;
    if (!current) return;

    (async () => {
      setState((prev) => ({ ...prev, loading: true, ready: false, error: null }));
      try {
        const owner = await getMeta(metaKeys.owner);
        if (owner && owner !== current.uid) {
          await clearLocalDatabase();
        }
        await setMeta(metaKeys.owner, current.uid);
        const snapshot = await loadLocalSnapshot();
        if (cancelled) return;
        commitSnapshot(snapshot);
        setState((prev) => ({
          ...prev,
          ...snapshot,
          ready: true,
          loading: false,
          error: null,
        }));
        void performSync(true);
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            ready: true,
            error: errorMessage(error),
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, user?.uid, commitSnapshot, performSync]);

  // Al recuperar la conexión se reintenta la cola automáticamente.
  useEffect(() => {
    if (isOnline && !wasOnline.current && status === 'signedIn' && state.ready) {
      void performSync(true);
    }
    wasOnline.current = isOnline;
  }, [isOnline, status, state.ready, performSync]);

  // Al volver a la app desde segundo plano se actualiza de forma silenciosa.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && userRef.current && onlineRef.current) {
        void performSync(true);
      }
    });
    return () => subscription.remove();
  }, [performSync]);

  // Si quedaron cambios pendientes, se reintenta cada 30 s mientras haya red.
  // Cubre el caso en que NetInfo no detecta una transición (por ejemplo, Wi-Fi
  // conectado pero sin internet y luego con internet).
  useEffect(() => {
    if (status !== 'signedIn' || !state.ready || !isOnline || state.pendingCount === 0) {
      return;
    }
    const timer = setInterval(() => void performSync(true), 30_000);
    return () => clearInterval(timer);
  }, [status, state.ready, state.pendingCount, isOnline, performSync]);

  const refresh = useCallback(async () => {
    await performSync(false);
  }, [performSync]);

  const enroll = useCallback(
    async (acude: LiveAcude, slot: LiveScheduleSlot): Promise<EnrollmentActionResult> => {
      const current = userRef.current;
      if (!current) {
        return { ok: false, message: 'Tu sesión expiró. Inicia sesión de nuevo.' };
      }
      if (current.role !== 'student') {
        return { ok: false, message: 'Solo los estudiantes pueden inscribirse a un ACUDE.' };
      }

      const clientRequestId = randomUUID();

      try {
        // En línea la API es la fuente de verdad: no se inserta nada en la
        // caché local hasta que el servidor confirme. Así un rechazo por
        // máximo de ACUDES, cruce o cupo no deja una fila "fantasma".
        if (onlineRef.current) {
          try {
            const { enrollment } = await enrollOnline({
              acude,
              slot,
              user: current,
              clientRequestId,
            });
            const next = [
              enrollment,
              ...enrollmentsRef.current.filter((item) => item.id !== enrollment.id),
            ];
            enrollmentsRef.current = next;
            setState((prev) => ({ ...prev, enrollments: next }));
            void performSync(true);
            return {
              ok: true,
              queued: false,
              message: 'Inscripción confirmada. Revisa “Mis ACUDES”.',
            };
          } catch (error) {
            if (!isNetworkError(error)) {
              return { ok: false, message: errorMessage(error) };
            }
            // La red cayó justo durante el envío. Se encola con el mismo
            // clientRequestId: si el servidor alcanzó a crearla, el reintento
            // es idempotente y no duplica la inscripción.
          }
        }

        const { enrollment } = await queueEnrollment({
          acude,
          slot,
          user: current,
          enrollments: enrollmentsRef.current,
          clientRequestId,
        });
        const next = [enrollment, ...enrollmentsRef.current];
        enrollmentsRef.current = next;
        setState((prev) => ({
          ...prev,
          enrollments: next,
          pendingCount: prev.pendingCount + 1,
        }));

        if (!onlineRef.current) {
          return {
            ok: true,
            queued: true,
            message: 'Inscripción guardada en el dispositivo. Se enviará al recuperar la conexión.',
          };
        }

        await performSync(true);
        const latest = (await listLocalEnrollments()).find(
          (item) => item.clientRequestId === enrollment.clientRequestId,
        );
        if (latest?.syncState === 'conflict') {
          return {
            ok: false,
            message: latest.syncError ?? 'El servidor rechazó la inscripción.',
          };
        }
        return {
          ok: true,
          queued: latest?.syncState === 'pending',
          message:
            latest?.syncState === 'pending'
              ? 'Inscripción guardada. Se confirmará al recuperar la conexión.'
              : 'Inscripción confirmada. Revisa “Mis ACUDES”.',
        };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },
    [performSync],
  );

  const cancel = useCallback(
    async (enrollment: LocalEnrollment): Promise<EnrollmentActionResult> => {
      try {
        const outcome = await queueCancellation(enrollment);
        let next: LocalEnrollment[];
        if (outcome.mode === 'removed') {
          next = enrollmentsRef.current.filter((item) => item.id !== enrollment.id);
        } else {
          next = enrollmentsRef.current.map((item) =>
            outcome.enrollment && item.id === outcome.enrollment.id ? outcome.enrollment : item,
          );
        }
        enrollmentsRef.current = next;
        const pendingCount = await countOutbox().catch(() => 0);
        setState((prev) => ({ ...prev, enrollments: next, pendingCount }));

        if (outcome.mode === 'removed') {
          return {
            ok: true,
            queued: false,
            message: 'Inscripción eliminada. Aún no había llegado al servidor.',
          };
        }

        if (onlineRef.current) {
          await performSync(true);
          const latest = await getLocalEnrollment(enrollment.id);
          if (latest?.syncState === 'conflict') {
            return {
              ok: false,
              message: latest.syncError ?? 'El servidor rechazó la cancelación.',
            };
          }
          return { ok: true, queued: false, message: 'Inscripción cancelada. Cupo liberado.' };
        }

        return {
          ok: true,
          queued: true,
          message: 'Cancelación guardada. Se enviará al recuperar la conexión.',
        };
      } catch (error) {
        return { ok: false, message: errorMessage(error) };
      }
    },
    [performSync],
  );

  const clearConflict = useCallback(async (enrollmentId: string) => {
    await deleteLocalEnrollment(enrollmentId);
    const [enrollments, pendingCount, conflictCount] = await Promise.all([
      listLocalEnrollments(),
      countOutbox(),
      countConflictEnrollments(),
    ]);
    enrollmentsRef.current = enrollments;
    setState((prev) => ({ ...prev, enrollments, pendingCount, conflictCount }));
  }, []);

  const applyCover = useCallback(async (acudeId: string, sourceUri: string) => {
    const previous = coversRef.current[acudeId];
    const uri = await persistCover(acudeId, sourceUri);
    await setCoverRecord(acudeId, uri);
    await deleteCoverFile(previous);
    const covers = { ...coversRef.current, [acudeId]: uri };
    coversRef.current = covers;
    setState((prev) => ({ ...prev, covers }));
  }, []);

  const removeCover = useCallback(async (acudeId: string) => {
    const previous = coversRef.current[acudeId];
    await removeCoverRecord(acudeId);
    await deleteCoverFile(previous);
    const covers = { ...coversRef.current };
    delete covers[acudeId];
    coversRef.current = covers;
    setState((prev) => ({ ...prev, covers }));
  }, []);

  const coverUri = useCallback(
    (acude: Pick<LiveAcude, 'id' | 'imageUrl'> | null | undefined) => {
      if (!acude) return undefined;
      return state.covers[acude.id] ?? resolveApiUrl(acude.imageUrl) ?? undefined;
    },
    [state.covers],
  );

  const activeEnrollments = useMemo(
    () => state.enrollments.filter((item) => item.status === 'active'),
    [state.enrollments],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      activeEnrollments,
      refresh,
      enroll,
      cancel,
      clearConflict,
      applyCover,
      removeCover,
      coverUri,
    }),
    [
      state,
      activeEnrollments,
      refresh,
      enroll,
      cancel,
      clearConflict,
      applyCover,
      removeCover,
      coverUri,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData debe usarse dentro de DataProvider');
  return context;
}
