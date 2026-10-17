/**
 * ReachInternational Mobile — Canonical DropdownFilterSelector Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on action buttons (hitSlopToMin48, minHeight: 44)
 * - Modal portal to prevent parent z-index clipping
 * - Dynamic viewport measurement and keyboard awareness
 * - Tactile haptic feedback on selection
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Modal,
  Keyboard,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import { SearchInput } from './SearchInput';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, Icon } from './icon';
import { haptics } from '../../lib/haptics';

export interface FilterOption {
  id: string;
  label: string;
  dotColor?: string;
  activeColor?: string;
  description?: string;
}

export interface DropdownFilterSelectorProps {
  label: string;
  value?: string;
  /** Alias for value */
  selectedId?: string;
  options: FilterOption[];
  onChange?: (value: string) => void;
  /** Alias for onChange */
  onSelect?: (value: string) => void;
  align?: 'left' | 'right';
  minMenuWidth?: number;
  showSearch?: boolean;
  /** Alias for showSearch */
  searchable?: boolean;
  searchPlaceholder?: string;
  placeholder?: string;
  disabled?: boolean;
  showPrefix?: boolean;
  testID?: string;
}

interface DropdownOptionRowProps {
  option: FilterOption;
  isSelected: boolean;
  isDark: boolean;
  onSelect: (id: string) => void;
}

const DropdownOptionRow = React.memo<DropdownOptionRowProps>(({
  option,
  isSelected,
  isDark,
  onSelect,
}) => {
  const handlePress = useCallback(() => {
    onSelect(option.id);
  }, [onSelect, option.id]);

  return (
    <Pressable
      variant="listRow"
      haptic="select"
      onPress={handlePress}
      style={[
        styles.optionItem,
        {
          backgroundColor: isSelected
            ? isDark
              ? 'rgba(2, 132, 199, 0.2)'
              : 'rgba(2, 132, 199, 0.12)'
            : 'transparent',
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={option.label}
    >
      <View style={styles.optionLeft}>
        {option.dotColor && (
          <View
            style={[
              styles.optionDot,
              {
                backgroundColor: option.dotColor,
              },
            ]}
          />
        )}
        <Text
          variant="caption"
          style={{
            color: isSelected ? '#0284c7' : undefined,
          }}
          numberOfLines={1}
        >
          {option.label}
        </Text>
      </View>
      {isSelected && (
        <Check size={14} color="#0284c7" strokeWidth={2.5} animate="mount" />
      )}
    </Pressable>
  );
});

export const DropdownFilterSelector: React.FC<DropdownFilterSelectorProps> = React.memo(({
  label,
  value: valueProp,
  selectedId,
  options,
  onChange: onChangeProp,
  onSelect,
  align = 'left',
  minMenuWidth = 200,
  showSearch: showSearchProp = false,
  searchable,
  searchPlaceholder,
  placeholder,
  disabled = false,
  showPrefix = false,
  testID,
}) => {
  const value = valueProp !== undefined ? valueProp : (selectedId ?? '');
  const onChange = onChangeProp || onSelect || (() => {});
  const showSearch = showSearchProp || Boolean(searchable);
  const { theme, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: minMenuWidth,
    maxHeight: 280,
  });

  const buttonRef = useRef<View>(null);

  // Keyboard awareness so popover stays visible above keyboard
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === value) || options[0];
  }, [options, value]);

  const hasSearch = Boolean(showSearch || options.length > 7);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const computeViewportPosition = (
    triggerX: number,
    triggerY: number,
    triggerW: number,
    triggerH: number
  ) => {
    const currentWindowW =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerWidth
        : Dimensions.get('window').width;

    const currentWindowH =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerHeight
        : Dimensions.get('window').height;

    const effectiveWindowH = Math.max(300, currentWindowH - keyboardHeight);
    const desiredMenuWidth = Math.max(triggerW, minMenuWidth);
    const menuWidth = Math.min(desiredMenuWidth, currentWindowW - 16);

    let left = align === 'right' ? triggerX + triggerW - menuWidth : triggerX;

    // Viewport horizontal clamp with 8px margin
    if (left < 8) left = 8;
    if (left + menuWidth > currentWindowW - 8) {
      left = Math.max(8, currentWindowW - menuWidth - 8);
    }

    const itemHeight = 38;
    const searchHeight = hasSearch ? 48 : 0;
    const desiredMenuHeight = Math.min(
      options.length * itemHeight + searchHeight + 16,
      280
    );

    // Viewport vertical available space
    const spaceBelow = effectiveWindowH - (triggerY + triggerH) - 12;
    const spaceAbove = triggerY - 12;

    const shouldOpenUpwards = spaceBelow < desiredMenuHeight && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpwards ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(300, Math.max(140, availableSpace));
    const top = shouldOpenUpwards
      ? Math.max(8, triggerY - Math.min(desiredMenuHeight, maxHeight) - 4)
      : triggerY + triggerH + 4;

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(menuWidth),
      maxHeight: Math.round(maxHeight),
    });
    setOpen(true);
  };

  const measureAndOpen = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }

    setSearchQuery('');
    haptics.select();

    if (!buttonRef.current) {
      setOpen(true);
      return;
    }

    // Web synchronous bounding rect
    if (Platform.OS === 'web' && (buttonRef.current as any).getBoundingClientRect) {
      const rect = (buttonRef.current as any).getBoundingClientRect();
      computeViewportPosition(rect.left, rect.top, rect.width, rect.height);
      return;
    }

    // Native measureInWindow
    buttonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
      computeViewportPosition(x, y, width, height);
    });
  };

  // Close on Escape key on web
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleSelectOption = useCallback((optId: string) => {
    haptics.select();
    onChange(optId);
    setOpen(false);
  }, [onChange]);

  const isFiltered = value !== 'all' && value !== 'default' && value !== 'machine_id_asc' && value !== 'newest';

  return (
    <View style={styles.container} testID={testID}>
      {/* Anchor Trigger Button */}
      <View ref={buttonRef} collapsable={false}>
        <Pressable
          variant="outline"
          haptic="select"
          hitSlopToMin48
          disabled={disabled}
          onPress={measureAndOpen}
          style={[
            styles.triggerBtn,
            {
              backgroundColor: open || isFiltered
                ? isDark
                  ? 'rgba(2, 132, 199, 0.12)'
                  : 'rgba(2, 132, 199, 0.08)'
                : theme.colors.canvas,
              borderColor: open || isFiltered ? '#0284c7' : theme.colors.hairline,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          accessibilityRole="combobox"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${label}: ${selectedOption?.label}`}
        >
          <View style={styles.triggerLeft}>
            {showPrefix && (
              <Text variant="caption" style={[{ color: theme.colors.mute }]}>
                {label}:
              </Text>
            )}
            {selectedOption?.dotColor && (
              <View style={[styles.statusDot, { backgroundColor: selectedOption.dotColor }]} />
            )}
            <Text
              variant="caption"
              style={[
                styles.triggerValue,
                {
                  color: isFiltered ? '#0284c7' : theme.colors.ink,
                },
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label || label}
            </Text>
          </View>
          <Icon
            name="chevron-down"
            size={13}
            color={open || isFiltered ? '#0284c7' : theme.colors.mute}
            state={open ? 'open' : 'closed'}
          />
        </Pressable>
      </View>

      {/* Universal Anchored Popover (Just below or above trigger) */}
      <Modal
        visible={open}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent={true}
      >
        {/* Fullscreen transparent dismiss backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close dropdown menu"
        >
          <View style={StyleSheet.absoluteFill} />
        </Pressable>

        {/* Dynamic Anchored Popover Box */}
        <View
          style={[
            styles.dropdownMenu,
            {
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Search Bar if long list */}
          {hasSearch && (
            <View
              style={[
                styles.menuSearchWrapper,
                { borderBottomColor: theme.colors.hairline },
              ]}
            >
              <SearchInput
                placeholder={`Search ${label.toLowerCase()}...`}
                placeholderTextColor={theme.colors.mute}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onClear={() => setSearchQuery('')}
                autoFocus={Platform.OS === 'web'}
              />
            </View>
          )}

          {/* Options List */}
          <ScrollView
            style={styles.menuScroll}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredOptions.length === 0 ? (
              <View style={styles.noOptions}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  No matching options
                </Text>
              </View>
            ) : (
              filteredOptions.map((opt: FilterOption) => (
                <DropdownOptionRow
                  key={opt.id}
                  option={opt}
                  isSelected={opt.id === value}
                  isDark={isDark}
                  onSelect={handleSelectOption}
                />
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 4,
  },
  triggerValue: {
    flexShrink: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dropdownMenu: {
    position: 'absolute',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 4,
    zIndex: 99999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 16,
      },
    }),
  },
  menuSearchWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  menuScroll: {
    flexGrow: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    minHeight: 38,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 6,
  },
  optionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  noOptions: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
