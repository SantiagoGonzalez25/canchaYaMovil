import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Chip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { SearchField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ROLE_LABELS } from '@/lib/labels';
import { foldForSearch } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { getUserEnrollments, listUsers, updateUserAccess } from '@/services/auth-service';
import { errorMessage } from '@/services/errors';
import type { Role, UserProfile, UserStatus } from '@/types';

const ROLE_OPTIONS: Role[] = ['student', 'manager', 'admin'];
const STATUS_OPTIONS: UserStatus[] = ['active', 'inactive', 'banned'];
const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  banned: 'Baneado',
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!isOnline) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers(controller.signal));
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [isOnline]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => requestRef.current?.abort();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const term = foldForSearch(query);
    if (!term) return users;
    return users.filter((item) =>
      foldForSearch(item.name, item.email, item.phone ?? '').includes(term),
    );
  }, [query, users]);

  const changeAccess = async (
    target: UserProfile,
    input: { role?: Role; status?: UserStatus },
  ) => {
    if (target.uid === user?.uid && (input.role !== 'admin' || input.status !== 'active')) {
      Alert.alert('Acción no permitida', 'No puedes quitarte el rol admin ni deshabilitar tu cuenta.');
      return;
    }
    setBusyId(target.uid);
    try {
      const updated = await updateUserAccess(target.uid, input);
      setUsers((prev) => prev.map((item) => (item.uid === updated.uid ? updated : item)));
    } catch (reason) {
      Alert.alert('No se pudo actualizar', errorMessage(reason));
    } finally {
      setBusyId(null);
    }
  };

  const showEnrollments = async (target: UserProfile) => {
    try {
      const items = await getUserEnrollments(target.uid);
      const lines = items.slice(0, 12).map(
        (item) =>
          `• ${item.acudeName}\n  ${item.day} ${item.startTime}-${item.endTime} · ${item.status}`,
      );
      Alert.alert(
        `Inscripciones de ${target.name}`,
        items.length === 0
          ? 'Este usuario no tiene inscripciones.'
          : `${lines.join('\n')}${items.length > 12 ? `\n… y ${items.length - 12} más` : ''}`,
      );
    } catch (reason) {
      Alert.alert('No se pudo cargar el historial', errorMessage(reason));
    }
  };

  if (status === 'loading') {
    return (
      <Screen>
        <LoadingState message="Recuperando tu sesión…" />
      </Screen>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;
  if (user.role !== 'admin') {
    return (
      <Screen>
        <EmptyState
          title="Solo administradores"
          message="La gestión de usuarios y roles está reservada al administrador."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} refreshing={loading} onRefresh={() => void load()}>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios y roles"
        subtitle="Consulta todos los usuarios, cambia su rol o estado y revisa su historial de inscripciones."
      />

      {!isOnline ? (
        <InlineNotice
          tone="warning"
          icon="cloud-offline-outline"
          title="Necesitas conexión"
          message="La gestión de usuarios requiere conexión."
        />
      ) : null}

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nombre, correo o teléfono"
        accessibilityLabel="Buscar usuarios"
      />
      <ThemedText variant="caption" tone="muted" style={styles.count}>
        {users.length} usuario{users.length === 1 ? '' : 's'} · {filtered.length} en la vista
      </ThemedText>

      {loading && users.length === 0 ? (
        <LoadingState message="Cargando usuarios…" />
      ) : error ? (
        <EmptyState
          title="No pudimos cargar los usuarios"
          message={error}
          icon="alert-circle-outline"
          actionLabel="Reintentar"
          onAction={() => void load()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin usuarios"
          message="No hay usuarios que coincidan con la búsqueda."
          icon="people-outline"
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((item) => {
            const role = item.role;
            const currentStatus = item.status ?? 'active';
            const busy = busyId === item.uid;
            return (
              <View
                key={item.uid}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.top}>
                  <Avatar name={item.name} size={40} />
                  <View style={styles.flex}>
                    <ThemedText variant="label">{item.name}</ThemedText>
                    <ThemedText variant="caption" tone="muted">
                      {item.email}
                    </ThemedText>
                    <ThemedText variant="caption" tone="subtle">
                      {item.phone ?? 'Sin teléfono'} · UID {item.uid.slice(0, 10)}…
                    </ThemedText>
                  </View>
                  <Badge label={ROLE_LABELS[role]} tone="primary" />
                </View>

                <ThemedText variant="caption" tone="subtle">
                  Rol
                </ThemedText>
                <View style={styles.chips}>
                  {ROLE_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={ROLE_LABELS[option]}
                      active={role === option}
                      onPress={() => void changeAccess(item, { role: option })}
                    />
                  ))}
                </View>

                <ThemedText variant="caption" tone="subtle">
                  Estado
                </ThemedText>
                <View style={styles.chips}>
                  {STATUS_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={STATUS_LABELS[option]}
                      active={currentStatus === option}
                      onPress={() => void changeAccess(item, { status: option })}
                    />
                  ))}
                </View>

                <View style={styles.actions}>
                  <ThemedText variant="caption" tone={busy ? 'warning' : 'subtle'} style={styles.flex}>
                    {busy ? 'Actualizando…' : `Estado actual: ${STATUS_LABELS[currentStatus]}`}
                  </ThemedText>
                  <Chip
                    label="Ver inscripciones"
                    icon="list-outline"
                    onPress={() => void showEnrollments(item)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.note, { borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSubtle} />
        <ThemedText variant="caption" tone="subtle" style={styles.flex}>
          Banear a un estudiante cancela sus inscripciones activas. Un profesor con ACUDES asignados
          no puede ser baneado ni degradado hasta reasignar o archivar sus ACUDES. El admin no puede
          quitarse su propio rol ni deshabilitarse.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  count: { marginTop: spacing.xs, marginBottom: spacing.sm },
  list: { gap: spacing.md, marginTop: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xl,
    paddingTop: spacing.md,
  },
});
