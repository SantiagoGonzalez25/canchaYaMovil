import type { TextStyle } from 'react-native';

import type { AcudeCategory } from '@/types';

export type ThemeScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  inputBackground: string;
  disabled: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  overlay: string;
  skeleton: string;
}

/** Paleta oficial TdeA, alineada con app/globals.css del panel web. */
export const brand = {
  green: '#00652e',
  greenDark: '#004a22',
  lime: '#92bd24',
  limeDark: '#7aa51d',
  teal: '#45a78f',
  deep: '#1d4851',
  text: '#211915',
  red: '#e11d48',
  gold: '#b45309',
} as const;

export const lightColors: ThemeColors = {
  background: '#f7f9f2',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  surfaceRaised: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#64748b',
  primary: '#00652e',
  primaryDark: '#004a22',
  primarySoft: '#f5f9e9',
  onPrimary: '#ffffff',
  accent: '#92bd24',
  accentSoft: '#ebf3d3',
  danger: '#e11d48',
  dangerSoft: '#ffe4e6',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  success: '#047857',
  successSoft: '#d1fae5',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  inputBackground: '#ffffff',
  disabled: '#cbd5e1',
  tabBar: '#ffffff',
  tabActive: '#004d23',
  tabInactive: '#64748b',
  overlay: 'rgba(15, 23, 42, 0.45)',
  skeleton: '#e2e8f0',
};

export const darkColors: ThemeColors = {
  background: '#08120d',
  surface: '#0f1f16',
  surfaceAlt: '#14291d',
  surfaceRaised: '#163021',
  border: '#244232',
  borderStrong: '#355c45',
  text: '#f1f5f9',
  textMuted: '#aac3b4',
  textSubtle: '#80998a',
  primary: '#7adfa9',
  primaryDark: '#4cc98a',
  primarySoft: '#123d26',
  onPrimary: '#062a17',
  accent: '#c1db77',
  accentSoft: '#2a3412',
  danger: '#ff9b93',
  dangerSoft: '#3a1715',
  warning: '#ffcc80',
  warningSoft: '#3a2c12',
  success: '#7ddaa4',
  successSoft: '#133824',
  info: '#93c5fd',
  infoSoft: '#12313a',
  inputBackground: '#0b1a12',
  disabled: '#3b5144',
  tabBar: '#0c1a12',
  tabActive: '#c1db77',
  tabInactive: '#80998a',
  overlay: 'rgba(0, 0, 0, 0.65)',
  skeleton: '#183024',
};

export const fonts = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semibold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  extraBold: 'NunitoSans_800ExtraBold',
  black: 'NunitoSans_900Black',
} as const;

/** Mapea el peso de React Native a la familia Nunito Sans cargada. */
export function fontFamilyForWeight(
  weight: TextStyle['fontWeight'] | undefined,
): string {
  switch (String(weight)) {
    case '900':
      return fonts.black;
    case '800':
      return fonts.extraBold;
    case '700':
      return fonts.bold;
    case '600':
      return fonts.semibold;
    case '500':
      return fonts.medium;
    default:
      return fonts.regular;
  }
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
} as const;

export const lineHeight = {
  xs: 15,
  sm: 19,
  md: 22,
  lg: 24,
  xl: 27,
  xxl: 31,
  xxxl: 37,
  display: 43,
} as const;

export const categoryPalette: Record<
  AcudeCategory,
  { solid: string; light: string; dark: string }
> = {
  sports: { solid: brand.green, light: '#dcf2df', dark: '#123d26' },
  cultural: { solid: brand.deep, light: '#d9eeea', dark: '#12313a' },
  training: { solid: '#1d4ed8', light: '#dbeafe', dark: '#172554' },
  recreational: { solid: brand.limeDark, light: '#ebf3d3', dark: '#2a3412' },
};

export const shadows = {
  card: {
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export interface AppTheme {
  scheme: ThemeScheme;
  isDark: boolean;
  colors: ThemeColors;
}

/**
 * El panel web de CanchaYa es una identidad clara y única. La app móvil usa la
 * misma paleta institucional siempre, sin cambiar a modo oscuro, para que la
 * experiencia sea idéntica en cualquier dispositivo.
 */
export function useAppTheme(): AppTheme {
  return {
    scheme: 'light',
    isDark: false,
    colors: lightColors,
  };
}

export function categoryColors(category: AcudeCategory, isDark: boolean) {
  const palette = categoryPalette[category];
  return {
    solid: palette.solid,
    soft: isDark ? palette.dark : palette.light,
  };
}
