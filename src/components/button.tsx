import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const sizeMap = {
  sm: { height: 38, padding: spacing.md, fontSize: 13 },
  md: { height: 48, padding: spacing.lg, fontSize: 15 },
  lg: { height: 54, padding: spacing.xl, fontSize: 16 },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;
  const dimensions = sizeMap[size];

  const palette: Record<
    ButtonVariant,
    { background: string; text: string; border: string; icon: string }
  > = {
    primary: {
      background: colors.primary,
      text: colors.onPrimary,
      border: colors.primary,
      icon: colors.onPrimary,
    },
    secondary: {
      background: colors.primarySoft,
      text: colors.primary,
      border: colors.primarySoft,
      icon: colors.primary,
    },
    outline: {
      background: 'transparent',
      text: colors.text,
      border: colors.borderStrong,
      icon: colors.text,
    },
    ghost: {
      background: 'transparent',
      text: colors.primary,
      border: 'transparent',
      icon: colors.primary,
    },
    danger: {
      background: colors.danger,
      text: colors.onPrimary,
      border: colors.danger,
      icon: colors.onPrimary,
    },
    dangerOutline: {
      background: 'transparent',
      text: colors.danger,
      border: colors.danger,
      icon: colors.danger,
    },
  };
  const current = palette[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: dimensions.height,
          paddingHorizontal: dimensions.padding,
          backgroundColor: current.background,
          borderColor: current.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.99 : 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={current.icon} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' ? (
            <Ionicons name={icon} size={dimensions.fontSize + 3} color={current.icon} />
          ) : null}
          <ThemedText
            variant="label"
            style={{ color: current.text, fontSize: dimensions.fontSize }}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
          {icon && iconPosition === 'right' ? (
            <Ionicons name={icon} size={dimensions.fontSize + 3} color={current.icon} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
