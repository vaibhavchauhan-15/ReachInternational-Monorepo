/**
 * ReachInternational Mobile — Radio Component
 * Backed by React Native Reusables RadioGroupItem.
 */

import React, { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Pressable } from './touch/Pressable';

export interface RadioProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: number;
  style?: ViewStyle;
}

export const Radio = memo(function Radio({
  selected,
  onSelect,
  disabled = false,
  accessibilityLabel = 'Radio button',
  size = 20,
  style,
}: RadioProps) {
  return (
    <Pressable
      variant="toggle"
      haptic={false}
      hitSlopToMin48={true}
      disabled={disabled}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitBox, style]}
    >
      <RadioGroup
        value={selected ? 'selected' : ''}
        onValueChange={() => onSelect()}
      >
        <RadioGroupItem value="selected" disabled={disabled} />
      </RadioGroup>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hitBox: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Radio;
export { RadioGroup, RadioGroupItem } from './radio-group';
