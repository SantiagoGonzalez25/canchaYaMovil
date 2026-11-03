import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { radius, spacing, useAppTheme } from '@/constants/theme';
import { listStatusHeadline, type ListStatus } from '@/lib/list-status';
import { Button } from './button';
import { ThemedText } from './themed-text';

interface StateViewProps {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'danger' | 'warning';
}

export function StateView({
  title,
  message,
  icon = 'sparkles-outline',
  actionLabel,
  onAction,
  tone = 'neutral',
}: StateViewProps) {
  const { colors } = useAppTheme();
  const toneColor =
    tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.primary;
  const toneSoft =
    tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.primarySoft;

  return (
    <View style={styles.state}>
      <View style={[styles.iconCircle, { backgroundColor: toneSoft }]}>
        <Ionicons name={icon} size={30} color={toneColor} />
      </View>
      <ThemedText variant="subtitle" align="center">
        {title}
      </ThemedText>
      {message ? (
        <ThemedText variant="bodySmall" tone="muted" align="center" style={styles.message}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" icon="refresh" />
      ) : null}
    </View>
  );
}

export function LoadingState({ message = 'Cargando información…' }: { message?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.state}>
      <ActivityIndicator size="large" color={colors.primary} />
      <ThemedText variant="bodySmall" tone="muted">
        {message}
      </ThemedText>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = 'Algo salió mal',
}: {
  message?: string | null;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <StateView
      title={title}
      message={message ?? 'No pudimos cargar la información.'}
      icon="cloud-offline-outline"
      tone="danger"
      actionLabel={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

export function EmptyState({
  title = 'Nada por aquí todavía',
  message,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <StateView
      title={title}
      message={message}
      icon={icon}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

export interface InlineNoticeProps {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function InlineNotice({
  tone = 'info',
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: InlineNoticeProps) {
  const { colors } = useAppTheme();
  const palettes = {
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
  };
  const palette = palettes[tone];
  const iconName =
    icon ??
    (tone === 'danger'
      ? 'alert-circle-outline'
      : tone === 'warning'
        ? 'alert-outline'
        : tone === 'success'
          ? 'checkmark-circle-outline'
          : 'information-circle-outline');

  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Ionicons name={iconName} size={20} color={palette.fg} style={styles.noticeIcon} />
      <View style={styles.noticeBody}>
        {title ? (
          <ThemedText variant="label" style={{ color: palette.fg }}>
            {title}
          </ThemedText>
        ) : null}
        <ThemedText variant="bodySmall" style={{ color: palette.fg }}>
          {message}
        </ThemedText>
        {actionLabel && onAction ? (
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="ghost"
            size="sm"
            style={styles.noticeAction}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Renderiza el estado correcto de una lista (carga, error, vacío, offline). */
export function ListStateView({
  status,
  error,
  onRetry,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
  children,
}: {
  status: ListStatus;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  children?: React.ReactNode;
}) {
  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState message={error} onRetry={onRetry} />;
  if (status === 'offline') {
    return (
      <StateView
        title={listStatusHeadline('offline')}
        message="Conéctate una vez para descargar la cartelera. Después podrás consultarla sin red."
        icon="cloud-offline-outline"
        tone="warning"
        actionLabel={onRetry ? 'Reintentar' : undefined}
        onAction={onRetry}
      />
    );
  }
  if (status === 'empty') {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        icon={emptyIcon}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  message: { maxWidth: 340 },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  noticeIcon: { marginTop: 1 },
  noticeBody: { flex: 1, gap: spacing.xs },
  noticeAction: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
