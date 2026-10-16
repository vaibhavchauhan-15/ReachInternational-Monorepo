/**
 * ReachInternational Mobile — Canonical Pagination Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Tactile haptic feedback on page and size transitions
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import { ChevronLeft, ChevronRight } from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';

export interface PaginationProps<T extends number = number> {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: T;
  totalCount?: number;
  totalItems?: number;
  onPageSizeChange?: (pageSize: T) => void;
  pageSizeOptions?: readonly T[] | T[];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Pagination<T extends number = number>({
  page,
  totalPages,
  onPageChange,
  pageSize,
  totalCount,
  totalItems,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100] as unknown as T[],
  disabled = false,
  style,
  testID = 'mobile-pagination',
}: PaginationProps<T>) {
  const { theme } = useTheme();
  const total = totalCount ?? totalItems;

  if (totalPages <= 1 && !onPageSizeChange) {
    return null;
  }

  const handlePrev = () => {
    if (page > 1 && !disabled) {
      haptics.select();
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages && !disabled) {
      haptics.select();
      onPageChange(page + 1);
    }
  };

  const handleSizeChange = (size: T) => {
    if (pageSize !== size && !disabled && onPageSizeChange) {
      haptics.select();
      onPageSizeChange(size);
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Navigation Controls Row */}
      {totalPages > 1 && (
        <View style={styles.paginationRow}>
          <Pressable
            variant="buttonSecondary"
            hitSlopToMin48
            disabled={page <= 1 || disabled}
            onPress={handlePrev}
            style={[
              styles.navButton,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                opacity: page <= 1 || disabled ? 0.45 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <ChevronLeft size={16} color={theme.colors.ink} />
            <Text variant="small" style={{ color: theme.colors.ink }}>
              Previous
            </Text>
          </Pressable>

          <View style={styles.indicatorContainer}>
            <Text variant="small" style={[styles.indicatorText, { color: theme.colors.ink }]}>
              Page {page} of {totalPages}
            </Text>
            {typeof total === 'number' && (
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                ({total} total)
              </Text>
            )}
          </View>

          <Pressable
            variant="buttonSecondary"
            hitSlopToMin48
            disabled={page >= totalPages || disabled}
            onPress={handleNext}
            style={[
              styles.navButton,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                opacity: page >= totalPages || disabled ? 0.45 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text variant="small" style={{ color: theme.colors.ink }}>
              Next
            </Text>
            <ChevronRight size={16} color={theme.colors.ink} />
          </Pressable>
        </View>
      )}

      {/* Rows Per Page Selector Strip */}
      {onPageSizeChange && pageSize && pageSizeOptions && pageSizeOptions.length > 0 && (
        <View style={styles.pageSizeRow}>
          <Text variant="caption" style={[styles.pageSizeLabel, { color: theme.colors.mute }]}>
            Rows per page:
          </Text>
          <View style={styles.chipsRow}>
            {pageSizeOptions.map((opt) => {
              const isSelected = pageSize === opt;
              return (
                <Pressable
                  key={opt}
                  variant="chip"
                  hitSlopToMin48
                  disabled={disabled}
                  onPress={() => handleSizeChange(opt)}
                  style={[
                    styles.pageSizeChip,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.canvasElevated,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.hairline,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt} rows per page`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    variant={isSelected ? "label" : "caption"}
                    style={{
                      color: isSelected ? '#ffffff' : theme.colors.ink,
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacingNumeric.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 44,
  },
  indicatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  indicatorText: {},
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  pageSizeLabel: {
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageSizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.xs,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Pagination;
