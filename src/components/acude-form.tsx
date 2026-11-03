import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chips';
import { InlineNotice } from '@/components/state-views';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import {
  slotFieldKey,
  validateAcudeDraft,
  type AcudeDraft,
  type AcudeDraftErrors,
} from '@/lib/acude-form';
import {
  ACUDE_STATUS_LABELS,
  CATEGORY_LABELS,
  SCENARIO_STATUS_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { errorMessage } from '@/services/errors';
import type {
  AcudeCategory,
  AcudeInput,
  AcudeStatus,
  Scenario,
  UserProfile,
} from '@/types';

interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

interface ChoiceRowProps {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

function ChoiceRow({ label, value, options, onChange, error, hint }: ChoiceRowProps) {
  return (
    <View style={styles.field}>
      <ThemedText variant="label">{label}</ThemedText>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.hint ? `${option.label} · ${option.hint}` : option.label}
            active={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
      {error ? (
        <ThemedText variant="caption" tone="danger">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText variant="caption" tone="subtle">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export interface AcudeFormProps {
  initial: AcudeDraft;
  scenarios: Scenario[];
  /** Perfiles de profesor para no escribir el UID a mano. */
  managers?: UserProfile[];
  submitLabel: string;
  onSubmit: (input: AcudeInput) => Promise<void> | void;
  submitting?: boolean;
  onArchive?: () => Promise<void> | void;
  archiving?: boolean;
}

export function AcudeForm({
  initial,
  scenarios,
  managers = [],
  submitLabel,
  onSubmit,
  submitting = false,
  onArchive,
  archiving = false,
}: AcudeFormProps) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const canManageImage = user?.role === 'admin';
  const [draft, setDraft] = useState<AcudeDraft>(initial);
  const [errors, setErrors] = useState<AcudeDraftErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const newSlotCounter = useRef(1);

  const update = <K extends keyof AcudeDraft,>(field: K, value: AcudeDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[String(field)]) return prev;
      const next = { ...prev };
      delete next[String(field)];
      return next;
    });
  };

  const updateSlot = (key: string, patch: Partial<AcudeDraft['schedule'][number]>) => {
    setDraft((prev) => ({
      ...prev,
      schedule: prev.schedule.map((slot) =>
        slot.key === key ? { ...slot, ...patch } : slot,
      ),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of ['day', 'startTime', 'endTime', 'scenarioId', 'maxCapacity'] as const) {
        delete next[slotFieldKey(key, field)];
      }
      delete next.schedule;
      return next;
    });
  };

  const addSlot = () => {
    const scenarioId = draft.scenarioId || scenarios[0]?.id || '';
    const key = `new-${Date.now()}-${newSlotCounter.current}`;
    newSlotCounter.current += 1;
    setDraft((prev) => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        {
          key,
          day: 'monday',
          startTime: '08:00',
          endTime: '10:00',
          scenarioId,
          maxCapacity: '',
        },
      ],
    }));
  };

  const removeSlot = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((slot) => slot.key !== key),
    }));
    setErrors({});
  };

  const handleSubmit = async () => {
    setNotice(null);
    const result = validateAcudeDraft(draft);
    setErrors(result.errors);
    if (!result.ok || !result.input) {
      setNotice('Revisa los campos marcados antes de guardar.');
      return;
    }
    try {
      await onSubmit(result.input);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const confirmArchive = () => {
    if (!onArchive) return;
    Alert.alert(
      'Archivar ACUDE',
      'El ACUDE dejará de aparecer en la cartelera. Solo es posible si no tiene inscripciones activas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: () => {
            setNotice(null);
            Promise.resolve(onArchive()).catch((error) => setNotice(errorMessage(error)));
          },
        },
      ],
    );
  };

  const selectedScenario = scenarios.find((scenario) => scenario.id === draft.scenarioId);

  const categoryOptions = (Object.keys(CATEGORY_LABELS) as AcudeCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  }));
  const statusOptions = (Object.keys(ACUDE_STATUS_LABELS) as AcudeStatus[]).map((value) => ({
    value,
    label: ACUDE_STATUS_LABELS[value],
  }));
  const scenarioOptions: ChoiceOption[] = scenarios.map((scenario) => ({
    value: scenario.id,
    label: scenario.name,
    hint:
      scenario.status === 'available'
        ? undefined
        : SCENARIO_STATUS_LABELS[scenario.status],
  }));
  const dayOptions = WEEKDAYS.map((day) => ({ value: day, label: WEEKDAY_LABELS[day] }));

  return (
    <View style={styles.form}>
      {notice ? <InlineNotice tone="danger" message={notice} /> : null}

      {scenarios.length === 0 ? (
        <InlineNotice
          tone="warning"
          icon="alert-circle-outline"
          title="No hay escenarios disponibles"
          message="Un administrador debe crear escenarios antes de programar un ACUDE."
        />
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <ThemedText variant="subtitle">Datos generales</ThemedText>
        </View>

        <TextField
          label="Nombre del ACUDE"
          value={draft.name}
          onChangeText={(value) => update('name', value)}
          placeholder="Ej. Fútbol formativo"
          autoCapitalize="sentences"
          maxLength={120}
          error={errors.name}
        />

        <ChoiceRow
          label="Categoría"
          value={draft.category}
          options={categoryOptions}
          onChange={(value) => update('category', value as AcudeCategory)}
        />

        <TextField
          label="Disciplina"
          value={draft.discipline}
          onChangeText={(value) => update('discipline', value)}
          placeholder="Ej. Fútbol, Teatro, Ajedrez"
          maxLength={80}
          error={errors.discipline}
        />

        <TextField
          label="Descripción"
          value={draft.description}
          onChangeText={(value) => update('description', value)}
          placeholder="Descripción breve para la cartelera"
          multiline
          maxLength={1500}
          error={errors.description}
        />

        <ChoiceRow
          label="Estado"
          value={draft.status}
          options={statusOptions}
          onChange={(value) => update('status', value as AcudeStatus)}
          hint="Solo los publicados aparecen en la cartelera de estudiantes."
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="person-outline" size={18} color={colors.primary} />
          <ThemedText variant="subtitle">Docente responsable</ThemedText>
        </View>
        {managers.length > 0 ? (
          <ChoiceRow
            label="Profesor registrado"
            value={
              managers.some((manager) => manager.uid === draft.teacherId)
                ? draft.teacherId
                : ''
            }
            options={[
              { value: '', label: 'Escribir manualmente' },
              ...managers.map((manager) => ({
                value: manager.uid,
                label: manager.name,
                hint: manager.email,
              })),
            ]}
            onChange={(value) => {
              const manager = managers.find((item) => item.uid === value);
              update('teacherId', manager?.uid ?? '');
              update('teacherName', manager?.name ?? '');
            }}
            hint="Selecciona un profesor o edita el UID y el nombre manualmente."
          />
        ) : (
          <InlineNotice
            tone="info"
            icon="key-outline"
            message="No hay perfiles de profesor disponibles. Escribe el UID y el nombre manualmente o crea un profesor desde Gestión."
          />
        )}
        <TextField
          label="UID del docente"
          value={draft.teacherId}
          onChangeText={(value) => update('teacherId', value)}
          placeholder="UID de Firebase del gestor"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          error={errors.teacherId}
        />
        <TextField
          label="Nombre del docente"
          value={draft.teacherName}
          onChangeText={(value) => update('teacherName', value)}
          placeholder="Nombre visible en la cartelera"
          maxLength={120}
          error={errors.teacherName}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <ThemedText variant="subtitle">Semestre y cupos</ThemedText>
        </View>
        <View style={styles.twoColumns}>
          <TextField
            label="Semestre"
            value={draft.semester}
            onChangeText={(value) => update('semester', value)}
            placeholder="2026-2"
            autoCapitalize="none"
            maxLength={6}
            error={errors.semester}
            containerStyle={styles.flex}
          />
          <TextField
            label="Cupo total"
            value={draft.maxCapacity}
            onChangeText={(value) => update('maxCapacity', value)}
            placeholder="30"
            keyboardType="number-pad"
            maxLength={3}
            error={errors.maxCapacity}
            containerStyle={styles.flex}
          />
        </View>
        <TextField
          label="Asistencia mínima (%)"
          value={draft.attendanceMin}
          onChangeText={(value) => update('attendanceMin', value)}
          placeholder="80"
          keyboardType="number-pad"
          maxLength={3}
          error={errors.attendanceMin}
          hint="Porcentaje de asistencia requerido para acreditar el ACUDE."
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <ThemedText variant="subtitle">Escenario principal</ThemedText>
        </View>
        <ChoiceRow
          label="Escenario"
          value={draft.scenarioId}
          options={scenarioOptions}
          onChange={(value) => update('scenarioId', value)}
          error={errors.scenarioId}
          hint="Debe usarse también en al menos una franja."
        />
        {selectedScenario ? (
          <View style={[styles.scenarioInfo, { backgroundColor: colors.surfaceAlt }]}>
            <ThemedText variant="bodySmall" tone="muted">
              {selectedScenario.location || 'Sin ubicación'} · {selectedScenario.capacity} personas ·{' '}
              {SCENARIO_STATUS_LABELS[selectedScenario.status]}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeading}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <ThemedText variant="subtitle">Franjas horarias</ThemedText>
          </View>
          <Button
            title="Agregar"
            onPress={addSlot}
            variant="secondary"
            size="sm"
            icon="add"
            disabled={draft.schedule.length >= 30}
          />
        </View>
        <ThemedText variant="caption" tone="subtle">
          Cada franja es un subgrupo con cupo propio. No puede haber cruces en el mismo escenario y día.
        </ThemedText>
        {errors.schedule ? (
          <ThemedText variant="caption" tone="danger">
            {errors.schedule}
          </ThemedText>
        ) : null}

        <View style={styles.slots}>
          {draft.schedule.map((slot, index) => (
            <View
              key={slot.key}
              style={[styles.slotCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.slotHeader}>
                <View style={styles.slotTitle}>
                  <ThemedText variant="label">Franja {index + 1}</ThemedText>
                  {slot.id ? (
                    <ThemedText variant="caption" tone="subtle">
                      Subgrupo existente
                    </ThemedText>
                  ) : (
                    <ThemedText variant="caption" tone="warning">
                      Nueva
                    </ThemedText>
                  )}
                </View>
                <Pressable
                  onPress={() => removeSlot(slot.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar franja ${index + 1}`}
                  hitSlop={8}
                  disabled={draft.schedule.length <= 1}
                  style={({ pressed }) => [
                    styles.removeSlot,
                    {
                      backgroundColor: colors.dangerSoft,
                      opacity: draft.schedule.length <= 1 ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>

              <ChoiceRow
                label="Día"
                value={slot.day}
                options={dayOptions}
                onChange={(value) => updateSlot(slot.key, { day: value as AcudeDraft['schedule'][number]['day'] })}
              />

              <View style={styles.twoColumns}>
                <TimeField
                  label="Inicio"
                  value={slot.startTime}
                  onChangeText={(value) => updateSlot(slot.key, { startTime: value })}
                  error={errors[slotFieldKey(slot.key, 'startTime')]}
                  containerStyle={styles.flex}
                />
                <TimeField
                  label="Fin"
                  value={slot.endTime}
                  onChangeText={(value) => updateSlot(slot.key, { endTime: value })}
                  error={errors[slotFieldKey(slot.key, 'endTime')]}
                  containerStyle={styles.flex}
                />
              </View>

              <ChoiceRow
                label="Escenario de la franja"
                value={slot.scenarioId}
                options={scenarioOptions}
                onChange={(value) => updateSlot(slot.key, { scenarioId: value })}
                error={errors[slotFieldKey(slot.key, 'scenarioId')]}
              />

              <TextField
                label="Cupo de esta franja"
                value={slot.maxCapacity}
                onChangeText={(value) => updateSlot(slot.key, { maxCapacity: value })}
                placeholder="Opcional; hereda el cupo del escenario"
                keyboardType="number-pad"
                maxLength={3}
                error={errors[slotFieldKey(slot.key, 'maxCapacity')]}
                optional
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <ThemedText variant="subtitle">Requisitos e imagen</ThemedText>
        </View>
        <TextField
          label="Requisitos"
          value={draft.requirements}
          onChangeText={(value) => update('requirements', value)}
          placeholder="Ej. Ropa deportiva, certificado médico…"
          multiline
          maxLength={800}
          error={errors.requirements}
          optional
        />
        {canManageImage ? (
          <TextField
            label="URL de imagen"
            value={draft.imageUrl}
            onChangeText={(value) => update('imageUrl', value)}
            placeholder="/images/acudes/futbol.jpg o https://…"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={500}
            error={errors.imageUrl}
            hint="Usa una ruta interna o una URL externa. También puedes cambiar la portada desde el detalle del ACUDE."
            optional
          />
        ) : null}
      </View>

      <Button
        title={submitLabel}
        onPress={() => void handleSubmit()}
        loading={submitting}
        disabled={archiving}
        icon="save-outline"
        size="lg"
        fullWidth
      />

      {onArchive ? (
        <Button
          title="Archivar ACUDE"
          onPress={confirmArchive}
          variant="dangerOutline"
          icon="archive-outline"
          loading={archiving}
          disabled={submitting}
          fullWidth
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  field: { gap: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  scenarioInfo: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  slots: { gap: spacing.md },
  slotCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slotTitle: { gap: 1 },
  removeSlot: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
