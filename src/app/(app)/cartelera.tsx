import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AcudeCard } from '@/components/acude-card';
import { CategoryFilter } from '@/components/chips';
import { ConnectionBanner } from '@/components/connection-banner';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, ListStateView } from '@/components/state-views';
import { SearchField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { resolveListStatus } from '@/lib/list-status';
import { foldForSearch } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { getLiveAcudes } from '@/services/acudes-service';
import type { AcudeCategory, LiveAcude } from '@/types';

export default function CarteleraScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const {
    acudes,
    loading,
    syncing,
    error,
    refresh,
    coverUri,
    activeEnrollments,
  } = useData();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AcudeCategory | 'all'>('all');
  const [serverAcudes, setServerAcudes] = useState<LiveAcude[] | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const loadFromServer = useCallback(async () => {
    requestRef.current?.abort();
    if (!isOnline) {
      setServerAcudes(null);
      setServerLoading(false);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setServerLoading(true);
    try {
      const result = await getLiveAcudes(
        {
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(category !== 'all' ? { category } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setServerAcudes(result.acudes);
    } catch {
      // Si el servidor no responde, se conserva la cartelera descargada.
      if (!controller.signal.aborted) setServerAcudes(null);
    } finally {
      if (!controller.signal.aborted) setServerLoading(false);
    }
  }, [category, isOnline, query]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void loadFromServer(), 280);
      return () => {
        clearTimeout(timer);
        requestRef.current?.abort();
      };
    }, [loadFromServer]),
  );

  const catalog = useMemo(
    () => (acudes.length > 0 ? acudes : (serverAcudes ?? [])),
    [acudes, serverAcudes],
  );
  const source = isOnline && serverAcudes ? serverAcudes : acudes;

  const countByCategory = useMemo(() => {
    const counts: Partial<Record<AcudeCategory | 'all', number>> = { all: catalog.length };
    for (const acude of catalog) {
      counts[acude.category] = (counts[acude.category] ?? 0) + 1;
    }
    return counts;
  }, [catalog]);

  const filtered = useMemo(() => {
    const search = foldForSearch(query);
    return source.filter((acude) => {
      if (category !== 'all' && acude.category !== category) return false;
      if (
        search &&
        !foldForSearch(
          acude.name,
          acude.discipline,
          acude.teacherName,
          acude.description,
          acude.requirements,
        ).includes(search)
      ) {
        return false;
      }
      return true;
    });
  }, [source, category, query]);

  const hasFilters = query.trim().length > 0 || category !== 'all';
  const status = resolveListStatus({
    loading: loading || serverLoading,
    refreshing: syncing,
    error: acudes.length === 0 ? error : null,
    hasData: source.length > 0,
    online: isOnline,
  });

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
  };

  const limitNotice =
    user?.role === 'student'
      ? `${activeEnrollments.length} de 2 ACUDES inscritos este semestre`
      : undefined;

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={syncing || serverLoading}
      onRefresh={() => {
        void refresh();
        void loadFromServer();
      }}
    >
      <PageHeader
        eyebrow="Cartelera digital"
        title="Oferta formativa y deportiva"
        subtitle="Consulta horarios, subgrupos, cupos y el escenario de cada sesión. La inscripción se realiza directamente al ACUDE."
        right={
          <View style={[styles.countPill, { backgroundColor: colors.primarySoft }]}>
            <ThemedText variant="caption" tone="primary" style={styles.countText}>
              {catalog.length} ACUDES
            </ThemedText>
          </View>
        }
      />

      <ConnectionBanner />

      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre, docente o disciplina"
            accessibilityLabel="Buscar ACUDES"
          />
        </View>
        <Pressable
          onPress={() => router.push('/(app)/calendario')}
          accessibilityRole="button"
          accessibilityLabel="Abrir calendario"
          style={({ pressed }) => [
            styles.calendarButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.categoryHeader}>
        <ThemedText variant="overline" tone="subtle">
          Explorar por categoría
        </ThemedText>
        {hasFilters ? (
          <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={10}>
            <ThemedText variant="caption" tone="primary" style={styles.clear}>
              Limpiar
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <CategoryFilter value={category} onChange={setCategory} counts={countByCategory} />

      {limitNotice ? (
        <View style={[styles.limitCard, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
          <ThemedText variant="caption" tone="muted" style={styles.flex}>
            {limitNotice}
          </ThemedText>
        </View>
      ) : null}

      {source.length === 0 && !hasFilters ? (
        <ListStateView
          status={status}
          error={error}
          onRetry={() => {
            void refresh();
            void loadFromServer();
          }}
          emptyTitle="Sin ACUDES publicados"
          emptyMessage="Todavía no hay ACUDES disponibles. Desliza para actualizar."
          emptyActionLabel="Actualizar"
          onEmptyAction={() => {
            void refresh();
            void loadFromServer();
          }}
          emptyIcon="calendar-outline"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No encontramos ACUDES"
          message="Prueba con otra categoría o limpia la búsqueda."
          icon="search-outline"
          actionLabel="Ver toda la cartelera"
          onAction={clearFilters}
        />
      ) : (
        <View>
          <View style={styles.resultsRow}>
            <ThemedText variant="bodySmall" tone="muted">
              <ThemedText variant="label">{filtered.length}</ThemedText>{' '}
              {filtered.length === 1 ? 'ACUDE publicado' : 'ACUDES publicados'}
            </ThemedText>
            {serverLoading ? (
              <View style={styles.loadingPill}>
                <ActivityIndicator size="small" color={colors.primary} />
                <ThemedText variant="caption" tone="subtle">
                  Actualizando
                </ThemedText>
              </View>
            ) : null}
          </View>
          {filtered.map((acude) => (
            <AcudeCard
              key={acude.id}
              acude={acude}
              coverUri={coverUri(acude)}
              onPress={() => router.push(`/acude/${acude.id}`)}
              footerNote={
                user?.role === 'student' &&
                activeEnrollments.some((item) => item.acudeId === acude.id)
                  ? 'Ya estás inscrito en este ACUDE'
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  countPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
  },
  countText: { fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  calendarButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  clear: { fontWeight: '700' },
  loadingPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  limitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
