import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, right }: PageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.flex}>
        {eyebrow ? (
          <ThemedText variant="overline" tone="primary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText variant="title">{title}</ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySmall" tone="muted" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText variant="subtitle">{title}</ThemedText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={styles.sectionAction}
          hitSlop={8}
        >
          <ThemedText variant="label" tone="primary">
            {actionLabel}
          </ThemedText>
          <Ionicons name={icon ?? 'chevron-forward'} size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  flex: { flex: 1, gap: 2 },
  subtitle: { marginTop: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
