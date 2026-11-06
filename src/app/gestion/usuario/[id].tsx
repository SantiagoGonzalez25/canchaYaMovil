import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong } from '@/lib/date';
import { WEEKDAY_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { errorMessage } from '@/services/errors';
import { cancelEnrollment } from '@/services/enrollments-service';
import { getUserEnrollments } from '@/services/auth-service';
import type { Enrollment } from '@/types';

export default function AdminUserEnrollmentsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!userId || user?.role !== 'admin' || !isOnline) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      setItems(await getUserEnrollments(userId, controller.signal));
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isOnline, user?.role, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const confirmRemove = (item: Enrollment) => {
    Alert.alert(
      'Quitar del ACUDE',
      `¿Quitar esta inscripción a “${item.acudeName}”? El cupo se liberará y el historial se conserva.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            setCancelingId(item.id);
            try {
              await cancelEnrollment(item.id);
              await load();
            } catch (reason) {
              Alert.alert('No se pudo quitar', errorMessage(reason));
            } finally {
              setCancelingId(null);
            }
          },
        },
      ],
    );
  };

  if (status === 'loading') {
    return (
      <Screen>
        <LoadingState message="Recuperando tu sesión…" />
      </Screen>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;
  if (user.role !== 'admin') {
    return (
      <Screen>
        <EmptyState
          title="Solo administradores"
          message="Esta vista está reservada al administrador."
          icon="lock-closed-outline"
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} refreshing={loading} onRefresh={() => void load()}>
      <PageHeader
        eyebrow="Usuarios"
        title="Inscripciones del usuario"
        subtitle="Consulta sus ACUDES y quita una inscripción activa si es necesario."
      />
      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Necesitas conexión"
          message="La gestión de inscripciones requiere conexión."
        />
      ) : loading ? (
        <LoadingState message="Cargando inscripciones…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar el historial"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin inscripciones"
          message="Este usuario no tiene inscripciones registradas."
          icon="bookmark-outline"
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.top}>
                <View style={styles.flex}>
                  <ThemedText variant="label">{item.acudeName}</ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {WEEKDAY_LABELS[item.day]} · {item.startTime}–{item.endTime}
                  </ThemedText>
                  <ThemedText variant="caption" tone="subtle">
                    {item.scenarioName} · {item.teacherName}
                  </ThemedText>
                  <ThemedText variant="caption" tone="subtle">
                    Inscrito el {formatDateLong(item.enrolledAt)}
                  </ThemedText>
                </View>
                <Badge
                  label={item.status === 'active' ? 'Activa' : 'Cancelada'}
                  tone={item.status === 'active' ? 'success' : 'neutral'}
                />
              </View>
              {item.status === 'active' ? (
                <Button
                  title="Quitar del ACUDE"
                  onPress={() => confirmRemove(item)}
                  loading={cancelingId === item.id}
                  disabled={cancelingId !== null}
                  variant="dangerOutline"
                  icon="person-remove-outline"
                  size="sm"
                  fullWidth
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
