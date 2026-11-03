import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AcudeForm } from '@/components/acude-form';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { createEmptyDraft } from '@/lib/acude-form';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { createAcude, getScenarios } from '@/services/acudes-service';
import { getManagers } from '@/services/auth-service';
import { errorMessage } from '@/services/errors';
import type { AcudeInput, Scenario, UserProfile } from '@/types';

export default function NuevoAcudeScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const isAdmin = user?.role === 'admin';

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isAdmin || !isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [scenarioResult, managerResult] = await Promise.all([
        getScenarios(controller.signal),
        getManagers(controller.signal).catch(() => [] as UserProfile[]),
      ]);
      if (controller.signal.aborted) return;
      setScenarios(scenarioResult);
      setManagers(managerResult);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isAdmin, isOnline]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const handleSubmit = async (input: AcudeInput) => {
    setSubmitting(true);
    try {
      const acude = await createAcude(input);
      Alert.alert(
        'ACUDE creado',
        `“${acude.name}” se guardó como ${acude.status === 'published' ? 'publicado' : acude.status === 'draft' ? 'borrador' : 'archivado'}.`,
        [{ text: 'Continuar', onPress: () => router.back() }],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Screen keyboard>
        <LoadingState message="Recuperando tu sesión…" />
      </Screen>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;

  if (!isAdmin) {
    return (
      <Screen keyboard>
        <EmptyState
          title="Acción reservada al administrador"
          message="Solo una cuenta con rol admin puede crear ACUDES."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={['left', 'right']}>
      <PageHeader
        eyebrow="Nuevo ACUDE"
        title="Crear actividad"
        subtitle="Define el grupo, el docente, los cupos y las franjas semanales."
      />

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Necesitas conexión"
          message="Conéctate para crear y guardar el ACUDE."
        />
      ) : loading ? (
        <LoadingState message="Cargando escenarios…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar los escenarios"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : (
        <AcudeForm
          initial={createEmptyDraft(scenarios)}
          scenarios={scenarios}
          managers={managers}
          submitLabel="Crear ACUDE"
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      )}
    </Screen>
  );
}
