import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { ConnectionBanner } from '@/components/connection-banner';
import { OccupancyBar } from '@/components/occupancy';
import { PageHeader, SectionHeader } from '@/components/page-header';
import { Screen } from '@/components/screen';
import { SlotRow } from '@/components/slot-row';
import { EmptyState, InlineNotice, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { categoryColors, radius, shadows, spacing, useAppTheme } from '@/constants/theme';
import { formatDateLong } from '@/lib/date';
import { CATEGORY_LABELS, WEEKDAY_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { useData } from '@/providers/data-provider';
import { useNetwork } from '@/providers/network-provider';
import { pickCoverImage, type CoverSource } from '@/services/cover-service';
import type { AcudeCategory } from '@/types';

const categoryIcon: Record<AcudeCategory, keyof typeof Ionicons.glyphMap> = {
  sports: 'football-outline',
  cultural: 'color-palette-outline',
  training: 'school-outline',
  recreational: 'happy-outline',
};

export default function AcudeDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const acudeId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { status, user } = useAuth();
  const { isOnline } = useNetwork();
  const { colors, isDark } = useAppTheme();
  const {
    acudes,
    activeEnrollments,
    ready,
    loading,
    refresh,
    enroll,
    cancel,
    coverUri,
    covers,
    applyCover,
    removeCover,
  } = useData();

  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [coverBusy, setCoverBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [failedCover, setFailedCover] = useState<string | null>(null);

  const acude = acudes.find((item) => item.id === acudeId);
  const enrolled = activeEnrollments.find(
    (item) => item.acudeId === acudeId && item.status === 'active',
  );
  const cover = acude ? coverUri(acude) : undefined;
  const showImage = !!cover && failedCover !== cover;
  const selectedSlot =
    acude?.schedule.find((slot) => slot.id === selectedSlotId) ??
    acude?.schedule.find((slot) => slot.available > 0) ??
    acude?.schedule[0] ??
    null;

  if (status === 'loading') {
    return (
      <Screen edges={['left', 'right']}>
        <Stack.Screen options={{ title: 'ACUDE' }} />
        <LoadingState message="Recuperando tu sesión…" />
      </Screen>
    );
  }
  if (status === 'signedOut' || !user) return <Redirect href="/sign-in" />;

  if (!acude) {
    return (
      <Screen edges={['left', 'right']}>
        <Stack.Screen options={{ title: 'ACUDE' }} />
        {loading || !ready ? (
          <LoadingState message="Buscando el ACUDE…" />
        ) : (
          <EmptyState
            title="ACUDE no disponible"
            message="Puede que ya no esté publicado o que no tengas acceso a esta actividad."
            icon="alert-circle-outline"
            actionLabel="Volver a la cartelera"
            onAction={() => router.replace('/(app)/cartelera')}
          />
        )}
      </Screen>
    );
  }

  const isStudent = user.role === 'student';
  const isAdmin = user.role === 'admin';
  const category = categoryColors(acude.category, isDark);
  const hasLocalCover = !!covers[acude.id];
  // La portada local es una preferencia del estudiante. Gestores y admin
  // gestionan imágenes desde la portada global (solo admin puede subirlas).
  const canManageLocalCover = user.role === 'student';
  const totalEnrolled = acude.totalCapacity - acude.totalAvailable;

  const handleCover = async (source: CoverSource) => {
    try {
      setCoverBusy(true);
      const uri = await pickCoverImage(source);
      if (uri) await applyCover(acude.id, uri);
    } catch (error) {
      Alert.alert(
        'No se pudo guardar la portada',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setCoverBusy(false);
    }
  };

  const openCoverOptions = () => {
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      { text: 'Tomar foto', onPress: () => void handleCover('camera') },
      { text: 'Elegir de la galería', onPress: () => void handleCover('library') },
    ];
    if (hasLocalCover) {
      buttons.push({
        text: 'Quitar portada local',
        style: 'destructive',
        onPress: () => {
          void removeCover(acude.id);
        },
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Portada del ACUDE', 'Esta portada se guarda solo en este dispositivo.', buttons);
  };

  const handleEnroll = async () => {
    if (!selectedSlot) return;
    setActionBusy(true);
    const result = await enroll(acude, selectedSlot);
    setActionBusy(false);
    Alert.alert(
      result.ok
        ? result.queued
          ? 'Inscripción guardada'
          : 'Inscripción confirmada'
        : 'No se pudo inscribir',
      result.message,
      result.ok
        ? [
            { text: 'Seguir explorando', style: 'cancel' },
            { text: 'Ver Mis ACUDES', onPress: () => router.push('/(app)/mis-acudes') },
          ]
        : [{ text: 'Entendido' }],
    );
  };

  const handleCancel = () => {
    if (!enrolled) return;
    Alert.alert(
      'Cancelar inscripción',
      `¿Quieres cancelar tu inscripción a “${acude.name}”? El cupo se libera de inmediato.`,
      [
        { text: 'Conservar', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            const result = await cancel(enrolled);
            setActionBusy(false);
            if (!result.ok) Alert.alert('No se pudo cancelar', result.message);
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['left', 'right']} refreshing={false} onRefresh={() => void refresh()}>
      <Stack.Screen options={{ title: acude.name }} />
      <ConnectionBanner />

      <PageHeader
        eyebrow={`${CATEGORY_LABELS[acude.category]} · ${acude.semester}`}
        title={acude.name}
        subtitle={acude.description || undefined}
        right={
          isStudent ? (
            <Badge
              label={
                acude.totalAvailable > 0
                  ? `${acude.totalAvailable} cupos disponibles`
                  : 'Sin cupos disponibles'
              }
              tone={acude.totalAvailable > 0 ? 'success' : 'danger'}
            />
          ) : isAdmin ? (
            <Button
              title="Editar"
              onPress={() => router.push(`/gestion/${acude.id}`)}
              size="sm"
              icon="create-outline"
            />
          ) : null
        }
      />

      <View style={[styles.hero, { backgroundColor: category.soft }]}>
        {showImage ? (
          <Image
            source={{ uri: cover }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            onError={() => setFailedCover(cover ?? null)}
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name={categoryIcon[acude.category]} size={62} color={category.solid} />
            <ThemedText variant="label" style={{ color: category.solid }}>
              {CATEGORY_LABELS[acude.category]}
            </ThemedText>
          </View>
        )}
        {canManageLocalCover ? (
          <Pressable
            onPress={openCoverOptions}
            disabled={coverBusy}
            accessibilityRole="button"
            accessibilityLabel="Cambiar portada local"
            style={[styles.coverButton, { backgroundColor: colors.overlay }]}
          >
            <Ionicons
              name={coverBusy ? 'hourglass-outline' : 'camera-outline'}
              size={16}
              color="#ffffff"
            />
            <ThemedText variant="caption" style={styles.coverButtonText}>
              {coverBusy ? 'Guardando…' : 'Portada'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading" tone="primary">
            {acude.totalAvailable}
          </ThemedText>
          <ThemedText variant="caption" tone="muted" align="center">
            cupos libres
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">{acude.schedule.length}</ThemedText>
          <ThemedText variant="caption" tone="muted" align="center">
            franjas
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="heading">{totalEnrolled}</ThemedText>
          <ThemedText variant="caption" tone="muted" align="center">
            inscritos
          </ThemedText>
        </View>
      </View>

      <SectionHeader title="Programación semanal" />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
        <ThemedText variant="bodySmall" tone="muted">
          Cada franja es un subgrupo con cupo propio. El escenario se usa para el grupo, nunca para
          una reserva individual.
        </ThemedText>
        <View style={styles.schedule}>
          {acude.schedule.map((slot) => (
            <SlotRow key={slot.id} slot={slot} />
          ))}
        </View>
      </View>

      <SectionHeader title="Información académica" />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow label="Docente" value={acude.teacherName} />
        <InfoRow label="Disciplina" value={acude.discipline} />
        <InfoRow label="Cupo por subgrupo" value={`${acude.maxCapacity} estudiantes`} />
        <InfoRow label="Asistencia mínima" value={`${acude.attendanceMin}%`} />
        <InfoRow
          label="Requisitos"
          value={acude.requirements || 'Carné institucional y vestimenta adecuada.'}
        />
        <InfoRow label="Última actualización" value={formatDateLong(acude.updatedAt)} />
      </View>

      <SectionHeader title={isStudent ? 'Inscripción' : isAdmin ? 'Administración' : 'Mi ACUDE'} />

      {isStudent ? (
        enrolled ? (
          <View style={[styles.enrolledCard, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <View style={styles.enrolledTop}>
              <Badge label="Inscrito" tone="success" icon="checkmark-circle-outline" />
              {enrolled.syncState === 'pending' ? (
                <Badge label="Guardado en el dispositivo" tone="warning" />
              ) : null}
            </View>
            <ThemedText variant="label">
              {WEEKDAY_LABELS[enrolled.day]} · {enrolled.startTime}–{enrolled.endTime}
            </ThemedText>
            <ThemedText variant="bodySmall" tone="muted">
              {enrolled.scenarioName} · {enrolled.teacherName}
            </ThemedText>
            <ThemedText variant="caption" tone="subtle">
              Inscripción del {formatDateLong(enrolled.enrolledOn)}. Si cancelas, el cupo se libera
              inmediatamente.
            </ThemedText>
            <Button
              title="Cancelar inscripción"
              onPress={handleCancel}
              loading={actionBusy}
              variant="dangerOutline"
              icon="close-circle-outline"
              fullWidth
            />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText variant="label">Elige tu subgrupo</ThemedText>
            <ThemedText variant="caption" tone="muted">
              Cada franja tiene cupo independiente. Puedes tener máximo 2 ACUDES por semestre.
            </ThemedText>
            <View style={styles.slotOptions}>
              {acude.schedule.map((slot) => {
                const selected = selectedSlot?.id === slot.id;
                const full = slot.available <= 0;
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => {
                      if (!full) setSelectedSlotId(slot.id);
                    }}
                    disabled={full}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: full }}
                    style={[
                      styles.slotOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primarySoft : colors.inputBackground,
                        opacity: full ? 0.55 : 1,
                      },
                    ]}
                  >
                    <View style={styles.flex}>
                      <ThemedText variant="label">
                        {WEEKDAY_LABELS[slot.day]} · {slot.startTime}–{slot.endTime}
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {slot.scenarioName}
                      </ThemedText>
                      <OccupancyBar
                        enrolled={slot.enrolled}
                        capacity={slot.capacity}
                        pct={slot.occupancyPct}
                        compact
                      />
                    </View>
                    <Badge
                      label={full ? 'Lleno' : `${slot.available} cupos`}
                      tone={full ? 'danger' : 'success'}
                    />
                  </Pressable>
                );
              })}
            </View>

            {!isOnline ? (
              <InlineNotice
                tone="warning"
                icon="cloud-offline-outline"
                message="Puedes inscribirte aunque no tengas conexión. Tu inscripción se enviará al recuperar la red."
              />
            ) : null}

            <Button
              title="Confirmar inscripción"
              onPress={() => void handleEnroll()}
              loading={actionBusy}
              disabled={!selectedSlot || selectedSlot.available <= 0}
              size="lg"
              fullWidth
              icon="add-circle-outline"
            />
            <ThemedText variant="caption" tone="subtle" align="center">
              Al inscribirte aceptas la regla de asistencia mínima del {acude.attendanceMin}%.
            </ThemedText>
          </View>
        )
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText variant="bodySmall" tone="muted">
            Este ACUDE tiene {totalEnrolled} inscripciones activas y {acude.schedule.length}{' '}
            subgrupos.
          </ThemedText>
          {isAdmin ? (
            <Button
              title="Editar programación"
              onPress={() => router.push(`/gestion/${acude.id}`)}
              icon="create-outline"
              fullWidth
            />
          ) : null}
          <Button
            title="Pasar asistencia"
            onPress={() => router.push('/(app)/asistencia')}
            variant="secondary"
            icon="checkbox-outline"
            fullWidth
          />
          {isAdmin ? (
            <Button
              title="Ver ocupación"
              onPress={() => router.push('/(app)/ocupacion')}
              variant="secondary"
              icon="pulse-outline"
              fullWidth
            />
          ) : null}
        </View>
      )}

      <View style={[styles.note, { borderColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textSubtle} />
        <ThemedText variant="caption" tone="subtle" style={styles.flex}>
          CanchaYa no reserva escenarios. La ocupación se calcula a partir de las inscripciones
          activas de cada subgrupo.
        </ThemedText>
      </View>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="overline" tone="subtle">
        {label}
      </ThemedText>
      <ThemedText variant="bodySmall">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    height: 210,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  coverButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  coverButtonText: { color: '#ffffff', fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  schedule: { gap: spacing.sm },
  infoRow: { gap: 1, paddingBottom: spacing.sm },
  enrolledCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  enrolledTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slotOptions: { gap: spacing.sm },
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    marginTop: spacing.xl,
  },
});
