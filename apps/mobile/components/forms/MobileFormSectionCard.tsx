import { Text } from '../ui/Text';
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Check, Lock } from '../ui/icon';
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
          backgroundColor: isDark ? '#141414' : '#ffffff',
          borderColor: isCompleted && !isReadOnly
            ? '#10b981'
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
                      ? '#262626'
                      : '#e4e4e7'
                    : isDark
                    ? '#0ea5e9'
                    : '#0284c7',
                  borderColor: isCompleted && !isReadOnly
                    ? '#10b981'
                    : isReadOnly
                    ? (isDark ? '#3f3f46' : '#d4d4d8')
                    : isDark
                    ? '#38bdf8'
                    : '#0284c7',
                },
              ]}
            >
              <Text
                variant="caption"
                weight="bold"
                style={[
                  styles.stepNumberText,
                  {
                    color: isCompleted && !isReadOnly
                      ? '#ffffff'
                      : isReadOnly
                      ? (isDark ? '#a1a1aa' : '#71717a')
                      : '#ffffff',
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

          <Text
            variant="subheading"
            weight="semibold"
            style={[styles.title, { color: theme.colors.ink }]}
            numberOfLines={1}
          >
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
                  backgroundColor: isDark ? '#262626' : '#f4f4f5',
                  borderColor: isDark ? '#3f3f46' : '#e4e4e7',
                },
              ]}
            >
              <Lock size={10} color={isDark ? '#a1a1aa' : '#71717a'} />
              <Text variant="caption" style={[styles.readOnlyBadgeText, { color: isDark ? '#a1a1aa' : '#71717a' }]}>
                View Only
              </Text>
            </View>
          ) : isCompleted && !headerAction && !hideCompletedBadge ? (
            <View
              style={[
                styles.completedBadge,
                {
                  backgroundColor: '#10b981',
                  borderColor: '#10b981',
                },
              ]}
            >
              <Check size={12} color="#ffffff" strokeWidth={2.5} />
            </View>
          ) : !isMandatory && !isCompleted ? (
            <View
              style={[
                styles.optionalBadge,
                {
                  backgroundColor: isDark ? '#262626' : '#f4f4f5',
                  borderColor: isDark ? '#3f3f46' : '#e4e4e7',
                },
              ]}
            >
              <Text variant="caption" style={[styles.optionalBadgeText, { color: isDark ? '#a1a1aa' : '#71717a' }]}>
                Optional
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Optional Description */}
      {description ? (
        <Text variant="caption" style={[styles.description, { color: theme.colors.mute }]}>
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
  },
  title: {
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionalBadgeText: {
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
  },
  description: {
    marginBottom: spacingNumeric.sm,
  },
  content: {
    gap: spacingNumeric.sm,
  },
});
