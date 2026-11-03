import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { ReportChart } from '@/components/report-chart';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { StatCard } from '@/components/stat-card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { addDays, formatDateTime, isDateKey, todayKey } from '@/lib/date';
import {
  CATEGORY_LABELS,
  REPORT_GROUP_LABELS,
  REPORT_KIND_LABELS,
  SEX_LABELS,
  WEEKDAYS,
  WEEKDAY_SHORT,
} from '@/lib/labels';
import { buildReportCsv, buildReportMatrix, reportFileName } from '@/lib/report';
import { reportPdfFileName } from '@/lib/report-pdf';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { getScenarios, listAcudes } from '@/services/acudes-service';
import { buildApiUrl } from '@/services/api-client';
import { errorMessage } from '@/services/errors';
import { getAttendanceReport, getEnrollmentReport } from '@/services/reports-service';
import { getValidIdToken } from '@/services/session-manager';
import type {
  Acude,
  AcudeCategory,
  AttendanceStatus,
  EnrollmentStatus,
  ReportGroupBy,
  ReportKind,
  ReportResult,
  Scenario,
  Sex,
  Weekday,
} from '@/types';

interface FilterState {
  from: string;
  to: string;
  student: string;
  acudeId: string;
  category: AcudeCategory | '';
  discipline: string;
  scenarioId: string;
  slotId: string;
  day: Weekday | '';
  sex: Sex | '';
  status: EnrollmentStatus | AttendanceStatus | '';
  teacherId: string;
  groupBy: ReportGroupBy;
}

interface Choice {
  value: string;
  label: string;
}

const GROUP_OPTIONS = Object.keys(REPORT_GROUP_LABELS) as ReportGroupBy[];

function initialFilters(): FilterState {
  const to = todayKey();
  return {
    from: addDays(to, -30),
    to,
    student: '',
    acudeId: '',
    category: '',
    discipline: '',
    scenarioId: '',
    slotId: '',
    day: '',
    sex: '',
    status: '',
    teacherId: '',
    groupBy: 'date',
  };
}

function FilterChoices({
  label,
  value,
  options,
  onChange,
  horizontal = false,
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  horizontal?: boolean;
}) {
  const content = options.map((option) => (
    <Chip
      key={option.value || 'all'}
      label={option.label}
      active={value === option.value}
      onPress={() => onChange(option.value)}
    />
  ));

  return (
    <View style={styles.filterField}>
      <ThemedText variant="label">{label}</ThemedText>
      {horizontal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalChips}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.wrappedChips}>{content}</View>
      )}
    </View>
  );
}

function queryFromFilters(filters: FilterState): {
  query: Parameters<typeof getEnrollmentReport>[0];
  error: string | null;
} {
  if (filters.from && !isDateKey(filters.from)) {
    return { query: {}, error: 'La fecha “Desde” debe tener formato AAAA-MM-DD.' };
  }
  if (filters.to && !isDateKey(filters.to)) {
    return { query: {}, error: 'La fecha “Hasta” debe tener formato AAAA-MM-DD.' };
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { query: {}, error: 'La fecha “Desde” no puede ser posterior a “Hasta”.' };
  }

  return {
    error: null,
    query: {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.student.trim() ? { student: filters.student.trim() } : {}),
      ...(filters.acudeId ? { acudeId: filters.acudeId } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.discipline ? { discipline: filters.discipline } : {}),
      ...(filters.scenarioId ? { scenarioId: filters.scenarioId } : {}),
      ...(filters.slotId ? { slotId: filters.slotId } : {}),
      ...(filters.day ? { day: filters.day } : {}),
      ...(filters.sex ? { sex: filters.sex } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      groupBy: filters.groupBy,
    },
  };
}

export default function ReportesScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const isStaff = user?.role === 'manager' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [kind, setKind] = useState<ReportKind>('enrollments');
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [query, setQuery] = useState<Parameters<typeof getEnrollmentReport>[0]>(
    {},
  );
  const [report, setReport] = useState<ReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [acudes, setAcudes] = useState<Acude[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const catalogRequestRef = useRef<AbortController | null>(null);
  const reportRequestRef = useRef<AbortController | null>(null);

  const loadCatalog = useCallback(async () => {
    catalogRequestRef.current?.abort();
    if (!isStaff || !isOnline) return;

    const controller = new AbortController();
    catalogRequestRef.current = controller;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [acudeResult, scenarioResult] = await Promise.all([
        listAcudes({}, controller.signal),
        getScenarios(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setAcudes(acudeResult.acudes);
      setScenarios(scenarioResult);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setCatalogError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setCatalogLoading(false);
    }
  }, [isOnline, isStaff]);

  const loadReport = useCallback(async () => {
    reportRequestRef.current?.abort();
    if (!isStaff || !isOnline) return;

    const controller = new AbortController();
    reportRequestRef.current = controller;
    setReportLoading(true);
    setReportError(null);
    try {
      const result =
        kind === 'attendance'
          ? await getAttendanceReport(query, controller.signal)
          : await getEnrollmentReport(query, controller.signal);
      if (controller.signal.aborted) return;
      setReport(result);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setReportError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setReportLoading(false);
    }
  }, [isOnline, isStaff, kind, query]);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
      return () => catalogRequestRef.current?.abort();
    }, [loadCatalog]),
  );

  useFocusEffect(
    useCallback(() => {
      void loadReport();
      return () => reportRequestRef.current?.abort();
    }, [loadReport]),
  );

  const categories = useMemo(() => {
    const present = new Set(acudes.map((acude) => acude.category));
    return (Object.keys(CATEGORY_LABELS) as AcudeCategory[]).filter((category) =>
      present.has(category),
    );
  }, [acudes]);

  const disciplines = useMemo(
    () => [...new Set(acudes.map((acude) => acude.discipline))].sort((a, b) => a.localeCompare(b, 'es')),
    [acudes],
  );

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const acude of acudes) map.set(acude.teacherId, acude.teacherName);
    return [...map.entries()];
  }, [acudes]);

  const usedScenarioIds = useMemo(
    () => new Set(acudes.flatMap((acude) => acude.schedule.map((slot) => slot.scenarioId))),
    [acudes],
  );

  const scenarioChoices = scenarios
    .filter((scenario) => usedScenarioIds.has(scenario.id))
    .map((scenario) => ({ value: scenario.id, label: scenario.name }));

  const slots = useMemo(
    () =>
      acudes
        .filter((acude) => !filters.acudeId || acude.id === filters.acudeId)
        .flatMap((acude) =>
          acude.schedule.map((slot) => ({
            value: slot.id,
            label: `${acude.name} · ${WEEKDAY_SHORT[slot.day]} ${slot.startTime}–${slot.endTime}`,
          })),
        ),
    [acudes, filters.acudeId],
  );

  const acudeChoices: Choice[] = [
    { value: '', label: 'Todos' },
    ...acudes.map((acude) => ({ value: acude.id, label: acude.name })),
  ];

  const statusChoices: Choice[] = [
    { value: '', label: 'Todos' },
    ...(kind === 'attendance'
      ? [
          { value: 'present', label: 'Asistió' },
          { value: 'absent', label: 'No asistió' },
        ]
      : [
          { value: 'active', label: 'Activa' },
          { value: 'canceled', label: 'Cancelada' },
        ]),
  ];

  const setFilter = <K extends keyof FilterState,>(field: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setFilterError(null);
  };

  const apply = (nextKind: ReportKind = kind, nextFilters: FilterState = filters) => {
    const { query: nextQuery, error } = queryFromFilters(nextFilters);
    if (error) {
      setFilterError(error);
      return;
    }
    setKind(nextKind);
    setQuery(nextQuery);
    setReportError(null);
  };

  const changeKind = (nextKind: ReportKind) => {
    const nextFilters: FilterState = {
      ...filters,
      status: '',
      groupBy: nextKind === 'attendance' ? 'acude' : 'date',
    };
    setFilters(nextFilters);
    apply(nextKind, nextFilters);
  };

  const clearFilters = () => {
    const next = initialFilters();
    setFilters(next);
    setFilterError(null);
    setKind('enrollments');
    apply('enrollments', next);
  };

  const setRange = (days: number) => {
    const to = todayKey();
    const next = { ...filters, from: addDays(to, -days), to };
    setFilters(next);
    setFilterError(null);
    apply(kind, next);
  };

  const exportReport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const csv = buildReportCsv(report);
      const fileName = reportFileName(report);
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true, intermediates: true });
      await file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Compartir reporte CanchaYa',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({
          title: fileName,
          message: csv,
        });
      }
    } catch (error) {
      Alert.alert('No se pudo exportar el reporte', errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    try {
      const fileName = reportPdfFileName(report);
      const url = buildApiUrl(`/api/reports/${kind}/pdf`, query);
      const destination = new File(Paths.cache, fileName).uri;
      await LegacyFileSystem.deleteAsync(destination, { idempotent: true }).catch(
        () => undefined,
      );

      const download = async (token: string) =>
        LegacyFileSystem.downloadAsync(url, destination, {
          headers: { Authorization: `Bearer ${token}` },
        });

      let result = await download(await getValidIdToken());
      if (result.status === 401) {
        result = await download(await getValidIdToken(true));
      }
      if (result.status < 200 || result.status >= 300) {
        await LegacyFileSystem.deleteAsync(destination, { idempotent: true }).catch(
          () => undefined,
        );
        throw new Error('No se pudo generar el PDF del reporte. Inténtalo de nuevo.');
      }

      // El archivo queda en la caché propia de la app, así que Sharing puede
      // leerlo sin los problemas de permisos de la caché de Expo Go.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: fileName,
        });
      } else {
        await Share.share({
          title: fileName,
          url: result.uri,
          message: `Reporte ${fileName}`,
        });
      }
    } catch (error) {
      Alert.alert('No se pudo exportar el PDF', errorMessage(error));
    } finally {
      setExportingPdf(false);
    }
  };

  if (!isStaff) {
    return (
      <Screen>
        <EmptyState
          title="Reportes para gestores y administradores"
          message="Tu cuenta de estudiante no tiene permisos para consultar los reportes institucionales."
          icon="lock-closed-outline"
        />
      </Screen>
    );
  }

  const matrix = report ? buildReportMatrix(report) : null;
  const reportAcudes = report
    ? [...new Set(report.rows.map((row) => row.acude).filter((name) => Boolean(name)))]
    : [];
  const activeFilterCount = [
    filters.acudeId,
    filters.category,
    filters.discipline,
    filters.scenarioId,
    filters.slotId,
    filters.day,
    filters.sex,
    filters.status,
    filters.teacherId,
    filters.student.trim(),
  ].filter(Boolean).length;

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={(reportLoading && !!report) || (catalogLoading && acudes.length > 0)}
      onRefresh={() => {
        void loadCatalog();
        void loadReport();
      }}
    >
      <PageHeader
        eyebrow="Gestión · Analítica"
        title="Reportes de eventos y asistencia"
        subtitle="Filtra por fechas y por los campos de cada ACUDE. Consulta los resultados en gráficas y exporta a CSV."
      />

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Reportes"
          message="Necesitas conexión para consultar los reportes de inscripciones y asistencia."
        />
      ) : catalogLoading && acudes.length === 0 ? (
        <LoadingState message="Cargando filtros del reporte…" />
      ) : catalogError ? (
        <EmptyState
          title="No pudimos cargar los filtros"
          message={catalogError}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void loadCatalog()}
        />
      ) : (
        <>
          <View style={styles.kindRow}>
            {(['enrollments', 'attendance'] as ReportKind[]).map((option) => (
              <Chip
                key={option}
                label={REPORT_KIND_LABELS[option]}
                active={kind === option}
                onPress={() => changeKind(option)}
              />
            ))}
          </View>

          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.filterHeader}>
              <View style={styles.flex}>
                <ThemedText variant="subtitle">Filtros</ThemedText>
                <ThemedText variant="caption" tone="subtle">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filtro${activeFilterCount === 1 ? '' : 's'} activo${activeFilterCount === 1 ? '' : 's'}`
                    : 'Sin filtros adicionales'}
                </ThemedText>
              </View>
              <Button
                title={showAdvanced ? 'Ocultar' : 'Más filtros'}
                onPress={() => setShowAdvanced((value) => !value)}
                variant="ghost"
                size="sm"
                icon={showAdvanced ? 'chevron-up' : 'options-outline'}
              />
            </View>

            <View style={styles.dateRow}>
              <TextField
                label="Desde"
                value={filters.from}
                onChangeText={(value) => setFilter('from', value)}
                placeholder="2026-10-01"
                autoCapitalize="none"
                maxLength={10}
                containerStyle={styles.flex}
              />
              <TextField
                label="Hasta"
                value={filters.to}
                onChangeText={(value) => setFilter('to', value)}
                placeholder="2026-10-31"
                autoCapitalize="none"
                maxLength={10}
                containerStyle={styles.flex}
              />
            </View>

            <View style={styles.rangeRow}>
              <Chip label="Últimos 7 días" onPress={() => setRange(7)} />
              <Chip label="Últimos 30 días" onPress={() => setRange(30)} />
            </View>

            <TextField
              label="Estudiante"
              value={filters.student}
              onChangeText={(value) => setFilter('student', value)}
              placeholder="Nombre o correo"
              autoCapitalize="none"
              leftIcon="search-outline"
            />

            <FilterChoices
              label="ACUDE"
              value={filters.acudeId}
              options={acudeChoices}
              onChange={(value) => {
                setFilter('acudeId', value);
                if (value) setFilter('slotId', '');
              }}
              horizontal
            />

            {showAdvanced ? (
              <>
                {categories.length > 0 ? (
                  <FilterChoices
                    label="Categoría"
                    value={filters.category}
                    options={[
                      { value: '', label: 'Todas' },
                      ...categories.map((value) => ({
                        value,
                        label: CATEGORY_LABELS[value],
                      })),
                    ]}
                    onChange={(value) => setFilter('category', value as AcudeCategory | '')}
                  />
                ) : null}

                {disciplines.length > 0 ? (
                  <FilterChoices
                    label="Disciplina"
                    value={filters.discipline}
                    options={[
                      { value: '', label: 'Todas' },
                      ...disciplines.map((value) => ({ value, label: value })),
                    ]}
                    onChange={(value) => setFilter('discipline', value)}
                  />
                ) : null}

                {scenarioChoices.length > 0 ? (
                  <FilterChoices
                    label="Escenario"
                    value={filters.scenarioId}
                    options={[{ value: '', label: 'Todos' }, ...scenarioChoices]}
                    onChange={(value) => setFilter('scenarioId', value)}
                  />
                ) : null}

                {slots.length > 0 ? (
                  <FilterChoices
                    label="Franja"
                    value={filters.slotId}
                    options={[{ value: '', label: 'Todas' }, ...slots]}
                    onChange={(value) => setFilter('slotId', value)}
                  />
                ) : null}

                <FilterChoices
                  label="Día"
                  value={filters.day}
                  options={[
                    { value: '', label: 'Todos' },
                    ...WEEKDAYS.map((day) => ({ value: day, label: WEEKDAY_SHORT[day] })),
                  ]}
                  onChange={(value) => setFilter('day', value as Weekday | '')}
                />

                <FilterChoices
                  label="Sexo"
                  value={filters.sex}
                  options={[
                    { value: '', label: 'Todos' },
                    ...(Object.keys(SEX_LABELS) as Sex[]).map((value) => ({
                      value,
                      label: SEX_LABELS[value],
                    })),
                  ]}
                  onChange={(value) => setFilter('sex', value as Sex | '')}
                />

                <FilterChoices
                  label={kind === 'attendance' ? 'Estado de asistencia' : 'Estado de inscripción'}
                  value={filters.status}
                  options={statusChoices}
                  onChange={(value) =>
                    setFilter('status', value as EnrollmentStatus | AttendanceStatus | '')
                  }
                />

                {isAdmin && teachers.length > 0 ? (
                  <FilterChoices
                    label="Docente"
                    value={filters.teacherId}
                    options={[
                      { value: '', label: 'Todos' },
                      ...teachers.map(([value, label]) => ({ value, label })),
                    ]}
                    onChange={(value) => setFilter('teacherId', value)}
                  />
                ) : null}

                <FilterChoices
                  label="Agrupar por"
                  value={filters.groupBy}
                  options={GROUP_OPTIONS.map((value) => ({
                    value,
                    label: REPORT_GROUP_LABELS[value],
                  }))}
                  onChange={(value) => setFilter('groupBy', value as ReportGroupBy)}
                />
              </>
            ) : null}

            {filterError ? <InlineNotice tone="danger" message={filterError} /> : null}

            <View style={styles.filterActions}>
              <Button
                title="Generar reporte"
                onPress={() => apply()}
                icon="bar-chart-outline"
                fullWidth
                style={styles.flex}
              />
              <Button
                title="Limpiar"
                onPress={clearFilters}
                variant="outline"
                icon="refresh-outline"
              />
            </View>
          </View>

          {reportLoading && !report ? (
            <LoadingState message="Calculando el reporte…" />
          ) : reportError ? (
            <EmptyState
              title="No pudimos generar el reporte"
              message={reportError}
              icon="alert-circle-outline"
              actionLabel="Reintentar"
              onAction={() => void loadReport()}
            />
          ) : report ? (
            <>
              <View style={styles.summaryRow}>
                {report.kind === 'attendance' ? (
                  <>
                    <StatCard label="Registros" value={report.summary.total} tone="teal" />
                    <StatCard label="Asistencias" value={report.summary.present} tone="blue" />
                    <StatCard label="Ausencias" value={report.summary.absent} tone="rose" />
                    <StatCard
                      label="Asistencia efectiva"
                      value={`${report.summary.attendanceRate}%`}
                      tone="violet"
                    />
                  </>
                ) : (
                  <>
                    <StatCard label="Eventos" value={report.summary.total} tone="teal" />
                    <StatCard label="Activas" value={report.summary.active} tone="blue" />
                    <StatCard label="Canceladas" value={report.summary.canceled} tone="rose" />
                    <StatCard
                      label="Cancelación"
                      value={`${
                        report.summary.total > 0
                          ? Math.round((report.summary.canceled / report.summary.total) * 100)
                          : 0
                      }%`}
                      tone="amber"
                    />
                  </>
                )}
              </View>

              <View style={styles.reportCard}>
                <SectionHeader
                  title={`${REPORT_KIND_LABELS[report.kind]} · ${REPORT_GROUP_LABELS[report.groupBy]}`}
                  actionLabel="Exportar CSV"
                  onAction={() => void exportReport()}
                  icon="share-outline"
                />
                <ThemedText variant="caption" tone="subtle" style={styles.reportMeta}>
                  Rango {report.from || 'sin límite'} → {report.to || 'hoy'} · {report.summary.total}{' '}
                  registros · generado {formatDateTime(report.generatedAt)}
                </ThemedText>
                {reportAcudes.length > 0 ? (
                  <ThemedText variant="caption" tone="muted">
                    ACUDES: {reportAcudes.join(' · ')}
                  </ThemedText>
                ) : null}

                {report.summary.total === 0 ? (
                  <EmptyState
                    title="Sin datos para estos filtros"
                    message="Amplía el rango de fechas o quita filtros. La asistencia solo existe después de registrarla."
                    icon="bar-chart-outline"
                  />
                ) : (
                  <>
                    {reportLoading ? <LoadingState message="Actualizando reporte…" /> : null}
                    <ReportChart report={report} />
                    {matrix && matrix.rows.length > 15 ? (
                      <ThemedText variant="caption" tone="subtle">
                        Gráfica: primeros 15 de {matrix.rows.length} grupos. El desglose y el CSV
                        incluyen todos.
                      </ThemedText>
                    ) : null}

                    <SectionHeader title="Desglose" />
                    <View style={[styles.table, { borderColor: colors.border }]}>
                      <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.surfaceAlt }]}>
                        <ThemedText variant="caption" style={[styles.colGroup, styles.strong]}>
                          {REPORT_GROUP_LABELS[report.groupBy]}
                        </ThemedText>
                        {report.series.map((series) => (
                          <ThemedText
                            key={series.name}
                            variant="caption"
                            style={[styles.colValue, styles.strong]}
                          >
                            {series.name}
                          </ThemedText>
                        ))}
                      </View>
                      {matrix?.rows.map((row) => (
                        <View key={row.key} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                          <ThemedText variant="caption" numberOfLines={2} style={styles.colGroup}>
                            {row.label}
                          </ThemedText>
                          {row.values.map((value, index) => (
                            <ThemedText
                              key={`${row.key}:${index}`}
                              variant="caption"
                              style={styles.colValue}
                            >
                              {value}
                            </ThemedText>
                          ))}
                        </View>
                      ))}
                    </View>

                    {report.rows.length > 0 ? (
                      <>
                        <SectionHeader title="Últimos registros" />
                        <View style={styles.detailList}>
                          {report.rows.slice(0, 20).map((row, index) => (
                            <View
                              key={`${row.date}:${row.email}:${row.acude}:${index}`}
                              style={[styles.detailRow, { borderColor: colors.border }]}
                            >
                              <View style={styles.flex}>
                                <ThemedText variant="label">{row.student}</ThemedText>
                                <ThemedText variant="caption" tone="muted">
                                  {row.acude} · {row.slot}
                                </ThemedText>
                                <ThemedText variant="caption" tone="subtle">
                                  {row.date} · {row.scenario} · {row.teacher}
                                </ThemedText>
                              </View>
                              <ThemedText
                                variant="caption"
                                tone={
                                  row.status === 'Asistió' || row.status === 'Activa'
                                    ? 'success'
                                    : row.status === 'No asistió' || row.status === 'Cancelada'
                                      ? 'danger'
                                      : 'muted'
                                }
                                style={styles.detailStatus}
                              >
                                {row.status}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                        {report.rows.length > 20 ? (
                          <ThemedText variant="caption" tone="subtle" style={styles.detailNote}>
                            Mostrando 20 de {report.rows.length} registros. El CSV incluye todos.
                          </ThemedText>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}

                <View style={styles.exportActions}>
                  <Button
                    title={exporting ? 'Preparando CSV…' : 'Exportar CSV'}
                    onPress={() => void exportReport()}
                    loading={exporting}
                    disabled={exportingPdf}
                    variant="secondary"
                    icon="download-outline"
                    style={styles.flex}
                  />
                  <Button
                    title={exportingPdf ? 'Preparando PDF…' : 'Exportar PDF'}
                    onPress={() => void exportPdf()}
                    loading={exportingPdf}
                    disabled={exporting}
                    variant="primary"
                    icon="document-text-outline"
                    style={styles.flex}
                  />
                </View>
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterField: { gap: spacing.xs },
  wrappedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  horizontalChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  reportCard: { marginTop: spacing.lg, gap: spacing.md },
  reportMeta: { marginTop: -spacing.sm },
  table: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  tableHeader: { borderTopWidth: 0 },
  colGroup: { flex: 2, paddingRight: spacing.xs },
  colValue: { flex: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  detailList: { gap: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  detailStatus: { minWidth: 58, textAlign: 'right' },
  detailNote: { marginTop: -spacing.sm },
  exportActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
