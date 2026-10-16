/**
 * ReachInternational Mobile — Canonical Reusable FilterSidebar & FilterCategoryCard
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Category-wise grouping without icons in header or category titles
 * - Reusable across all screens (Machines, Users, Clients, Operations, etc.)
 * - Built on canonical Drawer with spring physics and scrim backdrop
 * - Tactile haptic feedback on filter changes, resets, and dismissals
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Badge } from './Badge';
import { Pressable } from './touch/Pressable';
import { Drawer } from './overlay/Drawer';
import { X, RotateCcw, Check } from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

// ============================================================================
// CANONICAL FILTER CATEGORY CARD
// ============================================================================

export interface FilterCategoryCardProps {
  /** Optional index number (1, 2, 3...) */
  index?: number;
  /** Section title (e.g. "RENTAL STATUS", "HEALTH STATUS", "CLIENT ALLOCATION") */
  title: string;
  /** Explanatory subtitle below the title */
  subtitle?: string;
  /** Whether this filter currently deviates from default */
  isFiltered?: boolean;
  /** Badge label when filtered (defaults to "Filtered") */
  badgeLabel?: string;
  /** Badge color variant */
  badgeVariant?: 'info' | 'success' | 'warning' | 'error' | 'outline' | 'neutral';
  /** Category filter controls (e.g. DropdownFilterSelector) */
  children: React.ReactNode;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for automated tests */
  testID?: string;
}

export const FilterCategoryCard: React.FC<FilterCategoryCardProps> = React.memo(({
  index,
  title,
  subtitle,
  isFiltered = false,
  badgeLabel = 'Filtered',
  badgeVariant = 'info',
  children,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.categoryCard,
        {
          backgroundColor: theme.colors.canvas,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Category Header: Clean numbered title without icon */}
      <View style={styles.categoryTitleRow}>
        <Text variant="mono" style={[styles.categoryTitleText, { color: theme.colors.mute }]}>
          {index !== undefined ? `${index}.  ` : ''}{title}
        </Text>
        {isFiltered && (
          <Badge variant={badgeVariant} size="sm" style={styles.categoryBadge}>
            {badgeLabel}
          </Badge>
        )}
      </View>

      {/* Explanatory Subtitle */}
      {subtitle ? (
        <Text variant="caption" style={[styles.categorySubtitle, { color: theme.colors.mute }]}>
          {subtitle}
        </Text>
      ) : null}

      {/* Filter Control (DropdownFilterSelector, etc.) */}
      {children}
    </View>
  );
});

// ============================================================================
// CANONICAL REUSABLE FILTER SIDEBAR DRAWER
// ============================================================================

export interface FilterSidebarProps {
  /** Visibility state of the drawer */
  visible: boolean;
  /** Callback when drawer requests close */
  onClose: () => void;
  /** Header title (defaults to "Filters & Sorting") */
  title?: string;
  /** Header subtitle (e.g. "Category-wise fleet equipment refinement") */
  subtitle?: string;
  /** Count of currently active filters */
  activeFilterCount?: number;
  /** Callback when "Reset All" button is pressed */
  onResetAll?: () => void;
  /** Custom label for apply button (e.g. "Show 1 Machine" or "Show 24 Users") */
  applyText?: string;
  /** Callback when apply button is pressed (defaults to closing drawer with haptic) */
  onApply?: () => void;
  /** Maximum pixel width on wide viewports (defaults to 380) */
  maxPixelWidth?: number;
  /** Viewport width ratio (defaults to 0.88) */
  widthRatio?: number;
  /** Test identifier */
  testID?: string;
  /** Filter categories and content */
  children: React.ReactNode;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = React.memo(({
  visible,
  onClose,
  title = 'Filters & Sorting',
  subtitle,
  activeFilterCount = 0,
  onResetAll,
  applyText,
  onApply,
  maxPixelWidth = 380,
  widthRatio = 0.88,
  testID = 'reusable-filter-sidebar',
  children,
}) => {
  const { theme, isDark } = useTheme();

  const handleApply = () => {
    haptics.confirm();
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
  };

  const handleReset = () => {
    haptics.select();
    onResetAll?.();
  };

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      maxPixelWidth={maxPixelWidth}
      widthRatio={widthRatio}
      testID={testID}
    >
      <View style={styles.sidebarContainer}>
        {/* Header: Clean title without icon box */}
        <View style={[styles.sidebarHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerTitleCol}>
            <View style={styles.titleWithBadgeRow}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                {title}
              </Text>
              {activeFilterCount > 0 && (
                <Badge variant="info" size="sm" style={styles.activeBadge}>
                  {activeFilterCount} active
                </Badge>
              )}
            </View>
            {subtitle ? (
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            variant="iconButton"
            hitSlopToMin48
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close filter sidebar"
          >
            <X size={20} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Scrollable Categories Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          indicatorStyle={isDark ? 'white' : 'black'}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* Sticky Footer with Reset All and Apply Actions */}
        <View
          style={[
            styles.sidebarFooter,
            {
              borderTopColor: theme.colors.hairline,
              backgroundColor: theme.colors.canvasElevated,
            },
          ]}
        >
          {onResetAll && (
            <Pressable
              variant="buttonSecondary"
              hitSlopToMin48
              disabled={activeFilterCount === 0}
              onPress={handleReset}
              style={[
                styles.resetBtn,
                {
                  borderColor: theme.colors.hairline,
                  opacity: activeFilterCount === 0 ? 0.45 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reset all filters"
            >
              <RotateCcw size={14} color={theme.colors.mute} style={{ marginRight: 6 }} />
              <Text variant="label" style={{ color: theme.colors.mute }}>
                Reset All
              </Text>
            </Pressable>
          )}

          <Pressable
            variant="buttonPrimary"
            hitSlopToMin48
            onPress={handleApply}
            style={styles.applyBtn}
            accessibilityRole="button"
            accessibilityLabel={applyText || 'Apply filters and view results'}
          >
            <Check size={15} color="#ffffff" style={{ marginRight: 6 }} />
            <Text variant="label" style={{ color: '#ffffff' }}>
              {applyText || 'Apply Filters'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Drawer>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  sidebarContainer: {
    flex: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerTitleCol: {
    flex: 1,
    paddingRight: spacingNumeric.sm,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeBadge: {
    marginLeft: 6,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.md,
    paddingBottom: 40,
    gap: spacingNumeric.md,
  },
  categoryCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryTitleText: {},
  categoryBadge: {
    marginLeft: 'auto',
  },
  categorySubtitle: {
    marginBottom: 10,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.md,
    borderTopWidth: 1,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  applyBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    backgroundColor: '#0284c7',
  },
});
