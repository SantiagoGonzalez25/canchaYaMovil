import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong } from '@/lib/date';
import {
  emptyManagerDraft,
  validateManagerDraft,
  type ManagerDraft,
  type ManagerDraftErrors,
} from '@/lib/manager-form';
import { SEX_LABELS } from '@/lib/labels';
import { sanitizePersonNameInput } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { listAcudes } from '@/services/acudes-service';
import { createManager, getManagers } from '@/services/auth-service';
import { errorMessage } from '@/services/errors';
import type { Acude, Sex, UserProfile } from '@/types';

export default function UsuariosScreen() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const isAdmin = user?.role === 'admin';

  const [draft, setDraft] = useState<ManagerDraft>(emptyManagerDraft);
  const [errors, setErrors] = useState<ManagerDraftErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<UserProfile | null>(null);
  const [createdPassword, setCreatedPassword] = useState('');
  const [acudes, setAcudes] = useState<Acude[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loadingAcudes, setLoadingAcudes] = useState(true);
  const [acudesError, setAcudesError] = useState<string | null>(null);
  const [managersError, setManagersError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async () => {
    requestRef.current?.abort();
    if (!isAdmin || !isOnline) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingAcudes(true);
    setAcudesError(null);
    setManagersError(null);
    try {
      const [acudeResult, managerResult] = await Promise.allSettled([
        listAcudes({}, controller.signal),
        getManagers(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      if (acudeResult.status === 'fulfilled') setAcudes(acudeResult.value.acudes);
      else setAcudesError(errorMessage(acudeResult.reason));

      if (managerResult.status === 'fulfilled') setManagers(managerResult.value);
      else setManagersError(errorMessage(managerResult.reason));
    } finally {
      if (!controller.signal.aborted) setLoadingAcudes(false);
    }
  }, [isAdmin, isOnline]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return () => requestRef.current?.abort();
    }, [loadData]),
  );

  const teacherCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acude of acudes) {
      counts.set(acude.teacherId, (counts.get(acude.teacherId) ?? 0) + 1);
    }
    return counts;
  }, [acudes]);

  const update = <K extends keyof ManagerDraft,>(field: K, value: ManagerDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[String(field)]) return prev;
      const next = { ...prev };
      delete next[String(field)];
      return next;
    });
    setNotice(null);
  };

  const handleSubmit = async () => {
    setNotice(null);
    const validation = validateManagerDraft(draft);
    setErrors(validation.errors);
    if (!validation.ok || !validation.input) {
      setNotice('Revisa los campos marcados.');
      return;
    }

    setSubmitting(true);
    try {
      const manager = await createManager(validation.input);
      setCreated(manager);
      setCreatedPassword(validation.input.password);
      setManagers((prev) =>
        [...prev.filter((item) => item.uid !== manager.uid), manager].sort((a, b) =>
          a.name.localeCompare(b.name, 'es'),
        ),
      );
      setDraft(emptyManagerDraft());
      setErrors({});
      Alert.alert(
        'Profesor creado',
        `${manager.name} ya puede iniciar sesión con ${manager.email}. Su UID es ${manager.uid}.`,
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const shareCredentials = async () => {
    if (!created) return;
    const message = [
      `CanchaYa · perfil de profesor`,
      `Nombre: ${created.name}`,
      `Correo: ${created.email}`,
      `Contraseña temporal: ${createdPassword}`,
      `UID: ${created.uid}`,
      '',
      'Cambia la contraseña después del primer inicio de sesión.',
    ].join('\n');
    try {
      await Share.share({ title: 'Credenciales de profesor CanchaYa', message });
    } catch (error) {
      Alert.alert('No se pudo compartir', errorMessage(error));
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

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState
          title="Perfiles exclusivos del administrador"
          message="Solo una cuenta admin puede crear perfiles de profesor."
          icon="lock-closed-outline"
          actionLabel="Volver al inicio"
          onAction={() => router.replace('/(app)/panel')}
        />
      </Screen>
    );
  }

  const sexOptions = (Object.keys(SEX_LABELS) as Sex[]).map((value) => ({
    value,
    label: SEX_LABELS[value],
  }));

  return (
    <Screen keyboard edges={['left', 'right']}>
      <PageHeader
        eyebrow="Administración"
        title="Profesores"
        subtitle="Crea perfiles institucionales y consulta los docentes que ya tienen ACUDES asignados."
      />

      <InlineNotice
        tone="info"
        icon="people-outline"
        title="Perfiles institucionales"
        message="Crea profesores y asígnales ACUDES. El listado completo se consulta en vivo y el formulario de ACUDE permite elegir al docente."
      />

      {created ? (
        <View style={[styles.createdCard, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
          <View style={styles.createdHeader}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <ThemedText variant="label" tone="success" style={styles.flex}>
              Profesor creado correctamente
            </ThemedText>
          </View>
          <ThemedText variant="subtitle">{created.name}</ThemedText>
          <ThemedText variant="bodySmall" tone="muted">
            {created.email}
          </ThemedText>
          <ThemedText variant="caption" tone="subtle" selectable>
            UID: {created.uid}
          </ThemedText>
          <View style={styles.createdActions}>
            <Button
              title="Compartir credenciales"
              onPress={() => void shareCredentials()}
              variant="secondary"
              icon="share-outline"
              size="sm"
            />
            <Button
              title="Cerrar"
              onPress={() => setCreated(null)}
              variant="ghost"
              size="sm"
            />
          </View>
        </View>
      ) : null}

      {notice ? <InlineNotice tone="danger" message={notice} /> : null}

      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SectionHeader title="Nuevo profesor" />
        <TextField
          label="Nombre completo"
          value={draft.displayName}
          onChangeText={(value) => update('displayName', sanitizePersonNameInput(value))}
          placeholder="Ej. Ana María Pérez"
          autoCapitalize="words"
          maxLength={80}
          error={errors.displayName}
        />
        <TextField
          label="Correo institucional"
          value={draft.email}
          onChangeText={(value) => update('email', value)}
          placeholder="nombre@correo.edu.co"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          error={errors.email}
        />
        <TextField
          label="Contraseña temporal"
          value={draft.password}
          onChangeText={(value) => update('password', value)}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          error={errors.password}
          hint="Comparte una contraseña temporal y pide cambiarla."
        />
        <View style={styles.field}>
          <ThemedText variant="label">Sexo</ThemedText>
          <View style={styles.chips}>
            {sexOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={draft.sex === option.value}
                onPress={() => update('sex', option.value)}
              />
            ))}
          </View>
          {errors.sex ? (
            <ThemedText variant="caption" tone="danger">
              {errors.sex}
            </ThemedText>
          ) : null}
        </View>
        <TextField
          label="Teléfono"
          value={draft.phone}
          onChangeText={(value) => update('phone', value)}
          placeholder="300 000 0000"
          keyboardType="phone-pad"
          maxLength={30}
          error={errors.phone}
          optional
        />
        <Button
          title="Crear perfil de profesor"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!isOnline}
          icon="person-add-outline"
          fullWidth
        />
        {!isOnline ? (
          <ThemedText variant="caption" tone="warning" align="center">
            Crear profesores requiere conexión.
          </ThemedText>
        ) : null}
      </View>

      <SectionHeader title={`Profesores registrados · ${managers.length}`} />
      {loadingAcudes ? (
        <LoadingState message="Consultando profesores y ACUDES…" />
      ) : managersError ? (
        <InlineNotice
          tone="warning"
          icon="alert-circle-outline"
          title="No se pudo cargar el listado completo"
          message={managersError}
          actionLabel="Reintentar"
          onAction={() => void loadData()}
        />
      ) : acudesError ? (
        <InlineNotice
          tone="warning"
          message={acudesError}
          actionLabel="Reintentar"
          onAction={() => void loadData()}
        />
      ) : managers.length === 0 ? (
        <EmptyState
          title="Aún no hay profesores"
          message="Crea el primer perfil de profesor con el formulario de arriba."
          icon="people-outline"
        />
      ) : (
        <View style={styles.teacherList}>
          {managers.map((manager) => {
            const assigned = teacherCounts.get(manager.uid) ?? 0;
            return (
              <View
                key={manager.uid}
                style={[
                  styles.teacherCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Avatar name={manager.name} size={40} />
                <View style={styles.flex}>
                  <ThemedText variant="label">{manager.name}</ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    {manager.email}
                  </ThemedText>
                  <ThemedText variant="caption" tone="subtle" selectable>
                    UID: {manager.uid}
                  </ThemedText>
                  <ThemedText variant="caption" tone="subtle">
                    {manager.sex ? SEX_LABELS[manager.sex] : 'Sexo sin registrar'} ·{' '}
                    {assigned} ACUDE{assigned === 1 ? '' : 'S'} · Creado{' '}
                    {formatDateLong(manager.createdAt)}
                  </ThemedText>
                </View>
                <Badge label="Profesor" tone="primary" />
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.note, { borderColor: colors.border }]}>
        <Ionicons name="key-outline" size={18} color={colors.textSubtle} />
        <ThemedText variant="caption" tone="subtle" style={styles.flex}>
          El formulario de ACUDE permite escoger entre los profesores registrados; el UID también
          se muestra aquí por si necesitas usarlo en otro flujo.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  createdCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  createdHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  createdActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  formCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  field: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  teacherList: { gap: spacing.md },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
});
