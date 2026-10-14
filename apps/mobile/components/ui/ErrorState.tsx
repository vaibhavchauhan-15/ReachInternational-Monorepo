/**
 * ReachInternational Mobile — Canonical ErrorState Component
 * 
 * Classifies errors (Network, Timeout, Server, Permission, Generic),
 * sanitizes raw database/SQL state codes, and renders accessible,
 * responsive error cards with tactile haptic retry actions.
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on all interactive buttons
 * - Tactile haptic feedback on retry
 */

import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldAlert,
  RotateCcw,
  AlertCircle,
  ChevronRight,
} from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export type ErrorClassification = 'network' | 'timeout' | 'server' | 'permission' | 'generic';

export interface ErrorStateProps {
  error?: unknown;
  classification?: ErrorClassification;
  title?: string;
  message?: string;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  actionLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  testID?: string;
}

/**
 * Classifies an error and extracts a sanitized human-readable message.
 * Prevents PostgreSQL codes, schema references, or stack traces from reaching UI.
 */
export function classifyError(error: unknown): {
  classification: ErrorClassification;
  title: string;
  message: string;
} {
  if (!error) {
    return {
      classification: 'generic',
      title: 'Unable to Load Data',
      message: 'An unexpected issue occurred. Please try again.',
    };
  }

  const rawMessage =
    typeof error === 'string'
      ? error
      : (error as any)?.message || (error as any)?.error_description || String(error);

  const lower = rawMessage.toLowerCase();
  const code = String((error as any)?.code || (error as any)?.status || '');

  // 1. Network / Offline
  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection') ||
    lower.includes('internet') ||
    lower.includes('enotfound') ||
    code === 'NETWORK_ERROR'
  ) {
    return {
      classification: 'network',
      title: 'No Internet Connection',
      message: 'Check your mobile data or Wi-Fi network and try again.',
    };
  }

  // 2. Slow Network / Timeout
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    code === 'ETIMEDOUT' ||
    code === '408'
  ) {
    return {
      classification: 'timeout',
      title: 'Request Timed Out',
      message: 'The server took too long to respond. Please check your signal and retry.',
    };
  }

  // 3. Permission / Forbidden
  if (
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('row-level security') ||
    lower.includes('access denied') ||
    code === '42501' ||
    code === '403'
  ) {
    return {
      classification: 'permission',
      title: 'Access Restricted',
      message: 'You do not have permission to view or modify this record.',
    };
  }

  // 4. Server 500 / PostgreSQL Internal
  if (
    code.startsWith('5') ||
    code === 'P0001' ||
    lower.includes('internal server') ||
    lower.includes('database error')
  ) {
    return {
      classification: 'server',
      title: 'Service Temporarily Unavailable',
      message: 'We encountered an internal operational issue. Our team has been notified.',
    };
  }

  // 5. Sanitized Generic
  let sanitized = rawMessage;
  if (sanitized.includes('(SQLSTATE') || sanitized.includes('relation "') || sanitized.includes('public.')) {
    sanitized = 'A database operation could not be completed. Please try again.';
  }

  return {
    classification: 'generic',
    title: 'Unable to Load Data',
    message: sanitized.length > 140 ? 'An unexpected issue occurred while processing your request.' : sanitized,
  };
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  classification: propClassification,
  title: propTitle,
  message: propMessage,
  onRetry,
  retryLabel = 'Try Again',
  actionLabel,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  style,
  icon,
  testID = 'error-state-card',
}) => {
  const { theme, isDark } = useTheme();
  const [isRetrying, setIsRetrying] = useState(false);
  const effectiveRetryLabel = actionLabel || retryLabel;

  const auto = classifyError(error);
  const classification = propClassification || auto.classification;
  const title = propTitle || auto.title;
  const message = propMessage || auto.message;

  const handleRetryPress = async () => {
    if (!onRetry || isRetrying) return;
    try {
      haptics.select();
    } catch {
      // ignore
    }

    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // Retrying error handled by caller
    } finally {
      setIsRetrying(false);
    }
  };

  // Semantic icon and palette configuration mapped to Geist tokens
  const config = (() => {
    switch (classification) {
      case 'network':
        return {
          icon: <WifiOff size={compact ? 20 : 26} color={isDark ? '#f87171' : '#dc2626'} />,
          badgeBg: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
          badgeBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
        };
      case 'timeout':
        return {
          icon: <Clock size={compact ? 20 : 26} color={isDark ? '#fbbf24' : '#d97706'} />,
          badgeBg: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.08)',
          badgeBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
        };
      case 'permission':
        return {
          icon: <ShieldAlert size={compact ? 20 : 26} color={isDark ? '#fbbf24' : '#d97706'} />,
          badgeBg: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.08)',
          badgeBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
        };
      case 'server':
        return {
          icon: <AlertTriangle size={compact ? 20 : 26} color={isDark ? '#f87171' : '#dc2626'} />,
          badgeBg: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
          badgeBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
        };
      case 'generic':
      default:
        return {
          icon: <AlertCircle size={compact ? 20 : 26} color={isDark ? '#f87171' : '#dc2626'} />,
          badgeBg: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
          badgeBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
        };
    }
  })();

  return (
    <View
      style={[
        compact ? styles.compactContainer : styles.fullContainer,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`${title}: ${message}`}
      testID={testID}
    >
      {/* Icon Capsule */}
      <View
        style={[
          compact ? styles.compactIconBox : styles.iconBox,
          {
            backgroundColor: config.badgeBg,
            borderColor: config.badgeBorder,
          },
        ]}
      >
        {icon || config.icon}
      </View>

      {/* Title & Sanitized Explanation */}
      <Text
        variant={compact ? 'subheading' : 'heading'}
        style={[styles.titleText, { color: theme.colors.ink }]}
        numberOfLines={2}
      >
        {title}
      </Text>

      <Text
        variant="body"
        style={[styles.messageText, { color: theme.colors.mute }]}
        numberOfLines={compact ? 3 : 4}
      >
        {message}
      </Text>

      {/* Action Row */}
      {(onRetry || onSecondaryAction) && (
        <View style={styles.actionsRow}>
          {onRetry && (
            <Pressable
              variant="buttonPrimary"
              haptic="select"
              hitSlopToMin48
              onPress={handleRetryPress}
              disabled={isRetrying}
              style={[
                styles.retryBtn,
                { backgroundColor: theme.colors.ink },
              ]}
              accessibilityRole="button"
              accessibilityLabel={effectiveRetryLabel}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color={theme.colors.canvas} style={styles.spinner} />
              ) : (
                <RotateCcw size={14} color={theme.colors.canvas} style={styles.btnIcon} />
              )}
              <Text variant="label" style={{ color: theme.colors.canvas }}>
                {isRetrying ? 'Retrying...' : effectiveRetryLabel}
              </Text>
            </Pressable>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <Pressable
              variant="buttonGhost"
              haptic="tap"
              hitSlopToMin48
              onPress={onSecondaryAction}
              style={styles.secondaryBtn}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionLabel}
            >
              <Text variant="label" style={{ color: theme.colors.ink }}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    width: '100%',
    paddingVertical: spacingNumeric.xl,
    paddingHorizontal: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.md,
  },
  compactContainer: {
    width: '100%',
    paddingVertical: spacingNumeric.md,
    paddingHorizontal: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.xs,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.sm,
  },
  compactIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.xs,
  },
  titleText: {
    textAlign: 'center',
    marginBottom: 4,
  },
  messageText: {
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: spacingNumeric.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.sm,
    flexWrap: 'wrap',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
  },
  btnIcon: {
    marginRight: 6,
  },
  spinner: {
    marginRight: 6,
  },
});

export default ErrorState;
