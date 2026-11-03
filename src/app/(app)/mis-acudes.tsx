import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ConnectionBanner } from '@/components/connection-banner';
import { EnrollmentCard } from '@/components/enrollment-card';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { MAX_ACUDES_PER_SEMESTER } from '@/lib/enrollment-rules';
import { WEEKDAYS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import type { LocalEnrollment } from '@/types';

function sortEnrollments(items: LocalEnrollment[]): LocalEnrollment[] {
  return [...items].sort((a, b) => {
    const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

export default function MisAcudesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const {
    enrollments,
    activeEnrollments,
    loading,
    syncing,
    error,
    refresh,
    cancel,
    clearConflict,
  } = useData();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      sortEnrollments(
        enrollments.filter(
          (item) => item.status === 'active' || item.syncState !== 'synced',
        ),
      ),
    [enrollments],
  );

  if (user?.role !== 'student') return <Redirect href="/(app)/ocupacion" />;

  const used = Math.min(activeEnrollments.length, MAX_ACUDES_PER_SEMESTER);
  const full = activeEnrollments.length >= MAX_ACUDES_PER_SEMESTER;

  const confirmCancel = (enrollment: LocalEnrollment) => {
    Alert.alert(
      'Cancelar inscripción',
      `¿Quieres cancelar tu inscripción a “${enrollment.acudeName}”? El cupo se libera de inmediato.`,
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelingId(enrollment.id);
            const result = await cancel(enrollment);
            setCancelingId(null);
            if (!result.ok) {
              Alert.alert('No se pudo cancelar', result.message);
            }
          },
        },
      ],
    );
  };

  const dismissConflict = (enrollment: LocalEnrollment) => {
    Alert.alert(
      'Descartar aviso',
      'Se quitará este aviso. El estado real de tus inscripciones se conserva.',
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => void clearConflict(enrollment.id),
        },
      ],
    );
  };

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={syncing}
      onRefresh={() => void refresh()}
    >
      <PageHeader
        eyebrow="Mi semestre"
        title="Mis ACUDES"
        subtitle="Tus inscripciones activas y los cambios más recientes."
      />
      <ConnectionBanner />

      <View
        style={[
          styles.limitCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.limitHeader}>
          <View style={styles.flex}>
            <ThemedText variant="label">Cupos de inscripción</ThemedText>
            <ThemedText variant="caption" tone="muted">
              Máximo {MAX_ACUDES_PER_SEMESTER} ACUDES activos por semestre.
            </ThemedText>
          </View>
          <ThemedText variant="heading" tone={full ? 'warning' : 'primary'}>
            {used}/{MAX_ACUDES_PER_SEMESTER}
          </ThemedText>
        </View>
        <View style={styles.segments}>
          {Array.from({ length: MAX_ACUDES_PER_SEMESTER }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    index < used ? (full ? colors.warning : colors.primary) : colors.surfaceAlt,
                },
              ]}
            />
          ))}
        </View>
        {full ? (
          <ThemedText variant="caption" tone="warning">
            Ya usaste tus dos cupos. Cancela uno para inscribirte en otro ACUDE.
          </ThemedText>
        ) : (
          <ThemedText variant="caption" tone="subtle">
            Aún puedes inscribirte en {MAX_ACUDES_PER_SEMESTER - used} ACUDE
            {MAX_ACUDES_PER_SEMESTER - used === 1 ? '' : 's'} más.
          </ThemedText>
        )}
      </View>

      {error ? (
        <InlineNotice
          tone="warning"
          title="No pudimos actualizar"
          message={error}
          actionLabel="Reintentar"
          onAction={() => void refresh()}
        />
      ) : null}

      {loading && visible.length === 0 ? (
        <View style={styles.loading}>
          <ThemedText variant="bodySmall" tone="muted">
            Cargando tus inscripciones…
          </ThemedText>
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No tienes ACUDES inscritos"
          message="Explora la cartelera y elige una franja horaria que se acomode a tu semestre."
          icon="bookmark-outline"
          actionLabel="Explorar cartelera"
          onAction={() => router.push('/(app)/cartelera')}
        />
      ) : (
        <View style={styles.list}>
          <View style={styles.listHeader}>
            <ThemedText variant="subtitle">
              {visible.length} {visible.length === 1 ? 'registro' : 'registros'}
            </ThemedText>
            <Ionicons name="bookmark-outline" size={18} color={colors.textSubtle} />
          </View>
          {visible.map((enrollment) => (
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              canceling={cancelingId === enrollment.id}
              onCancel={() => confirmCancel(enrollment)}
              onDismissConflict={() => dismissConflict(enrollment)}
            />
          ))}
        </View>
      )}

      <InlineNotice
        tone="info"
        icon="sync-outline"
        title="Tus cambios están guardados"
        message="Las inscripciones y cancelaciones se enviarán automáticamente cuando vuelvas a estar en línea. Si no se pueden aplicar, verás el motivo aquí."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  limitCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, height: 8, borderRadius: 999 },
  loading: { paddingVertical: spacing.huge, alignItems: 'center' },
  list: {},
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
