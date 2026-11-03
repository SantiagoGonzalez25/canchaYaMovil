import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { InlineNotice } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/constants/theme';
import {
  validateScenarioDraft,
  type ScenarioDraft,
  type ScenarioDraftErrors,
} from '@/lib/scenario-form';
import {
  SCENARIO_STATUS_LABELS,
  SCENARIO_TYPE_LABELS,
} from '@/lib/labels';
import { errorMessage } from '@/services/errors';
import type { ScenarioInput, ScenarioStatus, ScenarioType } from '@/types';

export interface ScenarioFormProps {
  initial: ScenarioDraft;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (input: ScenarioInput) => Promise<void> | void;
  onCancel?: () => void;
}

export function ScenarioForm({
  initial,
  submitLabel,
  submitting = false,
  onSubmit,
  onCancel,
}: ScenarioFormProps) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<ScenarioDraftErrors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof ScenarioDraft,>(field: K, value: ScenarioDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[String(field)]) return prev;
      const next = { ...prev };
      delete next[String(field)];
      return next;
    });
  };

  const handleSubmit = async () => {
    setNotice(null);
    const result = validateScenarioDraft(draft);
    setErrors(result.errors);
    if (!result.ok || !result.input) {
      setNotice('Revisa los campos marcados.');
      return;
    }
    try {
      await onSubmit(result.input);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const typeOptions = (Object.keys(SCENARIO_TYPE_LABELS) as ScenarioType[]).map((value) => ({
    value,
    label: SCENARIO_TYPE_LABELS[value],
  }));
  const statusOptions = (Object.keys(SCENARIO_STATUS_LABELS) as ScenarioStatus[]).map(
    (value) => ({ value, label: SCENARIO_STATUS_LABELS[value] }),
  );

  return (
    <View style={styles.form}>
      {notice ? <InlineNotice tone="danger" message={notice} /> : null}

      <TextField
        label="Nombre"
        value={draft.name}
        onChangeText={(value) => update('name', value)}
        placeholder="Coliseo institucional"
        maxLength={100}
        error={errors.name}
      />

      <View style={styles.field}>
        <ThemedText variant="label">Tipo</ThemedText>
        <View style={styles.chips}>
          {typeOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={draft.type === option.value}
              onPress={() => update('type', option.value as ScenarioType)}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <ThemedText variant="label">Estado</ThemedText>
        <View style={styles.chips}>
          {statusOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={draft.status === option.value}
              onPress={() => update('status', option.value as ScenarioStatus)}
            />
          ))}
        </View>
      </View>

      <TextField
        label="Ubicación"
        value={draft.location}
        onChangeText={(value) => update('location', value)}
        placeholder="Campus Robledo · Bloque 10"
        maxLength={160}
        error={errors.location}
      />

      <TextField
        label="Capacidad"
        value={draft.capacity}
        onChangeText={(value) => update('capacity', value)}
        placeholder="30"
        keyboardType="number-pad"
        maxLength={4}
        error={errors.capacity}
        hint="Capacidad física del escenario, entre 1 y 5000."
      />

      <TextField
        label="Descripción"
        value={draft.description}
        onChangeText={(value) => update('description', value)}
        placeholder="Maderamen, iluminación, accesibilidad…"
        multiline
        maxLength={600}
        error={errors.description}
        optional
      />

      <Button
        title={submitLabel}
        onPress={() => void handleSubmit()}
        loading={submitting}
        icon="save-outline"
        fullWidth
      />
      {onCancel ? (
        <Button title="Cancelar" onPress={onCancel} variant="ghost" fullWidth />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
