/**
 * ReachInternational Mobile — Dashboard Alert Widget
 * Migrated to React Native Reusables Card and Geist tokens for 100% web mobile parity.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { useTheme } from '../../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { DashboardAlert } from '@reachinternational/types';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowUpRight,
} from '../../ui/icon';

interface AlertWidgetProps {
  alerts: DashboardAlert[];
  title?: string;
  showCount?: boolean;
  style?: StyleProp<ViewStyle>;
}

const severityConfig = {
  critical: {
    cardBgLight: '#fff1f2',
    cardBgDark: 'rgba(76, 5, 25, 0.25)',
    borderLight: 'rgba(244, 63, 94, 0.30)',
    borderDark: 'rgba(251, 113, 133, 0.30)',
    iconBgLight: 'rgba(244, 63, 94, 0.15)',
    iconBgDark: 'rgba(251, 113, 133, 0.20)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    titleColorLight: '#881337',
    titleColorDark: '#ffe4e6',
    descColorLight: '#be123c',
    descColorDark: '#fecdd3',
    icon: AlertCircle,
  },
  warning: {
    cardBgLight: '#fffbeb',
    cardBgDark: 'rgba(69, 26, 3, 0.25)',
    borderLight: 'rgba(245, 158, 11, 0.30)',
    borderDark: 'rgba(251, 191, 36, 0.30)',
    iconBgLight: 'rgba(245, 158, 11, 0.15)',
    iconBgDark: 'rgba(245, 158, 11, 0.25)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    titleColorLight: '#78350f',
    titleColorDark: '#fef3c7',
    descColorLight: '#b45309',
    descColorDark: '#fde68a',
    icon: AlertTriangle,
  },
  success: {
    cardBgLight: '#f0fdf4',
    cardBgDark: 'rgba(2, 44, 34, 0.25)',
    borderLight: 'rgba(16, 185, 129, 0.30)',
    borderDark: 'rgba(52, 211, 153, 0.30)',
    iconBgLight: 'rgba(16, 185, 129, 0.15)',
    iconBgDark: 'rgba(16, 185, 129, 0.25)',
    iconColorLight: '#059669',
    iconColorDark: '#34d399',
    titleColorLight: '#064e3b',
    titleColorDark: '#d1fae5',
    descColorLight: '#047857',
    descColorDark: '#a7f3d0',
    icon: CheckCircle2,
  },
  info: {
    cardBgLight: '#f0f9ff',
    cardBgDark: 'rgba(8, 47, 73, 0.25)',
    borderLight: 'rgba(14, 165, 233, 0.30)',
    borderDark: 'rgba(56, 189, 248, 0.30)',
    iconBgLight: 'rgba(14, 165, 233, 0.15)',
    iconBgDark: 'rgba(14, 165, 233, 0.25)',
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
  const cleanUrl = url.replace(/^\/\(app\)/, '');
  if (cleanUrl.startsWith('/audit')) return '/dashboard';
  return cleanUrl;
};

export const AlertItem: React.FC<{ alert: DashboardAlert }> = ({ alert }) => {
  const { isDark } = useTheme();
  const router = useRouter();
  const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  const targetRoute = resolveAppRoute(alert.actionUrl);

  const handlePress = () => {
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  return (
    <Card
      onPress={targetRoute ? handlePress : undefined}
      className="p-3.5 rounded-2xl flex-row items-start justify-between"
      style={[
        styles.card,
        {
          backgroundColor: isDark ? config.cardBgDark : config.cardBgLight,
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
            },
          ]}
        >
          <Icon
            size={18}
            color={isDark ? config.iconColorDark : config.iconColorLight}
          />
        </View>

        <View style={styles.textContainer}>
          <Text
            variant="subheading"
            weight="semibold"
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
    </Card>
  );
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
        <Text variant="caption" weight="semibold" style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
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
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm + 4,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  eyebrowHeader: {
    textTransform: 'uppercase',
    marginBottom: spacingNumeric.xs,
  },
  list: {
    gap: spacingNumeric.xs,
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
    borderRadius: 16,
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
