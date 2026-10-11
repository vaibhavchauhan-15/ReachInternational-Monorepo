import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Pressable } from '../ui/touch/Pressable';
import { SearchInput } from '../ui/SearchInput';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { ChevronDown, Check, X, Icon } from '../ui/icon';
import { haptics } from '../../lib/haptics';
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
  const [windowWidth, setWindowWidth] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : Dimensions.get('window').width
  );
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

  // Monitor window resize on web / orientation changes
  useEffect(() => {
    const updateDimensions = () => {
      const w =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.innerWidth
          : Dimensions.get('window').width;
      setWindowWidth(w);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    } else {
      const sub = Dimensions.addEventListener('change', updateDimensions);
      return () => sub.remove();
    }
  }, []);

  const isMobile = windowWidth <= 640;

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

    const menuWidth = Math.max(triggerW, minMenuWidth);
    let left = align === 'right' ? triggerX + triggerW - menuWidth : triggerX;

    // Viewport horizontal clamp
    if (left < 12) left = 12;
    if (left + menuWidth > currentWindowW - 12) {
      left = Math.max(12, currentWindowW - menuWidth - 12);
    }

    const itemHeight = 38;
    const searchHeight = hasSearch ? 48 : 0;
    const desiredMenuHeight = Math.min(
      options.length * itemHeight + searchHeight + 16,
      280
    );

    // Viewport vertical available space
    const spaceBelow = currentWindowH - (triggerY + triggerH) - 16;
    const spaceAbove = triggerY - 16;

    const shouldOpenUpwards = spaceBelow < desiredMenuHeight && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpwards ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(280, Math.max(140, availableSpace));
    const top = shouldOpenUpwards
      ? Math.max(12, triggerY - Math.min(desiredMenuHeight, maxHeight) - 4)
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
    if (open) {
      setOpen(false);
      return;
    }

    setSearchQuery('');
    haptics.select();

    if (isMobile) {
      setOpen(true);
      return;
    }

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

  const handleSelectOption = (optId: string) => {
    haptics.select();
    onChange(optId);
    setOpen(false);
  };

  const isFiltered = value !== 'all' && value !== 'machine_id_asc';

  return (
    <View style={styles.container}>
      {/* Anchor Trigger Button */}
      <View ref={buttonRef} collapsable={false}>
        <Pressable
          variant="outline"
          haptic="select"
          hitSlopToMin48
          onPress={measureAndOpen}
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
            <Text variant="caption" style={[{ color: theme.colors.mute }]}>
              {label}:
            </Text>
            {selectedOption?.dotColor && (
              <View style={[styles.statusDot, { backgroundColor: selectedOption.dotColor }]} />
            )}
            <Text
              variant="caption"
              style={[
                styles.triggerValue,
                {
                  color: theme.colors.ink,
                },
              ]}
              numberOfLines={1}
            >
              {selectedOption?.label}
            </Text>
          </View>
          <Icon
            name="chevron-down"
            size={13}
            color={open ? theme.colors.ink : theme.colors.mute}
            state={open ? 'open' : 'closed'}
          />
        </Pressable>
      </View>

      {/* Presentation Mode: Bottom Sheet on Mobile, Viewport-Aware Popover on Desktop / Tablet */}
      {isMobile ? (
        <AppModal
          visible={open}
          onClose={() => setOpen(false)}
          variant="bottom"
        >
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Sheet Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Filter by {label}
              </Text>
              <Pressable
                variant="iconButton"
                haptic="tap"
                hitSlopToMin48
                onPress={() => setOpen(false)}
                accessibilityLabel="Close filter options"
              >
                <X size={16} color={theme.colors.mute} />
              </Pressable>
            </View>

            {/* Optional Search */}
            {hasSearch && (
              <View style={[styles.sheetSearchBox, { borderBottomColor: theme.colors.hairline }]}>
                <SearchInput
                  placeholder={`Search ${label.toLowerCase()}...`}
                  placeholderTextColor={theme.colors.mute}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onClear={() => setSearchQuery('')}
                />
              </View>
            )}

            {/* Options List */}
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredOptions.length === 0 ? (
                <View style={styles.noOptions}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    No matching options
                  </Text>
                </View>
              ) : (
                filteredOptions.map((opt: FilterOption) => {
                  const isSelected = opt.id === value;
                  return (
                    <Pressable
                      key={opt.id}
                      variant="listRow"
                      haptic="select"
                      onPress={() => handleSelectOption(opt.id)}
                      style={[
                        styles.sheetOptionItem,
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
                          variant="body"
                          style={{
                            color: isSelected ? theme.colors.canvas : theme.colors.ink,
                          }}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={16} color={theme.colors.canvas} strokeWidth={2.5} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </AppModal>
      ) : (
        <Modal
          visible={open}
          transparent={true}
          animationType="none"
          onRequestClose={() => setOpen(false)}
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
                  autoFocus
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
                filteredOptions.map((opt: FilterOption) => {
                  const isSelected = opt.id === value;
                  return (
                    <Pressable
                      key={opt.id}
                      variant="listRow"
                      haptic="select"
                      onPress={() => handleSelectOption(opt.id)}
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
                          variant="caption"
                          style={{
                            color: isSelected ? theme.colors.canvas : theme.colors.ink,
                          }}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={14} color={theme.colors.canvas} strokeWidth={2.5} animate="mount" />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
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
  noOptions: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContainer: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingBottom: spacingNumeric.lg,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  sheetSearchBox: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  sheetScroll: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: spacingNumeric.xs,
  },
  sheetOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    minHeight: 44,
    marginVertical: 1,
  },
});
