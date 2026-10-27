/**
 * ReachInternational Mobile — Dashboard Status Card Component
 * Migrated to React Native Reusables Card and Geist tokens for 100% web mobile parity.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { useTheme } from '../../ui/ThemeProvider';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Info } from '../../ui/icon';

export interface StatusCardProps {
  title: string;
  status?: 'success' | 'pending' | 'warning' | 'info' | 'default';
  label?: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  href?: string;
  style?: StyleProp<ViewStyle>;
  monoValue?: boolean;
  children?: React.ReactNode;
}

const statusConfig = {
  default: {
    iconBgLight: 'rgba(100, 116, 139, 0.12)',
    iconBgDark: 'rgba(148, 163, 184, 0.16)',
    iconColorLight: '#64748b',
    iconColorDark: '#94a3b8',
    labelColorLight: '#171717',
    labelColorDark: '#fafafa',
    icon: Clock,
  },
  info: {
    iconBgLight: 'rgba(14, 165, 233, 0.16)',
    iconBgDark: 'rgba(56, 189, 248, 0.20)',
    iconColorLight: '#0284c7',
    iconColorDark: '#38bdf8',
    labelColorLight: '#0284c7',
    labelColorDark: '#38bdf8',
    icon: Info,
  },
  success: {
    iconBgLight: 'rgba(16, 185, 129, 0.16)',
    iconBgDark: 'rgba(52, 211, 153, 0.20)',
    iconColorLight: '#10b981',
    iconColorDark: '#34d399',
    labelColorLight: '#059669',
    labelColorDark: '#34d399',
    icon: CheckCircle2,
  },
  pending: {
    iconBgLight: 'rgba(245, 158, 11, 0.16)',
    iconBgDark: 'rgba(251, 191, 36, 0.20)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    labelColorLight: '#b45309',
    labelColorDark: '#fbbf24',
    icon: Clock,
  },
  warning: {
    iconBgLight: 'rgba(244, 63, 94, 0.16)',
    iconBgDark: 'rgba(251, 113, 133, 0.20)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    labelColorLight: '#e11d48',
    labelColorDark: '#fb7185',
    icon: AlertTriangle,
  },
};

const resolveRoute = (href?: string): string | null => {
  if (!href) return null;
  const cleanRoute = href.replace(/^\/\(app\)/, '');
  if (cleanRoute.startsWith('/audit')) return '/dashboard';
  return cleanRoute;
};

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status = 'default',
  label,
  description,
  icon: customIcon,
  href,
  style,
  monoValue = false,
  children,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const config = statusConfig[status] || statusConfig.default;
  const Icon = customIcon || config.icon;
  const targetRoute = resolveRoute(href);

  const handlePress = () => {
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  return (
    <Card
      onPress={targetRoute ? handlePress : undefined}
      className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card flex-col justify-between"
      style={style}
    >
      <View style={styles.topRow}>
        <Text
          variant="caption"
          weight="semibold"
          style={[
            styles.eyebrow,
            { color: isDark ? '#94a3b8' : '#64748b' },
          ]}
        >
          {title}
        </Text>
        {targetRoute ? (
          <ArrowRight size={14} color={isDark ? '#94a3b8' : '#64748b'} />
        ) : null}
      </View>

      {label ? (
        <View style={styles.contentRow}>
          <View
            style={[
              styles.iconCircle,
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
              variant={monoValue ? 'mono' : 'subheading'}
              weight="semibold"
              style={[
                styles.label,
                { color: isDark ? config.labelColorDark : config.labelColorLight },
              ]}
            >
              {label}
            </Text>
            {description ? (
              <Text
                variant="caption"
                style={[
                  styles.description,
                  { color: isDark ? '#94a3b8' : '#64748b' },
                ]}
                numberOfLines={2}
              >
                {description}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {children ? (
        <View
          style={[
            label ? styles.childrenWithLabel : styles.childrenOnly,
            { borderTopColor: theme.colors.hairline },
          ]}
        >
          {children}
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xs + 2,
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm + 2,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  label: {},
  description: {
    marginTop: 2,
  },
  childrenWithLabel: {
    marginTop: spacingNumeric.sm,
    paddingTop: spacingNumeric.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  childrenOnly: {
    paddingTop: spacingNumeric.xs,
  },
});
