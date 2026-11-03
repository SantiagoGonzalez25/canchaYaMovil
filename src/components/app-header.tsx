import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandLockup } from '@/components/brand-mark';
import { ThemedText } from '@/components/themed-text';
import { spacing, useAppTheme } from '@/constants/theme';
import { ROLE_LABELS } from '@/lib/labels';
import { firstName } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';

/**
 * Cabecera persistente de las pestañas: identidad TdeA como en el panel web y
 * un indicador discreto de conectividad, sin mensajes técnicos.
 */
export function AppHeader() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { syncing, pendingCount } = useData();
  const busy = syncing || pendingCount > 0;
  const dotColor = !isOnline ? colors.warning : busy ? colors.info : colors.success;
  const statusLabel = !isOnline ? 'Sin conexión' : busy ? 'Actualizando' : 'En línea';

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => router.push('/(app)/panel')}
        accessibilityRole="button"
        accessibilityLabel="Ir al inicio"
        style={styles.brandButton}
      >
        <BrandLockup compact />
      </Pressable>

      <View style={styles.right}>
        <View
          style={styles.status}
          accessible
          accessibilityLabel={statusLabel}
        >
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          {!isOnline ? (
            <ThemedText variant="caption" style={[styles.offline, { color: colors.warning }]}>
              Sin conexión
            </ThemedText>
          ) : null}
        </View>
        {user ? (
          <Pressable
            onPress={() => router.push('/(app)/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir mi perfil"
            style={({ pressed }) => [styles.user, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.userText}>
              <ThemedText variant="caption" style={styles.userName} numberOfLines={1}>
                {firstName(user.name)}
              </ThemedText>
              <ThemedText variant="caption" tone="primary" style={styles.role}>
                {ROLE_LABELS[user.role]}
              </ThemedText>
            </View>
            <Avatar name={user.name} size={34} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  brandButton: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  offline: { fontSize: 9, lineHeight: 11, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 999 },
  user: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  userText: { alignItems: 'flex-end' },
  userName: { fontWeight: '800', fontSize: 11, lineHeight: 13 },
  role: { fontSize: 9, lineHeight: 11 },
});
