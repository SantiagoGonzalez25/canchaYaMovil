import { StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

export interface OccupancyBarProps {
  enrolled: number;
  capacity: number;
  pct?: number;
  compact?: boolean;
}

export function OccupancyBar({ enrolled, capacity, pct, compact = false }: OccupancyBarProps) {
  const { colors, isDark } = useAppTheme();
  const percentage =
    typeof pct === 'number'
      ? Math.max(0, Math.min(100, pct))
      : capacity > 0
        ? Math.round((enrolled / capacity) * 100)
        : 0;

  const fill = percentage >= 90 ? colors.danger : percentage >= 60 ? colors.warning : colors.success;
  const softFill = isDark
    ? fill
    : percentage >= 90
      ? '#e57373'
      : percentage >= 60
        ? '#e0a83a'
        : '#46a56b';

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percentage}%`,
              backgroundColor: softFill,
            },
          ]}
        />
      </View>
      {!compact ? (
        <View style={styles.labels}>
          <ThemedText variant="caption" tone="muted">
            {enrolled}/{capacity} inscritos
          </ThemedText>
          <ThemedText variant="caption" style={{ color: fill, fontWeight: '700' }}>
            {percentage}% ocupado
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function AvailabilityPill({
  available,
  capacity,
}: {
  available: number;
  capacity: number;
}) {
  const { colors } = useAppTheme();
  const tone = available === 0 ? colors.danger : available <= 3 ? colors.warning : colors.success;
  const background =
    available === 0
      ? colors.dangerSoft
      : available <= 3
        ? colors.warningSoft
        : colors.successSoft;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <ThemedText variant="caption" style={{ color: tone, fontWeight: '700' }}>
        {available === 0 ? 'Sin cupos' : `${available} de ${capacity} cupos`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
