import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { fonts, fontSize, radius, spacing, useAppTheme } from '@/constants/theme';
import { ThemedText } from './themed-text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  optional?: boolean;
}

/** Campo de texto nativo con etiqueta, ayuda, error y mostrar/ocultar clave. */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    leftIcon,
    containerStyle,
    optional = false,
    secureTextEntry,
    multiline,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.border;
  const isPassword = !!secureTextEntry;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <ThemedText variant="label" tone="default">
            {label}
          </ThemedText>
          {optional ? (
            <ThemedText variant="caption" tone="subtle">
              Opcional
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            minHeight: multiline ? 108 : 50,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={19}
            color={focused ? colors.primary : colors.textSubtle}
            style={multiline ? styles.multilineIcon : undefined}
          />
        ) : null}
        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          secureTextEntry={isPassword ? hidden : false}
          placeholderTextColor={colors.textSubtle}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            {
              color: colors.text,
              paddingVertical: multiline ? spacing.md : 0,
              minHeight: multiline ? 100 : 48,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
          selectionColor={colors.primary}
          accessibilityLabel={label ?? rest.placeholder}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            hitSlop={10}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <ThemedText variant="caption" tone="danger">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText variant="caption" tone="subtle">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
});

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar…',
  accessibilityLabel,
}: SearchFieldProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Ionicons name="search-outline" size={19} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, { color: colors.text, minHeight: 46 }]}
        returnKeyType="search"
        autoCorrect={false}
        selectionColor={colors.primary}
        accessibilityLabel={accessibilityLabel ?? placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
        >
          <Ionicons name="close-circle" size={19} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    padding: 0,
  },
  multilineIcon: { marginTop: spacing.md + 2 },
  eye: { padding: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
});
