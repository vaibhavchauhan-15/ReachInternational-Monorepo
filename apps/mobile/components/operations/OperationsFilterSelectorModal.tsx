import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Text } from '../ui';
import { SearchInput } from '../ui/SearchInput';
import { Pressable } from '../ui/touch/Pressable';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X } from '../ui/icon';

export interface FilterSelectOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeVariant?: 'neutral' | 'success' | 'warning' | 'info';
  code?: string;
}

export interface OperationsFilterSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: FilterSelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export const OperationsFilterSelectorModal: React.FC<OperationsFilterSelectorModalProps> = ({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  searchPlaceholder = 'Search...',
  showSearch = true,
}) => {
  const { theme, isDark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.code && opt.code.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchTerm]);

  const handleSelect = (val: string) => {
    onSelect(val);
    setSearchTerm('');
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      variant="bottom"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
                  <Pressable
                    variant="iconButton"
                    haptic="select"
                    onPress={handleClose}
                    style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                    hitSlopToMin48={true}
                  >
                    <X size={16} color={theme.colors.mute} />
                  </Pressable>
                </View>

                {/* Search Input */}
                {showSearch && (
                  <View style={[styles.searchWrap, { borderBottomColor: theme.colors.hairline }]}>
                    <SearchInput
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      onClear={() => setSearchTerm('')}
                      placeholder={searchPlaceholder}
                    />
                  </View>
                )}

                {/* Options List */}
                <ScrollView
                  style={styles.optionsList}
                  contentContainerStyle={styles.optionsContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredOptions.length === 0 ? (
                    <View style={styles.emptyWrap}>
                      <Text variant="caption" style={[styles.emptyText, { color: theme.colors.mute }]}>
                        No matches found
                      </Text>
                    </View>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isSelected = opt.id === selectedValue;
                      return (
                        <Pressable
                          key={opt.id}
                          variant="listRow"
                          haptic="select"
                          onPress={() => handleSelect(opt.id)}
                          style={[
                            styles.optionRow,
                            {
                              backgroundColor: isSelected
                                ? isDark
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'rgba(0, 112, 243, 0.08)'
                                : 'transparent',
                              borderBottomColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          <View style={styles.optionContent}>
                            <View style={styles.optionTitleRow}>
                              <Text
                                variant="subheading"
                                style={[
                                  styles.optionLabel,
                                  {
                                    color: isSelected ? theme.colors.link : theme.colors.ink,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {opt.label}
                              </Text>
                              {opt.code && (
                                <View
                                  style={[
                                    styles.codePill,
                                    {
                                      backgroundColor: isDark
                                        ? 'rgba(59, 130, 246, 0.2)'
                                        : 'rgba(0, 112, 243, 0.1)',
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="mono"
                                    style={[
                                      styles.codeText,
                                      { color: theme.colors.link },
                                    ]}
                                  >
                                    {opt.code}
                                  </Text>
                                </View>
                              )}
                              {opt.badge && (
                                <View
                                  style={[
                                    styles.badgePill,
                                    {
                                      backgroundColor:
                                        opt.badgeVariant === 'success'
                                          ? 'rgba(16, 185, 129, 0.15)'
                                          : opt.badgeVariant === 'warning'
                                          ? 'rgba(245, 158, 11, 0.15)'
                                          : isDark
                                          ? 'rgba(255,255,255,0.1)'
                                          : 'rgba(0,0,0,0.06)',
                                    },
                                  ]}
                                >
                                  <Text
                                    variant="caption"
                                    style={[
                                      styles.badgeText,
                                      {
                                        color:
                                          opt.badgeVariant === 'success'
                                            ? '#10b981'
                                            : opt.badgeVariant === 'warning'
                                            ? '#f59e0b'
                                            : theme.colors.mute,
                                      },
                                    ]}
                                  >
                                    {opt.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {opt.subLabel ? (
                              <Text
                                variant="caption"
                                style={[styles.optionSubLabel, { color: theme.colors.mute }]}
                                numberOfLines={1}
                              >
                                {opt.subLabel}
                              </Text>
                            ) : null}
                          </View>

                          {isSelected && (
                            <View style={styles.checkWrap}>
                              <Check size={16} color={theme.colors.link} strokeWidth={2.5} />
                            </View>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
    maxHeight: '85%',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  title: {},
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  optionsList: {
    maxHeight: 400,
  },
  optionsContent: {
    paddingBottom: spacingNumeric.xl,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionContent: {
    flex: 1,
    marginRight: spacingNumeric.sm,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionLabel: {},
  codePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: {},
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    textTransform: 'uppercase',
  },
  optionSubLabel: {
    marginTop: 2,
  },
  checkWrap: {
    marginLeft: spacingNumeric.sm,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {},
});
