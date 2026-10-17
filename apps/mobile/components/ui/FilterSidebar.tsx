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
  Platform,
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

export interface FilterCategoryItemConfig {
  /** Unique category identifier */
  id: string;
  /** Section title (e.g. "Rental Status", "Health Status", "Client Allocation") */
  title: string;
  /** Explanatory subtitle below the title */
  subtitle?: string;
  /** Whether this filter currently deviates from default */
  isFiltered?: boolean;
  /** Badge label when filtered (defaults to "Filtered") */
  badgeLabel?: string;
  /** Badge color variant */
  badgeVariant?: 'info' | 'success' | 'warning' | 'error' | 'outline' | 'neutral';
  /** Optional index number (1, 2, 3...) */
  index?: number;
  /** Whether to display index prefix (defaults to false for clean minimal UX) */
  showIndex?: boolean;
  /** Render function for category filter control */
  renderControl?: () => React.ReactNode;
  /** Children node alternative */
  children?: React.ReactNode;
  /** Test identifier */
  testID?: string;
}

export interface FilterCategoryCardProps {
  /** Optional index number (1, 2, 3...) */
  index?: number;
  /** Section title (e.g. "Rental Status", "Health Status", "Client Allocation") */
  title: string;
  /** Explanatory subtitle below the title */
  subtitle?: string;
  /** Alias for subtitle */
  description?: string;
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
  /** Whether to display index prefix (defaults to false for clean minimal UX) */
  showIndex?: boolean;
}

export const FilterCategoryCard: React.FC<FilterCategoryCardProps> = React.memo(({
  index,
  title,
  subtitle,
  description,
  isFiltered = false,
  badgeLabel = 'Filtered',
  badgeVariant = 'info',
  children,
  style,
  testID,
  showIndex = false,
}) => {
  const { theme } = useTheme();
  const effectiveSubtitle = subtitle || description;

  return (
    <View
      style={[
        styles.categorySection,
        style,
      ]}
      testID={testID}
    >
      {/* Category Header: Clean, minimal title without numbering or decorative icons */}
      <View style={styles.categoryTitleRow}>
        <Text variant="label" style={[styles.categoryTitleText, { color: theme.colors.ink }]}>
          {showIndex && index !== undefined ? `${index}.  ` : ''}{title}
        </Text>
        {isFiltered && (
          <Badge
            variant={badgeVariant}
            size="sm"
            label={badgeLabel}
            style={styles.categoryBadge}
          />
        )}
      </View>

      {/* Explanatory Subtitle (only rendered if provided) */}
      {effectiveSubtitle ? (
        <Text variant="caption" style={[styles.categorySubtitle, { color: theme.colors.mute }]}>
          {effectiveSubtitle}
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
  visible?: boolean;
  /** Alias for visible */
  isOpen?: boolean;
  /** Callback when drawer requests close */
  onClose: () => void;
  /** Header title (defaults to "Filters & Sorting") */
  title?: string;
  /** Header subtitle (optional, omitted by default for clean minimalism) */
  subtitle?: string;
  /** Count of currently active filters */
  activeFilterCount?: number;
  /** Alias for activeFilterCount */
  badgeCount?: number;
  /** Callback when "Reset All" button is pressed */
  onResetAll?: () => void;
  /** Alias for onResetAll */
  onReset?: () => void;
  /** Custom label for apply button (e.g. "Show 1 Machine" or "Show 24 Users") */
  applyText?: string;
  /** Alias for applyText */
  applyLabel?: string;
  /** Callback when apply button is pressed (defaults to closing drawer with haptic) */
  onApply?: () => void;
  /** Maximum pixel width on wide viewports (defaults to 380) */
  maxPixelWidth?: number;
  /** Viewport width ratio (defaults to 0.88) */
  widthRatio?: number;
  /** Test identifier */
  testID?: string;
  /** Declarative filter categories config (alternative to direct children) */
  categories?: FilterCategoryItemConfig[];
  /** Custom footer actions slot (replaces default Reset All + Apply bar) */
  footerActions?: React.ReactNode;
  /** Filter categories and content (when not using declarative categories) */
  children?: React.ReactNode;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = React.memo(({
  visible,
  isOpen,
  onClose,
  title = 'Filters & Sorting',
  subtitle,
  activeFilterCount: activeFilterCountProp,
  badgeCount,
  onResetAll: onResetAllProp,
  onReset,
  applyText: applyTextProp,
  applyLabel,
  onApply,
  maxPixelWidth = 380,
  widthRatio = 0.88,
  testID = 'reusable-filter-sidebar',
  categories,
  footerActions,
  children,
}) => {
  const isVisible = visible !== undefined ? visible : Boolean(isOpen);
  const activeFilterCount = activeFilterCountProp !== undefined ? activeFilterCountProp : (badgeCount ?? 0);
  const onResetAll = onResetAllProp || onReset;
  const applyText = applyTextProp || applyLabel;
  const { theme, isDark } = useTheme();
  const isApplyingRef = React.useRef(false);

  const handleApply = React.useCallback(() => {
    if (isApplyingRef.current) return;
    isApplyingRef.current = true;
    haptics.confirm();
    if (onApply) {
      onApply();
    } else {
      onClose();
    }
    setTimeout(() => {
      isApplyingRef.current = false;
    }, 400);
  }, [onApply, onClose]);

  const handleReset = React.useCallback(() => {
    if (activeFilterCount === 0) return;
    haptics.select();
    onResetAll?.();
  }, [activeFilterCount, onResetAll]);

  return (
    <Drawer
      visible={isVisible}
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
                <Badge
                  variant="info"
                  size="sm"
                  label={`${activeFilterCount} active`}
                  style={styles.activeBadge}
                />
              )}
            </View>
            {subtitle ? (
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
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
          removeClippedSubviews={Platform.OS === 'android'}
        >
          {categories && categories.length > 0
            ? categories.map((cat, idx) => (
                <FilterCategoryCard
                  key={cat.id || String(idx)}
                  index={cat.index !== undefined ? cat.index : idx + 1}
                  showIndex={cat.showIndex}
                  title={cat.title}
                  subtitle={cat.subtitle}
                  isFiltered={cat.isFiltered}
                  badgeLabel={cat.badgeLabel}
                  badgeVariant={cat.badgeVariant}
                  testID={cat.testID}
                >
                  {cat.renderControl ? cat.renderControl() : cat.children}
                </FilterCategoryCard>
              ))
            : children}
        </ScrollView>

        {/* Sticky Footer with Reset All and Apply Actions */}
        {footerActions ? (
          footerActions
        ) : (
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
                activeOpacity={1.0}
                onPress={handleReset}
                style={[
                  styles.resetBtn,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvasElevated,
                    opacity: activeFilterCount === 0 ? 0.45 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Reset all filters"
              >
                <RotateCcw
                  size={14}
                  color={activeFilterCount === 0 ? theme.colors.mute : theme.colors.ink}
                  style={{ marginRight: 6 }}
                />
                <Text
                  variant="label"
                  style={{
                    color: activeFilterCount === 0 ? theme.colors.mute : theme.colors.ink,
                  }}
                >
                  Reset All
                </Text>
              </Pressable>
            )}

            <Pressable
              variant="buttonPrimary"
              hitSlopToMin48
              activeOpacity={1.0}
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
        )}
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
    paddingBottom: 28,
    gap: 16,
  },
  categorySection: {
    gap: 6,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTitleText: {},
  categoryBadge: {
    marginLeft: 'auto',
  },
  categorySubtitle: {
    marginBottom: 2,
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
