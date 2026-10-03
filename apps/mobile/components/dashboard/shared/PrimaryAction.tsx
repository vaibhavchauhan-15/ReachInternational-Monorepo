import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { useTheme } from '../../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { ArrowRight } from 'lucide-react-native';

export interface PrimaryActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  variant?: 'primary' | 'secondary' | 'warning';
  badgeText?: string;
  style?: any;
}

const resolveRoute = (href?: string): string => {
  if (!href) return '/(app)/dashboard';
  if (href.startsWith('/operations')) return '/(app)/operations';
  if (href.startsWith('/machines')) return '/(app)/machines';
  if (href.startsWith('/users')) return '/(app)/users';
  if (href.startsWith('/clients')) return '/(app)/clients';
  if (href.startsWith('/attendance')) return '/(app)/attendance';
  if (href.startsWith('/payroll')) return '/(app)/payroll';
  if (href.startsWith('/audit')) return '/(app)/more';
  return href.startsWith('/(app)') ? href : `/(app)${href}`;
};

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  title,
  description,
  href,
  icon: Icon,
  variant = 'primary',
  badgeText,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const handlePress = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
    router.push(resolveRoute(href) as any);
  };

  const isPrimary = variant === 'primary';
  const isWarning = variant === 'warning';

  const cardGradient: readonly [string, string, ...string[]] = isWarning
    ? (isDark ? ['#451a03', '#78350f', '#92400e'] : ['#ffffff', '#fffbeb', '#fef3c7'])
    : (isDark ? ['#1e293b', '#172033', '#0f172a'] : ['#ffffff', '#f8fafc', '#f1f5f9']);

  const cardBorder = isPrimary
    ? (isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(59, 130, 246, 0.35)')
    : isWarning
    ? (isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.3)')
    : (isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.9)');

  const iconGradient: readonly [string, string, ...string[]] = isPrimary
    ? (isDark
        ? ['rgba(59, 130, 246, 0.25)', 'rgba(59, 130, 246, 0.10)']
        : ['rgba(0, 112, 243, 0.16)', 'rgba(0, 112, 243, 0.06)'])
    : isWarning
    ? ['rgba(245, 158, 11, 0.22)', 'rgba(245, 158, 11, 0.08)']
    : (isDark
        ? ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0.08)']
        : ['rgba(100, 116, 139, 0.14)', 'rgba(100, 116, 139, 0.04)']);

  const iconColor = isPrimary
    ? (isDark ? '#60a5fa' : '#0070f3')
    : isWarning
    ? (isDark ? '#fbbf24' : '#d97706')
    : (isDark ? '#cbd5e1' : '#334155');

  const titleColor = isWarning
    ? (isDark ? '#fef3c7' : '#92400e')
    : (isDark ? '#f8fafc' : '#0f172a');

  const descColor = isWarning
    ? (isDark ? '#fde68a' : '#b45309')
    : (isDark ? '#94a3b8' : '#64748b');

  const arrowColor = isPrimary
    ? (isDark ? '#60a5fa' : '#0070f3')
    : isWarning
    ? (isDark ? '#fbbf24' : '#d97706')
    : (isDark ? '#94a3b8' : '#64748b');

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${description}`}
    >
      <LinearGradient
        colors={cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.actionCard,
          {
            borderColor: cardBorder,
          },
          style,
        ]}
      >
        <View style={styles.leftRow}>
          <LinearGradient
            colors={iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.iconContainer, { borderColor: cardBorder }]}
          >
            <Icon size={18} color={iconColor} />
          </LinearGradient>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
                {title}
              </Text>
              {badgeText ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isPrimary
                        ? isDark
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(0, 112, 243, 0.12)'
                        : isWarning
                        ? 'rgba(245, 158, 11, 0.2)'
                        : theme.colors.hairline,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: isPrimary
                          ? isDark
                            ? '#60a5fa'
                            : '#0070f3'
                          : isWarning
                          ? '#d97706'
                          : theme.colors.ink,
                      },
                    ]}
                  >
                    {badgeText}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.description, { color: descColor }]} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>

        <View style={styles.arrowWrap}>
          <ArrowRight size={17} color={arrowColor} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md - 2,
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs + 2,
    gap: spacingNumeric.sm,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
      web: {
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      } as any,
    }),
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: spacingNumeric.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  arrowWrap: {
    paddingLeft: 4,
    flexShrink: 0,
  },
});
