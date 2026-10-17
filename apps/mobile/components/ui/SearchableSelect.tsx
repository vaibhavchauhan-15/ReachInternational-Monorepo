/**
 * ReachInternational Mobile — Canonical Reusable SearchableSelect
 * Reusable dropdown/bottom-sheet picker matching web SearchableSelect.
 * Supports:
 * - Dropdown presentation (default): sleek anchored dropdown popover menu
 * - Modal presentation: bottom-sheet picker for full-screen dialogs
 * - Searchable filtering
 * - Icons, labels, descriptions, badges, status dots
 * - 44px min touch targets
 * - Native haptic feedback
 * - Light and Dark theme adaptation.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Dimensions,
  Keyboard,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { haptics } from '../../lib/haptics';
import { useTheme } from './ThemeProvider';
import { Text, useTypeStyle } from './Text';
import { Icon } from './icon';
import { Touchable } from './Touchable';
import { AppModal } from './AppModal';
import { ChevronDown, Search, X, Check } from './icon';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: 'neutral' | 'success' | 'warning' | 'info';
  code?: string;
  dotColor?: string;
}

export interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  options: SelectOption[];
  value: string;
  onChange: (value: string, option?: SelectOption | null) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  modalTitle?: string;
  searchPlaceholder?: string;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
  triggerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  presentation?: 'dropdown' | 'modal';
  onDropdownOpen?: () => void;
  inlineDescription?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  required = false,
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  leftIcon,
  error,
  disabled = false,
  searchable = true,
  modalTitle,
  searchPlaceholder = 'Search...',
  rightElement,
  containerStyle,
  triggerStyle,
  labelStyle,
  presentation = 'dropdown',
  onDropdownOpen,
  inlineDescription = false,
}) => {
  const { theme, isDark } = useTheme();
  const windowDim = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 0, left: 0, width: 300, maxHeight: 260 });

  const containerRef = useRef<View>(null);
  const triggerRef = useRef<View>(null);
  const bodyTypeStyle = useTypeStyle('body');

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        (opt.code && opt.code.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const showSearch = searchable && options.length > 4;

  // Track keyboard height on native
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

  // Compute dynamic dropdown position relative to visible viewport and soft keyboard
  const computeDropdownPosition = useCallback(() => {
    const anchor = triggerRef.current || containerRef.current;
    if (!anchor) return;

    const calculate = (x: number, y: number, width: number, height: number) => {
      const currentWindowW =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.innerWidth
          : Dimensions.get('window').width;

      const currentWindowH =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? ((window as any).visualViewport?.height || window.innerHeight)
          : Dimensions.get('window').height;

      const effectiveWindowH = Math.max(240, currentWindowH - keyboardHeight);
      const menuWidth = Math.min(width, currentWindowW - 16);

      let left = Math.max(8, Math.min(x, currentWindowW - menuWidth - 8));

      // Calculate space below and above relative to the effective visible window
      const spaceBelow = effectiveWindowH - (y + height) - 8;
      const spaceAbove = y - 8;

      const shouldOpenUpwards = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableSpace = shouldOpenUpwards ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(260, Math.max(120, availableSpace));

      const top = shouldOpenUpwards
        ? Math.max(8, y - maxHeight - 4)
        : y + height + 4;

      setDropdownPosition({
        top: Math.round(top),
        left: Math.round(left),
        width: Math.round(menuWidth),
        maxHeight: Math.round(maxHeight),
      });
    };

    if (Platform.OS === 'web' && (anchor as any).getBoundingClientRect) {
      const rect = (anchor as any).getBoundingClientRect();
      calculate(rect.left, rect.top, rect.width, rect.height);
    } else if (typeof anchor.measureInWindow === 'function') {
      anchor.measureInWindow((x, y, width, height) => {
        calculate(x, y, width, height);
      });
    }
  }, [keyboardHeight]);

  // Recalculate dropdown position whenever keyboard height changes or window resizes
  useEffect(() => {
    if (isOpen && presentation === 'dropdown') {
      computeDropdownPosition();
    }
  }, [isOpen, presentation, keyboardHeight, computeDropdownPosition]);

  // Web listeners for visualViewport resize and scroll
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen || presentation !== 'dropdown' || typeof window === 'undefined') return;

    const handleResize = () => {
      computeDropdownPosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    if ((window as any).visualViewport) {
      (window as any).visualViewport.addEventListener('resize', handleResize);
      (window as any).visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      if ((window as any).visualViewport) {
        (window as any).visualViewport.removeEventListener('resize', handleResize);
        (window as any).visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, [isOpen, presentation, computeDropdownPosition]);

  // Click-outside and keyboard escape dismissal on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen || presentation !== 'dropdown') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, presentation]);

  const handleToggle = () => {
    if (disabled) return;
    haptics.select();
    setSearchQuery('');

    if (presentation === 'modal') {
      if (!modalVisible) {
        onDropdownOpen?.();
      }
      setModalVisible((prev) => !prev);
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    onDropdownOpen?.();
    computeDropdownPosition();
    setIsOpen(true);
  };

  const handleSelect = (option: SelectOption) => {
    haptics.select();
    onChange(option.value, option);
    setModalVisible(false);
    setIsOpen(false);
    setSearchQuery('');
  };

  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const triggerBg = isDark ? '#121212' : '#fafafa';
  const iconColor = isDark ? '#737373' : '#9ca3af';

  const isDropdownActive = presentation === 'dropdown' && isOpen;
  const hasSelectedSubtitle = Boolean(selectedOption?.description);

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        containerStyle,
      ]}
    >
      {label && (
        <View style={styles.labelRow}>
          <Text variant="label" style={[{ color: isDark ? '#ffffff' : '#0f172a' }, labelStyle]}>
            {label}
            {required && <Text variant="label" style={{ color: '#ef4444' }}> *</Text>}
          </Text>
          {rightElement}
        </View>
      )}

      {/* Trigger Area */}
      <View ref={triggerRef} style={styles.triggerWrapper} collapsable={false}>
        {/* Trigger Button */}
        <Touchable
          preset="card"
          onPress={handleToggle}
          disabled={disabled}
          style={[
            styles.trigger,
            hasSelectedSubtitle && styles.triggerWithSubtitle,
            {
              backgroundColor: triggerBg,
              borderColor: error
                ? '#ef4444'
                : isDropdownActive
                ? '#0284c7'
                : cardBorder,
              opacity: disabled ? 0.6 : 1,
            },
            triggerStyle,
          ]}
        >
          <View style={styles.triggerLeft}>
            {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
            {selectedOption?.dotColor && (
              <View style={[styles.statusDot, { backgroundColor: selectedOption.dotColor }]} />
            )}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={styles.triggerTitleRow}>
                <Text
                  variant="body"
                  style={[
                    styles.triggerText,
                    {
                      color: selectedOption
                        ? isDark
                          ? '#f8fafc'
                          : '#0f172a'
                        : isDark
                        ? '#71717a'
                        : '#9ca3af',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {selectedOption ? selectedOption.label : placeholder}
                </Text>
                {selectedOption?.code && (
                  <View
                    style={[
                      styles.codeBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(2, 132, 199, 0.18)'
                          : 'rgba(2, 132, 199, 0.10)',
                        borderColor: isDark
                          ? 'rgba(2, 132, 199, 0.35)'
                          : 'rgba(2, 132, 199, 0.22)',
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      weight="semibold"
                      style={[
                        styles.codeText,
                        { color: isDark ? '#38bdf8' : '#0284c7' },
                      ]}
                    >
                      {selectedOption.code}
                    </Text>
                  </View>
                )}
                {selectedOption?.badge && (
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor:
                          selectedOption.badgeVariant === 'success'
                            ? 'rgba(16, 185, 129, 0.08)'
                            : selectedOption.badgeVariant === 'warning'
                            ? 'rgba(245, 158, 11, 0.08)'
                            : selectedOption.badgeVariant === 'info'
                            ? 'rgba(2, 132, 199, 0.08)'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                        borderColor:
                          selectedOption.badgeVariant === 'success'
                            ? 'rgba(16, 185, 129, 0.20)'
                            : selectedOption.badgeVariant === 'warning'
                            ? 'rgba(245, 158, 11, 0.20)'
                            : selectedOption.badgeVariant === 'info'
                            ? 'rgba(2, 132, 199, 0.20)'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.07)',
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      style={[
                        styles.badgeText,
                        {
                          color:
                            selectedOption.badgeVariant === 'success'
                              ? isDark ? 'rgba(52, 211, 153, 0.85)' : 'rgba(5, 150, 105, 0.85)'
                              : selectedOption.badgeVariant === 'warning'
                              ? isDark ? 'rgba(251, 191, 36, 0.85)' : 'rgba(217, 119, 6, 0.85)'
                              : selectedOption.badgeVariant === 'info'
                              ? isDark ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.85)'
                              : theme.colors.mute,
                        },
                      ]}
                    >
                      {selectedOption.badge}
                    </Text>
                  </View>
                )}
                {selectedOption?.description && inlineDescription && (
                  <Text
                    variant="caption"
                    style={[
                      styles.triggerDesc,
                      { color: isDark ? '#a1a1aa' : '#71717a', flexShrink: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {' · '}{selectedOption.description}
                  </Text>
                )}
              </View>
              {selectedOption?.description && !inlineDescription ? (
                <Text
                  variant="caption"
                  style={[
                    styles.triggerDesc,
                    { color: isDark ? '#71717a' : '#888888', marginTop: 2 },
                  ]}
                  numberOfLines={1}
                >
                  {selectedOption.description}
                </Text>
              ) : null}
            </View>
          </View>
          <Icon
            name="chevron-down"
            state={isDropdownActive ? 'open' : 'closed'}
            variant="body"
            color={iconColor}
          />
        </Touchable>

        {/* Anchored Modal Popover Menu (presentation="dropdown")
            Rendered inside a transparent Modal Portal so it is physically IMPOSSIBLE
            for any sibling component, section, or card to overlap it or clip it. */}
        {isDropdownActive && (
          <Modal
            visible={isOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
            statusBarTranslucent={true}
            hardwareAccelerated={true}
          >
            {/* Fullscreen transparent dismiss backdrop */}
            <Touchable
              variant="card"
              haptic={false}
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
              accessibilityLabel="Close dropdown menu"
            >
              <View style={StyleSheet.absoluteFill} />
            </Touchable>

            {/* Dynamic Anchored Dropdown Menu */}
            <View
              style={[
                styles.dropdownMenu,
                {
                  position: 'absolute',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  maxHeight: dropdownPosition.maxHeight,
                  backgroundColor: isDark ? '#171717' : '#ffffff',
                  borderColor: cardBorder,
                  zIndex: 99999,
                  ...Platform.select({
                    web: {
                      boxShadow: isDark
                        ? '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)'
                        : '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    } as any,
                    ios: {
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                    },
                    android: {
                      elevation: 16,
                    },
                  }),
                },
              ]}
            >
              {/* Optional Search Bar */}
              {showSearch && (
                <View style={styles.dropdownSearchRow}>
                  <View
                    style={[
                      styles.dropdownSearchBox,
                      {
                        backgroundColor: isDark ? '#121212' : '#f4f4f5',
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <Icon name={Search} variant="body" color={iconColor} />
                    <TextInput
                      style={[styles.dropdownSearchInput, bodyTypeStyle, { color: theme.colors.ink }]}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={iconColor}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus={Platform.OS === 'web'}
                    />
                    {searchQuery ? (
                      <Touchable preset="icon" onPress={() => setSearchQuery('')} accessibilityLabel="Clear Search">
                        <Icon name={X} variant="caption" color={iconColor} />
                      </Touchable>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Scrollable Options List */}
              <ScrollView
                style={[
                  styles.dropdownScroll,
                  { maxHeight: Math.max(80, dropdownPosition.maxHeight - (showSearch ? 52 : 0)) }
                ]}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {filteredOptions.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text variant="body" style={[styles.emptyText, { color: theme.colors.mute }]}>
                      No options found
                    </Text>
                  </View>
                ) : (
                  filteredOptions.map((item) => {
                    const isSelected = item.value === value;
                    return (
                      <Touchable
                        key={item.value}
                        preset="row"
                        onPress={() => handleSelect(item)}
                        style={[
                          styles.dropdownItemRow,
                          { borderBottomColor: isDark ? '#222222' : '#f5f5f5' },
                          isSelected && {
                            backgroundColor: isDark
                              ? 'rgba(2, 132, 199, 0.15)'
                              : '#f0f9ff',
                          },
                        ]}
                      >
                        <View style={styles.itemLeft}>
                          {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
                          {item.dotColor && (
                            <View style={[styles.statusDot, { backgroundColor: item.dotColor }]} />
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={styles.itemTitleRow}>
                              <Text
                                variant={isSelected ? "subheading" : "body"}
                                style={[
                                  styles.itemTitle,
                                  {
                                    color: isSelected ? '#0284c7' : theme.colors.ink,
                                  },
                                ]}
                              >
                                {item.label}
                              </Text>
                              {item.code && (
                                <View
                                  style={[
                                    styles.codeBadge,
                                    {
                                      backgroundColor: isDark
                                        ? 'rgba(2, 132, 199, 0.18)'
                                        : 'rgba(2, 132, 199, 0.10)',
                                      borderColor: isDark
                                        ? 'rgba(2, 132, 199, 0.35)'
                                        : 'rgba(2, 132, 199, 0.22)',
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="micro"
                                    weight="semibold"
                                    style={[
                                      styles.codeText,
                                      { color: isDark ? '#38bdf8' : '#0284c7' },
                                    ]}
                                  >
                                    {item.code}
                                  </Text>
                                </View>
                              )}
                              {item.badge && (
                                <View
                                  style={[
                                    styles.badgePill,
                                    {
                                      backgroundColor:
                                        item.badgeVariant === 'success'
                                          ? 'rgba(16, 185, 129, 0.08)'
                                          : item.badgeVariant === 'warning'
                                          ? 'rgba(245, 158, 11, 0.08)'
                                          : item.badgeVariant === 'info'
                                          ? 'rgba(2, 132, 199, 0.08)'
                                          : isDark
                                          ? 'rgba(255, 255, 255, 0.05)'
                                          : 'rgba(0, 0, 0, 0.04)',
                                      borderColor:
                                        item.badgeVariant === 'success'
                                          ? 'rgba(16, 185, 129, 0.20)'
                                          : item.badgeVariant === 'warning'
                                          ? 'rgba(245, 158, 11, 0.20)'
                                          : item.badgeVariant === 'info'
                                          ? 'rgba(2, 132, 199, 0.20)'
                                          : isDark
                                          ? 'rgba(255, 255, 255, 0.08)'
                                          : 'rgba(0, 0, 0, 0.07)',
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="micro"
                                    style={[
                                      styles.badgeText,
                                      {
                                        color:
                                          item.badgeVariant === 'success'
                                            ? isDark ? 'rgba(52, 211, 153, 0.85)' : 'rgba(5, 150, 105, 0.85)'
                                            : item.badgeVariant === 'warning'
                                            ? isDark ? 'rgba(251, 191, 36, 0.85)' : 'rgba(217, 119, 6, 0.85)'
                                            : item.badgeVariant === 'info'
                                            ? isDark ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.85)'
                                            : theme.colors.mute,
                                      },
                                    ]}
                                  >
                                    {item.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {item.description ? (
                              <Text
                                variant="caption"
                                style={[
                                  styles.itemDesc,
                                  { color: isDark ? '#71717a' : '#888888' },
                                ]}
                              >
                                {item.description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {isSelected && <Icon name={Check} variant="body" color="#0284c7" strokeWidth={2.5} />}
                      </Touchable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </Modal>
        )}
      </View>

      {error ? <Text variant="caption" style={styles.errorText}>{error}</Text> : null}

      {/* Modal Bottom Sheet (only when presentation="modal") */}
      {presentation === 'modal' && (
        <AppModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          variant="bottom"
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#171717' : '#ffffff',
                borderColor: cardBorder,
              },
            ]}
          >
            {/* Sheet Header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: isDark ? '#262626' : '#f0f0f0' },
              ]}
            >
              <Text variant="heading" style={[styles.modalTitle, { color: theme.colors.ink }]}>
                {modalTitle || label || 'Select Option'}
              </Text>
              <Touchable
                preset="icon"
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <Icon name={X} variant="subheading" color={theme.colors.ink} />
              </Touchable>
            </View>

              {/* Optional Search Bar */}
              {showSearch && (
                <View style={styles.searchRow}>
                  <View
                    style={[
                      styles.searchBox,
                      {
                        backgroundColor: isDark ? '#121212' : '#f4f4f5',
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <Icon name={Search} variant="body" color={iconColor} />
                    <TextInput
                      style={[styles.searchInput, bodyTypeStyle, { color: theme.colors.ink }]}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={iconColor}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                      <Touchable preset="icon" onPress={() => setSearchQuery('')} accessibilityLabel="Clear Search">
                        <Icon name={X} variant="caption" color={iconColor} />
                      </Touchable>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Options List */}
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = item.value === value;
                  return (
                    <Touchable
                      preset="row"
                      onPress={() => handleSelect(item)}
                      style={[
                        styles.itemRow,
                        { borderBottomColor: isDark ? '#262626' : '#f0f0f0' },
                        isSelected && {
                          backgroundColor: isDark
                            ? 'rgba(2, 132, 199, 0.15)'
                            : '#f0f9ff',
                        },
                      ]}
                    >
                      <View style={styles.itemLeft}>
                        {item.icon && <View style={styles.itemIcon}>{item.icon}</View>}
                        {item.dotColor && (
                          <View style={[styles.statusDot, { backgroundColor: item.dotColor }]} />
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={styles.itemTitleRow}>
                            <Text
                              variant={isSelected ? "subheading" : "body"}
                              style={[
                                styles.itemTitle,
                                {
                                  color: isSelected ? '#0284c7' : theme.colors.ink,
                                },
                              ]}
                            >
                              {item.label}
                            </Text>
                            {item.code && (
                              <View
                                style={[
                                  styles.codeBadge,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(2, 132, 199, 0.18)'
                                      : 'rgba(2, 132, 199, 0.10)',
                                    borderColor: isDark
                                      ? 'rgba(2, 132, 199, 0.35)'
                                      : 'rgba(2, 132, 199, 0.22)',
                                  },
                                ]}
                              >
                                <Text
                                  variant="micro"
                                  weight="semibold"
                                  style={[
                                    styles.codeText,
                                    { color: isDark ? '#38bdf8' : '#0284c7' },
                                  ]}
                                >
                                  {item.code}
                                </Text>
                              </View>
                            )}
                            {item.badge && (
                              <View
                                style={[
                                  styles.badgePill,
                                  {
                                    backgroundColor:
                                      item.badgeVariant === 'success'
                                        ? 'rgba(16, 185, 129, 0.08)'
                                        : item.badgeVariant === 'warning'
                                        ? 'rgba(245, 158, 11, 0.08)'
                                        : item.badgeVariant === 'info'
                                        ? 'rgba(2, 132, 199, 0.08)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(0, 0, 0, 0.04)',
                                    borderColor:
                                      item.badgeVariant === 'success'
                                        ? 'rgba(16, 185, 129, 0.20)'
                                        : item.badgeVariant === 'warning'
                                        ? 'rgba(245, 158, 11, 0.20)'
                                        : item.badgeVariant === 'info'
                                        ? 'rgba(2, 132, 199, 0.20)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.08)'
                                        : 'rgba(0, 0, 0, 0.07)',
                                  },
                                ]}
                              >
                                <Text
                                  variant="micro"
                                  style={[
                                    styles.badgeText,
                                    {
                                      color:
                                        item.badgeVariant === 'success'
                                          ? isDark ? 'rgba(52, 211, 153, 0.85)' : 'rgba(5, 150, 105, 0.85)'
                                          : item.badgeVariant === 'warning'
                                          ? isDark ? 'rgba(251, 191, 36, 0.85)' : 'rgba(217, 119, 6, 0.85)'
                                          : item.badgeVariant === 'info'
                                          ? isDark ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.85)'
                                          : theme.colors.mute,
                                    },
                                  ]}
                                >
                                  {item.badge}
                                </Text>
                              </View>
                            )}
                          </View>
                          {item.description ? (
                            <Text
                              variant="caption"
                              style={[
                                styles.itemDesc,
                                { color: isDark ? '#71717a' : '#888888' },
                              ]}
                            >
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {isSelected && <Icon name={Check} variant="body" color="#0284c7" strokeWidth={2.5} />}
                    </Touchable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text variant="body" style={[styles.emptyText, { color: theme.colors.mute }]}>
                      No options found
                    </Text>
                  </View>
                }
              />
            </View>
        </AppModal>
      )}
    </View>
  );
};

const styles: any = StyleSheet.create({
  container: {
    marginBottom: 10,
    width: '100%',
    position: 'relative',
  },
  triggerWrapper: {
    width: '100%',
    position: 'relative',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  label: {},
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  triggerWithSubtitle: {
    minHeight: 52,
    paddingVertical: 6,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  triggerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  triggerDesc: {},
  leftIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {},
  errorText: {
    color: '#ef4444',
    marginTop: 4,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownSearchRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    gap: 6,
  },
  dropdownSearchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {},
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  list: {
    maxHeight: 380,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {},
  itemDesc: {
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  codeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {},
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    textTransform: 'uppercase',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {},
});
