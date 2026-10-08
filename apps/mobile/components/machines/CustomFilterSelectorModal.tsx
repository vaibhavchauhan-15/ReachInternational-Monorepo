import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { useTheme } from '../ui/ThemeProvider';
import { Text, useTypeStyle } from '../ui/Text';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X } from '../ui/icon';

export interface FilterOption {
  id: string;
  label: string;
  dotColor?: string;
  activeColor?: string;
}

export interface CustomFilterSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export const CustomFilterSelectorModal: React.FC<CustomFilterSelectorModalProps> = ({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}) => {
  const { theme } = useTheme();
  const bodyTypeStyle = useTypeStyle('body');
  const [modalSearch, setModalSearch] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setModalSearch('');
    }
  }, [visible]);

  const filteredOptions = React.useMemo(() => {
    if (!modalSearch.trim()) return options;
    const q = modalSearch.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, modalSearch]);

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
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
                <Text variant="subheading" style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
                <Pressable
                  variant="iconButton"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                  accessibilityLabel="Close filter dialog"
                >
                  <X size={16} color={theme.colors.mute} />
                </Pressable>
              </View>

              {/* Optional Search Bar for longer lists (e.g. Supervisors) */}
              {options.length > 5 && (
                <View style={[styles.searchWrapper, { borderBottomColor: theme.colors.hairline }]}>
                  <TextInput
                    placeholder={`Search ${title.toLowerCase()}...`}
                    placeholderTextColor={theme.colors.mute}
                    value={modalSearch}
                    onChangeText={setModalSearch}
                    style={[
                      styles.searchInput,
                      bodyTypeStyle,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                        color: theme.colors.ink,
                      },
                    ]}
                  />
                  {modalSearch.length > 0 && (
                    <Pressable
                      variant="iconButton"
                      haptic="tap"
                      hitSlopToMin48
                      onPress={() => setModalSearch('')}
                      style={styles.searchClearBtn}
                      accessibilityLabel="Clear search"
                    >
                      <X size={14} color={theme.colors.mute} />
                    </Pressable>
                  )}
                </View>
              )}

              {/* Options List */}
              <ScrollView
                style={styles.optionsList}
                showsVerticalScrollIndicator={false}
              >
                {filteredOptions.length === 0 ? (
                  <View style={styles.noResults}>
                    <Text variant="caption" style={[styles.noResultsText, { color: theme.colors.mute }]}>
                      No matching options found
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
                        onPress={() => {
                          onSelect(opt.id);
                          onClose();
                        }}
                        style={[
                          styles.optionRow,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.ink
                              : theme.colors.canvasElevated,
                            borderColor: isSelected
                              ? theme.colors.ink
                              : theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.optionLeft}>
                          {opt.dotColor && (
                            <View
                              style={[
                                styles.dot,
                                {
                                  backgroundColor: isSelected ? theme.colors.canvas : opt.dotColor,
                                },
                              ]}
                            />
                          )}
                          <Text
                            variant="body"
                            style={[
                              styles.optionLabel,
                              {
                                color: isSelected ? theme.colors.canvas : theme.colors.ink,
                              },
                            ]}
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
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  title: {
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    padding: spacingNumeric.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs,
    minHeight: 44,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {},
  searchWrapper: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    height: 38,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    paddingRight: 32,
  },
  searchClearBtn: {
    position: 'absolute',
    right: 22,
    top: 18,
  },
  noResults: {
    padding: spacingNumeric.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {},
});
