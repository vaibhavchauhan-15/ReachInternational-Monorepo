/**
 * ReachInternational Mobile — Canonical Reusable FilterToolbar & SearchInput
 * Matches Web FilterToolbar (apps/web/components/ui/FilterToolbar.tsx)
 * Geist Design Tokens, 3-Tier Viewport Responsiveness, 44px Touch Targets, Web Outline Suppression
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import { Search, X, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

// ============================================================================
// 1. REUSABLE SEARCH INPUT
// ============================================================================

export interface SearchInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  onClear?: () => void;
  onSubmitEditing?: () => void;
  variant?: 'pill' | 'rounded';
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  isLoading = false,
  onClear,
  onSubmitEditing,
  variant = 'rounded',
  containerStyle,
  inputStyle,
  leftIcon,
  rightIcon,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'search',
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const handleClear = () => {
    Haptics.selectionAsync().catch(() => {});
    onChangeText('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const borderRadius = variant === 'pill' ? radiusNumeric.full : 10;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={[
        styles.searchBox,
        {
          borderRadius,
          backgroundColor: theme.colors.canvas,
          borderColor: isFocused ? theme.colors.ink : theme.colors.hairline,
        },
        isFocused && Platform.OS === 'web' && ({
          boxShadow: isDark
            ? '0 0 0 1px rgba(255, 255, 255, 0.35)'
            : '0 0 0 1px rgba(0, 0, 0, 0.22)',
        } as any),
        containerStyle,
      ]}
    >
      {/* Left Icon or Loading Spinner */}
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors.mute} style={styles.searchIcon} />
      ) : leftIcon ? (
        <View style={styles.searchIcon}>{leftIcon}</View>
      ) : (
        <Search
          size={15}
          color={isFocused ? theme.colors.ink : theme.colors.mute}
          style={styles.searchIcon}
        />
      )}

      {/* Actual TextInput with Web Outline Suppression */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mute}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[
          styles.searchInput,
          { color: theme.colors.ink },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
          inputStyle,
        ]}
        {...textInputProps}
      />

      {/* Clear Button or Custom Right Icon */}
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Clear search text"
        >
          <X size={14} color={theme.colors.mute} />
        </TouchableOpacity>
      ) : rightIcon ? (
        <View style={styles.clearBtn}>{rightIcon}</View>
      ) : null}
    </TouchableOpacity>
  );
};

// ============================================================================
// 2. CANONICAL FILTER TOOLBAR
// ============================================================================

export interface FilterToolbarProps {
  /** Search query value */
  searchQuery?: string;
  /** Function to update search query */
  onSearchChange?: (value: string) => void;
  /** Search input placeholder text */
  placeholder?: string;
  /** Number of active filters (excluding default state) */
  activeFilterCount?: number;
  /** Callback when "Reset / Clear filters" is clicked */
  onResetFilters?: () => void;
  /** Custom actions slot on the top search row (e.g. Refresh, Export, etc.) */
  actions?: React.ReactNode;
  /** Filter options/pills/dropdowns content rendered below search */
  children?: React.ReactNode;
  /** Whether search query or filter is actively loading */
  isLoading?: boolean;
  /** Search input variant */
  searchVariant?: 'pill' | 'rounded';
  /** Optional submit handler */
  onSubmitSearch?: () => void;
  /** Optional outer container style */
  style?: StyleProp<ViewStyle>;
  /** Optional search box container style */
  searchContainerStyle?: StyleProp<ViewStyle>;
  /** Optional toggle button for expandable filter panels */
  showFilterToggle?: boolean;
  /** Filter panel open state */
  isFilterOpen?: boolean;
  /** Toggle callback for expandable filter panel */
  onToggleFilter?: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  activeFilterCount = 0,
  onResetFilters,
  actions,
  children,
  isLoading = false,
  searchVariant = 'rounded',
  onSubmitSearch,
  style,
  searchContainerStyle,
  showFilterToggle = false,
  isFilterOpen = false,
  onToggleFilter,
}) => {
  const { theme, isDark } = useTheme();

  const handleToggle = () => {
    Haptics.selectionAsync().catch(() => {});
    onToggleFilter?.();
  };

  const handleReset = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onResetFilters?.();
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
    >
      {/* Top Search & Action Row */}
      <View style={styles.topRow}>
        {onSearchChange !== undefined && searchQuery !== undefined && (
          <View style={styles.searchFlexWrap}>
            <SearchInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={placeholder}
              isLoading={isLoading}
              onSubmitEditing={onSubmitSearch}
              variant={searchVariant}
              containerStyle={searchContainerStyle}
            />
          </View>
        )}

        {/* Optional Filter Panel Toggle Button */}
        {showFilterToggle && onToggleFilter && (
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.8}
            style={[
              styles.filterToggleBtn,
              {
                backgroundColor:
                  isFilterOpen || activeFilterCount > 0
                    ? theme.colors.ink
                    : theme.colors.canvas,
                borderColor:
                  isFilterOpen || activeFilterCount > 0
                    ? theme.colors.ink
                    : theme.colors.hairline,
              },
            ]}
            accessibilityLabel="Toggle filters"
          >
            <SlidersHorizontal
              size={13}
              color={
                isFilterOpen || activeFilterCount > 0
                  ? theme.colors.canvas
                  : theme.colors.ink
              }
            />
            <Text
              style={[
                styles.filterToggleText,
                {
                  color:
                    isFilterOpen || activeFilterCount > 0
                      ? theme.colors.canvas
                      : theme.colors.ink,
                },
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 && (
              <View
                style={[
                  styles.activeBadge,
                  {
                    backgroundColor:
                      isFilterOpen || activeFilterCount > 0
                        ? theme.colors.canvas
                        : theme.colors.ink,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.activeBadgeText,
                    {
                      color:
                        isFilterOpen || activeFilterCount > 0
                          ? theme.colors.ink
                          : theme.colors.canvas,
                    },
                  ]}
                >
                  {activeFilterCount}
                </Text>
              </View>
            )}
            <ChevronDown
              size={12}
              color={
                isFilterOpen || activeFilterCount > 0
                  ? theme.colors.canvas
                  : theme.colors.ink
              }
              style={{
                transform: [{ rotate: isFilterOpen ? '180deg' : '0deg' }],
              }}
            />
          </TouchableOpacity>
        )}

        {/* Custom Actions (e.g. Refresh button) */}
        {actions}

        {/* Quick Reset Button */}
        {activeFilterCount > 0 && onResetFilters && (
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.8}
            style={[
              styles.resetBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Reset filters"
          >
            <RotateCcw size={13} color={theme.colors.mute} />
            <Text style={[styles.resetBtnText, { color: theme.colors.mute }]}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Children Section (e.g. Scrollable Filter Pills, Selectors) */}
      {children && <View style={styles.childrenContainer}>{children}</View>}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchFlexWrap: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  childrenContainer: {
    width: '100%',
  },
});
