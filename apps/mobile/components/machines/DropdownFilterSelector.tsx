import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { ChevronDown, Check, X, Search } from 'lucide-react-native';
import type { FilterOption } from './CustomFilterSelectorModal';

export type { FilterOption };

export interface DropdownFilterSelectorProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  align?: 'left' | 'right';
  minMenuWidth?: number;
  showSearch?: boolean;
}

export const DropdownFilterSelector: React.FC<DropdownFilterSelectorProps> = ({
  label,
  value,
  options,
  onChange,
  align = 'left',
  minMenuWidth = 200,
  showSearch = false,
}) => {
  const { theme, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: minMenuWidth,
  });

  const buttonRef = useRef<View>(null);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === value) || options[0];
  }, [options, value]);

  const hasSearch = Boolean(showSearch);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const measureAndOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setSearchQuery('');

    if (!buttonRef.current) {
      setOpen(true);
      return;
    }

    const windowWidth = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : Dimensions.get('window').width;

    const windowHeight = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerHeight
      : Dimensions.get('window').height;

    // Web synchronous bounding rect
    if (Platform.OS === 'web' && (buttonRef.current as any).getBoundingClientRect) {
      const rect = (buttonRef.current as any).getBoundingClientRect();
      const menuWidth = Math.max(rect.width, minMenuWidth);
      let left = align === 'right' ? rect.right - menuWidth : rect.left;

      if (left < 8) left = 8;
      if (left + menuWidth > windowWidth - 8) {
        left = windowWidth - menuWidth - 8;
      }

      const menuHeight = Math.min(options.length * 38 + (hasSearch ? 45 : 0) + 16, 260);
      const shouldOpenUpwards = rect.bottom + menuHeight > windowHeight - 16 && rect.top > menuHeight + 16;
      const top = shouldOpenUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;

      setCoords({ top: Math.max(8, top), left: Math.max(8, left), width: menuWidth });
      setOpen(true);
      return;
    }

    // Native measureInWindow
    buttonRef.current.measureInWindow((x, y, width, height) => {
      const menuWidth = Math.max(width, minMenuWidth);
      let left = align === 'right' ? x + width - menuWidth : x;

      if (left < 8) left = 8;
      if (left + menuWidth > windowWidth - 8) {
        left = windowWidth - menuWidth - 8;
      }

      const menuHeight = Math.min(options.length * 38 + (hasSearch ? 45 : 0) + 16, 260);
      const shouldOpenUpwards = y + height + menuHeight > windowHeight - 16 && y > menuHeight + 16;
      const top = shouldOpenUpwards ? y - menuHeight - 4 : y + height + 4;

      setCoords({ top: Math.max(8, top), left: Math.max(8, left), width: menuWidth });
      setOpen(true);
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

  const isFiltered = value !== 'all' && value !== 'machine_id_asc';

  return (
    <View style={styles.container}>
      {/* Anchor Trigger Button */}
      <View ref={buttonRef} collapsable={false}>
        <TouchableOpacity
          onPress={measureAndOpen}
          activeOpacity={0.8}
          style={[
            styles.triggerBtn,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: isFiltered ? theme.colors.ink : theme.colors.hairline,
            },
          ]}
          accessibilityRole="combobox"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${label} filter: ${selectedOption?.label}`}
        >
          <View style={styles.triggerLeft}>
            <Text style={[styles.triggerLabel, { color: theme.colors.mute }]}>
              {label}:
            </Text>
            {selectedOption?.dotColor && (
              <View style={[styles.statusDot, { backgroundColor: selectedOption.dotColor }]} />
            )}
            <Text
              style={[
                styles.triggerValue,
                {
                  color: isFiltered ? theme.colors.ink : theme.colors.ink,
                  fontWeight: isFiltered ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label}
            </Text>
          </View>
          <ChevronDown
            size={13}
            color={open ? theme.colors.ink : theme.colors.mute}
            style={{
              transform: [{ rotate: open ? '180deg' : '0deg' }],
            }}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Dropdown Menu */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    top: coords.top,
                    left: coords.left,
                    width: coords.width,
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                {/* Search Bar if long list */}
                {hasSearch && (
                  <View style={[styles.menuSearchBox, { borderBottomColor: theme.colors.hairline }]}>
                    <Search size={13} color={theme.colors.mute} style={{ marginRight: 6 }} />
                    <TextInput
                      placeholder={`Search ${label.toLowerCase()}...`}
                      placeholderTextColor={theme.colors.mute}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                      style={[styles.menuSearchInput, { color: theme.colors.ink }]}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={13} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}
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
                      <Text style={[styles.noOptionsText, { color: theme.colors.mute }]}>
                        No matching options
                      </Text>
                    </View>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isSelected = opt.id === value;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => {
                            onChange(opt.id);
                            setOpen(false);
                          }}
                          activeOpacity={0.7}
                          style={[
                            styles.optionItem,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.ink
                                : 'transparent',
                            },
                          ]}
                        >
                          <View style={styles.optionLeft}>
                            {opt.dotColor && (
                              <View
                                style={[
                                  styles.optionDot,
                                  {
                                    backgroundColor: isSelected ? theme.colors.canvas : opt.dotColor,
                                  },
                                ]}
                              />
                            )}
                            <Text
                              style={[
                                styles.optionText,
                                {
                                  color: isSelected ? theme.colors.canvas : theme.colors.ink,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {opt.label}
                            </Text>
                          </View>
                          {isSelected && (
                            <Check size={14} color={theme.colors.canvas} strokeWidth={2.5} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '47%',
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 4,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  triggerValue: {
    fontSize: 12,
    flexShrink: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 4,
    maxHeight: 260,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  menuSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  menuSearchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
    height: 26,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  menuScroll: {
    maxHeight: 210,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
    minHeight: 36,
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
  optionText: {
    fontSize: 12,
    flexShrink: 1,
  },
  noOptions: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noOptionsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
