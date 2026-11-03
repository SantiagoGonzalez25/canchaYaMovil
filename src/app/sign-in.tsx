import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TdeaLogo } from '@/components/brand-mark';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { InlineNotice } from '@/components/state-views';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { errorMessage } from '@/services/errors';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignInScreen() {
  const { status, signIn } = useAuth();
  const { isOnline } = useNetwork();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn') return <Redirect href="/(app)/panel" />;

  const submit = async () => {
    setFormError(null);
    const nextEmailError = !email.trim()
      ? 'Escribe tu correo institucional.'
      : !isValidEmail(email)
        ? 'El correo no tiene un formato válido.'
        : null;
    const nextPasswordError = !password ? 'Escribe tu contraseña.' : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard scroll contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <TdeaLogo height={34} />
        <ThemedText variant="caption" tone="muted">
          Bienestar Institucional · TdeA
        </ThemedText>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.formTitle}>
          <ThemedText variant="overline" tone="primary">
            CanchaYa
          </ThemedText>
          <ThemedText variant="title" style={styles.title}>
            Iniciar sesión
          </ThemedText>
          <ThemedText variant="bodySmall" tone="muted">
            Accede con tu correo institucional.
          </ThemedText>
        </View>

        {!isOnline ? (
          <InlineNotice
            tone="warning"
            icon="cloud-offline-outline"
            title="Sin conexión"
            message="Conéctate a internet para iniciar sesión. Si ya tenías una sesión abierta, la app conserva tus datos guardados."
          />
        ) : null}

        {formError ? (
          <InlineNotice
            tone="danger"
            title="No pudimos iniciar sesión"
            message={formError}
          />
        ) : null}

        <TextField
          label="Correo institucional"
          leftIcon="mail-outline"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setEmailError(null);
          }}
          placeholder="nombre@correo.edu.co"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          error={emailError}
          returnKeyType="next"
        />
        <TextField
          label="Contraseña"
          leftIcon="lock-closed-outline"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setPasswordError(null);
          }}
          placeholder="Tu contraseña"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          error={passwordError}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />

        <Button
          title="Iniciar sesión"
          onPress={() => void submit()}
          loading={loading}
          disabled={!isOnline}
          icon="log-in-outline"
          fullWidth
          size="lg"
        />

        <View style={styles.footer}>
          <ThemedText variant="bodySmall" tone="muted">
            ¿Aún no tienes cuenta?
          </ThemedText>
          <Link href="/sign-up" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <ThemedText variant="label" tone="primary">
                Regístrate
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>

      <ThemedText variant="caption" tone="subtle" align="center" style={styles.legal}>
        CanchaYa · Bienestar Institucional TdeA
      </ThemedText>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.giant,
    gap: spacing.lg,
  },
  hero: { gap: spacing.xs },
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
  formTitle: { gap: 2 },
  title: { fontSize: 26, lineHeight: 32 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legal: { marginTop: spacing.sm },
});
