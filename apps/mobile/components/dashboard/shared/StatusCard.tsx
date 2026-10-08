import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { Touchable } from '../../ui/Touchable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { CheckCircle2, Clock, AlertTriangle } from '../../ui/icon';

export interface StatusCardProps {
  title: string;
  status: 'success' | 'pending' | 'warning';
  label: string;
  description?: string;
  href?: string;
  style?: any;
}

const statusConfig = {
  success: {
    accentGradient: ['#10b981', 'rgba(16, 185, 129, 0.6)', 'transparent'] as const,
    cardGradientLight: ['rgba(16, 185, 129, 0.10)', 'rgba(16, 185, 129, 0.04)', 'transparent'] as const,
    cardGradientDark: ['rgba(2, 44, 34, 0.35)', 'rgba(2, 44, 34, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(16, 185, 129, 0.25)',
    borderDark: 'rgba(52, 211, 153, 0.30)',
    textLight: '#059669',
    textDark: '#34d399',
    iconBgLight: 'rgba(16, 185, 129, 0.15)',
    iconBgDark: 'rgba(52, 211, 153, 0.20)',
    iconBorderLight: 'rgba(16, 185, 129, 0.25)',
    iconBorderDark: 'rgba(52, 211, 153, 0.30)',
    iconColorLight: '#059669',
    iconColorDark: '#34d399',
    icon: CheckCircle2,
  },
  pending: {
    accentGradient: ['#f59e0b', 'rgba(245, 158, 11, 0.6)', 'transparent'] as const,
    cardGradientLight: ['rgba(245, 158, 11, 0.10)', 'rgba(245, 158, 11, 0.04)', 'transparent'] as const,
    cardGradientDark: ['rgba(69, 26, 3, 0.35)', 'rgba(69, 26, 3, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(245, 158, 11, 0.25)',
    borderDark: 'rgba(251, 191, 36, 0.30)',
    textLight: '#b45309',
    textDark: '#fbbf24',
    iconBgLight: 'rgba(245, 158, 11, 0.15)',
    iconBgDark: 'rgba(251, 191, 36, 0.20)',
    iconBorderLight: 'rgba(245, 158, 11, 0.25)',
    iconBorderDark: 'rgba(251, 191, 36, 0.30)',
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    icon: Clock,
  },
  warning: {
    accentGradient: ['#f43f5e', 'rgba(244, 63, 94, 0.6)', 'transparent'] as const,
    cardGradientLight: ['rgba(244, 63, 94, 0.10)', 'rgba(244, 63, 94, 0.04)', 'transparent'] as const,
    cardGradientDark: ['rgba(76, 5, 25, 0.40)', 'rgba(76, 5, 25, 0.15)', 'transparent'] as const,
    borderLight: 'rgba(244, 63, 94, 0.25)',
    borderDark: 'rgba(251, 113, 133, 0.30)',
    textLight: '#e11d48',
    textDark: '#fb7185',
    iconBgLight: 'rgba(244, 63, 94, 0.15)',
    iconBgDark: 'rgba(251, 113, 133, 0.20)',
    iconBorderLight: 'rgba(244, 63, 94, 0.25)',
    iconBorderDark: 'rgba(251, 113, 133, 0.30)',
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    icon: AlertTriangle,
  },
};

const resolveRoute = (href?: string): string | null => {
  if (!href) return null;
  if (href.startsWith('/operations')) return href.startsWith('/(app)') ? href : `/(app)${href}`;
  if (href.startsWith('/machines')) return '/(app)/machines';
  if (href.startsWith('/users')) return '/(app)/users';
  return href.startsWith('/(app)') ? href : `/(app)${href}`;
};

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status,
  label,
  description,
  href,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const targetRoute = resolveRoute(href);

  const handlePress = () => {
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  const content = (
    <LinearGradient
      colors={isDark ? config.cardGradientDark : config.cardGradientLight}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        {
          borderColor: isDark ? config.borderDark : config.borderLight,
        },
        style,
      ]}
    >
      {/* Top Hairline Gradient Accent Bar */}
      <LinearGradient
        colors={[config.accentGradient[0], config.accentGradient[1], 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccentBar}
      />

      <Text variant="caption" style={[styles.titleEyebrow, { color: isDark ? '#94a3b8' : '#64748b' }]}>
        {title}
      </Text>

      <View style={styles.contentRow}>
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
          />
        </View>
        <Text
          variant="subheading"
          style={[
            styles.label,
            { color: isDark ? config.textDark : config.textLight },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>

      {description ? (
        <Text
          variant="caption"
          style={[styles.description, { color: isDark ? '#94a3b8' : '#64748b' }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
    </LinearGradient>
  );

  if (targetRoute) {
    return (
      <Touchable
        preset="card"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${label}`}
        style={styles.touchWrapper}
      >
        {content}
      </Touchable>
    );
  }

  return <View style={styles.touchWrapper}>{content}</View>;
};

const styles = StyleSheet.create({
  touchWrapper: {
    flex: 1,
    minWidth: '47%',
  },
  card: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 108,
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
  titleEyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacingNumeric.xs,
    zIndex: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs + 2,
    marginBottom: spacingNumeric.xs,
    zIndex: 1,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
  },
  description: {
    zIndex: 1,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 2,
  },
});
