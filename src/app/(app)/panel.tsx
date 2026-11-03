import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AcudeCard } from '@/components/acude-card';
import { Badge } from '@/components/badge';
import { ConnectionBanner } from '@/components/connection-banner';
import { Button } from '@/components/button';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, LoadingState } from '@/components/state-views';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { categoryColors, radius, shadows, spacing, useAppTheme } from '@/constants/theme';
import {
  addDays,
  formatDateLong,
  formatTimeRange,
  minutesOf,
  nowMinutesBogota,
  relativeDayLabel,
  sessionPhase,
  todayKey,
  weekdayOf,
} from '@/lib/date';
import { CATEGORY_LABELS, SESSION_PHASE_LABELS, WEEKDAY_SHORT } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { listAcudes } from '@/services/acudes-service';
import { listEnrollments } from '@/services/enrollments-service';
import { errorMessage } from '@/services/errors';
import {
  getAttendanceReport,
  getEnrollmentReport,
} from '@/services/reports-service';
import { getOccupation } from '@/services/staff-service';
import type {
  Acude,
  AcudeCategory,
  LiveAcude,
  LiveScheduleSlot,
  OccupationResult,
  ReportResult,
} from '@/types';

const categoryIcon: Record<AcudeCategory, keyof typeof Ionicons.glyphMap> = {
  sports: 'football-outline',
  cultural: 'color-palette-outline',
  training: 'school-outline',
  recreational: 'happy-outline',
};

interface NextSession {
  acude: LiveAcude;
  slot: LiveScheduleSlot;
  date: string;
  phase: ReturnType<typeof sessionPhase>;
}

function findNextSession(
  acudes: LiveAcude[],
  active: { acudeId: string; slotId: string }[],
  now = new Date(),
): NextSession | null {
  const today = todayKey(now);
  const byAcude = new Map(active.map((item) => [item.acudeId, item.slotId]));

  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(today, offset);
    const day = weekdayOf(date);
    const candidates: NextSession[] = [];

    for (const acude of acudes) {
      const slotId = byAcude.get(acude.id);
      if (!slotId) continue;
      const slot = acude.schedule.find((item) => item.id === slotId);
      if (!slot || slot.day !== day) continue;
      const phase = sessionPhase(slot, date, now);
      if (phase === 'finished') continue;
      if (offset === 0 && minutesOf(slot.endTime) <= nowMinutesBogota(now)) continue;
      candidates.push({ acude, slot, date, phase });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
      return candidates[0] ?? null;
    }
  }

  return null;
}

interface StaffData {
  acudes: Acude[];
  occupation: OccupationResult;
  activeEnrollments: number;
  enrollmentReport: ReportResult;
  attendanceReport: ReportResult;
}

export default function PanelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors, isDark } = useAppTheme();
  const {
    acudes,
    activeEnrollments,
    coverUri,
    syncing,
    refresh,
  } = useData();

  const isStaff = user?.role === 'manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadStaff = useCallback(async () => {
    requestRef.current?.abort();
    if (!isStaff || !isOnline) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const date = todayKey();
      const [acudeResult, occupation, enrollments, enrollmentReport, attendanceReport] =
        await Promise.all([
          listAcudes({}, controller.signal),
          getOccupation({ date }, controller.signal),
          listEnrollments({ status: 'active' }, controller.signal),
          getEnrollmentReport({ groupBy: 'date' }, controller.signal),
          getAttendanceReport({ groupBy: 'acude' }, controller.signal),
        ]);
      if (controller.signal.aborted) return;
      setStaffData({
        acudes: acudeResult.acudes.filter((acude) => acude.status === 'published'),
        occupation,
        activeEnrollments: enrollments.enrollments.filter(
          (enrollment) => enrollment.status === 'active',
        ).length,
        enrollmentReport,
        attendanceReport,
      });
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isOnline, isStaff]);

  useFocusEffect(
    useCallback(() => {
      void loadStaff();
      return () => requestRef.current?.abort();
    }, [loadStaff]),
  );

  const staffSessions = useMemo(() => {
    if (!staffData) return [];
    return staffData.occupation.scenarios
      .flatMap((scenario) => scenario.sessions)
      .filter((session) => session.phase === 'in_session' || session.phase === 'upcoming')
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 4);
  }, [staffData]);

  const reportAcudes = useMemo(() => {
    if (!staffData) return [];
    return [
      ...new Set(
        staffData.enrollmentReport.rows
          .map((row) => row.acude)
          .filter((name) => Boolean(name)),
      ),
    ];
  }, [staffData]);

  const nextSession = useMemo(
    () => (isStaff ? null : findNextSession(acudes, activeEnrollments)),
    [acudes, activeEnrollments, isStaff],
  );

  const enrolledIds = useMemo(
    () => new Set(activeEnrollments.map((enrollment) => enrollment.acudeId)),
    [activeEnrollments],
  );

  const recommended = useMemo(
    () =>
      acudes
        .filter((acude) => !enrolledIds.has(acude.id) && acude.totalAvailable > 0)
        .slice(0, 3),
    [acudes, enrolledIds],
  );

  if (!user) return null;

  if (isStaff) {
    const currentSessions =
      staffData?.occupation.scenarios.filter((item) => item.current).length ?? 0;

    return (
      <Screen
        edges={['left', 'right']}
        refreshing={loading && !!staffData}
        onRefresh={() => void loadStaff()}
      >
        <PageHeader
          eyebrow={`${isAdmin ? 'Administración' : 'Gestión'} · ${formatDateLong(todayKey())}`}
          title="Panel de gestión de ACUDES"
          subtitle="Estado de los escenarios, subgrupos publicados e inscripciones activas."
        />

        {!isOnline ? (
          <EmptyState
            title="Panel no disponible"
            message="Vuelve a conectarte para consultar la ocupación, las inscripciones y la asistencia."
            icon="cloud-offline-outline"
            actionLabel="Reintentar"
            onAction={() => void loadStaff()}
          />
        ) : loading && !staffData ? (
          <LoadingState message="Cargando el panel…" />
        ) : error ? (
          <EmptyState
            title="No pudimos cargar el panel"
            message={error}
            icon="alert-circle-outline"
            actionLabel="Reintentar"
            onAction={() => void loadStaff()}
          />
        ) : staffData ? (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="En clase ahora"
                value={currentSessions}
                hint={`${staffData.occupation.scenarios.length} escenarios`}
                tone={currentSessions > 0 ? 'amber' : 'teal'}
              />
              <StatCard
                label="ACUDES publicados"
                value={staffData.acudes.length}
                hint="Oferta vigente"
                tone="blue"
              />
            </View>
            <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
              <StatCard
                label="Inscripciones activas"
                value={staffData.activeEnrollments}
                hint="En tus subgrupos"
                tone="violet"
              />
              <StatCard
                label="Asistencia media"
                value={`${staffData.attendanceReport.summary.attendanceRate}%`}
                hint={`${staffData.attendanceReport.summary.total} registros`}
                tone="rose"
              />
            </View>

            <SectionHeader title="Accesos rápidos" />
            <View style={styles.actionsGrid}>
              {isAdmin ? (
                <QuickAction
                  icon="pulse-outline"
                  label="Ocupación"
                  onPress={() => router.push('/(app)/ocupacion')}
                />
              ) : null}
              <QuickAction
                icon="checkbox-outline"
                label="Asistencia"
                onPress={() => router.push('/(app)/asistencia')}
              />
              <QuickAction
                icon="bar-chart-outline"
                label="Reportes"
                onPress={() => router.push('/(app)/reportes')}
              />
              <QuickAction
                icon="calendar-outline"
                label="Calendario"
                onPress={() => router.push('/(app)/calendario')}
              />
              <QuickAction
                icon="settings-outline"
                label={isAdmin ? 'ACUDES' : 'Mi ACUDE'}
                onPress={() => router.push('/(app)/gestion')}
              />
              {isAdmin ? (
                <>
                  <QuickAction
                    icon="location-outline"
                    label="Escenarios"
                    onPress={() => router.push('/gestion/escenarios')}
                  />
                  <QuickAction
                    icon="people-outline"
                    label="Profesores"
                    onPress={() => router.push('/gestion/usuarios')}
                  />
                </>
              ) : null}
            </View>

            <SectionHeader title="Sesiones de hoy" />
            {staffSessions.length === 0 ? (
              <EmptyState
                title="No hay sesiones próximas"
                message="La ocupación del día está libre o ya terminó."
                icon="time-outline"
              />
            ) : (
              <View style={styles.sessionList}>
                {staffSessions.map((session) => (
                  <Pressable
                    key={`${session.acudeId}:${session.slotId}`}
                    onPress={() => router.push(`/acude/${session.acudeId}`)}
                    accessibilityRole="button"
                    style={[
                      styles.sessionCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.sessionTime}>
                      <ThemedText variant="label" tone="primary">
                        {session.startTime}
                      </ThemedText>
                      <ThemedText variant="caption" tone="subtle">
                        {session.endTime}
                      </ThemedText>
                    </View>
                    <View style={styles.flex}>
                      <ThemedText variant="label" numberOfLines={1}>
                        {session.acudeName}
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                        {session.teacherName}
                      </ThemedText>
                    </View>
                    <Badge
                      label={SESSION_PHASE_LABELS[session.phase]}
                      tone={session.phase === 'in_session' ? 'success' : 'info'}
                    />
                  </Pressable>
                ))}
              </View>
            )}

            <SectionHeader title="Inscripciones por fecha" />
            <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText variant="caption" tone="muted">
                Últimos 30 días · {staffData.enrollmentReport.summary.total} eventos
              </ThemedText>
              {reportAcudes.length > 0 ? (
                <ThemedText variant="caption" tone="muted">
                  ACUDES: {reportAcudes.join(' · ')}
                </ThemedText>
              ) : null}
              <View style={styles.reportStats}>
                <ReportMini label="Activas" value={staffData.enrollmentReport.summary.active} tone="success" />
                <ReportMini
                  label="Canceladas"
                  value={staffData.enrollmentReport.summary.canceled}
                  tone="danger"
                />
                <ReportMini
                  label="Asistencias"
                  value={staffData.attendanceReport.summary.present}
                  tone="primary"
                />
                <ReportMini
                  label="Ausencias"
                  value={staffData.attendanceReport.summary.absent}
                  tone="warning"
                />
              </View>
              <Button
                title="Ver reportes completos"
                onPress={() => router.push('/(app)/reportes')}
                variant="secondary"
                icon="arrow-forward-outline"
                iconPosition="right"
                fullWidth
              />
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={syncing}
      onRefresh={() => void refresh()}
    >
      <PageHeader
        eyebrow={`Hola, ${user.name.split(' ')[0]}`}
        title="Mi panel"
        subtitle={`${activeEnrollments.length} de 2 ACUDES inscritos este semestre.`}
      />
      <ConnectionBanner />

      <View style={styles.statsRow}>
        <StatCard
          label="Mis ACUDES"
          value={`${activeEnrollments.length}/2`}
          hint={activeEnrollments.length === 2 ? 'Cupos completos' : 'Puedes inscribirte a otro'}
          tone={activeEnrollments.length === 2 ? 'amber' : 'teal'}
        />
        <StatCard
          label="Cupos disponibles"
          value={acudes.reduce((sum, acude) => sum + acude.totalAvailable, 0)}
          hint={`${acudes.length} ACUDES publicados`}
          tone="blue"
        />
      </View>

      <SectionHeader title="Mi próximo ACUDE" />
      {nextSession ? (
        <Pressable
          onPress={() => router.push(`/acude/${nextSession.acude.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${nextSession.acude.name}`}
          style={({ pressed }) => [
            styles.nextCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.94 : 1,
            },
            shadows.card,
          ]}
        >
          <View
            style={[
              styles.nextImageWrap,
              { backgroundColor: categoryColors(nextSession.acude.category, isDark).soft },
            ]}
          >
            {coverUri(nextSession.acude) ? (
              <Image
                source={{ uri: coverUri(nextSession.acude) }}
                style={styles.nextImage}
                contentFit="cover"
                transition={220}
              />
            ) : (
              <View style={styles.nextPlaceholder}>
                <Ionicons
                  name={categoryIcon[nextSession.acude.category]}
                  size={56}
                  color={categoryColors(nextSession.acude.category, isDark).solid}
                />
              </View>
            )}
            <View style={styles.nextOverlay}>
              <Badge
                label={CATEGORY_LABELS[nextSession.acude.category]}
                tone="primary"
                solid
              />
              <Badge
                label={SESSION_PHASE_LABELS[nextSession.phase]}
                tone={nextSession.phase === 'in_session' ? 'success' : 'info'}
                solid
              />
            </View>
          </View>

          <View style={styles.nextBody}>
            <ThemedText variant="subtitle" numberOfLines={2}>
              {nextSession.acude.name}
            </ThemedText>
            <View style={styles.nextMetaRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <ThemedText variant="bodySmall" tone="muted" style={styles.flex}>
                {relativeDayLabel(nextSession.date)} · {WEEKDAY_SHORT[nextSession.slot.day]}{' '}
                {formatTimeRange(nextSession.slot.startTime, nextSession.slot.endTime)}
              </ThemedText>
            </View>
            <View style={styles.nextMetaRow}>
              <Ionicons name="location-outline" size={15} color={colors.textSubtle} />
              <ThemedText variant="bodySmall" tone="muted" style={styles.flex}>
                {nextSession.slot.scenarioName} · {nextSession.acude.teacherName}
              </ThemedText>
            </View>
            <View style={styles.nextFooter}>
              <ThemedText variant="caption" tone="subtle" style={styles.flex}>
                {nextSession.acude.totalAvailable} cupos disponibles
              </ThemedText>
              <Button
                title="Ver ficha"
                size="sm"
                onPress={() => router.push(`/acude/${nextSession.acude.id}`)}
                icon="arrow-forward-outline"
                iconPosition="right"
              />
            </View>
          </View>
        </Pressable>
      ) : (
        <EmptyState
          title="No tienes una próxima sesión"
          message="Inscríbete a un ACUDE para ver aquí tu siguiente clase."
          icon="calendar-outline"
          actionLabel="Ver cartelera"
          onAction={() => router.push('/(app)/cartelera')}
        />
      )}

      <SectionHeader
        title="Mis ACUDES"
        actionLabel={activeEnrollments.length > 0 ? 'Gestionar' : undefined}
        onAction={() => router.push('/(app)/mis-acudes')}
      />
      {activeEnrollments.length === 0 ? (
        <EmptyState
          title="Todavía no tienes inscripciones activas"
          message="Explora la cartelera y elige una actividad para este semestre."
          icon="bookmark-outline"
          actionLabel="Ver cartelera"
          onAction={() => router.push('/(app)/cartelera')}
        />
      ) : (
        <View style={styles.enrollmentList}>
          {activeEnrollments.map((enrollment) => (
            <Pressable
              key={enrollment.id}
              onPress={() => router.push(`/acude/${enrollment.acudeId}`)}
              accessibilityRole="button"
              style={[
                styles.enrollmentRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.flex}>
                <ThemedText variant="label" numberOfLines={1}>
                  {enrollment.acudeName}
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {WEEKDAY_SHORT[enrollment.day]} {formatTimeRange(enrollment.startTime, enrollment.endTime)} ·{' '}
                  {enrollment.scenarioName}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionHeader
        title="ACUDES con cupos"
        actionLabel="Ver todos"
        onAction={() => router.push('/(app)/cartelera')}
      />
      {recommended.length === 0 ? (
        <ThemedText variant="bodySmall" tone="muted">
          No hay cupos nuevos por ahora.
        </ThemedText>
      ) : (
        <View style={styles.recommended}>
          {recommended.map((acude) => (
            <AcudeCard
              key={acude.id}
              acude={acude}
              coverUri={coverUri(acude)}
              onPress={() => router.push(`/acude/${acude.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <ThemedText variant="caption" style={styles.quickLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ReportMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'danger' | 'warning';
}) {
  return (
    <View style={styles.reportMini}>
      <ThemedText variant="subtitle" tone={tone}>
        {value}
      </ThemedText>
      <ThemedText variant="caption" tone="subtle" align="center">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    width: '31%',
    minWidth: 100,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '700', textAlign: 'center' },
  sessionList: { gap: spacing.sm },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sessionTime: { alignItems: 'center', minWidth: 48 },
  reportCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reportStats: { flexDirection: 'row', gap: spacing.sm },
  reportMini: { flex: 1, alignItems: 'center' },
  nextCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  nextImageWrap: { height: 170, position: 'relative' },
  nextImage: { width: '100%', height: '100%' },
  nextPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nextOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nextBody: { padding: spacing.md, gap: spacing.xs },
  nextMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nextFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  enrollmentList: { gap: spacing.sm },
  enrollmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  recommended: { gap: spacing.md },
});
