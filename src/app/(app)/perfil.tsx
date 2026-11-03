import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { InlineNotice } from '@/components/state-views';
import { StatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME } from '@/config/env';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { SEMESTER_LABEL, formatDateTime } from '@/lib/date';
import { ROLE_LABELS, SEX_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { errorMessage } from '@/services/errors';

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={styles.flex}>
        <ThemedText variant="overline" tone="subtle">
          {label}
        </ThemedText>
        <ThemedText variant="bodySmall">{value}</ThemedText>
      </View>
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const {
    syncing,
    pendingCount,
    conflictCount,
    lastSyncedAt,
    activeEnrollments,
    refresh,
  } = useData();

  if (!user) return null;

  const isStudent = user.role === 'student';
  const isAdmin = user.role === 'admin';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleRefreshProfile = async () => {
    try {
      await refreshProfile();
    } catch (reason) {
      Alert.alert('No pudimos actualizar tu información', errorMessage(reason));
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((reason) => {
            Alert.alert('No se pudo cerrar la sesión', errorMessage(reason));
          });
        },
      },
    ]);
  };

  return (
    <Screen
      edges={['left', 'right']}
      refreshing={syncing}
      onRefresh={() => void refresh()}
    >
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        subtitle="Información de tu cuenta y estado de la aplicación."
        right={<Avatar name={user.name} size={48} />}
      />

      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar name={user.name} size={66} />
        <View style={styles.flex}>
          <ThemedText variant="heading" style={styles.name}>
            {user.name}
          </ThemedText>
          <ThemedText variant="bodySmall" tone="muted">
            {user.email}
          </ThemedText>
          <View style={styles.badgeRow}>
            <Badge
              label={ROLE_LABELS[user.role]}
              tone={isAdmin ? 'warning' : user.role === 'manager' ? 'info' : 'primary'}
            />
            <Badge label={SEMESTER_LABEL} tone="neutral" />
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        {isStudent ? (
          <>
            <StatCard
              label="Mis ACUDES"
              value={`${activeEnrollments.length}/2`}
              hint="Inscripciones activas"
              tone="teal"
            />
            <StatCard
              label="Cambios por enviar"
              value={pendingCount}
              hint={isOnline ? 'Se actualizan automáticamente' : 'Se enviarán al volver la red'}
              tone={pendingCount > 0 ? 'amber' : 'teal'}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Estado"
              value={isOnline ? 'En línea' : 'Sin conexión'}
              hint={syncing ? 'Actualizando información' : 'Conexión del dispositivo'}
              tone={isOnline ? 'teal' : 'amber'}
            />
            <StatCard
              label="Información"
              value={syncing ? 'Actualizando' : lastSyncedAt ? 'Al día' : 'Pendiente'}
              hint={lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Abre el panel para actualizar'}
              tone={lastSyncedAt ? 'teal' : 'amber'}
            />
          </>
        )}
      </View>

      {conflictCount > 0 && isStudent ? (
        <InlineNotice
          tone="warning"
          icon="alert-circle-outline"
          title="Hay cambios que necesitan tu revisión"
          message="Revisa tus inscripciones para ver qué ocurrió y continuar."
          actionLabel="Revisar ahora"
          onAction={() => router.push('/(app)/mis-acudes')}
        />
      ) : null}

      <SectionHeader title="Datos de la cuenta" />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow icon="mail-outline" label="Correo" value={user.email} />
        <InfoRow icon="person-outline" label="Rol" value={ROLE_LABELS[user.role]} />
        <InfoRow
          icon="male-female-outline"
          label="Sexo registrado"
          value={user.sex ? SEX_LABELS[user.sex] : 'No registrado'}
        />
        <InfoRow icon="calendar-outline" label="Semestre activo" value={SEMESTER_LABEL} />
        <InfoRow
          icon="sync-outline"
          label="Última actualización"
          value={lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Pendiente'}
        />
      </View>
      <Button
        title="Actualizar mi información"
        onPress={() => void handleRefreshProfile()}
        variant="outline"
        icon="refresh-outline"
        fullWidth
      />

      <SectionHeader title="Accesos rápidos" />
      <View style={styles.quickGrid}>
        {isStudent ? (
          <>
            <QuickLink
              icon="grid-outline"
              label="Cartelera"
              onPress={() => router.push('/(app)/cartelera')}
            />
            <QuickLink
              icon="calendar-outline"
              label="Calendario"
              onPress={() => router.push('/(app)/calendario')}
            />
            <QuickLink
              icon="bookmark-outline"
              label="Mis ACUDES"
              onPress={() => router.push('/(app)/mis-acudes')}
            />
          </>
        ) : (
          <>
            <QuickLink
              icon="home-outline"
              label="Panel"
              onPress={() => router.push('/(app)/panel')}
            />
            <QuickLink
              icon="bar-chart-outline"
              label="Reportes"
              onPress={() => router.push('/(app)/reportes')}
            />
            <QuickLink
              icon="checkbox-outline"
              label="Asistencia"
              onPress={() => router.push('/(app)/asistencia')}
            />
            <QuickLink
              icon="settings-outline"
              label={isAdmin ? 'Gestión' : 'Mi ACUDE'}
              onPress={() => router.push('/(app)/gestion')}
            />
          </>
        )}
      </View>

      <View style={[styles.appInfo, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.appIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="school" size={18} color={colors.onPrimary} />
        </View>
        <View style={styles.flex}>
          <ThemedText variant="label">
            {APP_NAME} {appVersion}
          </ThemedText>
          <ThemedText variant="caption" tone="muted">
            Bienestar Institucional · Tecnológico de Antioquia
          </ThemedText>
        </View>
      </View>

      {!isOnline ? (
        <InlineNotice
          tone="info"
          icon="cloud-offline-outline"
          message="Tus cambios se guardan y se enviarán cuando vuelvas a estar en línea."
        />
      ) : null}

      <Pressable
        onPress={confirmSignOut}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.signOut,
          {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.danger,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <ThemedText variant="label" tone="danger">
          Cerrar sesión
        </ThemedText>
      </Pressable>

      <ThemedText variant="caption" tone="subtle" align="center" style={styles.footer}>
        CanchaYa · Bienestar Institucional TdeA
      </ThemedText>
    </Screen>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quickLink,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <ThemedText variant="caption" style={styles.quickLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: { fontSize: 20, lineHeight: 25 },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickLink: {
    width: '31%',
    minWidth: 100,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontWeight: '700', textAlign: 'center' },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  footer: { marginTop: spacing.lg },
});
