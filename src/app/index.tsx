import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { spacing, useAppTheme } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

/** Puerta de entrada: decide entre login y la app según la sesión guardada. */
export default function IndexScreen() {
  const { status } = useAuth();
  const { colors } = useAppTheme();

  if (status === 'signedIn') return <Redirect href="/(app)/panel" />;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;

  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <BrandLockup />
      <ThemedText variant="bodySmall" tone="muted">
        Recuperando tu sesión…
      </ThemedText>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
});
