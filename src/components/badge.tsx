import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  solid?: boolean;
}

export function Badge({ label, tone = 'neutral', icon, solid = false }: BadgeProps) {
  const { colors } = useAppTheme();

  const tones: Record<BadgeTone, { soft: string; solid: string; text: string }> = {
    primary: { soft: colors.primarySoft, solid: colors.primary, text: colors.primary },
    success: { soft: colors.successSoft, solid: colors.success, text: colors.success },
    warning: { soft: colors.warningSoft, solid: colors.warning, text: colors.warning },
    danger: { soft: colors.dangerSoft, solid: colors.danger, text: colors.danger },
    info: { soft: colors.infoSoft, solid: colors.info, text: colors.info },
    neutral: { soft: colors.surfaceAlt, solid: colors.textMuted, text: colors.textMuted },
  };
  const palette = tones[tone];
  const textColor = solid ? colors.onPrimary : palette.text;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: solid ? palette.solid : palette.soft },
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={textColor} /> : null}
      <ThemedText variant="caption" style={{ color: textColor, fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
