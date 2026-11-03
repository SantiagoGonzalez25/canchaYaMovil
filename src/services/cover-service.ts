import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Portadas de ACUDES.
 *
 * La portada local se guarda únicamente en este dispositivo. La portada global
 * se prepara aquí (compresión y límite de 500 KB) y se sube a la API desde el
 * módulo de administración; solo el rol admin puede modificarla.
 */

export type CoverSource = 'camera' | 'library';

function coversDirectory(): Directory {
  const directory = new Directory(Paths.document, 'covers');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export async function pickCoverImage(source: CoverSource): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Necesitamos permiso para usar la cámara. Puedes habilitarlo en Ajustes.');
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos permiso para acceder a tus fotos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export interface UploadableCover {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Prepara una portada para el endpoint multipart. La API exige máximo 500 KB;
 * se prueba con varias resoluciones/calidades y se devuelve la primera que quepa.
 */
export async function prepareCoverForUpload(sourceUri: string): Promise<UploadableCover> {
  const attempts = [
    { width: 1200, compress: 0.72 },
    { width: 900, compress: 0.55 },
    { width: 700, compress: 0.4 },
  ];
  let lastUri = sourceUri;

  for (const attempt of attempts) {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: attempt.width });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: attempt.compress,
      format: SaveFormat.JPEG,
    });
    lastUri = saved.uri;
    const file = new File(saved.uri);
    if (file.size <= 500 * 1024) {
      return {
        uri: saved.uri,
        name: `portada-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      };
    }
  }

  const finalFile = new File(lastUri);
  if (finalFile.size > 500 * 1024) {
    throw new Error(
      'La imagen sigue ocupando más de 500 KB después de comprimirla. Elige una foto más liviana.',
    );
  }

  return {
    uri: lastUri,
    name: `portada-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  };
}

/** Comprime y copia la imagen al almacenamiento permanente de la app. */
export async function persistCover(acudeId: string, sourceUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri);
  context.resize({ width: 1200 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });

  const safeId = acudeId.replace(/[^A-Za-z0-9_-]/g, '_');
  const directory = coversDirectory();
  const target = new File(directory, `${safeId}-${Date.now()}.jpg`);
  // La API nueva de File puede fallar al copiar archivos de caché por
  // permisos; la API legacy es más permisiva para archivos propios de la app.
  await LegacyFileSystem.copyAsync({ from: saved.uri, to: target.uri });
  return target.uri;
}

export async function deleteCoverFile(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Si el archivo ya no existe, no hay nada que limpiar.
  }
}

/** Elimina las portadas locales al cerrar sesión para no dejar archivos huérfanos. */
export async function clearCoverFiles(): Promise<void> {
  try {
    const directory = coversDirectory();
    for (const entry of directory.list()) {
      try {
        entry.delete();
      } catch {
        // Un archivo bloqueado no debe impedir el cierre de sesión.
      }
    }
  } catch {
    // Si el directorio no existe, no hay nada que limpiar.
  }
}
