import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { fonts, useAppTheme } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

/** Los tabs tipan el color como ColorValue; Ionicons solo acepta cadenas. */
function tabIconColor(color: unknown): string | undefined {
  return typeof color === 'string' ? color : undefined;
}

export default function AppLayout() {
  const { status, user } = useAuth();
  const { colors } = useAppTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;
  // La primera pestaña autenticada es el panel.

  const role = user.role;
  const isStudent = role === 'student';
  const isAdmin = role === 'admin';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <AppHeader />
      </SafeAreaView>
      <View style={styles.tabs}>
        <Tabs
          screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          fontFamily: fonts.semibold,
          marginTop: 1,
        },
        tabBarItemStyle: { paddingVertical: 3 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="panel"
        options={{
          title: isStudent ? 'Inicio' : 'Panel',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={tabIconColor(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="cartelera"
        options={{
          title: 'Cartelera',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={tabIconColor(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          // Visible para todos los roles; el administrador también entra desde el Panel.
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size}
              color={tabIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mis-acudes"
        options={{
          title: 'Mis ACUDES',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bookmark' : 'bookmark-outline'}
              size={size}
              color={tabIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ocupacion"
        options={{
          title: 'Ocupación',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={tabIconColor(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="asistencia"
        options={{
          title: 'Asistencia',
          href: isStudent ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'checkbox' : 'checkbox-outline'}
              size={size}
              color={tabIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          href: isStudent ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={size}
              color={tabIconColor(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="gestion"
        options={{
          title: isAdmin ? 'Gestión' : 'Mi ACUDE',
          href: isStudent ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={tabIconColor(color)}
            />
          ),
        }}
      />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={size + 1}
                color={tabIconColor(color)}
              />
            ),
          }}
        />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
