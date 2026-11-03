import { useAppTheme, fontFamilyForWeight, fontSize, lineHeight } from '@/constants/theme';
import { Text, type TextProps, type TextStyle } from 'react-native';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'body'
  | 'bodySmall'
  | 'label'
  | 'caption'
  | 'overline';

export type TextTone =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'inverse';

export interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

const variantStyles: Record<
  TextVariant,
  { fontSize: number; lineHeight: number; fontWeight: TextStyle['fontWeight'] }
> = {
  display: { fontSize: fontSize.display, lineHeight: lineHeight.display, fontWeight: '800' },
  title: { fontSize: fontSize.xxxl, lineHeight: lineHeight.xxxl, fontWeight: '800' },
  heading: { fontSize: fontSize.xxl, lineHeight: lineHeight.xxl, fontWeight: '700' },
  subtitle: { fontSize: fontSize.lg, lineHeight: lineHeight.lg, fontWeight: '700' },
  body: { fontSize: fontSize.md, lineHeight: lineHeight.md, fontWeight: '400' },
  bodySmall: { fontSize: fontSize.sm, lineHeight: lineHeight.sm, fontWeight: '400' },
  label: { fontSize: fontSize.sm, lineHeight: lineHeight.sm, fontWeight: '700' },
  caption: { fontSize: fontSize.xs, lineHeight: lineHeight.xs, fontWeight: '500' },
  overline: { fontSize: fontSize.xs, lineHeight: lineHeight.xs, fontWeight: '700' },
};

export function ThemedText({
  variant = 'body',
  tone = 'default',
  weight,
  align,
  style,
  ...rest
}: ThemedTextProps) {
  const { colors } = useAppTheme();
  const base = variantStyles[variant];

  const toneColor: Record<TextTone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primary,
    danger: colors.danger,
    warning: colors.warning,
    success: colors.success,
    info: colors.info,
    inverse: colors.onPrimary,
  };

  return (
    <Text
      {...rest}
      style={[
        {
          color: toneColor[tone],
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: weight ?? base.fontWeight,
          fontFamily: fontFamilyForWeight(weight ?? base.fontWeight),
          textAlign: align,
        },
        variant === 'overline' ? { letterSpacing: 0.8, textTransform: 'uppercase' } : null,
        style,
      ]}
    />
  );
}
