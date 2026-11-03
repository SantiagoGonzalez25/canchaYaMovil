import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { SearchField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { categoryColors, radius, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong } from '@/lib/date';
import { ACUDE_STATUS_LABELS, CATEGORY_LABELS } from '@/lib/labels';
import { foldForSearch } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { listAcudes } from '@/services/acudes-service';
import { errorMessage } from '@/services/errors';
import type { Acude, AcudeStatus } from '@/types';

type StatusFilter = AcudeStatus | 'all';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'published', label: ACUDE_STATUS_LABELS.published },
  { value: 'draft', label: ACUDE_STATUS_LABELS.draft },
  { value: 'archived', label: ACUDE_STATUS_LABELS.archived },
];

export default function GestionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors, isDark } = useAppTheme();

  const [acudes, setAcudes] = useState<Acude[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const requestRef = useRef<AbortController | null>(null);

  const isAdmin = user?.role === 'admin';
  const isStaff = isAdmin || user?.role === 'manager';

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isStaff || !isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await listAcudes({}, controller.signal);
      if (controller.signal.aborted) return;
      setAcudes(result.acudes);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isOnline, isStaff]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      all: acudes.length,
      published: 0,
      draft: 0,
      archived: 0,
    };
    for (const acude of acudes) {
      if (acude.status in result) result[acude.status] += 1;
    }
    return result;
  }, [acudes]);

  const filtered = useMemo(() => {
    const search = foldForSearch(query);
    return acudes.filter((acude) => {
      if (status !== 'all' && acude.status !== status) return false;
      if (
        search &&
        !foldForSearch(
          acude.name,
          acude.discipline,
          acude.teacherName,
          acude.semester,
          acude.description,
        ).includes(search)
      ) {
        return false;
      }
      return true;
    });
  }, [acudes, query, status]);

  if (!isStaff) {
    return (
      <Screen>
        <EmptyState
          title="Gestión de ACUDES"
          message="Esta sección está disponible para profesores y administradores."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  const hasFilters = query.trim().length > 0 || status !== 'all';

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={loading && acudes.length > 0}
      onRefresh={() => void load()}
    >
      <PageHeader
        eyebrow={isAdmin ? 'Administración' : 'Gestión'}
        title={isAdmin ? 'Gestión de ACUDES' : 'Mi ACUDE'}
        subtitle={
          isAdmin
            ? 'Crea, publica, edita y archiva la oferta de actividades del semestre.'
            : 'Consulta la programación de los ACUDES que tienes asignados.'
        }
        right={
          isAdmin ? (
            <Pressable
              onPress={() => router.push('/gestion/nuevo')}
              accessibilityRole="button"
              accessibilityLabel="Crear un ACUDE"
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
          ) : undefined
        }
      />

      {isAdmin ? (
        <View style={styles.quickActions}>
          <Button
            title="Escenarios"
            onPress={() => router.push('/gestion/escenarios')}
            variant="secondary"
            icon="location-outline"
            style={styles.flex}
          />
          <Button
            title="Profesores"
            onPress={() => router.push('/gestion/usuarios')}
            variant="secondary"
            icon="people-outline"
            style={styles.flex}
          />
        </View>
      ) : null}

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nombre, docente o disciplina"
        accessibilityLabel="Buscar ACUDES"
      />

      <View style={styles.filters}>
        {STATUS_FILTERS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            count={counts[option.value]}
            active={status === option.value}
            onPress={() => setStatus(option.value)}
          />
        ))}
      </View>

      <ThemedText variant="caption" tone="muted">
        {acudes.length} ACUDE{acudes.length === 1 ? '' : 'S'} en total · {filtered.length} en la
        vista
      </ThemedText>

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Necesitas conexión"
          message="Conéctate para crear, editar o archivar ACUDES."
        />
      ) : null}

      {loading && acudes.length === 0 ? (
        <LoadingState message="Cargando el catálogo de gestión…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar los ACUDES"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : !isOnline && acudes.length === 0 ? (
        <EmptyState
          title="Sin datos para gestionar"
          message="Conéctate para cargar el catálogo de ACUDES."
          icon="cloud-offline-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? 'Sin resultados'
              : isAdmin
                ? 'Todavía no hay ACUDES'
                : 'No tienes ACUDES asignados'
          }
          message={
            hasFilters
              ? 'Prueba con otro término de búsqueda o cambia el estado seleccionado.'
              : isAdmin
                ? 'Crea el primer ACUDE para que aparezca en la cartelera de los estudiantes.'
                : 'Cuando el administrador te asigne un ACUDE, aparecerá aquí.'
          }
          icon={hasFilters ? 'search-outline' : 'calendar-outline'}
          actionLabel={hasFilters ? 'Limpiar filtros' : isAdmin ? 'Crear ACUDE' : undefined}
          onAction={
            hasFilters
              ? () => {
                  setQuery('');
                  setStatus('all');
                }
              : isAdmin
                ? () => router.push('/gestion/nuevo')
                : undefined
          }
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((acude) => {
            const category = categoryColors(acude.category, isDark);
            const days = new Set(acude.schedule.map((slot) => slot.day)).size;
            return (
              <Pressable
                key={acude.id}
                onPress={() => router.push(`/gestion/${acude.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${acude.name}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <View style={[styles.accent, { backgroundColor: category.solid }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={styles.flex}>
                      <ThemedText variant="subtitle">{acude.name}</ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {CATEGORY_LABELS[acude.category]} · {acude.discipline}
                      </ThemedText>
                    </View>
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
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={14} color={colors.textSubtle} />
                    <ThemedText variant="caption" tone="muted" style={styles.flex}>
                      {acude.teacherName} · Semestre {acude.semester}
                    </ThemedText>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSubtle} />
                    <ThemedText variant="caption" tone="muted" style={styles.flex}>
                      {acude.schedule.length} franja{acude.schedule.length === 1 ? '' : 's'} · {days}{' '}
                      día{days === 1 ? '' : 's'} · {acude.maxCapacity} cupos
                    </ThemedText>
                  </View>
                  <View style={styles.cardBottom}>
                    <ThemedText variant="caption" tone="subtle">
                      Actualizado el {formatDateLong(acude.updatedAt)}
                    </ThemedText>
                    <View style={styles.editHint}>
                      <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                        {isAdmin ? 'Editar' : 'Ver ficha'}
                      </ThemedText>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.md, marginTop: spacing.md },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  accent: { width: 5 },
  cardBody: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
