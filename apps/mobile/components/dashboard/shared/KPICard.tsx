import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { useTheme } from '../../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

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
  icon?: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  variant?: KPIVariant;
  href?: string;
  onPress?: () => void;
  active?: boolean;
  subtitle?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  style?: any;
  containerStyle?: any;
}

const variantStyles: Record<
  KPIVariant,
  {
    cardGradientLight: readonly [string, string, ...string[]];
    cardGradientDark: readonly [string, string, ...string[]];
    iconGradientLight: readonly [string, string, ...string[]];
    iconGradientDark: readonly [string, string, ...string[]];
    borderColorLight: string;
    borderColorDark: string;
    iconColorLight: string;
    iconColorDark: string;
    valueColorLight: string;
    valueColorDark: string;
  }
> = {
  default: {
    cardGradientLight: ['#ffffff', '#f8fafc', '#f1f5f9'],
    cardGradientDark: ['#1e293b', '#172033', '#0f172a'],
    iconGradientLight: ['rgba(100, 116, 139, 0.16)', 'rgba(100, 116, 139, 0.06)'],
    iconGradientDark: ['rgba(148, 163, 184, 0.25)', 'rgba(148, 163, 184, 0.10)'],
    borderColorLight: 'rgba(226, 232, 240, 0.9)',
    borderColorDark: 'rgba(51, 65, 85, 0.8)',
    iconColorLight: '#475569',
    iconColorDark: '#cbd5e1',
    valueColorLight: '#0f172a',
    valueColorDark: '#f8fafc',
  },
  info: {
    cardGradientLight: ['#ffffff', '#f0f9ff', '#e0f2fe'],
    cardGradientDark: ['#0b1e33', '#082f49', '#0c4a6e'],
    iconGradientLight: ['rgba(14, 165, 233, 0.22)', 'rgba(14, 165, 233, 0.08)'],
    iconGradientDark: ['rgba(56, 189, 248, 0.35)', 'rgba(14, 165, 233, 0.15)'],
    borderColorLight: 'rgba(14, 165, 233, 0.25)',
    borderColorDark: 'rgba(56, 189, 248, 0.35)',
    iconColorLight: '#0284c7',
    iconColorDark: '#38bdf8',
    valueColorLight: '#0284c7',
    valueColorDark: '#38bdf8',
  },
  warning: {
    cardGradientLight: ['#ffffff', '#fffbeb', '#fef3c7'],
    cardGradientDark: ['#271708', '#451a03', '#78350f'],
    iconGradientLight: ['rgba(245, 158, 11, 0.22)', 'rgba(245, 158, 11, 0.08)'],
    iconGradientDark: ['rgba(251, 191, 36, 0.35)', 'rgba(245, 158, 11, 0.15)'],
    borderColorLight: 'rgba(245, 158, 11, 0.25)',
    borderColorDark: 'rgba(251, 191, 36, 0.35)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    valueColorLight: '#b45309',
    valueColorDark: '#fbbf24',
  },
  success: {
    cardGradientLight: ['#ffffff', '#f0fdf4', '#dcfce7'],
    cardGradientDark: ['#072419', '#022c22', '#064e3b'],
    iconGradientLight: ['rgba(16, 185, 129, 0.22)', 'rgba(16, 185, 129, 0.08)'],
    iconGradientDark: ['rgba(52, 211, 153, 0.35)', 'rgba(16, 185, 129, 0.15)'],
    borderColorLight: 'rgba(16, 185, 129, 0.25)',
    borderColorDark: 'rgba(52, 211, 153, 0.35)',
    iconColorLight: '#059669',
    iconColorDark: '#34d399',
    valueColorLight: '#059669',
    valueColorDark: '#34d399',
  },
  error: {
    cardGradientLight: ['#ffffff', '#fff1f2', '#ffe4e6'],
    cardGradientDark: ['#290812', '#4c0519', '#881337'],
    iconGradientLight: ['rgba(244, 63, 94, 0.22)', 'rgba(244, 63, 94, 0.08)'],
    iconGradientDark: ['rgba(251, 113, 133, 0.35)', 'rgba(244, 63, 94, 0.15)'],
    borderColorLight: 'rgba(244, 63, 94, 0.25)',
    borderColorDark: 'rgba(251, 113, 133, 0.35)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    valueColorLight: '#e11d48',
    valueColorDark: '#fb7185',
  },
  purple: {
    cardGradientLight: ['#ffffff', '#faf5ff', '#ede9fe'],
    cardGradientDark: ['#1d0d3b', '#2e1065', '#3b0764'],
    iconGradientLight: ['rgba(139, 92, 246, 0.22)', 'rgba(139, 92, 246, 0.08)'],
    iconGradientDark: ['rgba(192, 132, 252, 0.35)', 'rgba(139, 92, 246, 0.15)'],
    borderColorLight: 'rgba(139, 92, 246, 0.25)',
    borderColorDark: 'rgba(192, 132, 252, 0.35)',
    iconColorLight: '#7c3aed',
    iconColorDark: '#c084fc',
    valueColorLight: '#7c3aed',
    valueColorDark: '#c084fc',
  },
  indigo: {
    cardGradientLight: ['#ffffff', '#eef2ff', '#e0e7ff'],
    cardGradientDark: ['#131238', '#1e1b4b', '#312e81'],
    iconGradientLight: ['rgba(79, 70, 229, 0.22)', 'rgba(79, 70, 229, 0.08)'],
    iconGradientDark: ['rgba(129, 140, 248, 0.35)', 'rgba(79, 70, 229, 0.15)'],
    borderColorLight: 'rgba(79, 70, 229, 0.25)',
    borderColorDark: 'rgba(129, 140, 248, 0.35)',
    iconColorLight: '#4338ca',
    iconColorDark: '#a5b4fc',
    valueColorLight: '#4338ca',
    valueColorDark: '#a5b4fc',
  },
};

const resolveRoute = (href?: string): string | null => {
  if (!href) return null;
  if (href.startsWith('/operations')) return '/(app)/operations';
  if (href.startsWith('/machines')) return '/(app)/machines';
  if (href.startsWith('/users')) return '/(app)/users';
  if (href.startsWith('/clients')) return '/(app)/clients';
  if (href.startsWith('/attendance')) return '/(app)/attendance';
  if (href.startsWith('/payroll')) return '/(app)/payroll';
  if (href.startsWith('/audit')) return '/(app)/more';
  return href.startsWith('/(app)') ? href : `/(app)${href}`;
};

export const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon: Icon,
  variant = 'default',
  href,
  onPress,
  active = false,
  style,
  containerStyle,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const config = variantStyles[variant] || variantStyles.default;
  const targetRoute = resolveRoute(href);
  const isInteractive = Boolean(onPress || targetRoute);

  const handlePress = async () => {
    if (isInteractive) {
      try {
        await Haptics.selectionAsync();
      } catch {
        // ignore
      }
      if (onPress) {
        onPress();
      } else if (targetRoute) {
        router.push(targetRoute as any);
      }
    }
  };

  const cardContent = (
    <LinearGradient
      colors={isDark ? config.cardGradientDark : config.cardGradientLight}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        {
          borderColor: active
            ? (isDark ? '#f8fafc' : theme.colors.ink)
            : (isDark ? config.borderColorDark : config.borderColorLight),
          borderWidth: active ? 1.5 : 1,
        },
        style,
      ]}
    >
      {/* Header Row: Label & Creative Icon Capsule */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.label,
            { color: isDark ? theme.colors.mute : '#64748b' },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>

        {Icon ? (
          <LinearGradient
            colors={isDark ? config.iconGradientDark : config.iconGradientLight}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.iconCircle,
              {
                borderColor: isDark ? config.borderColorDark : config.borderColorLight,
              },
            ]}
          >
            <Icon
              size={16}
              color={isDark ? config.iconColorDark : config.iconColorLight}
            />
          </LinearGradient>
        ) : null}
      </View>

      {/* Metric Value */}
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {
              color: isDark ? config.valueColorDark : config.valueColorLight,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </LinearGradient>
  );

  if (isInteractive) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={[styles.touchWrapper, containerStyle]}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.touchWrapper, containerStyle]}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  touchWrapper: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    height: '100%',
  },
  card: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 96,
    height: '100%',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      } as any,
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1,
    lineHeight: 16,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueRow: {
    marginTop: spacingNumeric.xs,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
