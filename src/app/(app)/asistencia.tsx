import { Ionicons } from '@expo/vector-icons';
import {
  Redirect,
  useFocusEffect,
  useGlobalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import {
  addDays,
  formatTimeRange,
  formatWeekRange,
  relativeDayLabel,
  startOfWeek,
  todayKey,
} from '@/lib/date';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { listAcudes } from '@/services/acudes-service';
import { errorMessage } from '@/services/errors';
import { listEnrollments } from '@/services/enrollments-service';
import {
  getAttendanceSessions,
  listAttendance,
  saveAttendance,
} from '@/services/staff-service';
import type {
  Acude,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Enrollment,
} from '@/types';

interface DraftEntry {
  status?: AttendanceStatus;
  notes: string;
}

interface SessionGroup {
  date: string;
  sessions: AttendanceSession[];
}

type AcudeFilterStatus = 'all' | 'active' | 'draft';

function toRecordMap(records: AttendanceRecord[]): Record<string, AttendanceRecord> {
  return Object.fromEntries(records.map((record) => [record.enrollmentId, record]));
}

function groupSessions(sessions: AttendanceSession[]): SessionGroup[] {
  const grouped = new Map<string, AttendanceSession[]>();
  for (const session of sessions) {
    const list = grouped.get(session.date) ?? [];
    list.push(session);
    grouped.set(session.date, list);
  }
  return [...grouped.entries()].map(([date, items]) => ({ date, sessions: items }));
}

export default function AsistenciaScreen() {
  const router = useRouter();
  const { acudeId: acudeIdParam } = useGlobalSearchParams<{ acudeId?: string }>();
  const requestedAcudeId = Array.isArray(acudeIdParam)
    ? acudeIdParam[0]
    : (acudeIdParam ?? '');
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();

  const today = todayKey();
  const currentWeekStart = startOfWeek(today);
  const oldestWeekStart = addDays(currentWeekStart, -7);
  const latestWeekStart = addDays(currentWeekStart, 7);

  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [acudes, setAcudes] = useState<Acude[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [acudeFilter, setAcudeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AcudeFilterStatus>('all');
  const sessionsRequestRef = useRef<AbortController | null>(null);
  const rosterRequestRef = useRef<AbortController | null>(null);

  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(
    null,
  );
  const [roster, setRoster] = useState<Enrollment[]>([]);
  const [existing, setExisting] = useState<Record<string, AttendanceRecord>>({});
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  const loadSessions = useCallback(async () => {
    sessionsRequestRef.current?.abort();
    if (isStudent) return;
    if (!isOnline) {
      setSessionsLoading(false);
      return;
    }

    const controller = new AbortController();
    sessionsRequestRef.current = controller;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const [sessionResult, acudeResult] = await Promise.all([
        getAttendanceSessions(
          { from: weekStart, to: addDays(weekStart, 6) },
          controller.signal,
        ),
        listAcudes({}, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setSessions(sessionResult.sessions);
      setAcudes(
        [...acudeResult.acudes]
          .filter((acude) => acude.status !== 'archived')
          .filter((acude) => (isAdmin ? true : acude.status === 'published'))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
    } catch (reason) {
      if (controller.signal.aborted) return;
      setSessionsError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setSessionsLoading(false);
    }
  }, [isAdmin, isOnline, isStudent, weekStart]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
      return () => sessionsRequestRef.current?.abort();
    }, [loadSessions]),
  );

  const loadRoster = useCallback(async () => {
    rosterRequestRef.current?.abort();
    if (isStudent || !selectedSession) return;
    if (!isOnline) {
      setRosterLoading(false);
      return;
    }

    const controller = new AbortController();
    rosterRequestRef.current = controller;
    setRosterLoading(true);
    setRosterError(null);
    try {
      const [enrollmentResult, attendanceResult] = await Promise.all([
        listEnrollments(
          {
            acudeId: selectedSession.acudeId,
            slotId: selectedSession.slotId,
            status: 'active',
          },
          controller.signal,
        ),
        listAttendance(
          {
            acudeId: selectedSession.acudeId,
            slotId: selectedSession.slotId,
            date: selectedSession.date,
          },
          controller.signal,
        ),
      ]);
      if (controller.signal.aborted) return;
      const activeRoster = [...enrollmentResult.enrollments]
        .filter((enrollment) => enrollment.status === 'active')
        .sort((a, b) => a.userName.localeCompare(b.userName, 'es'));
      const records = toRecordMap(attendanceResult.attendance);
      const nextDraft: Record<string, DraftEntry> = {};
      for (const enrollment of activeRoster) {
        nextDraft[enrollment.id] = {
          status: records[enrollment.id]?.status,
          notes: records[enrollment.id]?.notes ?? '',
        };
      }
      setRoster(activeRoster);
      setExisting(records);
      setDraft(nextDraft);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setRosterError(errorMessage(reason));
      setRoster([]);
      setExisting({});
      setDraft({});
    } finally {
      if (!controller.signal.aborted) setRosterLoading(false);
    }
  }, [isOnline, isStudent, selectedSession]);

  useFocusEffect(
    useCallback(() => {
      void loadRoster();
      return () => rosterRequestRef.current?.abort();
    }, [loadRoster]),
  );

  const closeSession = useCallback(() => {
    rosterRequestRef.current?.abort();
    setSelectedSession(null);
    setRoster([]);
    setExisting({});
    setDraft({});
    setRosterError(null);
    setRosterLoading(false);
  }, []);

  const openSession = (session: AttendanceSession) => {
    setSelectedSession(session);
    setRoster([]);
    setExisting({});
    setDraft({});
    setRosterError(null);
    setRosterLoading(true);
  };

  const changeWeek = (next: string) => {
    closeSession();
    setSessions([]);
    setAcudeFilter('');
    setWeekStart(next);
  };

  const requestedAcude = acudes.find((acude) => acude.id === requestedAcudeId);
  const effectiveStatusFilter: AcudeFilterStatus = isAdmin
    ? requestedAcude
      ? requestedAcude.status === 'draft'
        ? 'draft'
        : 'active'
      : statusFilter
    : 'active';

  const statusAcudes = useMemo(
    () =>
      acudes.filter((acude) =>
        effectiveStatusFilter === 'all'
          ? true
          : effectiveStatusFilter === 'active'
            ? acude.status === 'published'
            : acude.status === 'draft',
      ),
    [acudes, effectiveStatusFilter],
  );

  const acudeOptions = useMemo(
    () => statusAcudes.map((acude) => ({ id: acude.id, name: acude.name })),
    [statusAcudes],
  );

  const effectiveFilter = requestedAcude
    ? requestedAcude.id
    : acudeOptions.some((option) => option.id === acudeFilter)
      ? acudeFilter
      : '';
  const activeAcudeName =
    acudeOptions.find((option) => option.id === effectiveFilter)?.name ?? '';

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (effectiveFilter && session.acudeId !== effectiveFilter) return false;
        if (effectiveStatusFilter === 'active') {
          return session.acudeStatus === 'published';
        }
        if (effectiveStatusFilter === 'draft') {
          return session.acudeStatus === 'draft';
        }
        return true;
      }),
    [effectiveFilter, effectiveStatusFilter, sessions],
  );

  const groupedSessions = useMemo(
    () => groupSessions(filteredSessions),
    [filteredSessions],
  );

  const markedCount = roster.filter((enrollment) => draft[enrollment.id]?.status).length;
  const missingCount = roster.length - markedCount;
  const alreadySaved = Object.keys(existing).length > 0;
  const canGoPrevious = weekStart > oldestWeekStart;
  const canGoNext = weekStart < latestWeekStart;

  if (isStudent) return <Redirect href="/(app)/panel" />;

  const setStatus = (enrollmentId: string, status: AttendanceStatus) => {
    setDraft((prev) => ({
      ...prev,
      [enrollmentId]: {
        status,
        notes: prev[enrollmentId]?.notes ?? '',
      },
    }));
  };

  const setNotes = (enrollmentId: string, notes: string) => {
    setDraft((prev) => ({
      ...prev,
      [enrollmentId]: {
        status: prev[enrollmentId]?.status,
        notes,
      },
    }));
  };

  const markAllPresent = () => {
    setDraft((prev) => {
      const next: Record<string, DraftEntry> = { ...prev };
      for (const enrollment of roster) {
        next[enrollment.id] = {
          status: 'present',
          notes: prev[enrollment.id]?.notes ?? '',
        };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedSession) return;
    if (!isOnline) {
      Alert.alert('Sin conexión', 'Necesitas conexión para registrar la asistencia.');
      return;
    }
    const missing = roster.filter((enrollment) => !draft[enrollment.id]?.status);
    if (missing.length > 0) {
      Alert.alert(
        'Falta marcar asistencia',
        `Marca presente o ausente para ${
          missing.length === 1
            ? missing[0]?.userName
            : `${missing.length} estudiantes`
        } antes de guardar.`,
      );
      return;
    }

    setSaving(true);
    try {
      const result = await saveAttendance({
        acudeId: selectedSession.acudeId,
        slotId: selectedSession.slotId,
        date: selectedSession.date,
        records: roster.map((enrollment) => ({
          enrollmentId: enrollment.id,
          status: draft[enrollment.id]?.status ?? 'absent',
          notes: draft[enrollment.id]?.notes.trim() ?? '',
        })),
      });
      const records = toRecordMap(result.attendance);
      setExisting((prev) => ({ ...prev, ...records }));
      setSessions((prev) =>
        prev.map((session) =>
          session.sessionKey === selectedSession.sessionKey
            ? { ...session, status: 'saved' }
            : session,
        ),
      );
      Alert.alert(
        'Asistencia guardada',
        `Se registraron ${result.saved} estudiante${
          result.saved === 1 ? '' : 's'
        } para el ${relativeDayLabel(selectedSession.date)}.`,
      );
    } catch (error) {
      Alert.alert('No se pudo guardar la asistencia', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const listContent = (
    <>
      <View
        style={[styles.weekCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Pressable
          onPress={() => {
            if (canGoPrevious) changeWeek(addDays(weekStart, -7));
          }}
          disabled={!canGoPrevious}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          style={[styles.arrow, { opacity: canGoPrevious ? 1 : 0.35 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </Pressable>
        <View style={styles.weekLabel}>
          <ThemedText variant="label">Semana</ThemedText>
          <ThemedText variant="caption" tone="muted">
            {formatWeekRange(weekStart)}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => {
            if (canGoNext) changeWeek(addDays(weekStart, 7));
          }}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          style={[styles.arrow, { opacity: canGoNext ? 1 : 0.35 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {weekStart !== currentWeekStart ? (
        <Pressable
          onPress={() => changeWeek(currentWeekStart)}
          style={styles.todayLink}
          accessibilityRole="button"
        >
          <Ionicons name="locate-outline" size={15} color={colors.primary} />
          <ThemedText variant="caption" tone="primary" style={styles.linkStrong}>
            Volver a la semana actual
          </ThemedText>
        </Pressable>
      ) : null}

      {effectiveFilter && activeAcudeName ? (
        <View
          style={[
            styles.activeFilter,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <Ionicons name="funnel-outline" size={15} color={colors.primary} />
          <ThemedText variant="caption" tone="primary" style={styles.flex}>
            Mostrando sesiones de {activeAcudeName}
          </ThemedText>
          <Pressable
            onPress={() => {
              setAcudeFilter('');
              router.setParams({ acudeId: '' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Quitar filtro de ACUDE"
            hitSlop={8}
          >
            <ThemedText variant="caption" tone="primary" style={styles.linkStrong}>
              Quitar
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {isAdmin ? (
        <View style={styles.section}>
          <ThemedText variant="label">Estado del ACUDE</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(
              [
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Activos' },
                { value: 'draft', label: 'Borradores' },
              ] as const
            ).map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={effectiveStatusFilter === option.value}
                onPress={() => {
                  setStatusFilter(option.value);
                  setAcudeFilter('');
                  router.setParams({ acudeId: '' });
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {acudeOptions.length > 1 ? (
        <View style={styles.section}>
          <ThemedText variant="label">Filtrar por ACUDE</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="Todos"
              active={effectiveFilter === ''}
              onPress={() => {
                setAcudeFilter('');
                router.setParams({ acudeId: '' });
              }}
            />
            {acudeOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.name}
                active={effectiveFilter === option.id}
                onPress={() => {
                  setAcudeFilter(option.id);
                  router.setParams({ acudeId: '' });
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {acudes.length === 0 ? (
        <EmptyState
          title={isAdmin ? 'No hay ACUDES registrados' : 'No tienes ACUDES activos'}
          message={
            isAdmin
              ? 'Crea un ACUDE para poder consultar sus sesiones de asistencia.'
              : 'Tus ACUDES en borrador no aparecen en asistencia. Cuando el administrador los publique, podrás pasar lista.'
          }
          icon="calendar-outline"
        />
      ) : groupedSessions.length === 0 ? (
        <EmptyState
          title="No hay sesiones programadas"
          message={
            isAdmin && effectiveStatusFilter === 'draft'
              ? 'No hay ACUDES en borrador con clases en esta semana.'
              : 'En esta semana no hay clases según el horario de tus ACUDES. Puedes revisar la semana anterior para corregir asistencias.'
          }
          icon="calendar-outline"
          actionLabel={canGoPrevious ? 'Ver semana anterior' : undefined}
          onAction={
            canGoPrevious ? () => changeWeek(addDays(weekStart, -7)) : undefined
          }
        />
      ) : (
        groupedSessions.map((group) => (
          <View key={group.date} style={styles.dayGroup}>
            <View style={styles.dayHeader}>
              <ThemedText variant="label">{relativeDayLabel(group.date)}</ThemedText>
              <Badge
                label={`${group.sessions.length} sesión${
                  group.sessions.length === 1 ? '' : 'es'
                }`}
                tone="neutral"
              />
            </View>
            {group.sessions.map((session) => {
              const isScheduled = session.status === 'scheduled';
              const statusLabel =
                session.status === 'saved'
                  ? 'Guardada'
                  : isScheduled
                    ? 'Programada'
                    : 'Pendiente';
              const statusTone: 'success' | 'info' | 'warning' =
                session.status === 'saved'
                  ? 'success'
                  : isScheduled
                    ? 'info'
                    : 'warning';
              return (
                <Pressable
                  key={session.sessionKey}
                  onPress={() => {
                    if (!isScheduled) openSession(session);
                  }}
                  disabled={isScheduled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isScheduled }}
                  accessibilityLabel={
                    isScheduled
                      ? `Sesión programada de ${session.acudeName} el ${relativeDayLabel(
                          session.date,
                        )}`
                      : `Abrir asistencia de ${session.acudeName} el ${relativeDayLabel(
                          session.date,
                        )}`
                  }
                  style={[
                    styles.sessionCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isScheduled ? styles.sessionDisabled : null,
                  ]}
                >
                  <View style={styles.sessionTime}>
                    <ThemedText variant="label" tone="primary">
                      {session.startTime}
                    </ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {session.endTime}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.sessionTitleRow}>
                      <ThemedText variant="label" style={styles.flex}>
                        {session.acudeName}
                      </ThemedText>
                      {isAdmin && session.acudeStatus === 'draft' ? (
                        <Badge label="Borrador" tone="neutral" />
                      ) : null}
                    </View>
                    <ThemedText variant="caption" tone="muted">
                      {session.scenarioName} · {session.enrolled} inscrito
                      {session.enrolled === 1 ? '' : 's'}
                    </ThemedText>
                    {isAdmin ? (
                      <ThemedText variant="caption" tone="subtle">
                        {session.teacherName}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.sessionRight}>
                    <Badge label={statusLabel} tone={statusTone} />
                    <Ionicons
                      name={isScheduled ? 'time-outline' : 'chevron-forward'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      )}
    </>
  );

  const detailContent = selectedSession ? (
    <>
      <Pressable
        onPress={closeSession}
        accessibilityRole="button"
        style={styles.backLink}
      >
        <Ionicons name="arrow-back" size={16} color={colors.primary} />
        <ThemedText variant="caption" tone="primary" style={styles.linkStrong}>
          Volver a mis sesiones
        </ThemedText>
      </Pressable>

      <View
        style={[styles.selectedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.selectedHeader}>
          <View style={styles.flex}>
            <ThemedText variant="caption" tone="muted">
              {relativeDayLabel(selectedSession.date)}
            </ThemedText>
            <ThemedText variant="label" style={styles.selectedTitle}>
              {selectedSession.acudeName}
            </ThemedText>
            <ThemedText variant="caption" tone="muted">
              {formatTimeRange(selectedSession.startTime, selectedSession.endTime)} ·{' '}
              {selectedSession.scenarioName}
            </ThemedText>
            {user?.role === 'admin' ? (
              <ThemedText variant="caption" tone="subtle">
                Docente: {selectedSession.teacherName}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.detailBadges}>
            {isAdmin && selectedSession.acudeStatus === 'draft' ? (
              <Badge label="Borrador" tone="neutral" />
            ) : null}
            <Badge
              label={alreadySaved ? 'Guardada' : 'Pendiente'}
              tone={alreadySaved ? 'success' : 'warning'}
            />
          </View>
        </View>
      </View>

      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <ThemedText variant="heading" tone="primary">
            {roster.length}
          </ThemedText>
          <ThemedText variant="caption" tone="muted">
            inscritos activos
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <ThemedText variant="heading" tone="success">
            {markedCount}
          </ThemedText>
          <ThemedText variant="caption" tone="muted">
            marcados
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <ThemedText variant="heading" tone={missingCount > 0 ? 'warning' : 'success'}>
            {missingCount}
          </ThemedText>
          <ThemedText variant="caption" tone="muted">
            pendientes
          </ThemedText>
        </View>
      </View>

      {rosterLoading ? (
        <LoadingState message="Cargando el listado de estudiantes…" />
      ) : rosterError ? (
        <EmptyState
          title="No pudimos cargar la asistencia"
          message={rosterError}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void loadRoster()}
        />
      ) : roster.length === 0 ? (
        <EmptyState
          title="Sin inscripciones activas"
          message="Ningún estudiante está inscrito en esta franja. Cuando se inscriban, aparecerán aquí."
          icon="people-outline"
        />
      ) : (
        <>
          <View style={styles.rosterHeader}>
            <ThemedText variant="label">Listado del día</ThemedText>
            <Pressable
              onPress={markAllPresent}
              accessibilityRole="button"
              style={styles.markAll}
            >
              <Ionicons name="checkmark-done-outline" size={15} color={colors.primary} />
              <ThemedText variant="caption" tone="primary" style={styles.linkStrong}>
                Todos presentes
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.roster}>
            {roster.map((enrollment) => {
              const entry = draft[enrollment.id];
              const alreadyRecorded = !!existing[enrollment.id];
              return (
                <View
                  key={enrollment.id}
                  style={[
                    styles.studentCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.studentTop}>
                    <Avatar name={enrollment.userName} size={42} />
                    <View style={styles.flex}>
                      <ThemedText variant="label">{enrollment.userName}</ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {enrollment.userEmail}
                      </ThemedText>
                    </View>
                    {alreadyRecorded ? (
                      <Badge label="Ya registrado" tone="success" />
                    ) : (
                      <Badge label="Sin registrar" tone="neutral" />
                    )}
                  </View>

                  <View style={styles.statusRow}>
                    <Pressable
                      onPress={() => setStatus(enrollment.id, 'present')}
                      accessibilityRole="button"
                      accessibilityState={{ selected: entry?.status === 'present' }}
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            entry?.status === 'present'
                              ? colors.success
                              : colors.inputBackground,
                          borderColor:
                            entry?.status === 'present' ? colors.success : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={17}
                        color={
                          entry?.status === 'present' ? colors.onPrimary : colors.textMuted
                        }
                      />
                      <ThemedText
                        variant="caption"
                        style={{
                          color:
                            entry?.status === 'present'
                              ? colors.onPrimary
                              : colors.textMuted,
                          fontWeight: '700',
                        }}
                      >
                        Asistió
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setStatus(enrollment.id, 'absent')}
                      accessibilityRole="button"
                      accessibilityState={{ selected: entry?.status === 'absent' }}
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            entry?.status === 'absent'
                              ? colors.danger
                              : colors.inputBackground,
                          borderColor:
                            entry?.status === 'absent' ? colors.danger : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={17}
                        color={entry?.status === 'absent' ? colors.onPrimary : colors.textMuted}
                      />
                      <ThemedText
                        variant="caption"
                        style={{
                          color:
                            entry?.status === 'absent'
                              ? colors.onPrimary
                              : colors.textMuted,
                          fontWeight: '700',
                        }}
                      >
                        No asistió
                      </ThemedText>
                    </Pressable>
                  </View>

                  <TextField
                    value={entry?.notes ?? ''}
                    onChangeText={(value) => setNotes(enrollment.id, value)}
                    placeholder="Observación opcional (máx. 300)"
                    maxLength={300}
                    multiline={false}
                    containerStyle={styles.notes}
                  />
                </View>
              );
            })}
          </View>

          <Button
            title={
              missingCount > 0
                ? `Guardar asistencia (${missingCount} pendientes)`
                : 'Guardar asistencia'
            }
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!isOnline}
            icon="save-outline"
            size="lg"
            fullWidth
            style={styles.saveButton}
          />
          <ThemedText variant="caption" tone="subtle" align="center">
            Puedes guardar de nuevo la misma sesión para corregir los registros.
          </ThemedText>
        </>
      )}
    </>
  ) : null;

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={sessionsLoading && sessions.length > 0}
      onRefresh={() => {
        void loadSessions();
        void loadRoster();
      }}
    >
      <PageHeader
        eyebrow={user?.role === 'admin' ? 'Administración' : 'Profesor'}
        title="Control de asistencia"
        subtitle={
          selectedSession
            ? 'Pasa lista de la sesión seleccionada. Puedes corregirla mientras esté dentro de la ventana permitida.'
            : 'Elige una sesión de tu horario. Las clases futuras aparecen como programadas; podrás pasar lista desde el día de la sesión.'
        }
        right={
          <Button
            title="Ver reporte"
            onPress={() => router.push('/(app)/reportes')}
            variant="secondary"
            size="sm"
            icon="bar-chart-outline"
          />
        }
      />

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Asistencia"
          message="Necesitas conexión para cargar tus sesiones y registrar la asistencia."
        />
      ) : null}

      {selectedSession ? (
        detailContent
      ) : sessionsLoading && sessions.length === 0 ? (
        <LoadingState message="Cargando tus sesiones…" />
      ) : sessionsError && sessions.length === 0 ? (
        <EmptyState
          title="No pudimos cargar tus sesiones"
          message={sessionsError}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void loadSessions()}
        />
      ) : (
        listContent
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  arrow: { padding: spacing.sm },
  weekLabel: { flex: 1, alignItems: 'center', gap: 1 },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  todayLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  linkStrong: { fontWeight: '700' },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  dayGroup: { gap: spacing.sm, marginTop: spacing.xl },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sessionDisabled: { opacity: 0.72 },
  sessionTime: { width: 48, alignItems: 'center', gap: 1 },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  sessionRight: { alignItems: 'flex-end', gap: spacing.xs },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailBadges: { alignItems: 'flex-end', gap: spacing.xs },
  selectedTitle: { marginTop: 2, marginBottom: 2 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 1 },
  divider: { width: 1, height: 34 },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  roster: { gap: spacing.md },
  studentCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  studentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  notes: { gap: 0 },
  saveButton: { marginTop: spacing.lg },
});
