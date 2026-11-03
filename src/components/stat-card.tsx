import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

export type StatTone = 'teal' | 'amber' | 'blue' | 'violet' | 'rose' | 'neutral';

const lightTones: Record<StatTone, [string, string]> = {
  teal: ['#f5f9e9', '#ffffff'],
  amber: ['#fef3c7', '#ffffff'],
  blue: ['#dbeafe', '#ffffff'],
  violet: ['#d9eeea', '#ffffff'],
  rose: ['#ffe4e6', '#ffffff'],
  neutral: ['#f1f5f9', '#ffffff'],
};

const darkTones: Record<StatTone, [string, string]> = {
  teal: ['#123d26', '#0f1f16'],
  amber: ['#3a2c12', '#0f1f16'],
  blue: ['#172554', '#0f1f16'],
  violet: ['#12313a', '#0f1f16'],
  rose: ['#3a1715', '#0f1f16'],
  neutral: ['#14291d', '#0f1f16'],
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'teal',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <LinearGradient
      colors={isDark ? darkTones[tone] : lightTones[tone]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: colors.border }]}
    >
      <ThemedText variant="overline" tone="subtle" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText variant="heading" style={styles.value} numberOfLines={1}>
        {value}
      </ThemedText>
      {hint ? (
        <ThemedText variant="caption" tone="subtle" numberOfLines={2}>
          {hint}
        </ThemedText>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  value: { fontSize: 26, lineHeight: 32 },
});
