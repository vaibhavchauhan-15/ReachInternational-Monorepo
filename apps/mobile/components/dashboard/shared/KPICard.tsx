/**
 * ReachInternational Mobile — Dashboard KPI Card Component
 * Migrated to React Native Reusables Card and Geist design tokens for 100% web mobile parity.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Skeleton } from '../../ui/Skeleton';
import { useTheme } from '../../ui/ThemeProvider';
import { spacingNumeric, radiusNumeric, type TypeVariant } from '@reachinternational/design-tokens';
import { haptics } from '../../../lib/haptics';

export type KPIVariant =
  | 'default'
  | 'warning'
  | 'error'
  | 'success'
  | 'info'
  | 'purple'
  | 'indigo';

export interface KPICardProps {
  label: string;
  value: number | string;
  isLoading?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  variant?: KPIVariant;
  labelVariant?: TypeVariant;
  valueVariant?: TypeVariant;
  labelWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  valueWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  labelColor?: string;
  valueColor?: string;
  href?: string;
  onPress?: () => void;
  interactive?: boolean;
  active?: boolean;
  subtitle?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

const variantConfig: Record<
  KPIVariant,
  {
    iconBgLight: string;
    iconBgDark: string;
    iconColorLight: string;
    iconColorDark: string;
    labelColorLight?: string;
    labelColorDark?: string;
    valueColorLight: string;
    valueColorDark: string;
  }
> = {
  default: {
    iconBgLight: 'rgba(100, 116, 139, 0.12)',
    iconBgDark: 'rgba(148, 163, 184, 0.16)',
    iconColorLight: '#64748b',
    iconColorDark: '#94a3b8',
    labelColorLight: '#64748b',
    labelColorDark: '#94a3b8',
    valueColorLight: '#171717',
    valueColorDark: '#f8fafc',
  },
  info: {
    iconBgLight: 'rgba(14, 165, 233, 0.16)',
    iconBgDark: 'rgba(56, 189, 248, 0.20)',
    iconColorLight: '#0284c7',
    iconColorDark: '#38bdf8',
    labelColorLight: '#0284c7',
    labelColorDark: '#38bdf8',
    valueColorLight: '#0284c7',
    valueColorDark: '#38bdf8',
  },
  warning: {
    iconBgLight: 'rgba(245, 158, 11, 0.16)',
    iconBgDark: 'rgba(251, 191, 36, 0.20)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    labelColorLight: '#d97706',
    labelColorDark: '#fbbf24',
    valueColorLight: '#d97706',
    valueColorDark: '#fbbf24',
  },
  success: {
    iconBgLight: 'rgba(16, 185, 129, 0.16)',
    iconBgDark: 'rgba(52, 211, 153, 0.20)',
    iconColorLight: '#10b981',
    iconColorDark: '#34d399',
    labelColorLight: '#059669',
    labelColorDark: '#34d399',
    valueColorLight: '#10b981',
    valueColorDark: '#34d399',
  },
  error: {
    iconBgLight: 'rgba(244, 63, 94, 0.16)',
    iconBgDark: 'rgba(251, 113, 133, 0.20)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    labelColorLight: '#e11d48',
    labelColorDark: '#fb7185',
    valueColorLight: '#e11d48',
    valueColorDark: '#fb7185',
  },
  purple: {
    iconBgLight: 'rgba(139, 92, 246, 0.16)',
    iconBgDark: 'rgba(192, 132, 252, 0.20)',
    iconColorLight: '#7c3aed',
    iconColorDark: '#c084fc',
    labelColorLight: '#7c3aed',
    labelColorDark: '#c084fc',
    valueColorLight: '#7c3aed',
    valueColorDark: '#c084fc',
  },
  indigo: {
    iconBgLight: 'rgba(79, 70, 229, 0.16)',
    iconBgDark: 'rgba(129, 140, 248, 0.20)',
    iconColorLight: '#4338ca',
    iconColorDark: '#a5b4fc',
    labelColorLight: '#4338ca',
    labelColorDark: '#a5b4fc',
    valueColorLight: '#4338ca',
    valueColorDark: '#a5b4fc',
  },
};

const resolveRoute = (href?: string): string | null => {
  if (!href) return null;
  const cleanRoute = href.replace(/^\/\(app\)/, '');
  if (cleanRoute.startsWith('/audit')) return '/dashboard';
  return cleanRoute;
};

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  isLoading = false,
  icon: Icon,
  variant = 'default',
  labelVariant,
  valueVariant,
  labelWeight,
  valueWeight,
  labelColor,
  valueColor,
  href,
  onPress,
  interactive = true,
  active = false,
  subtitle,
  style,
  containerStyle,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const config = variantConfig[variant] || variantConfig.default;
  const targetRoute = resolveRoute(href);
  const isInteractive = Boolean(onPress || targetRoute || interactive);

  const handlePress = () => {
    if (isInteractive) {
      if (onPress) {
        onPress();
      } else if (targetRoute) {
        router.push(targetRoute as any);
      } else {
        haptics.tap();
      }
    }
  };

  const resolvedLabelColor =
    labelColor || (isDark ? config.labelColorDark || '#94a3b8' : config.labelColorLight || '#64748b');

  return (
    <View style={[styles.touchWrapper, containerStyle]}>
      <Card
        interactive={isInteractive}
        onPress={isInteractive ? handlePress : undefined}
        className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 flex-col justify-between h-full"
        style={[
          styles.kpiCard,
          active && {
            borderColor: isDark ? '#f8fafc' : theme.colors.ink,
            borderWidth: 1.5,
          },
          style,
        ]}
      >
        {/* Header Row: Label & Icon Capsule */}
        <View style={styles.headerRow}>
          <Text
            variant={labelVariant || 'caption'}
            weight={labelWeight || 'medium'}
            style={[
              styles.label,
              { color: resolvedLabelColor },
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>

          {Icon ? (
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark ? config.iconBgDark : config.iconBgLight,
                },
              ]}
            >
              <Icon
                size={16}
                color={isDark ? config.iconColorDark : config.iconColorLight}
              />
            </View>
          ) : null}
        </View>

        {/* Metric Value */}
        <View style={styles.valueRow}>
          {isLoading ? (
            <Skeleton width={38} height={26} borderRadius={radiusNumeric.xs} style={{ marginVertical: 2 }} />
          ) : (
            <Text
              variant={valueVariant || 'title'}
              weight={valueWeight || 'bold'}
              style={[
                styles.value,
                {
                  color: valueColor || (isDark ? config.valueColorDark : config.valueColorLight),
                },
              ]}
            >
              {value}
            </Text>
          )}
          {Boolean(subtitle) && !isLoading ? (
            <Text
              variant="micro"
              weight="medium"
              style={[
                styles.subtitle,
                { color: theme.colors.mute },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  touchWrapper: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  label: {
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueRow: {
    marginTop: spacingNumeric.xs + 2,
  },
  value: {},
  subtitle: {
    marginTop: 2,
  },
  kpiCard: {
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.sm + 4,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 84,
  },
});
