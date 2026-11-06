import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { AcudeCoverManager } from '@/components/acude-cover-manager';
import { AcudeForm } from '@/components/acude-form';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { draftFromInput } from '@/lib/acude-form';
import { formatDateLong } from '@/lib/date';
import {
  ACUDE_STATUS_LABELS,
  CATEGORY_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import {
  archiveAcude,
  getAcude,
  getScenarios,
  toAcudeInput,
  updateAcude,
} from '@/services/acudes-service';
import { getManagers } from '@/services/auth-service';
import { errorMessage } from '@/services/errors';
import type { Acude, AcudeInput, Scenario, UserProfile } from '@/types';

export default function EditarAcudeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const acudeId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const isAdmin = user?.role === 'admin';
  const isStaff = isAdmin || user?.role === 'manager';

  const [acude, setAcude] = useState<Acude | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isStaff || !acudeId || !isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [acudeResult, scenarioResult, managerResult] = await Promise.all([
        getAcude(acudeId, controller.signal),
        getScenarios(controller.signal),
        isAdmin
          ? getManagers(controller.signal).catch(() => [] as UserProfile[])
          : Promise.resolve([] as UserProfile[]),
      ]);
      if (controller.signal.aborted) return;
      setAcude(acudeResult);
      setScenarios(scenarioResult);
      setManagers(managerResult);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [acudeId, isAdmin, isOnline, isStaff]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const handleSubmit = async (input: AcudeInput) => {
    if (!acudeId) return;
    setSubmitting(true);
    try {
      const updated = await updateAcude(acudeId, input);
      setAcude(updated);
      Alert.alert('Cambios guardados', `“${updated.name}” se actualizó correctamente.`, [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Volver', onPress: () => router.back() },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!acudeId) return;
    setArchiving(true);
    try {
      const archived = await archiveAcude(acudeId);
      setAcude(archived);
      Alert.alert('ACUDE archivado', `“${archived.name}” ya no aparece en la cartelera.`, [
        { text: 'Entendido', onPress: () => router.back() },
      ]);
    } finally {
      setArchiving(false);
    }
  };

  if (status === 'loading') {
    return (
      <Screen>
        <LoadingState message="Recuperando tu sesión…" />
      </Screen>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;

  if (!isStaff) {
    return (
      <Screen>
        <EmptyState
          title="ACUDES del equipo académico"
          message="Esta sección está disponible para profesores y administradores."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  if (!acudeId) {
    return (
      <Screen>
        <EmptyState
          title="ACUDE no indicado"
          message="No recibimos el identificador del ACUDE que quieres editar."
          icon="alert-circle-outline"
          actionLabel="Volver a gestión"
          onAction={() => router.replace('/(app)/gestion')}
        />
      </Screen>
    );
  }

  const scenarioName = (scenarioId: string) =>
    scenarios.find((scenario) => scenario.id === scenarioId)?.name ?? 'Escenario por asignar';

  return (
    <Screen keyboard={isAdmin} edges={['left', 'right']}>
      <Stack.Screen options={{ title: isAdmin ? 'Editar ACUDE' : 'Mi ACUDE' }} />
      <PageHeader
        eyebrow={
          acude
            ? isAdmin
              ? 'Editar ACUDE'
              : `${ACUDE_STATUS_LABELS[acude.status]} · ${CATEGORY_LABELS[acude.category]}`
            : isAdmin
              ? 'Editar ACUDE'
              : 'Mi ACUDE'
        }
        title={acude?.name ?? (isAdmin ? 'Editar actividad' : 'Mi ACUDE')}
        subtitle={
          acude
            ? `${acude.discipline} · Semestre ${acude.semester} · Actualizado el ${formatDateLong(acude.updatedAt)}`
            : isAdmin
              ? 'Administra los datos, horarios y cupos del ACUDE.'
              : 'Consulta la programación de tu ACUDE.'
        }
        right={
          !isAdmin && acude ? (
            <Badge
              label={ACUDE_STATUS_LABELS[acude.status]}
              tone={
                acude.status === 'published'
                  ? 'success'
                  : acude.status === 'draft'
                    ? 'warning'
                    : 'neutral'
              }
            />
          ) : undefined
        }
      />

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Necesitas conexión"
          message={
            isAdmin
              ? 'Conéctate para cargar y guardar los cambios del ACUDE.'
              : 'Conéctate para consultar la programación de tu ACUDE.'
          }
        />
      ) : loading ? (
        <LoadingState message="Cargando el ACUDE…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar el ACUDE"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : !acude ? (
        <EmptyState
          title="ACUDE no disponible"
          message="Puede que haya sido eliminado o que no tengas permisos para verlo."
          icon="alert-circle-outline"
          actionLabel="Volver a gestión"
          onAction={() => router.replace('/(app)/gestion')}
        />
      ) : isAdmin ? (
        <>
          <AcudeCoverManager acude={acude} onChange={setAcude} />
          <AcudeForm
            key={acude.id}
            initial={draftFromInput(toAcudeInput(acude))}
            scenarios={scenarios}
            managers={managers}
            submitLabel="Guardar cambios"
            submitting={submitting}
            onSubmit={handleSubmit}
            onArchive={acude.status === 'archived' ? undefined : handleArchive}
            archiving={archiving}
          />
        </>
      ) : (
        <>
          {acude.status === 'draft' ? (
            <InlineNotice
              tone="info"
              icon="document-text-outline"
              title="ACUDE en borrador"
              message="Puedes revisar su programación y pasar asistencia. La ficha pública estará disponible cuando el administrador lo publique."
            />
          ) : acude.status === 'archived' ? (
            <InlineNotice
              tone="neutral"
              icon="archive-outline"
              title="ACUDE archivado"
              message="Su histórico se conserva, pero no aparece en la cartelera."
            />
          ) : null}

          <SectionHeader title="Programación semanal" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {acude.schedule.map((slot) => {
              const capacity = slot.maxCapacity ?? acude.maxCapacity;
              const enrolled = acude.slotEnrolled[slot.id] ?? 0;
              return (
                <View key={slot.id} style={styles.slotRow}>
                  <View style={styles.flex}>
                    <ThemedText variant="label">
                      {WEEKDAY_LABELS[slot.day]} · {slot.startTime}–{slot.endTime}
                    </ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {scenarioName(slot.scenarioId)}
                    </ThemedText>
                  </View>
                  <Badge
                    label={`${enrolled}/${capacity} inscritos`}
                    tone={enrolled >= capacity ? 'warning' : 'primary'}
                  />
                </View>
              );
            })}
          </View>

          <SectionHeader title="Información académica" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <InfoRow label="Docente" value={acude.teacherName} />
            <InfoRow label="Disciplina" value={acude.discipline} />
            <InfoRow label="Semestre" value={acude.semester} />
            <InfoRow label="Asistencia mínima" value={`${acude.attendanceMin}%`} />
            <InfoRow
              label="Requisitos"
              value={acude.requirements || 'Carné institucional y vestimenta adecuada.'}
            />
          </View>

          {acude.status === 'published' || isAdmin ? (
            <Button
              title="Pasar asistencia"
              onPress={() =>
                router.push(
                  `/(app)/asistencia?acudeId=${encodeURIComponent(acude.id)}`,
                )
              }
              icon="checkbox-outline"
              size="lg"
              fullWidth
              style={styles.attendanceButton}
            />
          ) : (
            <InlineNotice
              tone="info"
              icon="information-circle-outline"
              title="Asistencia"
              message="Publica este ACUDE para poder pasar asistencia."
            />
          )}
          {acude.status === 'published' ? (
            <Button
              title="Ver ficha pública"
              onPress={() => router.push(`/acude/${acude.id}`)}
              variant="secondary"
              icon="arrow-forward-outline"
              iconPosition="right"
              fullWidth
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="overline" tone="subtle">
        {label}
      </ThemedText>
      <ThemedText variant="bodySmall">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoRow: { gap: 1, paddingBottom: spacing.sm },
  attendanceButton: { marginTop: spacing.sm },
});
