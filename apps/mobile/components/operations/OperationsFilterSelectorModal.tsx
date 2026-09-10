import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X, Search } from 'lucide-react-native';

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
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <TouchableWithoutFeedback>
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
                  <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                {showSearch && (
                  <View style={[styles.searchWrap, { borderBottomColor: theme.colors.hairline }]}>
                    <Search size={14} color={theme.colors.mute} style={styles.searchIcon} />
                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          color: theme.colors.ink,
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={theme.colors.mute}
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searchTerm.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSearchTerm('')}
                        style={styles.clearSearchBtn}
                      >
                        <X size={12} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}
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
                      <Text style={[styles.emptyText, { color: theme.colors.mute }]}>
                        No matches found
                      </Text>
                    </View>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isSelected = opt.id === selectedValue;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => handleSelect(opt.id)}
                          activeOpacity={0.7}
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
                                style={[
                                  styles.optionLabel,
                                  {
                                    color: isSelected ? theme.colors.link : theme.colors.ink,
                                    fontWeight: isSelected ? '700' : '600',
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
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
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
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: spacingNumeric.md + 10,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingLeft: 34,
    paddingRight: 32,
    fontSize: 13,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: spacingNumeric.md + 10,
    padding: 4,
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
  optionLabel: {
    fontSize: 14,
  },
  codePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  checkWrap: {
    marginLeft: spacingNumeric.sm,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
