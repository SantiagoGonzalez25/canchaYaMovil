import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { CATEGORY_LABELS, WEEKDAY_SHORT, WEEKDAYS } from '@/lib/labels';
import type { AcudeCategory, Weekday } from '@/types';
import { ThemedText } from './themed-text';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

export function Chip({ label, active = false, onPress, icon, count }: ChipProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={active ? colors.onPrimary : colors.textMuted} />
      ) : null}
      <ThemedText
        variant="caption"
        style={{ color: active ? colors.onPrimary : colors.textMuted, fontWeight: '700' }}
      >
        {label}
        {typeof count === 'number' ? ` · ${count}` : ''}
      </ThemedText>
    </Pressable>
  );
}

export interface CategoryFilterProps {
  value: AcudeCategory | 'all';
  onChange: (value: AcudeCategory | 'all') => void;
  counts?: Partial<Record<AcudeCategory | 'all', number>>;
}

export function CategoryFilter({ value, onChange, counts }: CategoryFilterProps) {
  const options: { value: AcudeCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'sports', label: CATEGORY_LABELS.sports },
    { value: 'cultural', label: CATEGORY_LABELS.cultural },
    { value: 'training', label: CATEGORY_LABELS.training },
    { value: 'recreational', label: CATEGORY_LABELS.recreational },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          count={counts?.[option.value]}
          active={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ScrollView>
  );
}

export interface DayFilterProps {
  value: Weekday | 'all';
  onChange: (value: Weekday | 'all') => void;
  includeAll?: boolean;
}

export function DayFilter({ value, onChange, includeAll = true }: DayFilterProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {includeAll ? (
        <Chip label="Todos los días" active={value === 'all'} onPress={() => onChange('all')} />
      ) : null}
      {WEEKDAYS.map((day) => (
        <Chip
          key={day}
          label={WEEKDAY_SHORT[day]}
          active={value === day}
          onPress={() => onChange(day)}
        />
      ))}
    </ScrollView>
  );
}

export interface WeekDateStripProps {
  dates: string[];
  selected: string;
  onSelect: (date: string) => void;
}

/** Tira de días con número, usada por el calendario semanal. */
export function WeekDateStrip({ dates, selected, onSelect }: WeekDateStripProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.weekRow}>
      {dates.map((date) => {
        const active = date === selected;
        const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay();
        const weekday = WEEKDAYS[(jsDay + 6) % 7];
        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Seleccionar ${date}`}
            style={[
              styles.dateCell,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            {weekday ? (
              <ThemedText
                variant="caption"
                style={{ color: active ? colors.onPrimary : colors.textSubtle }}
              >
                {WEEKDAY_SHORT[weekday]}
              </ThemedText>
            ) : null}
            <ThemedText
              variant="subtitle"
              style={{ color: active ? colors.onPrimary : colors.text }}
            >
              {Number(date.slice(8, 10))}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
});
