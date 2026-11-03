import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryColors, radius, shadows, spacing, useAppTheme } from '@/constants/theme';
import { formatTimeRange } from '@/lib/date';
import {
  ACUDE_STATUS_LABELS,
  CATEGORY_LABELS,
  WEEKDAY_SHORT,
} from '@/lib/labels';
import { truncate } from '@/lib/text';
import type { AcudeCategory, LiveAcude } from '@/types';
import { Badge, type BadgeTone } from './badge';
import { OccupancyBar } from './occupancy';
import { ThemedText } from './themed-text';

const categoryIcon: Record<AcudeCategory, keyof typeof Ionicons.glyphMap> = {
  sports: 'football-outline',
  cultural: 'color-palette-outline',
  training: 'school-outline',
  recreational: 'happy-outline',
};

const categoryTone: Record<AcudeCategory, BadgeTone> = {
  sports: 'primary',
  cultural: 'info',
  training: 'info',
  recreational: 'success',
};

export interface AcudeCardProps {
  acude: LiveAcude;
  coverUri?: string;
  onPress: () => void;
  showStatus?: boolean;
  footerNote?: string;
}

/** Tarjeta de cartelera con el mismo lenguaje visual del panel web. */
export function AcudeCard({
  acude,
  coverUri,
  onPress,
  showStatus = false,
  footerNote,
}: AcudeCardProps) {
  const { colors, isDark } = useAppTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const category = categoryColors(acude.category, isDark);
  const showImage = !!coverUri && !imageFailed;
  const available = acude.totalAvailable > 0;
  const enrolled = acude.totalCapacity - acude.totalAvailable;
  const first = acude.schedule[0];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${acude.name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        },
        shadows.card,
      ]}
    >
      <View style={[styles.cover, { backgroundColor: category.soft }]}>
        {showImage ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.image}
            contentFit="cover"
            transition={220}
            onError={() => setImageFailed(true)}
            accessibilityLabel={`Portada de ${acude.name}`}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name={categoryIcon[acude.category]} size={44} color={category.solid} />
            <ThemedText variant="caption" style={{ color: category.solid }}>
              {CATEGORY_LABELS[acude.category]}
            </ThemedText>
          </View>
        )}
        {showStatus ? (
          <View style={styles.statusBadge}>
            <Badge
              label={ACUDE_STATUS_LABELS[acude.status]}
              tone={acude.status === 'published' ? 'success' : acude.status === 'draft' ? 'warning' : 'neutral'}
              solid
            />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge label={CATEGORY_LABELS[acude.category]} tone={categoryTone[acude.category]} />
          <View
            style={[
              styles.availablePill,
              { backgroundColor: available ? colors.successSoft : colors.dangerSoft },
            ]}
          >
            <ThemedText
              variant="caption"
              style={{ color: available ? colors.success : colors.danger, fontWeight: '800' }}
            >
              {available ? `${acude.totalAvailable} cupos libres` : 'Agotado'}
            </ThemedText>
          </View>
        </View>

        <ThemedText variant="subtitle" numberOfLines={2} style={styles.title}>
          {acude.name}
        </ThemedText>

        {acude.description ? (
          <ThemedText variant="bodySmall" tone="muted" numberOfLines={2}>
            {truncate(acude.description, 140)}
          </ThemedText>
        ) : null}

        <View style={styles.scheduleRow}>
          {acude.schedule.slice(0, 3).map((slot) => (
            <View key={slot.id} style={[styles.scheduleChip, { backgroundColor: colors.surfaceAlt }]}>
              <ThemedText variant="caption" tone="muted" style={styles.scheduleText}>
                {WEEKDAY_SHORT[slot.day]} {slot.startTime}–{slot.endTime}
              </ThemedText>
            </View>
          ))}
          {acude.schedule.length > 3 ? (
            <View style={[styles.scheduleChip, { backgroundColor: colors.surfaceAlt }]}>
              <ThemedText variant="caption" tone="subtle">
                +{acude.schedule.length - 3}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {footerNote ? (
          <ThemedText variant="caption" tone="primary" style={{ fontWeight: '700' }}>
            {footerNote}
          </ThemedText>
        ) : null}

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerRow}>
            <ThemedText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
              {acude.teacherName}
            </ThemedText>
            <ThemedText variant="caption" tone="subtle">
              {enrolled}/{acude.totalCapacity}
            </ThemedText>
          </View>
          <OccupancyBar enrolled={enrolled} capacity={acude.totalCapacity} compact />
          <ThemedText variant="caption" tone="subtle" numberOfLines={1} style={styles.scenario}>
            {first?.scenarioName ?? 'Escenario por asignar'} ·{' '}
            {first ? formatTimeRange(first.startTime, first.endTime) : 'Sin horario'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  cover: { height: 158, position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  statusBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  body: { padding: spacing.lg, gap: spacing.sm },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  availablePill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  title: { marginTop: 2 },
  scheduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  scheduleChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  scheduleText: { fontSize: 10.5 },
  flex: { flex: 1 },
  footer: { borderTopWidth: 1, paddingTop: spacing.sm, gap: spacing.xs, marginTop: spacing.xs },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scenario: { marginTop: 2 },
});
