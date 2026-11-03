import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { CategoryFilter, Chip } from '@/components/chips';
import { ConnectionBanner } from '@/components/connection-banner';
import { OccupancyBar } from '@/components/occupancy';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { SearchField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { categoryColors, radius, spacing, useAppTheme } from '@/constants/theme';
import {
  addDays,
  formatDayMonth,
  formatTimeRange,
  formatWeekRange,
  SEMESTER_LABEL,
  SEMESTER_RANGE_LABEL,
  sessionPhase,
  startOfWeek,
  todayKey,
  weekdayOf,
} from '@/lib/date';
import {
  CATEGORY_LABELS,
  SESSION_PHASE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
} from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { getLiveAcudes } from '@/services/acudes-service';
import type {
  AcudeCategory,
  LiveAcude,
  LiveScheduleSlot,
  SessionPhase,
} from '@/types';

interface CalendarEvent {
  key: string;
  date: string;
  acude: LiveAcude;
  slot: LiveScheduleSlot;
}

type CalendarView = 'agenda' | 'week' | 'scenario';

const PHASE_TONE: Record<SessionPhase, 'success' | 'info' | 'neutral' | 'warning'> = {
  in_session: 'success',
  upcoming: 'info',
  finished: 'neutral',
  scheduled: 'warning',
};

export default function CalendarioScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { activeEnrollments, acudes, loading, syncing, refresh, coverUri, enroll, cancel } = useData();

  const today = todayKey();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [view, setView] = useState<CalendarView>('agenda');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AcudeCategory | 'all'>('all');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<{ acudeId: string; slotId: string } | null>(null);
  const [busy, setBusy] = useState(false);
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

  const sourceAcudes = isOnline && serverAcudes ? serverAcudes : acudes;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const enrolledAcudeIds = useMemo(
    () =>
      new Set(
        activeEnrollments
          .filter((enrollment) => enrollment.status === 'active')
          .map((enrollment) => enrollment.acudeId),
      ),
    [activeEnrollments],
  );

  const enrolledSlotIds = useMemo(
    () =>
      new Set(
        activeEnrollments
          .filter((enrollment) => enrollment.status === 'active')
          .map((enrollment) => enrollment.slotId),
      ),
    [activeEnrollments],
  );

  const filteredAcudes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sourceAcudes.filter((acude) => {
      if (category !== 'all' && acude.category !== category) return false;
      if (onlyAvailable && acude.totalAvailable <= 0) return false;
      if (isStudent && onlyMine && !enrolledAcudeIds.has(acude.id)) return false;
      if (term) {
        const haystack = `${acude.name} ${acude.discipline} ${acude.teacherName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [
    sourceAcudes,
    category,
    enrolledAcudeIds,
    isStudent,
    onlyAvailable,
    onlyMine,
    query,
  ]);

  const events = useMemo(() => {
    const list: CalendarEvent[] = [];
    for (const acude of filteredAcudes) {
      for (const slot of acude.schedule) {
        if (isStudent && onlyMine && !enrolledSlotIds.has(slot.id)) continue;
        // El filtro "Con cupos" debe aplicarse a cada franja, no solo al ACUDE:
        // un ACUDE puede tener una franja llena y otra con cupos.
        if (onlyAvailable && slot.available <= 0) continue;
        const date = days.find((item) => weekdayOf(item) === slot.day);
        if (!date) continue;
        list.push({
          key: `${date}:${acude.id}:${slot.id}`,
          date,
          acude,
          slot,
        });
      }
    }
    return list.sort(
      (a, b) => a.date.localeCompare(b.date) || a.slot.startTime.localeCompare(b.slot.startTime),
    );
  }, [days, filteredAcudes, isStudent, onlyAvailable, onlyMine, enrolledSlotIds]);

  const visibleEvents = useMemo(
    () => (selectedDay === 'week' ? events : events.filter((event) => event.date === selectedDay)),
    [events, selectedDay],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const date of days) map.set(date, []);
    for (const event of events) map.get(event.date)?.push(event);
    return map;
  }, [days, events]);

  const visibleEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const date of days) map.set(date, []);
    for (const event of visibleEvents) map.get(event.date)?.push(event);
    return map;
  }, [days, visibleEvents]);

  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const event of events) {
      const current = map.get(event.date) ?? [];
      if (!current.includes(event.acude.category)) current.push(event.acude.category);
      map.set(event.date, current);
    }
    return map;
  }, [events]);

  const scenarioGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; events: CalendarEvent[] }>();
    for (const event of visibleEvents) {
      const current = map.get(event.slot.scenarioId);
      if (current) current.events.push(event);
      else {
        map.set(event.slot.scenarioId, {
          id: event.slot.scenarioId,
          name: event.slot.scenarioName,
          events: [event],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [visibleEvents]);

  const selectedAcude = selected ? acudes.find((acude) => acude.id === selected.acudeId) : null;
  const selectedSlot = selectedAcude?.schedule.find((slot) => slot.id === selected?.slotId);
  const existingEnrollment = selectedAcude
    ? activeEnrollments.find(
        (enrollment) => enrollment.acudeId === selectedAcude.id && enrollment.status === 'active',
      ) ?? null
    : null;

  const totalAvailable = events.reduce((sum, event) => sum + Math.max(0, event.slot.available), 0);
  const myCount = visibleEvents.filter((event) => enrolledSlotIds.has(event.slot.id)).length;

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setOnlyAvailable(false);
    setOnlyMine(false);
    setSelectedDay('week');
  };

  const moveWeek = (direction: -1 | 1) => {
    setWeekStart((current) => addDays(current, direction * 7));
    setSelectedDay('week');
    setSelected(null);
  };

  const goToToday = () => {
    const now = todayKey();
    setWeekStart(startOfWeek(now));
    setSelectedDay(now);
    setSelected(null);
  };

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${weekStart}T12:00:00Z`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [weekStart]);

  const handleEnroll = async () => {
    if (!selectedAcude || !selectedSlot) return;
    setBusy(true);
    const result = await enroll(selectedAcude, selectedSlot);
    setBusy(false);
    Alert.alert(
      result.ok
        ? result.queued
          ? 'Inscripción guardada'
          : 'Inscripción confirmada'
        : 'No se pudo inscribir',
      result.message,
      result.ok ? [{ text: 'Entendido', onPress: () => setSelected(null) }] : [{ text: 'Cerrar' }],
    );
  };

  const handleCancel = () => {
    if (!existingEnrollment) return;
    Alert.alert(
      'Cancelar inscripción',
      `¿Quieres cancelar tu inscripción a “${existingEnrollment.acudeName}”?`,
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const result = await cancel(existingEnrollment);
            setBusy(false);
            if (!result.ok) Alert.alert('No se pudo cancelar', result.message);
            else setSelected(null);
          },
        },
      ],
    );
  };

  const renderSession = (event: CalendarEvent, compact = false) => {
    const enrolled = enrolledSlotIds.has(event.slot.id);
    const categoryColor = categoryColors(event.acude.category, isDark);
    const phase = sessionPhase(event.slot, event.date);
    return (
      <Pressable
        key={event.key}
        onPress={() => setSelected({ acudeId: event.acude.id, slotId: event.slot.id })}
        accessibilityRole="button"
        accessibilityLabel={`${event.acude.name}, ${event.slot.startTime}`}
        style={({ pressed }) => [
          styles.session,
          compact && styles.sessionCompact,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderLeftColor: categoryColor.solid,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.sessionTop}>
          <ThemedText variant="label" style={styles.sessionTime}>
            {event.slot.startTime}–{event.slot.endTime}
          </ThemedText>
          <Badge
            label={
              enrolled
                ? 'Inscrito'
                : event.slot.available <= 0
                  ? 'Lleno'
                  : `${event.slot.available} cupos`
            }
            tone={enrolled ? 'success' : event.slot.available <= 0 ? 'danger' : 'info'}
          />
        </View>
        <ThemedText variant={compact ? 'label' : 'subtitle'} numberOfLines={2}>
          {event.acude.name}
        </ThemedText>
        <ThemedText variant="caption" tone="muted" numberOfLines={1}>
          {event.slot.scenarioName} · {event.acude.teacherName}
        </ThemedText>
        {!compact ? (
          <View style={styles.sessionMeta}>
            <Badge label={CATEGORY_LABELS[event.acude.category]} tone="primary" />
            <Badge label={SESSION_PHASE_LABELS[phase]} tone={PHASE_TONE[phase]} />
          </View>
        ) : null}
        <OccupancyBar
          enrolled={event.slot.enrolled}
          capacity={event.slot.capacity}
          pct={event.slot.occupancyPct}
          compact
        />
      </Pressable>
    );
  };

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={syncing}
      onRefresh={() => {
        void refresh();
        void loadFromServer();
      }}
    >
      <PageHeader
        eyebrow="Calendario"
        title="Calendario semanal de ACUDES"
        subtitle={`${SEMESTER_LABEL} · ${SEMESTER_RANGE_LABEL}. Consulta las franjas, filtra y abre cada sesión para inscribirte o revisar su ocupación.`}
        right={
          <Pressable
            onPress={goToToday}
            style={[styles.todayButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Ir a hoy"
          >
            <Ionicons name="locate-outline" size={15} color={colors.primary} />
            <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
              Hoy
            </ThemedText>
          </Pressable>
        }
      />

      <ConnectionBanner />

      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => moveWeek(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Semana anterior"
            style={styles.arrow}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </Pressable>
          <View style={styles.monthTitle}>
            <View style={styles.monthTitleRow}>
              <ThemedText variant="subtitle">{monthLabel}</ThemedText>
              {serverLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
            <ThemedText variant="caption" tone="subtle">
              {formatWeekRange(weekStart)}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => moveWeek(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Semana siguiente"
            style={styles.arrow}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={goToToday}
            accessibilityRole="button"
            accessibilityLabel="Ir a hoy"
            style={[styles.todayChip, { backgroundColor: colors.primarySoft }]}
          >
            <ThemedText variant="caption" tone="primary" style={styles.todayChipText}>
              Hoy
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
        >
          <Pressable
            onPress={() => setSelectedDay('week')}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedDay === 'week' }}
            style={[
              styles.weekChip,
              {
                backgroundColor: selectedDay === 'week' ? colors.primary : colors.surfaceAlt,
                borderColor: selectedDay === 'week' ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={17}
              color={selectedDay === 'week' ? colors.onPrimary : colors.textMuted}
            />
            <ThemedText
              variant="caption"
              style={{
                color: selectedDay === 'week' ? colors.onPrimary : colors.textMuted,
                fontWeight: '800',
              }}
            >
              Semana
            </ThemedText>
          </Pressable>

          {days.map((date) => {
            const active = selectedDay === date;
            const dayIsToday = date === today;
            const dots = dotsByDay.get(date) ?? [];
            const count = (eventsByDay.get(date) ?? []).length;
            return (
              <Pressable
                key={date}
                onPress={() => setSelectedDay(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${WEEKDAY_LABELS[weekdayOf(date)]} ${date}, ${count} actividades`}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderColor: active ? colors.primary : dayIsToday ? colors.primary : colors.border,
                  },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{
                    color: active ? colors.onPrimary : colors.textSubtle,
                    fontWeight: '700',
                  }}
                >
                  {WEEKDAY_SHORT[weekdayOf(date)]}
                </ThemedText>
                <ThemedText
                  variant="subtitle"
                  style={{
                    color: active ? colors.onPrimary : colors.text,
                    fontSize: 18,
                    lineHeight: 21,
                  }}
                >
                  {Number(date.slice(8, 10))}
                </ThemedText>
                <View style={styles.dotRow}>
                  {dots.slice(0, 3).map((dotCategory) => (
                    <View
                      key={`${date}:${dotCategory}`}
                      style={[
                        styles.eventDot,
                        {
                          backgroundColor: active
                            ? colors.onPrimary
                            : categoryColors(dotCategory as AcudeCategory, isDark).solid,
                        },
                      ]}
                    />
                  ))}
                  {dots.length > 3 ? (
                    <ThemedText
                      variant="caption"
                      style={{ color: active ? colors.onPrimary : colors.textSubtle, fontSize: 8 }}
                    >
                      +{dots.length - 3}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.viewRow}>
          {(
            [
              ['agenda', 'Agenda'],
              ['week', 'Semana'],
              ['scenario', 'Por escenario'],
            ] as [CalendarView, string][]
          ).map(([value, label]) => (
            <Chip key={value} label={label} active={view === value} onPress={() => setView(value)} />
          ))}
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por ACUDE, disciplina o docente…"
          accessibilityLabel="Buscar en el calendario"
        />

        <CategoryFilter value={category} onChange={setCategory} />

        <View style={styles.toggleRow}>
          <Chip
            label="Con cupos"
            active={onlyAvailable}
            onPress={() => setOnlyAvailable((value) => !value)}
            icon="checkmark-circle-outline"
          />
          {isStudent ? (
            <Chip
              label="Mis ACUDES"
              active={onlyMine}
              onPress={() => setOnlyMine((value) => !value)}
              icon="bookmark-outline"
            />
          ) : null}
          <Pressable onPress={clearFilters} hitSlop={10} accessibilityRole="button">
            <ThemedText variant="caption" tone="primary" style={styles.clear}>
              Limpiar
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <ThemedText variant="caption" tone="muted">
            <ThemedText variant="label">{visibleEvents.length}</ThemedText> franjas · {totalAvailable}{' '}
            cupos libres
            {isStudent ? ` · ${myCount} de tus subgrupos` : ''}
          </ThemedText>
        </View>
      </View>

      {loading && acudes.length === 0 ? (
        <LoadingState message="Cargando el calendario…" />
      ) : isStudent && onlyMine && activeEnrollments.length === 0 ? (
        <EmptyState
          title="Aún no tienes ACUDES"
          message="Inscríbete desde la cartelera o desmarca “Mis ACUDES” para explorar toda la programación."
          icon="calendar-outline"
          actionLabel="Ir a la cartelera"
          onAction={() => router.push('/(app)/cartelera')}
        />
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          title={selectedDay === 'week' ? 'No hay franjas para estos filtros' : 'No hay actividades este día'}
          message={
            selectedDay === 'week'
              ? 'Prueba con otra categoría o cambia de semana.'
              : 'Desliza los días y elige otro con indicador de actividad, o vuelve a la semana completa.'
          }
          icon="time-outline"
          actionLabel={selectedDay === 'week' ? undefined : 'Ver toda la semana'}
          onAction={selectedDay === 'week' ? undefined : () => setSelectedDay('week')}
        />
      ) : view === 'week' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.weekBoard}
        >
          {days.map((date) => {
            const dayEvents = eventsByDay.get(date) ?? [];
            const isToday = date === today;
            return (
              <View
                key={date}
                style={[
                  styles.weekColumn,
                  {
                    backgroundColor: isToday
                      ? colors.primarySoft
                      : selectedDay === date
                        ? colors.surfaceAlt
                        : colors.surface,
                    borderColor: selectedDay === date ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.weekColumnHeader, { borderBottomColor: colors.border }]}>
                  <ThemedText variant="overline" tone={isToday ? 'primary' : 'subtle'}>
                    {WEEKDAY_LABELS[weekdayOf(date)]}
                  </ThemedText>
                  <ThemedText variant="label" tone={isToday ? 'primary' : 'default'}>
                    {formatDayMonth(date)}
                  </ThemedText>
                  <ThemedText variant="caption" tone="subtle">
                    {dayEvents.length} franja{dayEvents.length === 1 ? '' : 's'}
                  </ThemedText>
                </View>
                <View style={styles.weekColumnBody}>
                  {dayEvents.length === 0 ? (
                    <ThemedText variant="caption" tone="subtle" align="center">
                      Sin sesiones
                    </ThemedText>
                  ) : (
                    dayEvents.map((event) => renderSession(event, true))
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : view === 'scenario' ? (
        <View style={styles.scenarioGroups}>
          {scenarioGroups.map((group) => (
            <View
              key={group.id}
              style={[styles.scenarioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.scenarioHeader}>
                <View style={[styles.scenarioIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                </View>
                <ThemedText variant="subtitle" style={styles.flex}>
                  {group.name}
                </ThemedText>
                <Badge label={`${group.events.length} franjas`} tone="neutral" />
              </View>
              <View style={styles.scenarioEvents}>
                {group.events.map((event) => (
                  <View key={event.key}>
                    <ThemedText variant="caption" tone="subtle">
                      {WEEKDAY_SHORT[event.slot.day]} {formatDayMonth(event.date)}
                    </ThemedText>
                    {renderSession(event, true)}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.agenda}>
          {days.map((date) => {
            const dayEvents = visibleEventsByDay.get(date) ?? [];
            if (dayEvents.length === 0) return null;
            const isToday = date === today;
            return (
              <View
                key={date}
                style={[styles.agendaDay, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.agendaHeader}>
                  <ThemedText variant="subtitle" tone={isToday ? 'primary' : 'default'}>
                    {WEEKDAY_LABELS[weekdayOf(date)]} {formatDayMonth(date)}
                  </ThemedText>
                  <Badge label={`${dayEvents.length} franjas`} tone={isToday ? 'primary' : 'neutral'} />
                </View>
                <View style={styles.agendaSessions}>
                  {dayEvents.map((event) => renderSession(event))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <InlineNotice
        tone="info"
        icon="information-circle-outline"
        message="Selecciona una franja para ver el detalle del ACUDE, su ocupación y las opciones de inscripción."
      />

      <Modal
        visible={!!selected && !!selectedAcude && !!selectedSlot}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView edges={['bottom']} style={styles.modalSafe}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.flex}>
                  <View style={styles.modalBadges}>
                    {selectedAcude ? (
                      <Badge label={CATEGORY_LABELS[selectedAcude.category]} tone="primary" />
                    ) : null}
                    {selectedAcude ? <Badge label={selectedAcude.semester} tone="neutral" /> : null}
                    {existingEnrollment ? <Badge label="Inscrito" tone="success" /> : null}
                  </View>
                  <ThemedText variant="heading" style={styles.modalTitle}>
                    {selectedAcude?.name}
                  </ThemedText>
                  {selectedSlot ? (
                    <ThemedText variant="bodySmall" tone="muted">
                      {WEEKDAY_LABELS[selectedSlot.day]}{' '}
                      {formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)} ·{' '}
                      {selectedSlot.scenarioName}
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setSelected(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {selectedAcude && selectedSlot ? (
                  <>
                    <View style={styles.modalImageWrap}>
                      {coverUri(selectedAcude) ? (
                        <Image
                          source={{ uri: coverUri(selectedAcude) ?? undefined }}
                          style={styles.modalImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View
                          style={[
                            styles.modalImagePlaceholder,
                            { backgroundColor: categoryColors(selectedAcude.category, isDark).soft },
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={32}
                            color={categoryColors(selectedAcude.category, isDark).solid}
                          />
                        </View>
                      )}
                    </View>
                    <ThemedText variant="body" tone="muted">
                      {selectedAcude.description || 'Sin descripción registrada.'}
                    </ThemedText>

                    <View style={styles.modalStats}>
                      <View style={[styles.modalStat, { backgroundColor: colors.surfaceAlt }]}>
                        <ThemedText variant="overline" tone="subtle">
                          Docente
                        </ThemedText>
                        <ThemedText variant="label">{selectedAcude.teacherName}</ThemedText>
                      </View>
                      <View style={[styles.modalStat, { backgroundColor: colors.surfaceAlt }]}>
                        <ThemedText variant="overline" tone="subtle">
                          Cupo del subgrupo
                        </ThemedText>
                        <ThemedText variant="label">
                          {selectedSlot.enrolled} de {selectedSlot.capacity} inscritos
                        </ThemedText>
                      </View>
                    </View>

                    <OccupancyBar
                      enrolled={selectedSlot.enrolled}
                      capacity={selectedSlot.capacity}
                      pct={selectedSlot.occupancyPct}
                    />

                    {isStudent ? (
                      existingEnrollment ? (
                        <View style={[styles.enrolledBox, { backgroundColor: colors.successSoft }]}>
                          <ThemedText variant="label" tone="success">
                            Ya estás inscrito
                          </ThemedText>
                          <ThemedText variant="caption" tone="success">
                            {existingEnrollment.acudeName} ·{' '}
                            {formatTimeRange(existingEnrollment.startTime, existingEnrollment.endTime)}
                          </ThemedText>
                          <Button
                            title="Cancelar inscripción"
                            onPress={handleCancel}
                            variant="dangerOutline"
                            loading={busy}
                            icon="close-circle-outline"
                          />
                        </View>
                      ) : selectedSlot.available > 0 ? (
                        <Button
                          title="Inscribirme"
                          onPress={() => void handleEnroll()}
                          loading={busy}
                          icon="add-circle-outline"
                          size="lg"
                          fullWidth
                        />
                      ) : (
                        <InlineNotice tone="warning" message="Este subgrupo ya está lleno." />
                      )
                    ) : null}

                    <View style={styles.modalActions}>
                      <Button
                        title="Ver ficha completa"
                        onPress={() => {
                          setSelected(null);
                          router.push(`/acude/${selectedAcude.id}`);
                        }}
                        variant="outline"
                        icon="arrow-forward-outline"
                        iconPosition="right"
                        fullWidth
                      />
                      {isAdmin ? (
                        <Button
                          title="Editar ACUDE"
                          onPress={() => {
                            setSelected(null);
                            router.push(`/gestion/${selectedAcude.id}`);
                          }}
                          fullWidth
                          icon="create-outline"
                        />
                      ) : null}
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { flex: 1, alignItems: 'center', gap: 1 },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  todayChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  todayChipText: { fontWeight: '800' },
  dayStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  weekChip: {
    minWidth: 84,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  dayChip: {
    width: 58,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: spacing.xs,
  },
  dotRow: {
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  viewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  clear: { fontWeight: '700', marginLeft: spacing.xs },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  agenda: { gap: spacing.md },
  agendaDay: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  agendaSessions: { gap: spacing.sm },
  session: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sessionCompact: { padding: spacing.sm, gap: 3 },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sessionTime: { fontSize: 12 },
  sessionMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: 2 },
  weekBoard: { gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: spacing.sm },
  weekColumn: {
    width: 164,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  weekColumnHeader: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    gap: 2,
  },
  weekColumnBody: { padding: spacing.sm, gap: spacing.sm, minHeight: 300 },
  scenarioGroups: { gap: spacing.md },
  scenarioCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  scenarioHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scenarioIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenarioEvents: { gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSafe: { maxHeight: '92%' },
  modalCard: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modalTitle: { fontSize: 22, lineHeight: 27, marginTop: spacing.xs },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  modalImageWrap: { height: 140, borderRadius: radius.md, overflow: 'hidden' },
  modalImage: { width: '100%', height: '100%' },
  modalImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalStats: { flexDirection: 'row', gap: spacing.sm },
  modalStat: { flex: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  enrolledBox: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  modalActions: { gap: spacing.sm, marginTop: spacing.xs },
});
