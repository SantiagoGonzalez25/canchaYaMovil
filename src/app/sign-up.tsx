import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { Chip } from '@/components/chips';
import { Screen } from '@/components/screen';
import { InlineNotice } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { isValidPersonName, normalizePersonName, sanitizePersonNameInput } from '@/lib/text';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { SEX_OPTIONS } from '@/services/auth-service';
import { errorMessage } from '@/services/errors';
import type { Sex } from '@/types';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignUpScreen() {
  const { status, signUp } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Redirect href="/(app)/panel" />;

  const submit = async () => {
    const cleanName = normalizePersonName(displayName);
    const next: Record<string, string | null> = {
      displayName: !cleanName
        ? 'Escribe tu nombre completo.'
        : !isValidPersonName(cleanName)
          ? 'Usa solo letras y espacios en el nombre.'
          : null,
      email: !isValidEmail(email) ? 'El correo no tiene un formato válido.' : null,
      password: password.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : null,
      confirm: confirm !== password ? 'Las contraseñas no coinciden.' : null,
      sex: !sex ? 'Selecciona una opción.' : null,
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean) || !sex) return;

    setLoading(true);
    try {
      await signUp({
        displayName: cleanName,
        email,
        password,
        sex,
        phone: phone.trim() || undefined,
      });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard scroll contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <BrandLockup compact />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio de sesión"
          hitSlop={10}
        >
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.titleBlock}>
          <ThemedText variant="overline" tone="primary">
            CanchaYa
          </ThemedText>
          <ThemedText variant="title" style={styles.title}>
            Crear cuenta
          </ThemedText>
          <ThemedText variant="body" tone="muted">
            El registro público crea una cuenta de{' '}
            <ThemedText variant="label">estudiante</ThemedText>. Podrás inscribirte a máximo dos
            ACUDES por semestre.
          </ThemedText>
        </View>

        {!isOnline ? (
          <InlineNotice
            tone="warning"
            icon="cloud-offline-outline"
            title="Sin conexión"
            message="Conéctate a internet para crear tu cuenta."
          />
        ) : null}

        {formError ? (
          <InlineNotice tone="danger" title="No pudimos crear tu cuenta" message={formError} />
        ) : null}

        <View style={styles.form}>
        <TextField
          label="Nombre completo"
          leftIcon="person-outline"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(sanitizePersonNameInput(value));
            setErrors((prev) => ({ ...prev, displayName: null }));
          }}
          placeholder="Ej. Ana María Pérez"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={80}
          error={errors.displayName}
        />
        <TextField
          label="Correo institucional"
          leftIcon="mail-outline"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((prev) => ({ ...prev, email: null }));
          }}
          placeholder="nombre@correo.edu.co"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email}
        />
        <TextField
          label="Teléfono"
          optional
          leftIcon="call-outline"
          value={phone}
          onChangeText={setPhone}
          placeholder="300 000 0000"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          hint="Solo se usa para contacto institucional."
        />
        <TextField
          label="Contraseña"
          leftIcon="lock-closed-outline"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: null }));
          }}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />
        <TextField
          label="Confirmar contraseña"
          leftIcon="lock-closed-outline"
          value={confirm}
          onChangeText={(value) => {
            setConfirm(value);
            setErrors((prev) => ({ ...prev, confirm: null }));
          }}
          placeholder="Repite la contraseña"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.confirm}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />

        <View style={styles.sexBlock}>
          <View style={styles.sexLabel}>
            <ThemedText variant="label">Sexo</ThemedText>
            <ThemedText variant="caption" tone="subtle">
              Se usa para los reportes institucionales.
            </ThemedText>
          </View>
          <View style={styles.sexOptions}>
            {SEX_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={sex === option.value}
                onPress={() => {
                  setSex(option.value);
                  setErrors((prev) => ({ ...prev, sex: null }));
                }}
              />
            ))}
          </View>
          {errors.sex ? (
            <ThemedText variant="caption" tone="danger">
              {errors.sex}
            </ThemedText>
          ) : null}
        </View>

        <Button
          title="Crear cuenta"
          onPress={() => void submit()}
          loading={loading}
          disabled={!isOnline}
          icon="person-add-outline"
          size="lg"
          fullWidth
        />

        <View style={[styles.legal, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <ThemedText variant="caption" tone="muted" style={styles.legalText}>
            Al registrarte aceptas las normas de uso de los escenarios del Tecnológico de Antioquia.
            No reservamos escenarios: la ocupación se deriva de las inscripciones a los ACUDES.
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText variant="bodySmall" tone="muted">
            ¿Ya tienes cuenta?
          </ThemedText>
          <Link href="/sign-in" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <ThemedText variant="label" tone="primary">
                Inicia sesión
              </ThemedText>
            </Pressable>
          </Link>
        </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.giant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 3,
  },
  titleBlock: { gap: spacing.xs },
  title: { fontSize: 26, lineHeight: 32 },
  form: { gap: spacing.lg },
  sexBlock: { gap: spacing.sm },
  sexLabel: { gap: 2 },
  sexOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legal: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  legalText: { flex: 1 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});
