/**
 * ReachInternational Mobile — Dashboard Primary Action Card Component
 * Migrated to React Native Reusables Card and Geist tokens for 100% web mobile parity.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Badge } from '../../ui/Badge';
import { useTheme } from '../../ui/ThemeProvider';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { ArrowRight } from '../../ui/icon';

export interface PrimaryActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  variant?: 'primary' | 'secondary' | 'warning';
  badgeText?: string;
  style?: StyleProp<ViewStyle>;
}

const resolveRoute = (href?: string): string => {
  if (!href) return '/dashboard';
  const cleanRoute = href.replace(/^\/\(app\)/, '');
  if (cleanRoute.startsWith('/audit')) return '/dashboard';
  return cleanRoute;
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
  const { isDark } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    router.push(resolveRoute(href) as any);
  };

  const isPrimary = variant === 'primary';
  const isWarning = variant === 'warning';

  const iconBg = isPrimary
    ? (isDark ? 'rgba(56, 189, 248, 0.20)' : 'rgba(14, 165, 233, 0.14)')
    : isWarning
    ? (isDark ? 'rgba(251, 191, 36, 0.20)' : 'rgba(245, 158, 11, 0.14)')
    : (isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.12)');

  const iconColor = isPrimary
    ? (isDark ? '#38bdf8' : '#0284c7')
    : isWarning
    ? (isDark ? '#fbbf24' : '#d97706')
    : (isDark ? '#94a3b8' : '#64748b');

  return (
    <Card
      onPress={handlePress}
      className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card flex-row items-center justify-between"
      style={style}
    >
      <View style={styles.leftRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Icon size={18} color={iconColor} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              variant="subheading"
              style={[
                styles.title,
                { color: isDark ? '#f8fafc' : '#171717' },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {badgeText ? (
              <Badge
                variant={isWarning ? 'warning' : 'default'}
                label={badgeText}
                className="ml-2 py-0 px-2"
              />
            ) : null}
          </View>
          <Text
            variant="caption"
            style={[
              styles.description,
              { color: isDark ? '#94a3b8' : '#64748b' },
            ]}
            numberOfLines={1}
          >
            {description}
          </Text>
        </View>
      </View>

      <View style={styles.arrowContainer}>
        <ArrowRight size={16} color={isDark ? '#94a3b8' : '#64748b'} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacingNumeric.sm + 2,
    minWidth: 0,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  },
  title: {},
  description: {
    marginTop: 2,
  },
  arrowContainer: {
    paddingLeft: spacingNumeric.xs,
    flexShrink: 0,
  },
});
