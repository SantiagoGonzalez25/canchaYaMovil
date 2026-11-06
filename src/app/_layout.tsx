import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { NunitoSans_500Medium } from '@expo-google-fonts/nunito-sans/500Medium';
import { NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans/600SemiBold';
import { NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans/700Bold';
import { NunitoSans_800ExtraBold } from '@expo-google-fonts/nunito-sans/800ExtraBold';
import { NunitoSans_900Black } from '@expo-google-fonts/nunito-sans/900Black';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fonts, useAppTheme } from '@/constants/theme';
import { AuthProvider } from '@/providers/auth-provider';
import { DataProvider } from '@/providers/data-provider';
import { NetworkProvider } from '@/providers/network-provider';

void SplashScreen.preventAutoHideAsync();

function NavigationShell() {
  const { colors, isDark } = useAppTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '700', fontFamily: fonts.bold },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="acude/[id]"
          options={{
            headerShown: true,
            title: 'Detalle del ACUDE',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen
          name="gestion/nuevo"
          options={{
            headerShown: true,
            title: 'Nuevo ACUDE',
            presentation: 'modal',
            headerBackTitle: 'Cerrar',
          }}
        />
        <Stack.Screen
          name="gestion/[id]"
          options={{
            headerShown: true,
            title: 'Editar ACUDE',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen
          name="gestion/escenarios"
          options={{
            headerShown: true,
            title: 'Escenarios',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen
          name="gestion/usuarios"
          options={{
            headerShown: true,
            title: 'Profesores',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen
          name="gestion/usuarios-admin"
          options={{
            headerShown: true,
            title: 'Usuarios y roles',
            headerBackTitle: 'Atrás',
          }}
        />
        <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'No encontrado' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    NunitoSans_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <DataProvider>
            <NavigationShell />
          </DataProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
