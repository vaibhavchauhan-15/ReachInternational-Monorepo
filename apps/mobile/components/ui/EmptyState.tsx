/**
 * ReachInternational Mobile — Canonical EmptyState Primitive
 * 
 * Semantic empty state variants:
 * - 'empty': Genuinely empty records/list
 * - 'no-results': Search query yielded zero matches
 * - 'filtered': Active filter strip matches zero records
 * - 'offline': Device is disconnected and no cached records exist
 * - 'unauthorized': Role does not have access to view this section
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48)
 * - Tactile haptic feedback on actions
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import {
  ClipboardList,
  Search,
  SlidersHorizontal,
  WifiOff,
  ShieldAlert,
  RotateCcw,
} from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

// Backward-compatible export of ErrorState
export { ErrorState, type ErrorStateProps } from './ErrorState';

export type EmptyStateVariant = 'empty' | 'no-results' | 'filtered' | 'offline' | 'unauthorized';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: { label: string; onPress: () => void };
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'empty',
  title: propTitle,
  description: propDescription,
  actionLabel,
  onAction,
  action,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  style,
  icon,
  testID = 'empty-state-card',
}) => {
  const resolvedActionLabel = actionLabel || action?.label;
  const resolvedOnAction = onAction || action?.onPress;
  const { theme, isDark } = useTheme();

  // Semantic variant defaults
  const variantConfig = (() => {
    switch (variant) {
      case 'no-results':
        return {
          defaultTitle: 'No Matching Results',
          defaultDesc: 'Try adjusting your search terms or clearing keywords.',
          icon: <Search size={compact ? 20 : 26} color={theme.colors.mute} />,
          badgeBg: isDark ? '#262626' : '#f4f4f5',
        };
      case 'filtered':
        return {
          defaultTitle: 'No Records for Selected Filters',
          defaultDesc: 'Reset your active filter criteria to see all available records.',
          icon: <SlidersHorizontal size={compact ? 20 : 26} color={theme.colors.mute} />,
          badgeBg: isDark ? '#262626' : '#f4f4f5',
        };
      case 'offline':
        return {
          defaultTitle: 'Offline — No Local Data',
          defaultDesc: 'Connect to cellular or Wi-Fi to load and sync these records.',
          icon: <WifiOff size={compact ? 20 : 26} color={theme.colors.mute} />,
          badgeBg: isDark ? '#78350f' : '#fef3c7',
        };
      case 'unauthorized':
        return {
          defaultTitle: 'Access Restricted',
          defaultDesc: 'Your account role does not have authorization to view this data.',
          icon: <ShieldAlert size={compact ? 20 : 26} color={theme.colors.mute} />,
          badgeBg: isDark ? '#450a0a' : '#fee2e2',
        };
      case 'empty':
      default:
        return {
          defaultTitle: 'No Records Found',
          defaultDesc: 'There are currently no items recorded in this section.',
          icon: <ClipboardList size={compact ? 20 : 26} color={theme.colors.mute} />,
          badgeBg: isDark ? '#262626' : '#f4f4f5',
        };
    }
  })();

  const title = propTitle || variantConfig.defaultTitle;
  const description = propDescription !== undefined ? propDescription : variantConfig.defaultDesc;

  const handleAction = () => {
    if (!resolvedOnAction) return;
    try {
      haptics.select();
    } catch {
      // ignore
    }
    resolvedOnAction();
  };

  return (
    <View
      style={[
        compact ? styles.compactContainer : styles.fullContainer,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${title}: ${description}`}
      testID={testID}
    >
      {/* Icon Orb */}
      <View
        style={[
          compact ? styles.compactIconBox : styles.iconBox,
          {
            backgroundColor: variantConfig.badgeBg,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {icon || variantConfig.icon}
      </View>

      {/* Title & Description */}
      <Text
        variant={compact ? 'subheading' : 'heading'}
        style={[styles.titleText, { color: theme.colors.ink }]}
        numberOfLines={2}
      >
        {title}
      </Text>

      {description ? (
        <Text
          variant="body"
          style={[styles.descText, { color: theme.colors.mute }]}
          numberOfLines={compact ? 3 : 4}
        >
          {description}
        </Text>
      ) : null}

      {/* Action Buttons */}
      {Boolean(resolvedActionLabel || secondaryActionLabel) && (
        <View style={styles.actionRow}>
          {Boolean(resolvedActionLabel && resolvedOnAction) && (
            <Pressable
              variant="buttonPrimary"
              haptic="select"
              hitSlopToMin48
              onPress={handleAction}
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.colors.ink },
              ]}
              accessibilityRole="button"
              accessibilityLabel={resolvedActionLabel}
            >
              <Text variant="label" style={{ color: theme.colors.canvas }}>
                {resolvedActionLabel}
              </Text>
            </Pressable>
          )}

          {Boolean(secondaryActionLabel && onSecondaryAction) && (
            <Pressable
              variant="buttonGhost"
              haptic="tap"
              hitSlopToMin48
              onPress={onSecondaryAction}
              style={styles.secondaryBtn}
              accessibilityRole="button"
              accessibilityLabel={secondaryActionLabel}
            >
              <Text variant="label" style={{ color: theme.colors.ink }}>
                {secondaryActionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    width: '100%',
    paddingVertical: spacingNumeric.xl,
    paddingHorizontal: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.md,
  },
  compactContainer: {
    width: '100%',
    paddingVertical: spacingNumeric.md,
    paddingHorizontal: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.xs,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.sm,
  },
  compactIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.xs,
  },
  titleText: {
    textAlign: 'center',
    marginBottom: 4,
  },
  descText: {
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacingNumeric.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.sm,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
  },
});

export default EmptyState;
