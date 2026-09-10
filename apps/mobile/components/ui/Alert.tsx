import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  style?: ViewStyle;
}

export function Alert({
  variant = 'error',
  title,
  children,
  icon,
  onDismiss,
  style,
}: AlertProps) {
  const { isDark } = useTheme();

  const variantStyles = {
    info: {
      bg: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(14, 165, 233, 0.08)',
      border: isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(14, 165, 233, 0.25)',
      text: isDark ? '#bae6fd' : '#0369a1',
      title: isDark ? '#e0f2fe' : '#075985',
      iconColor: '#0ea5e9',
      defaultIcon: <Info size={16} color="#0ea5e9" />,
    },
    success: {
      bg: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
      border: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
      text: isDark ? '#a7f3d0' : '#047857',
      title: isDark ? '#d1fae5' : '#065f46',
      iconColor: '#10b981',
      defaultIcon: <CheckCircle2 size={16} color="#10b981" />,
    },
    warning: {
      bg: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
      border: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)',
      text: isDark ? '#fde68a' : '#b45309',
      title: isDark ? '#fef3c7' : '#92400e',
      iconColor: '#f59e0b',
      defaultIcon: <AlertTriangle size={16} color="#f59e0b" />,
    },
    error: {
      bg: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
      border: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)',
      text: isDark ? '#fecaca' : '#b91c1c',
      title: isDark ? '#fee2e2' : '#991b1b',
      iconColor: '#ef4444',
      defaultIcon: <AlertCircle size={16} color="#ef4444" />,
    },
  };

  const current = variantStyles[variant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
        },
        style,
      ]}
    >
      <View style={styles.iconWrapper}>
        {icon || current.defaultIcon}
      </View>

      <View style={styles.contentWrapper}>
        {title ? (
          <Text style={[styles.titleText, { color: current.title }]}>{title}</Text>
        ) : null}
        {typeof children === 'string' ? (
          <Text style={[styles.messageText, { color: current.text }]}>{children}</Text>
        ) : (
          children
        )}
      </View>

      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={8}>
          <X size={14} color={current.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.sm,
    gap: 10,
  },
  iconWrapper: {
    paddingTop: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 2,
  },
});
