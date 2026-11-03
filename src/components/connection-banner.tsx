import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { ThemedText } from './themed-text';

/**
 * Aviso discreto de estado. No muestra errores técnicos ni detalles de la API:
 * solo lo que la persona necesita saber para seguir usando la app.
 */
export function ConnectionBanner() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isOnline } = useNetwork();
  const { pendingCount, conflictCount, syncing, refresh } = useData();

  const hasConflicts = conflictCount > 0;
  const hasPending = pendingCount > 0;
  const show = !isOnline || hasPending || hasConflicts;
  if (!show) return null;

  const tone = hasConflicts
    ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle-outline' as const }
    : !isOnline
      ? { bg: colors.warningSoft, fg: colors.warning, icon: 'cloud-offline-outline' as const }
      : { bg: colors.infoSoft, fg: colors.info, icon: 'sync-outline' as const };

  const message = hasConflicts
    ? 'Algunos cambios necesitan tu revisión.'
    : !isOnline
      ? 'Sin conexión. Tus cambios se guardan en el dispositivo.'
      : 'Tienes cambios guardados por enviar.';

  const canReview = hasConflicts;
  const canSync = !hasConflicts && hasPending && isOnline;

  return (
    <View style={[styles.banner, { backgroundColor: tone.bg }]}>
      <Ionicons name={tone.icon} size={16} color={tone.fg} />
      <ThemedText variant="caption" style={{ color: tone.fg, flex: 1, fontWeight: '600' }}>
        {message}
      </ThemedText>
      {canReview ? (
        <Pressable
          onPress={() => router.push('/(app)/mis-acudes')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <ThemedText variant="caption" style={{ color: tone.fg, fontWeight: '800' }}>
            Revisar
          </ThemedText>
        </Pressable>
      ) : canSync ? (
        <Pressable
          onPress={() => void refresh()}
          disabled={syncing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sincronizar cambios pendientes"
        >
          <ThemedText variant="caption" style={{ color: tone.fg, fontWeight: '800' }}>
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
