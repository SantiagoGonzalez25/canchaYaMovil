import { StyleSheet, View } from 'react-native';

import { buildReportMatrix } from '@/lib/report';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import type { ReportResult } from '@/types';
import { ThemedText } from './themed-text';

/** Gráfica nativa de barras agrupadas, sin dependencias de charting. */
export function ReportChart({ report, maxRows = 15 }: { report: ReportResult; maxRows?: number }) {
  const { colors } = useAppTheme();
  const matrix = buildReportMatrix(report);
  const visibleRows = matrix.rows.slice(0, maxRows);
  const maxValue = Math.max(
    1,
    ...visibleRows.flatMap((row) => row.values),
  );

  if (visibleRows.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.legend}>
        {report.series.map((series) => (
          <View key={series.name} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: series.color ?? colors.primary }]}
            />
            <ThemedText variant="caption" tone="muted">
              {series.name}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.rows}>
        {visibleRows.map((row) => (
          <View key={row.key} style={styles.row}>
            <ThemedText variant="caption" tone="muted" numberOfLines={2} style={styles.label}>
              {row.label}
            </ThemedText>
            <View style={styles.bars}>
              {report.series.map((series, index) => {
                const value = row.values[index] ?? 0;
                const width = `${Math.max(0, Math.min(100, (value / maxValue) * 100))}%` as const;
                return (
                  <View
                    key={`${row.key}:${series.name}`}
                    style={styles.barLine}
                    accessibilityLabel={`${row.label}, ${series.name}: ${value}`}
                  >
                    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width,
                            backgroundColor: series.color ?? colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText variant="caption" style={styles.value}>
                      {value}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.pill },
  rows: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  label: { width: 94 },
  bars: { flex: 1, gap: 4 },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: {
    flex: 1,
    height: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: radius.pill },
  value: { width: 28, textAlign: 'right' },
});
