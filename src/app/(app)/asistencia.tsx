import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
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
  formatWeekdayDate,
  relativeDayLabel,
  todayKey,
  weekdayOf,
} from '@/lib/date';
import { WEEKDAY_SHORT } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { getScenarios, listAcudes } from '@/services/acudes-service';
import { errorMessage } from '@/services/errors';
import { listEnrollments } from '@/services/enrollments-service';
import { listAttendance, saveAttendance } from '@/services/staff-service';
import type {
  Acude,
  AttendanceRecord,
  AttendanceStatus,
  Enrollment,
  Scenario,
} from '@/types';

interface DraftEntry {
  status?: AttendanceStatus;
  notes: string;
}

function toRecordMap(records: AttendanceRecord[]): Record<string, AttendanceRecord> {
  return Object.fromEntries(records.map((record) => [record.enrollmentId, record]));
}

export default function AsistenciaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();

  const [acudes, setAcudes] = useState<Acude[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [acudesLoading, setAcudesLoading] = useState(true);
  const [acudesError, setAcudesError] = useState<string | null>(null);
  const acudesRequestRef = useRef<AbortController | null>(null);
  const rosterRequestRef = useRef<AbortController | null>(null);

  const [selectedAcudeId, setSelectedAcudeId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const [roster, setRoster] = useState<Enrollment[]>([]);
  const [existing, setExisting] = useState<Record<string, AttendanceRecord>>({});
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isStudent = user?.role === 'student';

  const changeDate = (nextDate: string) => {
    setSelectedDate(nextDate);
    setSelectedSlotId(null);
    setRoster([]);
    setExisting({});
    setDraft({});
    setRosterError(null);
    setRosterLoading(true);
  };

  const loadAcudes = useCallback(async () => {
    acudesRequestRef.current?.abort();
    if (isStudent || !isOnline) return;

    const controller = new AbortController();
    acudesRequestRef.current = controller;
    setAcudesLoading(true);
    setAcudesError(null);
    try {
      const [acudeResult, scenarioResult] = await Promise.all([
        listAcudes({}, controller.signal),
        getScenarios(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setAcudes(
        [...acudeResult.acudes]
          .filter((acude) => acude.status !== 'archived')
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      setScenarios(scenarioResult);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setAcudesError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setAcudesLoading(false);
    }
  }, [isOnline, isStudent]);

  useFocusEffect(
    useCallback(() => {
      void loadAcudes();
      return () => acudesRequestRef.current?.abort();
    }, [loadAcudes]),
  );

  const selectedAcude = useMemo(
    () => acudes.find((acude) => acude.id === selectedAcudeId) ?? acudes[0] ?? null,
    [acudes, selectedAcudeId],
  );

  const slotOptions = useMemo(() => {
    if (!selectedAcude) return [];
    const day = weekdayOf(selectedDate);
    return selectedAcude.schedule
      .filter((slot) => slot.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedAcude, selectedDate]);

  const selectedSlot = useMemo(
    () => slotOptions.find((slot) => slot.id === selectedSlotId) ?? slotOptions[0] ?? null,
    [selectedSlotId, slotOptions],
  );

  const scenarioNames = useMemo(
    () => Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario.name])),
    [scenarios],
  );

  const loadRoster = useCallback(async () => {
    rosterRequestRef.current?.abort();
    if (isStudent || !isOnline || !selectedAcude || !selectedSlot) return;
    if (selectedSlot.day !== weekdayOf(selectedDate)) return;

    const controller = new AbortController();
    rosterRequestRef.current = controller;
    setRosterLoading(true);
    setRosterError(null);
    try {
      const [enrollmentResult, attendanceResult] = await Promise.all([
        listEnrollments(
          {
            acudeId: selectedAcude.id,
            slotId: selectedSlot.id,
            status: 'active',
          },
          controller.signal,
        ),
        listAttendance(
          {
            acudeId: selectedAcude.id,
            slotId: selectedSlot.id,
            date: selectedDate,
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
  }, [isOnline, isStudent, selectedAcude, selectedSlot, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void loadRoster();
      return () => rosterRequestRef.current?.abort();
    }, [loadRoster]),
  );

  if (isStudent) return <Redirect href="/(app)/panel" />;

  const today = todayKey();
  const isToday = selectedDate === today;
  const markedCount = roster.filter((enrollment) => draft[enrollment.id]?.status).length;
  const missingCount = roster.length - markedCount;
  const canGoForward = selectedDate < today;

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
    if (!selectedAcude || !selectedSlot) return;
    if (selectedSlot.day !== weekdayOf(selectedDate)) {
      Alert.alert(
        'Franja no válida',
        'La franja seleccionada no corresponde al día de la fecha elegida.',
      );
      return;
    }
    if (!isOnline) {
      Alert.alert('Sin conexión', 'Necesitas conexión para registrar la asistencia.');
      return;
    }
    const missing = roster.filter((enrollment) => !draft[enrollment.id]?.status);
    if (missing.length > 0) {
      Alert.alert(
        'Falta marcar asistencia',
        `Marca presente o ausente para ${missing.length === 1 ? missing[0]?.userName : `${missing.length} estudiantes`} antes de guardar.`,
      );
      return;
    }

    setSaving(true);
    try {
      const result = await saveAttendance({
        acudeId: selectedAcude.id,
        slotId: selectedSlot.id,
        date: selectedDate,
        records: roster.map((enrollment) => ({
          enrollmentId: enrollment.id,
          status: draft[enrollment.id]?.status ?? 'absent',
          notes: draft[enrollment.id]?.notes.trim() ?? '',
        })),
      });
      const records = toRecordMap(result.attendance);
      setExisting((prev) => ({ ...prev, ...records }));
      Alert.alert(
        'Asistencia guardada',
        `Se registraron ${result.saved} estudiante${result.saved === 1 ? '' : 's'} para el ${formatWeekdayDate(selectedDate)}.`,
      );
    } catch (error) {
      Alert.alert('No se pudo guardar la asistencia', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const hasAcudes = acudes.length > 0;

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={acudesLoading && hasAcudes}
      onRefresh={() => {
        void loadAcudes();
        void loadRoster();
      }}
    >
      <PageHeader
        eyebrow={user?.role === 'admin' ? 'Administración' : 'Profesor'}
        title="Control de asistencia"
        subtitle="Selecciona el ACUDE, la franja y la fecha. La lista muestra únicamente los estudiantes inscritos."
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
          message="Necesitas conexión para registrar la asistencia de esta sesión."
        />
      ) : acudesLoading && !hasAcudes ? (
        <LoadingState message="Cargando tus ACUDES…" />
      ) : acudesError ? (
        <EmptyState
          title="No pudimos cargar los ACUDES"
          message={acudesError}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void loadAcudes()}
        />
      ) : !hasAcudes ? (
        <EmptyState
          title="No tienes ACUDES asignados"
          message="Cuando un administrador te asigne un ACUDE con franjas, podrás registrar la asistencia desde aquí."
          icon="calendar-outline"
        />
      ) : (
        <>
          <View
            style={[styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              onPress={() => changeDate(addDays(selectedDate, -1))}
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
              onPress={() => {
                if (canGoForward) changeDate(addDays(selectedDate, 1));
              }}
              disabled={!canGoForward}
              accessibilityRole="button"
              accessibilityLabel="Día siguiente"
              style={[styles.arrow, { opacity: canGoForward ? 1 : 0.35 }]}
              hitSlop={8}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {!isToday ? (
            <Pressable
              onPress={() => changeDate(today)}
              style={styles.todayLink}
              accessibilityRole="button"
            >
              <Ionicons name="locate-outline" size={15} color={colors.primary} />
              <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                Volver a hoy
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <ThemedText variant="label">ACUDE</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {acudes.map((acude) => (
                <Chip
                  key={acude.id}
                  label={acude.name}
                  active={selectedAcude?.id === acude.id}
                  onPress={() => {
                    setSelectedAcudeId(acude.id);
                    setSelectedSlotId(null);
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {!selectedSlot ? (
            <EmptyState
              title="No hay franjas para este día"
              message={`“${selectedAcude?.name ?? 'Este ACUDE'}” no tiene subgrupos el ${WEEKDAY_SHORT[weekdayOf(selectedDate)]}. Cambia la fecha para registrar asistencia.`}
              icon="calendar-outline"
            />
          ) : (
            <>
              <View style={styles.section}>
                <ThemedText variant="label">Subgrupo</ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {slotOptions.map((slot) => (
                    <Chip
                      key={slot.id}
                      label={`${slot.startTime}–${slot.endTime} · ${
                        scenarioNames[slot.scenarioId] ?? 'Escenario'
                      }`}
                      active={selectedSlot?.id === slot.id}
                      onPress={() => setSelectedSlotId(slot.id)}
                    />
                  ))}
                </ScrollView>
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
                      <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
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
                                    entry?.status === 'present' ? colors.success : colors.inputBackground,
                                  borderColor:
                                    entry?.status === 'present' ? colors.success : colors.border,
                                },
                              ]}
                            >
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={17}
                                color={entry?.status === 'present' ? colors.onPrimary : colors.textMuted}
                              />
                              <ThemedText
                                variant="caption"
                                style={{
                                  color:
                                    entry?.status === 'present' ? colors.onPrimary : colors.textMuted,
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
                                    entry?.status === 'absent' ? colors.danger : colors.inputBackground,
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
                                    entry?.status === 'absent' ? colors.onPrimary : colors.textMuted,
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
                    Puedes guardar de nuevo el mismo día para corregir los registros.
                  </ThemedText>
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
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
  section: { gap: spacing.sm, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
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
