import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Check, Lock } from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MobileFormSectionCardProps {
  stepNumber?: number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isMandatory?: boolean;
  isCompleted?: boolean;
  isReadOnly?: boolean;
  headerAction?: React.ReactNode;
  hideCompletedBadge?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const MobileFormSectionCard: React.FC<MobileFormSectionCardProps> = ({
  stepNumber,
  title,
  description,
  icon,
  isMandatory = false,
  isCompleted = false,
  isReadOnly = false,
  headerAction,
  hideCompletedBadge = false,
  children,
  style,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
          borderColor: isCompleted && !isReadOnly
            ? isDark
              ? 'rgba(52, 211, 153, 0.8)'
              : '#10b981'
            : isDark
            ? '#262626'
            : '#ebebeb',
          borderWidth: isCompleted && !isReadOnly ? 1.5 : 1,
        },
        style,
      ]}
    >
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#262626' : '#f0f0f0' }]}>
        <View style={styles.titleRow}>
          {stepNumber !== undefined && (
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor: isCompleted && !isReadOnly
                    ? '#10b981'
                    : isReadOnly
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)'
                    : isDark
                    ? 'rgba(14, 165, 233, 0.15)'
                    : 'rgba(14, 165, 233, 0.1)',
                  borderColor: isCompleted && !isReadOnly
                    ? '#10b981'
                    : isReadOnly
                    ? theme.colors.hairline
                    : isDark
                    ? 'rgba(14, 165, 233, 0.3)'
                    : 'rgba(14, 165, 233, 0.25)',
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  {
                    color: isCompleted && !isReadOnly
                      ? '#ffffff'
                      : isReadOnly
                      ? theme.colors.mute
                      : isDark
                      ? '#38bdf8'
                      : '#0284c7',
                  },
                ]}
              >
                {stepNumber}
              </Text>
            </View>
          )}

          {icon ? (
            <View style={{ marginRight: 2, alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </View>
          ) : null}

          <Text style={[styles.title, { color: theme.colors.ink }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          {headerAction}

          {isReadOnly ? (
            <View
              style={[
                styles.readOnlyBadge,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f3f4f6',
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Lock size={10} color={theme.colors.mute} />
              <Text style={[styles.readOnlyBadgeText, { color: theme.colors.mute }]}>Read-only</Text>
            </View>
          ) : isCompleted && !headerAction && !hideCompletedBadge ? (
            <View style={styles.completedBadge}>
              <Check size={12} color="#10b981" strokeWidth={2.5} />
            </View>
          ) : !isMandatory && !isCompleted ? (
            <View
              style={[
                styles.optionalBadge,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f3f4f6',
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text style={[styles.optionalBadgeText, { color: theme.colors.mute }]}>Optional</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Optional Description */}
      {description ? (
        <Text style={[styles.description, { color: theme.colors.mute }]}>
          {description}
        </Text>
      ) : null}

      {/* Section Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacingNumeric.xs,
    borderBottomWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flex: 1,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  optionalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  readOnlyBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacingNumeric.sm,
  },
  content: {
    gap: spacingNumeric.sm,
  },
});
