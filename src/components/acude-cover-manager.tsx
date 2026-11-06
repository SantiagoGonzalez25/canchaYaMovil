import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { resolveApiUrl } from '@/config/env';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import {
  pickCoverImage,
  prepareCoverForUpload,
  type CoverSource,
  type UploadableCover,
} from '@/services/cover-service';
import {
  deleteAcudeImage,
  uploadAcudeImage,
} from '@/services/acudes-service';
import { errorMessage } from '@/services/errors';
import type { Acude } from '@/types';

/**
 * Portada global del ACUDE (solo admin). A diferencia de la portada local del
 * detalle, esta sí se sube a la API y la ven todos los dispositivos.
 */
export function AcudeCoverManager({
  acude,
  onChange,
}: {
  acude: Acude;
  onChange: (acude: Acude) => void;
}) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { coverUri, covers, removeCover, refresh } = useData();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [failedCover, setFailedCover] = useState<string | null>(null);

  // Defensa adicional: aunque la pantalla solo se renderiza para admin, este
  // componente nunca debe permitir que otro rol cambie una portada global.
  if (user?.role !== 'admin') return null;

  const cover = coverUri(acude);
  const showImage = !!cover && failedCover !== cover;
  const globalImageUrl = resolveApiUrl(acude.imageUrl);
  const hasGlobalImage = !!acude.imageUrl || !!acude.imageStoragePath;
  const hasLocalCover = !!covers[acude.id];
  const busy = uploading || removing;

  const confirmUpload = async (prepared: UploadableCover) => {
    try {
      setUploading(true);
      const result = await uploadAcudeImage(acude.id, prepared);
      await removeCover(acude.id).catch(() => undefined);
      onChange(result.acude);
      await refresh();
      Alert.alert(
        'Portada actualizada',
        'La imagen ya está disponible para todos los dispositivos.',
      );
    } catch (error) {
      Alert.alert('No se pudo subir la portada', errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const upload = async (source: CoverSource) => {
    try {
      setUploading(true);
      const picked = await pickCoverImage(source);
      if (!picked) {
        setUploading(false);
        return;
      }
      const prepared = await prepareCoverForUpload(picked);
      setUploading(false);
      Alert.alert(
        'Confirmar portada global',
        '¿Quieres usar esta imagen como portada para todos los dispositivos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar', onPress: () => void confirmUpload(prepared) },
        ],
      );
    } catch (error) {
      setUploading(false);
      const message = errorMessage(error);
      if (message.includes('500 KB')) {
        Alert.alert(
          'Imagen demasiado grande',
          'La portada no puede superar los 500 KB. Elige una foto más liviana o recórtala un poco.',
        );
        return;
      }
      Alert.alert('No se pudo preparar la portada', message);
    }
  };

  const copyImageUrl = async () => {
    if (!globalImageUrl) return;
    try {
      await Clipboard.setStringAsync(globalImageUrl);
      Alert.alert('Enlace copiado', 'La dirección de la portada global está en el portapapeles.');
    } catch (error) {
      Alert.alert('No se pudo copiar el enlace', errorMessage(error));
    }
  };

  const remove = async () => {
    try {
      setRemoving(true);
      const updated = await deleteAcudeImage(acude.id);
      await removeCover(acude.id).catch(() => undefined);
      onChange(updated);
      await refresh();
      Alert.alert(
        'Portada eliminada',
        'El ACUDE volverá a mostrar el ícono de categoría.',
      );
    } catch (error) {
      Alert.alert('No se pudo quitar la portada', errorMessage(error));
    } finally {
      setRemoving(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      'Quitar portada global',
      'La imagen se eliminará para todos los dispositivos. La portada local de este teléfono también se quitará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => void remove(),
        },
      ],
    );
  };

  const openOptions = () => {
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      { text: 'Tomar foto', onPress: () => void upload('camera') },
      { text: 'Elegir de la galería', onPress: () => void upload('library') },
    ];
    if (hasGlobalImage) {
      buttons.push({
        text: 'Quitar portada global',
        style: 'destructive',
        onPress: confirmRemove,
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert(
      'Portada global',
      'La imagen se comparte con todos los dispositivos y reemplaza la portada anterior (máximo 500 KB).',
      buttons,
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="image-outline" size={19} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText variant="subtitle">Portada global</ThemedText>
          <ThemedText variant="caption" tone="muted">
            Visible para estudiantes y gestores en todos los dispositivos.
          </ThemedText>
        </View>
        {busy ? (
          <ThemedText variant="caption" tone="primary">
            {uploading ? 'Subiendo…' : 'Quitando…'}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={openOptions}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cambiar portada global"
        style={[styles.preview, { backgroundColor: colors.surfaceAlt }]}
      >
        {showImage ? (
          <Image
            source={{ uri: cover }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            onError={() => setFailedCover(cover ?? null)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={38} color={colors.textSubtle} />
            <ThemedText variant="caption" tone="subtle">
              Sin portada global
            </ThemedText>
          </View>
        )}
      </Pressable>

      {hasLocalCover ? (
        <ThemedText variant="caption" tone="warning">
          Ahora se muestra tu portada local de este teléfono. Al subir una global se quitará la
          local y se verá en todos los dispositivos.
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Subir portada"
          onPress={openOptions}
          loading={uploading}
          disabled={busy}
          variant="secondary"
          icon="cloud-upload-outline"
          style={styles.flex}
        />
        {hasGlobalImage ? (
          <Button
            title="Quitar"
            onPress={confirmRemove}
            loading={removing}
            disabled={busy}
            variant="dangerOutline"
            icon="trash-outline"
          />
        ) : null}
      </View>

      {globalImageUrl ? (
        <Button
          title="Copiar enlace de la imagen"
          onPress={() => void copyImageUrl()}
          variant="ghost"
          icon="link-outline"
          fullWidth
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  preview: {
    height: 172,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
