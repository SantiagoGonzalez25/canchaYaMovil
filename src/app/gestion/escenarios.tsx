import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { PageHeader } from '@/components/page-header';
import { ScenarioForm } from '@/components/scenario-form';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong } from '@/lib/date';
import {
  SCENARIO_STATUS_LABELS,
  SCENARIO_TYPE_LABELS,
} from '@/lib/labels';
import {
  emptyScenarioDraft,
  scenarioDraftFrom,
} from '@/lib/scenario-form';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import {
  createScenario,
  deleteScenario,
  getScenarios,
  updateScenario,
} from '@/services/acudes-service';
import { errorMessage } from '@/services/errors';
import type { Scenario, ScenarioInput } from '@/types';

export default function EscenariosScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const isAdmin = user?.role === 'admin';

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isAdmin || !isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await getScenarios(controller.signal);
      if (controller.signal.aborted) return;
      setScenarios([...result].sort((a, b) => a.name.localeCompare(b.name, 'es')));
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

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (scenario: Scenario) => {
    setEditing(scenario);
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (input: ScenarioInput) => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateScenario(editing.id, input);
      } else {
        await createScenario(input);
      }
      setShowForm(false);
      setEditing(null);
      Alert.alert('Escenario guardado', 'Los cambios están disponibles para programar ACUDES.');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (scenario: Scenario) => {
    Alert.alert(
      'Eliminar escenario',
      `¿Eliminar “${scenario.name}”? Solo es posible si ningún ACUDE activo lo usa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setDeletingId(scenario.id);
            deleteScenario(scenario.id)
              .then(async () => {
                Alert.alert('Escenario eliminado', `“${scenario.name}” ya no está disponible.`);
                await load();
              })
              .catch((reason) => {
                Alert.alert('No puedes eliminar un escenario', errorMessage(reason));
                console.warn('[escenarios] no se pudo eliminar', reason);
              })
              .finally(() => setDeletingId(null));
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

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState
          title="Escenarios exclusivos del administrador"
          message="Solo una cuenta admin puede crear, editar o eliminar escenarios."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen
        edges={['left', 'right']}
        refreshing={loading && scenarios.length > 0}
        onRefresh={() => void load()}
      >
        <PageHeader
          eyebrow="Administración"
          title="Escenarios"
          subtitle="Canchas, coliseos, salones y auditorios donde se programan los ACUDES."
          right={
            <Pressable
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Crear escenario"
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="add" size={20} color={colors.onPrimary} />
              <ThemedText variant="caption" style={{ color: colors.onPrimary, fontWeight: '800' }}>
                Nuevo
              </ThemedText>
            </Pressable>
          }
        />

        {!isOnline ? (
          <InlineNotice
            tone="warning"
            icon="cloud-offline-outline"
            title="Necesitas conexión"
            message="Conéctate para consultar o modificar los escenarios."
          />
        ) : loading && scenarios.length === 0 ? (
          <LoadingState message="Cargando escenarios…" />
        ) : error ? (
          <EmptyState
            title="No pudimos cargar los escenarios"
            message={error}
            icon="alert-circle-outline"
            actionLabel="Reintentar"
            onAction={() => void load()}
          />
        ) : scenarios.length === 0 ? (
          <EmptyState
            title="Aún no hay escenarios"
            message="Crea el primero para poder programar franjas de ACUDES."
            icon="location-outline"
            actionLabel="Crear escenario"
            onAction={openCreate}
          />
        ) : (
          <View style={styles.list}>
            {scenarios.map((scenario) => (
              <View
                key={scenario.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.flex}>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={SCENARIO_STATUS_LABELS[scenario.status]}
                        tone={
                          scenario.status === 'available'
                            ? 'success'
                            : scenario.status === 'maintenance'
                              ? 'warning'
                              : 'neutral'
                        }
                      />
                      <Badge label={SCENARIO_TYPE_LABELS[scenario.type]} tone="neutral" />
                    </View>
                    <ThemedText variant="subtitle" style={styles.name}>
                      {scenario.name}
                    </ThemedText>
                    <ThemedText variant="bodySmall" tone="muted">
                      {scenario.location} · Capacidad {scenario.capacity}
                    </ThemedText>
                  </View>
                </View>

                {scenario.description ? (
                  <ThemedText variant="bodySmall" tone="muted">
                    {scenario.description}
                  </ThemedText>
                ) : null}

                <View style={styles.cardFooter}>
                  <ThemedText variant="caption" tone="subtle">
                    Actualizado {formatDateLong(scenario.updatedAt)}
                  </ThemedText>
                  <View style={styles.actions}>
                    <Button
                      title="Editar"
                      onPress={() => openEdit(scenario)}
                      variant="secondary"
                      size="sm"
                      icon="create-outline"
                    />
                    <Button
                      title="Eliminar"
                      onPress={() => confirmDelete(scenario)}
                      variant="dangerOutline"
                      size="sm"
                      icon="trash-outline"
                      loading={deletingId === scenario.id}
                      disabled={deletingId !== null}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.note, { borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSubtle} />
          <ThemedText variant="caption" tone="subtle" style={styles.flex}>
            Un escenario no puede tener dos ACUDES en la misma franja. Los cruces se bloquean
            automáticamente al crear o editar un ACUDE.
          </ThemedText>
        </View>
      </Screen>

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <Screen keyboard>
          <PageHeader
            eyebrow="Escenario"
            title={editing ? 'Editar escenario' : 'Nuevo escenario'}
            subtitle="Los cambios afectan la programación de franjas de los ACUDES."
          />
          <ScenarioForm
            key={editing?.id ?? 'new'}
            initial={editing ? scenarioDraftFrom(editing) : emptyScenarioDraft()}
            submitLabel={editing ? 'Guardar cambios' : 'Crear escenario'}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </Screen>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  list: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  name: { marginTop: spacing.xs },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
});
