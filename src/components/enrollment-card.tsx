import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { categoryColors, radius, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong, formatTimeRange } from '@/lib/date';
import { CATEGORY_LABELS, WEEKDAY_LABELS } from '@/lib/labels';
import type { LocalEnrollment } from '@/types';
import { Badge } from './badge';
import { Button } from './button';
import { InlineNotice } from './state-views';
import { ThemedText } from './themed-text';

export interface EnrollmentCardProps {
  enrollment: LocalEnrollment;
  onCancel?: () => void;
  onDismissConflict?: () => void;
  canceling?: boolean;
  past?: boolean;
}

export function EnrollmentCard({
  enrollment,
  onCancel,
  onDismissConflict,
  canceling,
  past = false,
}: EnrollmentCardProps) {
  const { colors, isDark } = useAppTheme();
  const category = categoryColors(enrollment.category, isDark);
  const isPending = enrollment.syncState === 'pending';
  const isConflict = enrollment.syncState === 'conflict';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: past ? 0.62 : 1,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: category.solid }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge label={CATEGORY_LABELS[enrollment.category]} tone="primary" />
          {isConflict ? (
            <Badge label="Revisar" tone="danger" icon="alert-circle-outline" />
          ) : isPending ? (
            <Badge label="Pendiente" tone="warning" icon="cloud-upload-outline" />
          ) : (
            <Badge
              label={past ? 'Finalizada' : 'Activa'}
              tone={past ? 'neutral' : 'success'}
              icon={past ? 'time-outline' : 'checkmark-circle-outline'}
            />
          )}
        </View>

        <ThemedText variant="subtitle">{enrollment.acudeName}</ThemedText>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <ThemedText variant="bodySmall" tone="muted" style={styles.flex}>
            {WEEKDAY_LABELS[enrollment.day]} · {formatTimeRange(enrollment.startTime, enrollment.endTime)}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={15} color={colors.textSubtle} />
          <ThemedText variant="bodySmall" tone="muted" style={styles.flex}>
            {enrollment.scenarioName} · {enrollment.teacherName}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={15} color={colors.textSubtle} />
          <ThemedText variant="caption" tone="subtle" style={styles.flex}>
            Inscrito el {formatDateLong(enrollment.enrolledOn)}
          </ThemedText>
        </View>

        {isConflict ? (
          <>
            <InlineNotice
              tone="danger"
              title="No se pudo aplicar este cambio"
              message={
                enrollment.syncError ??
                'La operación no se pudo aplicar. Revisa tu horario o el cupo disponible.'
              }
            />
            {onDismissConflict ? (
              <Button
                title="Entendido, descartar"
                onPress={onDismissConflict}
                variant="outline"
                size="sm"
                fullWidth
              />
            ) : null}
          </>
        ) : isPending ? (
          <InlineNotice
            tone="warning"
            icon="cloud-upload-outline"
            message={
              enrollment.status === 'canceled'
                ? 'Cancelación guardada. Se enviará al recuperar la conexión.'
                : 'Inscripción guardada en el dispositivo. Se enviará al recuperar la conexión.'
            }
          />
        ) : null}

        {!past && enrollment.status === 'active' && !isConflict && onCancel ? (
          <Button
            title="Cancelar inscripción"
            onPress={onCancel}
            variant="dangerOutline"
            size="sm"
            icon="close-circle-outline"
            loading={canceling}
            fullWidth
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  accent: { width: 5 },
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
