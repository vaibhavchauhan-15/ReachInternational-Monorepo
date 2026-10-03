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

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { ChevronDown, Search, X, Check } from 'lucide-react-native';

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
}) => {
  const { theme, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<View>(null);

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

  // Click-outside and keyboard escape dismissal on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen || presentation !== 'dropdown') return;

    const handleClickOutside = (e: MouseEvent) => {
      const node = containerRef.current as unknown as HTMLElement | null;
      if (node && typeof node.contains === 'function' && !node.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, presentation]);

  const handleToggle = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    setSearchQuery('');

    if (presentation === 'modal') {
      setModalVisible((prev) => !prev);
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelect = (option: SelectOption) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(option.value, option);
    setModalVisible(false);
    setIsOpen(false);
    setSearchQuery('');
  };

  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const triggerBg = isDark ? '#121212' : '#fafafa';
  const iconColor = isDark ? '#737373' : '#9ca3af';

  const showSearch = searchable && options.length > 4;
  const isDropdownActive = presentation === 'dropdown' && isOpen;

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        isDropdownActive && { zIndex: 1000 },
        containerStyle,
      ]}
    >
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: isDark ? '#ffffff' : '#0f172a' }, labelStyle]}>
            {label}
            {required && <Text style={{ color: '#ef4444', fontWeight: '700' }}> *</Text>}
          </Text>
          {rightElement}
        </View>
      )}

      {/* Trigger Area with Anchor */}
      <View style={[styles.triggerWrapper, isDropdownActive && { zIndex: 1000 }]}>
        {/* Trigger Button */}
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.7}
          disabled={disabled}
          style={[
            styles.trigger,
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
            <Text
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
                  fontWeight: selectedOption ? '600' : 'normal',
                },
              ]}
              numberOfLines={1}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
          </View>
          <ChevronDown
            size={15}
            color={iconColor}
            style={isDropdownActive ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>

        {/* Anchored Dropdown Popover Menu (presentation="dropdown") */}
        {isDropdownActive && (
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: isDark ? '#171717' : '#ffffff',
                borderColor: cardBorder,
                ...Platform.select({
                  web: {
                    boxShadow: isDark
                      ? '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)'
                      : '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                  } as any,
                  ios: {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                  },
                  android: {
                    elevation: 8,
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
                  <Search size={14} color={iconColor} />
                  <TextInput
                    style={[styles.dropdownSearchInput, { color: theme.colors.ink }]}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={iconColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                      <X size={13} color={iconColor} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {/* Scrollable Options List */}
            <ScrollView
              style={styles.dropdownScroll}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.colors.mute }]}>
                    No options found
                  </Text>
                </View>
              ) : (
                filteredOptions.map((item) => {
                  const isSelected = item.value === value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
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
                              style={[
                                styles.itemTitle,
                                {
                                  color: isSelected ? '#0284c7' : theme.colors.ink,
                                  fontWeight: isSelected ? '700' : '500',
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
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.codeText,
                                    { color: theme.colors.mute },
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
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : item.badgeVariant === 'warning'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : item.badgeVariant === 'info'
                                        ? 'rgba(2, 132, 199, 0.15)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.1)'
                                        : 'rgba(0, 0, 0, 0.06)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.badgeText,
                                    {
                                      color:
                                        item.badgeVariant === 'success'
                                          ? '#10b981'
                                          : item.badgeVariant === 'warning'
                                          ? '#f59e0b'
                                          : item.badgeVariant === 'info'
                                          ? '#0284c7'
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
                      {isSelected && <Check size={16} color="#0284c7" strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Bottom Sheet (only when presentation="modal") */}
      {presentation === 'modal' && (
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
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
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                  {modalTitle || label || 'Select Option'}
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeBtn}
                  hitSlop={10}
                >
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
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
                    <Search size={15} color={iconColor} />
                    <TextInput
                      style={[styles.searchInput, { color: theme.colors.ink }]}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={iconColor}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery ? (
                      <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                        <X size={14} color={iconColor} />
                      </TouchableOpacity>
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
                    <TouchableOpacity
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
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
                              style={[
                                styles.itemTitle,
                                {
                                  color: isSelected ? '#0284c7' : theme.colors.ink,
                                  fontWeight: isSelected ? '700' : '500',
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
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.codeText,
                                    { color: theme.colors.mute },
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
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : item.badgeVariant === 'warning'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : item.badgeVariant === 'info'
                                        ? 'rgba(2, 132, 199, 0.15)'
                                        : isDark
                                        ? 'rgba(255, 255, 255, 0.1)'
                                        : 'rgba(0, 0, 0, 0.06)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.badgeText,
                                    {
                                      color:
                                        item.badgeVariant === 'success'
                                          ? '#10b981'
                                          : item.badgeVariant === 'warning'
                                          ? '#f59e0b'
                                          : item.badgeVariant === 'info'
                                          ? '#0284c7'
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
                      {isSelected && <Check size={18} color="#0284c7" strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.colors.mute }]}>
                      No options found
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  leftIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 13.5,
    flex: 1,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 250,
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
    fontSize: 13,
    height: '100%',
    padding: 0,
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
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
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
    fontSize: 13.5,
    height: '100%',
    padding: 0,
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
  itemTitle: {
    fontSize: 13.5,
  },
  itemDesc: {
    fontSize: 12,
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
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
