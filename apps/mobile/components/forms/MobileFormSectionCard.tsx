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
            : theme.colors.hairline,
          borderWidth: isCompleted && !isReadOnly ? 1.5 : 1,
        },
        style,
      ]}
    >
      {/* Header Bar */}
      <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
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
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.06)',
                  borderColor: isCompleted && !isReadOnly
                    ? '#10b981'
                    : theme.colors.hairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: isCompleted && !isReadOnly ? '#ffffff' : theme.colors.ink },
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
          ) : isCompleted ? (
            <View style={styles.completedBadge}>
              <Check size={12} color="#10b981" strokeWidth={2.5} />
            </View>
          ) : !isMandatory ? (
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
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
  },
  mandatoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f43f5e',
  },
  optionalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionalBadgeText: {
    fontSize: 10,
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
    fontSize: 10,
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
