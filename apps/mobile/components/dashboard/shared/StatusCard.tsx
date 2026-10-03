import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { useTheme } from '../../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react-native';

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
    accentGradient: ['#10b981', '#34d399', '#059669'] as const,
    cardGradientLight: ['#ffffff', '#f0fdf4', '#dcfce7'] as const,
    cardGradientDark: ['#022c22', '#064e3b', '#047857'] as const,
    borderLight: 'rgba(16, 185, 129, 0.28)',
    borderDark: 'rgba(52, 211, 153, 0.35)',
    textLight: '#059669',
    textDark: '#34d399',
    iconGradientLight: ['rgba(16, 185, 129, 0.22)', 'rgba(16, 185, 129, 0.08)'] as const,
    iconGradientDark: ['rgba(52, 211, 153, 0.35)', 'rgba(16, 185, 129, 0.15)'] as const,
    iconColorLight: '#059669',
    iconColorDark: '#34d399',
    orbColorLight: 'rgba(16, 185, 129, 0.10)',
    orbColorDark: 'rgba(52, 211, 153, 0.18)',
    icon: CheckCircle2,
  },
  pending: {
    accentGradient: ['#f59e0b', '#fbbf24', '#d97706'] as const,
    cardGradientLight: ['#ffffff', '#fffbeb', '#fef3c7'] as const,
    cardGradientDark: ['#451a03', '#78350f', '#92400e'] as const,
    borderLight: 'rgba(245, 158, 11, 0.28)',
    borderDark: 'rgba(251, 191, 36, 0.35)',
    textLight: '#d97706',
    textDark: '#fbbf24',
    iconGradientLight: ['rgba(245, 158, 11, 0.22)', 'rgba(245, 158, 11, 0.08)'] as const,
    iconGradientDark: ['rgba(251, 191, 36, 0.35)', 'rgba(245, 158, 11, 0.15)'] as const,
    iconColorLight: '#d97706',
    iconColorDark: '#fbbf24',
    orbColorLight: 'rgba(245, 158, 11, 0.10)',
    orbColorDark: 'rgba(251, 191, 36, 0.18)',
    icon: Clock,
  },
  warning: {
    accentGradient: ['#f43f5e', '#fb7185', '#e11d48'] as const,
    cardGradientLight: ['#ffffff', '#fff1f2', '#ffe4e6'] as const,
    cardGradientDark: ['#4c0519', '#881337', '#9f1239'] as const,
    borderLight: 'rgba(244, 63, 94, 0.28)',
    borderDark: 'rgba(251, 113, 133, 0.35)',
    textLight: '#e11d48',
    textDark: '#fb7185',
    iconGradientLight: ['rgba(244, 63, 94, 0.22)', 'rgba(244, 63, 94, 0.08)'] as const,
    iconGradientDark: ['rgba(251, 113, 133, 0.35)', 'rgba(244, 63, 94, 0.15)'] as const,
    iconColorLight: '#e11d48',
    iconColorDark: '#fb7185',
    orbColorLight: 'rgba(244, 63, 94, 0.10)',
    orbColorDark: 'rgba(251, 113, 133, 0.18)',
    icon: AlertTriangle,
  },
};

const resolveRoute = (href?: string): string | null => {
  if (!href) return null;
  if (href.startsWith('/operations')) return '/(app)/operations';
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

  const handlePress = async () => {
    if (targetRoute) {
      try {
        await Haptics.selectionAsync();
      } catch {
        // ignore
      }
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
      <Text style={[styles.titleEyebrow, { color: isDark ? '#94a3b8' : '#64748b' }]}>
        {title}
      </Text>

      <View style={styles.contentRow}>
        <LinearGradient
          colors={isDark ? config.iconGradientDark : config.iconGradientLight}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.iconContainer,
            {
              borderColor: isDark ? config.borderDark : config.borderLight,
            },
          ]}
        >
          <Icon
            size={16}
            color={isDark ? config.iconColorDark : config.iconColorLight}
          />
        </LinearGradient>
        <Text
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
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${label}`}
        style={styles.touchWrapper}
      >
        {content}
      </TouchableOpacity>
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
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
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
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 18,
    flex: 1,
  },
  description: {
    fontSize: 11.5,
    lineHeight: 15,
    zIndex: 1,
  },
});
