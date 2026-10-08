import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { DashboardAlert } from '@reachinternational/types';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowUpRight,
} from '../../ui/icon';
import { haptics } from '../../../lib/haptics';

import { Touchable } from '../../ui/Touchable';

interface AlertWidgetProps {
  alerts: DashboardAlert[];
  title?: string;
  showCount?: boolean;
  style?: any;
}

const severityConfig = {
  critical: {
    gradientLight: ['rgba(244, 63, 94, 0.10)', 'rgba(244, 63, 94, 0.04)', 'transparent'] as const,
    gradientDark: ['rgba(76, 5, 25, 0.40)', 'rgba(76, 5, 25, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(244, 63, 94, 0.25)',
    borderDark: 'rgba(251, 113, 133, 0.30)',
    iconBgLight: 'rgba(244, 63, 94, 0.15)',
    iconBgDark: 'rgba(251, 113, 133, 0.20)',
    iconBorderLight: 'rgba(244, 63, 94, 0.25)',
    iconBorderDark: 'rgba(251, 113, 133, 0.30)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    titleColorLight: '#881337',
    titleColorDark: '#ffe4e6',
    descColorLight: '#be123c',
    descColorDark: '#fecdd3',
    icon: AlertCircle,
  },
  warning: {
    gradientLight: ['rgba(245, 158, 11, 0.10)', 'rgba(245, 158, 11, 0.03)', 'transparent'] as const,
    gradientDark: ['rgba(69, 26, 3, 0.35)', 'rgba(69, 26, 3, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(245, 158, 11, 0.25)',
    borderDark: 'rgba(251, 191, 36, 0.30)',
    iconBgLight: 'rgba(245, 158, 11, 0.15)',
    iconBgDark: 'rgba(245, 158, 11, 0.25)',
    iconBorderLight: 'rgba(245, 158, 11, 0.25)',
    iconBorderDark: 'rgba(251, 191, 36, 0.35)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    titleColorLight: '#78350f',
    titleColorDark: '#fef3c7',
    descColorLight: '#b45309',
    descColorDark: '#fde68a',
    icon: AlertTriangle,
  },
  success: {
    gradientLight: ['rgba(16, 185, 129, 0.10)', 'rgba(16, 185, 129, 0.04)', 'transparent'] as const,
    gradientDark: ['rgba(2, 44, 34, 0.40)', 'rgba(2, 44, 34, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(16, 185, 129, 0.25)',
    borderDark: 'rgba(52, 211, 153, 0.30)',
    iconBgLight: 'rgba(16, 185, 129, 0.15)',
    iconBgDark: 'rgba(16, 185, 129, 0.25)',
    iconBorderLight: 'rgba(16, 185, 129, 0.25)',
    iconBorderDark: 'rgba(52, 211, 153, 0.35)',
    iconColorLight: '#059669',
    iconColorDark: '#34d399',
    titleColorLight: '#064e3b',
    titleColorDark: '#d1fae5',
    descColorLight: '#047857',
    descColorDark: '#a7f3d0',
    icon: CheckCircle2,
  },
  info: {
    gradientLight: ['rgba(14, 165, 233, 0.10)', 'rgba(14, 165, 233, 0.04)', 'transparent'] as const,
    gradientDark: ['rgba(8, 47, 73, 0.40)', 'rgba(8, 47, 73, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(14, 165, 233, 0.25)',
    borderDark: 'rgba(56, 189, 248, 0.30)',
    iconBgLight: 'rgba(14, 165, 233, 0.15)',
    iconBgDark: 'rgba(14, 165, 233, 0.25)',
    iconBorderLight: 'rgba(14, 165, 233, 0.25)',
    iconBorderDark: 'rgba(56, 189, 248, 0.35)',
    iconColorLight: '#0284c7',
    iconColorDark: '#38bdf8',
    titleColorLight: '#0369a1',
    titleColorDark: '#e0f2fe',
    descColorLight: '#0284c7',
    descColorDark: '#7dd3fc',
    icon: Info,
  },
};

const resolveAppRoute = (url?: string): string | null => {
  if (!url) return null;
  if (url.startsWith('/operations')) return url.startsWith('/(app)') ? url : `/(app)${url}`;
  if (url.startsWith('/machines')) return '/(app)/machines';
  if (url.startsWith('/users')) return '/(app)/users';
  if (url.startsWith('/clients')) return '/(app)/clients';
  if (url.startsWith('/attendance')) return '/(app)/attendance';
  if (url.startsWith('/payroll')) return '/(app)/payroll';
  if (url.startsWith('/audit')) return '/(app)/dashboard';
  return url.startsWith('/(app)') ? url : `/(app)${url}`;
};

export const AlertItem: React.FC<{ alert: DashboardAlert }> = ({ alert }) => {
  const { isDark } = useTheme();
  const router = useRouter();
  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  const targetRoute = resolveAppRoute(alert.actionUrl);

  const handlePress = async () => {
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  const content = (
    <LinearGradient
      colors={isDark ? config.gradientDark : config.gradientLight}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.alertCard,
        {
          borderColor: isDark ? config.borderDark : config.borderLight,
        },
      ]}
    >
      <View style={styles.leftRow}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isDark ? config.iconBgDark : config.iconBgLight,
              borderColor: isDark ? config.iconBorderDark : config.iconBorderLight,
            },
          ]}
        >
          <Icon
            size={16}
            color={isDark ? config.iconColorDark : config.iconColorLight}
            animate="mount"
          />
        </View>

        <View style={styles.textContainer}>
          <Text
            variant="subheading"
            style={[
              styles.alertTitle,
              { color: isDark ? config.titleColorDark : config.titleColorLight },
            ]}
          >
            {alert.title}
          </Text>
          {alert.description ? (
            <Text
              variant="caption"
              style={[
                styles.alertDesc,
                { color: isDark ? config.descColorDark : config.descColorLight },
              ]}
              numberOfLines={2}
            >
              {alert.description}
            </Text>
          ) : null}
        </View>
      </View>

      {targetRoute ? (
        <View style={styles.arrowContainer}>
          <ArrowUpRight
            size={16}
            color={isDark ? config.iconColorDark : config.iconColorLight}
          />
        </View>
      ) : null}
    </LinearGradient>
  );

  if (targetRoute) {
    return (
      <Touchable
        preset="card"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={alert.title}
      >
        {content}
      </Touchable>
    );
  }

  return content;
};

export const AlertWidget: React.FC<AlertWidgetProps> = ({
  alerts,
  title = 'ALERT',
  showCount = false,
  style,
}) => {
  const { theme } = useTheme();

  if (!alerts || alerts.length === 0) return null;

  return (
    <View style={[styles.container, style]}>
      {title ? (
        <Text variant="caption" style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          {title}
          {showCount ? ` (${alerts.length})` : ''}
        </Text>
      ) : null}
      <View style={styles.list}>
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacingNumeric.md,
  },
  eyebrowHeader: {
    marginBottom: spacingNumeric.xs,
  },
  list: {
    gap: spacingNumeric.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm + 2,
    borderRadius: radiusNumeric.md || 12,
    borderWidth: 1,
    gap: spacingNumeric.xs,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      } as any,
    }),
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacingNumeric.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {},
  alertDesc: {
    marginTop: 2,
  },
  arrowContainer: {
    paddingTop: 2,
    paddingLeft: spacingNumeric.xs,
    flexShrink: 0,
  },
});
