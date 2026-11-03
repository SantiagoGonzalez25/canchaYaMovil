import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatTimeRange } from '@/lib/date';
import { WEEKDAY_LABELS } from '@/lib/labels';
import type { LiveScheduleSlot } from '@/types';
import { Badge } from './badge';
import { Button } from './button';
import { AvailabilityPill, OccupancyBar } from './occupancy';
import { ThemedText } from './themed-text';

export interface SlotRowProps {
  slot: LiveScheduleSlot;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  actionDisabled?: boolean;
  enrolledLabel?: string;
  footer?: React.ReactNode;
}

export function SlotRow({
  slot,
  actionLabel,
  onAction,
  actionLoading,
  actionDisabled,
  enrolledLabel,
  footer,
}: SlotRowProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <ThemedText variant="label">
            {WEEKDAY_LABELS[slot.day]} · {formatTimeRange(slot.startTime, slot.endTime)}
          </ThemedText>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSubtle} />
            <ThemedText variant="caption" tone="muted">
              {slot.scenarioName}
            </ThemedText>
          </View>
        </View>
        <AvailabilityPill available={slot.available} capacity={slot.capacity} />
      </View>

      <OccupancyBar enrolled={slot.enrolled} capacity={slot.capacity} pct={slot.occupancyPct} />

      {enrolledLabel ? (
        <Badge label={enrolledLabel} tone="success" icon="checkmark-circle-outline" />
      ) : null}

      {footer}

      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          loading={actionLoading}
          disabled={actionDisabled || slot.available <= 0}
          variant={enrolledLabel ? 'secondary' : 'primary'}
          size="sm"
          icon={enrolledLabel ? 'checkmark' : 'add-circle-outline'}
          fullWidth
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  flex: { flex: 1 },
});
