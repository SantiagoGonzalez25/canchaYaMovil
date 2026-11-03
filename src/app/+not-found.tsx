import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { spacing, useAppTheme } from '@/constants/theme';

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Pantalla no encontrada' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText variant="title">404</ThemedText>
        <ThemedText variant="heading" align="center">
          Esta pantalla no existe
        </ThemedText>
        <ThemedText variant="body" tone="muted" align="center">
          Puede que el enlace haya cambiado o el ACUDE ya no esté disponible.
        </ThemedText>
        <Link href="/(app)/panel" asChild>
          <Button title="Volver a la cartelera" icon="grid-outline" />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
});
