/**
 * ReachInternational Mobile — Assignment Search Input
 *
 * Debounced search input tailored for candidate filtering across operators,
 * machinery, supervisors, and client accounts.
 *
 * Invariants:
 * - Minimum 44px touch targets on input and clear button
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Search, X } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';

export interface AssignmentSearchInputProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  count?: number;
  totalCount?: number;
  debounceMs?: number;
}

export const AssignmentSearchInput: React.FC<AssignmentSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, employee ID, or model...',
  count,
  totalCount,
  debounceMs = 250,
}) => {
  const { theme, isDark } = useTheme();
  const [internalValue, setInternalValue] = useState(value);

  // Sync external changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounced propagation
  useEffect(() => {
    const handler = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [internalValue, onChange, value, debounceMs]);

  const handleClear = () => {
    haptics.select();
    setInternalValue('');
    onChange('');
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Search size={16} color={theme.colors.mute} style={styles.searchIcon} />
        <TextInput
          value={internalValue}
          onChangeText={setInternalValue}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mute}
          style={[styles.input, { color: theme.colors.ink }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {internalValue.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={10}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search input"
          >
            <X size={16} color={theme.colors.mute} />
          </Pressable>
        )}
      </View>
      {count !== undefined && (
        <View style={styles.countContainer}>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            {totalCount !== undefined
              ? `Showing ${count} of ${totalCount}`
              : `${count} result${count === 1 ? '' : 's'}`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacingNumeric.md,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: spacingNumeric.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacingNumeric.sm,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacingNumeric.xs,
  },
});
