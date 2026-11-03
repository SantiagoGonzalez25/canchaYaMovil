import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { OccupancyBar } from '@/components/occupancy';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { categoryColors, radius, spacing, useAppTheme } from '@/constants/theme';
import {
  addDays,
  formatWeekdayDate,
  relativeDayLabel,
  sessionPhase,
  todayKey,
} from '@/lib/date';
import { CATEGORY_LABELS, SESSION_PHASE_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { errorMessage } from '@/services/errors';
import { getOccupation } from '@/services/staff-service';
import type { OccupationResult, SessionPhase } from '@/types';

const PHASE_TONE: Record<SessionPhase, 'success' | 'info' | 'neutral' | 'warning'> = {
  in_session: 'success',
  upcoming: 'info',
  finished: 'neutral',
  scheduled: 'warning',
};

export default function OcupacionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { isOnline } = useNetwork();

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [occupation, setOccupation] = useState<OccupationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await getOccupation({ date: selectedDate }, controller.signal);
      if (controller.signal.aborted) return;
      setOccupation(result);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(errorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isOnline, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const reload = () => {
    void load();
  };

  const summary = useMemo(() => {
    const sessions = occupation?.scenarios.flatMap((scenario) => scenario.sessions) ?? [];
    return {
      inSession: sessions.filter((session) => session.phase === 'in_session').length,
      upcoming: sessions.filter((session) => session.phase === 'upcoming').length,
      enrolled: sessions.reduce((sum, session) => sum + session.enrolled, 0),
      activeScenarios: (occupation?.scenarios ?? []).filter((scenario) => scenario.sessions.length > 0),
      totalSessions: sessions.length,
    };
  }, [occupation]);

  if (user?.role !== 'admin') return <Redirect href="/(app)/panel" />;

  const isToday = selectedDate === todayKey();
  const showLoading = loading && occupation?.date !== selectedDate;

  return (
    <Screen edges={['left', 'right']} refreshing={loading && !!occupation} onRefresh={reload}>
      <PageHeader
        eyebrow="Administración · Ocupación"
        title="Panel de ocupación"
        subtitle="Qué grupo está usando cada escenario, con cupos y estado de la sesión."
      />

      <View style={[styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => setSelectedDate((date) => addDays(date, -1))}
          accessibilityRole="button"
          accessibilityLabel="Día anterior"
          style={styles.arrow}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </Pressable>
        <View style={styles.dateLabel}>
          <ThemedText variant="label">{relativeDayLabel(selectedDate)}</ThemedText>
          <ThemedText variant="caption" tone="muted">
            {formatWeekdayDate(selectedDate)}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setSelectedDate((date) => addDays(date, 1))}
          accessibilityRole="button"
          accessibilityLabel="Día siguiente"
          style={styles.arrow}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {!isToday ? (
        <Pressable
          onPress={() => setSelectedDate(todayKey())}
          style={styles.todayLink}
          accessibilityRole="button"
        >
          <Ionicons name="locate-outline" size={15} color={colors.primary} />
          <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
            Volver a hoy
          </ThemedText>
        </Pressable>
      ) : null}

      {!isOnline ? (
        <>
          <InlineNotice
            tone="warning"
            icon="cloud-offline-outline"
            title="Necesitas conexión"
            message="Conéctate para consultar la ocupación en tiempo real."
          />
          <EmptyState
            title="Sin datos de ocupación"
            message="Este panel cambia en tiempo real. Vuelve a conectarte para consultarlo."
            icon="cloud-offline-outline"
            actionLabel="Reintentar"
            onAction={reload}
          />
        </>
      ) : showLoading ? (
        <LoadingState message="Consultando ocupación…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar la ocupación"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={reload}
        />
      ) : (
        <>
          <View style={styles.stats}>
            <StatCard label="En clase" value={summary.inSession} icon="radio-button-on-outline" tone="success" />
            <StatCard label="Próximas" value={summary.upcoming} icon="time-outline" tone="info" />
            <StatCard label="Inscritos hoy" value={summary.enrolled} icon="people-outline" tone="primary" />
          </View>

          {summary.totalSessions === 0 ? (
            <EmptyState
              title="No hay sesiones programadas"
              message="Ningún ACUDE tiene franjas para este día. Prueba con otra fecha."
              icon="calendar-outline"
            />
          ) : (
            <View style={styles.list}>
              {summary.activeScenarios.map(({ scenario, sessions }) => (
                <View
                  key={scenario.id}
                  style={[
                    styles.scenarioCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.scenarioHeader}>
                    <View style={[styles.scenarioIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="location-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <ThemedText variant="subtitle">{scenario.name}</ThemedText>
                      <ThemedText variant="caption" tone="subtle">
                        {scenario.location || 'Sin ubicación'} · {scenario.capacity} personas
                      </ThemedText>
                    </View>
                    <Badge label={`${sessions.length} sesión${sessions.length === 1 ? '' : 'es'}`} tone="neutral" />
                  </View>

                  <View style={styles.sessions}>
                    {sessions.map((session) => {
                      const category = categoryColors(session.category, isDark);
                      const phase = isToday ? session.phase : sessionPhase(session, selectedDate);
                      return (
                        <Pressable
                          key={`${session.acudeId}:${session.slotId}`}
                          onPress={() => router.push(`/acude/${session.acudeId}`)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.session,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.inputBackground,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                        >
                          <View style={[styles.sessionAccent, { backgroundColor: category.solid }]} />
                          <View style={styles.sessionBody}>
                            <View style={styles.sessionTop}>
                              <ThemedText variant="label" style={styles.flex}>
                                {session.startTime} – {session.endTime}
                              </ThemedText>
                              <Badge
                                label={SESSION_PHASE_LABELS[phase]}
                                tone={PHASE_TONE[phase]}
                              />
                            </View>
                            <ThemedText variant="bodySmall">{session.acudeName}</ThemedText>
                            <View style={styles.metaRow}>
                              <Badge label={CATEGORY_LABELS[session.category]} tone="primary" />
                              <ThemedText variant="caption" tone="muted" style={styles.flex}>
                                {session.teacherName}
                              </ThemedText>
                            </View>
                            <OccupancyBar
                              enrolled={session.enrolled}
                              capacity={session.capacity}
                              pct={session.occupancyPct}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'success' | 'info' | 'primary';
}) {
  const { colors } = useAppTheme();
  const palette = {
    success: { fg: colors.success, bg: colors.successSoft },
    info: { fg: colors.info, bg: colors.infoSoft },
    primary: { fg: colors.primary, bg: colors.primarySoft },
  }[tone];

  return (
    <View style={[styles.stat, { backgroundColor: palette.bg }]}>
      <Ionicons name={icon} size={18} color={palette.fg} />
      <ThemedText variant="heading" style={{ color: palette.fg }}>
        {value}
      </ThemedText>
      <ThemedText variant="caption" style={{ color: palette.fg }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  arrow: { padding: spacing.sm },
  dateLabel: { flex: 1, alignItems: 'center', gap: 1 },
  todayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  stats: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.lg },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  list: { gap: spacing.lg },
  scenarioCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  scenarioHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scenarioIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  sessions: { gap: spacing.sm },
  session: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sessionAccent: { width: 4 },
  sessionBody: { flex: 1, padding: spacing.md, gap: spacing.sm },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
