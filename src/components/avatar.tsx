import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/constants/theme';
import { initials } from '@/lib/text';
import { ThemedText } from './themed-text';

export interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 46 }: AvatarProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
          borderColor: colors.border,
        },
      ]}
      accessible
      accessibilityLabel={`Avatar de ${name}`}
    >
      <ThemedText
        variant="label"
        tone="primary"
        style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
      >
        {initials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
