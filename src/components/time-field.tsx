import { formatTimeInput } from '@/lib/time-input';
import { TextField, type TextFieldProps } from './text-field';

export type TimeFieldProps = Omit<TextFieldProps, 'onChangeText'> & {
  onChangeText: (value: string) => void;
};

/**
 * Campo de hora con máscara HH:mm y teclado numérico. Se usa en las franjas
 * del formulario de ACUDES para impedir horas negativas o fuera de rango.
 */
export function TimeField({ onChangeText, hint, ...rest }: TimeFieldProps) {
  return (
    <TextField
      {...rest}
      onChangeText={(value) => onChangeText(formatTimeInput(value))}
      keyboardType="number-pad"
      maxLength={5}
      placeholder="HH:mm"
      leftIcon="time-outline"
      autoCapitalize="none"
      autoCorrect={false}
      hint={hint ?? 'Formato 24 h'}
    />
  );
}
