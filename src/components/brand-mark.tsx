import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

const tdeaLogo = require('../../assets/images/tdea-horizontal.svg');

export function TdeaLogo({ height = 32 }: { height?: number }) {
  return (
    <Image
      source={tdeaLogo}
      style={{ width: height * 3.9, height }}
      contentFit="contain"
      accessibilityLabel="Tecnológico de Antioquia"
    />
  );
}

export function BrandMark({ size = 52 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Ionicons name="school" size={size * 0.48} color={colors.onPrimary} />
    </View>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={styles.lockup}>
      <View
        style={[
          styles.logoPlate,
          {
            backgroundColor: isDark ? '#ffffff' : 'transparent',
            paddingHorizontal: isDark ? spacing.xs : 0,
            paddingVertical: isDark ? 2 : 0,
          },
        ]}
      >
        <Image
          source={tdeaLogo}
          style={{ width: compact ? 100 : 125, height: compact ? 26 : 32 }}
          contentFit="contain"
          accessibilityLabel="Tecnológico de Antioquia"
        />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View>
        <ThemedText
          variant={compact ? 'subtitle' : 'heading'}
          style={styles.name}
          numberOfLines={1}
        >
          CanchaYa
        </ThemedText>
        <ThemedText
          variant="overline"
          style={{ color: colors.primary, lineHeight: 12, fontSize: 9 }}
        >
          ACUDES
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoPlate: { borderRadius: radius.sm },
  divider: { width: 1, height: 30 },
  name: { letterSpacing: -0.4, lineHeight: 22 },
});
