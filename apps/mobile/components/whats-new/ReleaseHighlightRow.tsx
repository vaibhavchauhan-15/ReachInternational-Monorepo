/**
 * ReachInternational Mobile — ReleaseHighlightRow Component
 * Reusable row displaying an individual feature or improvement highlight
 * with semantic icon container, category pill, title, and description.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { ReleaseHighlight, HighlightCategory } from '../../lib/whats-new/types';
import {
  Zap,
  Gauge,
  Users,
  Calendar,
  Sparkles,
  Truck,
  ShieldCheck,
  Lock,
  Cpu,
  Clock,
  CheckCircle2,
} from '../ui/icon';

export interface ReleaseHighlightRowProps {
  highlight: ReleaseHighlight;
  isLast?: boolean;
  style?: StyleProp<ViewStyle>;
}

function renderHighlightIcon(name: string, color: string) {
  const iconProps = { size: 20, color };
  switch (name) {
    case 'zap':
      return <Zap {...iconProps} />;
    case 'gauge':
      return <Gauge {...iconProps} />;
    case 'users':
      return <Users {...iconProps} />;
    case 'calendar':
      return <Calendar {...iconProps} />;
    case 'truck':
      return <Truck {...iconProps} />;
    case 'shield-check':
      return <ShieldCheck {...iconProps} />;
    case 'lock':
      return <Lock {...iconProps} />;
    case 'cpu':
      return <Cpu {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    case 'sparkles':
    default:
      return <Sparkles {...iconProps} />;
  }
}

function getCategoryConfig(category: HighlightCategory, isDark: boolean) {
  switch (category) {
    case 'performance':
      return {
        label: 'Performance',
        color: '#f59e0b',
        bg: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.10)',
      };
    case 'feature':
      return {
        label: 'New Feature',
        color: '#0284c7',
        bg: isDark ? 'rgba(2, 132, 199, 0.18)' : 'rgba(2, 132, 199, 0.10)',
      };
    case 'improvement':
      return {
        label: 'Enhancement',
        color: '#10b981',
        bg: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)',
      };
    case 'security':
      return {
        label: 'Security',
        color: '#8b5cf6',
        bg: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.10)',
      };
    case 'fix':
    default:
      return {
        label: 'Fix',
        color: '#64748b',
        bg: isDark ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.10)',
      };
  }
}

export function ReleaseHighlightRow({ highlight, isLast = false, style }: ReleaseHighlightRowProps) {
  const { theme, isDark } = useTheme();
  const categoryConfig = getCategoryConfig(highlight.category, isDark);

  return (
    <View
      style={[
        styles.container,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.hairline,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`${categoryConfig.label}: ${highlight.title}. ${highlight.description}`}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: categoryConfig.bg,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : theme.colors.hairline,
            },
          ]}
        >
          {renderHighlightIcon(highlight.iconName, categoryConfig.color)}
        </View>

        <View style={styles.contentCol}>
          <View style={styles.headerLine}>
            <Text variant="subheading" style={[styles.title, { color: theme.colors.ink }]}>
              {highlight.title}
            </Text>
            <View
              style={[
                styles.categoryPill,
                {
                  backgroundColor: categoryConfig.bg,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                },
              ]}
            >
              <Text variant="caption" style={{ color: categoryConfig.color }}>
                {categoryConfig.label}
              </Text>
            </View>
          </View>

          <Text variant="caption" style={[styles.description, { color: theme.colors.body }]}>
            {highlight.description}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacingNumeric.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingNumeric.md,
  },
  contentCol: {
    flex: 1,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
    marginBottom: 4,
  },
  title: {
    flex: 1,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  description: {
    marginTop: 2,
  },
});
