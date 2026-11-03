/**
 * ReachInternational Mobile — SegmentedToggle (Re-exporting ToggleSwitch)
 * Replaced the legacy segmented toggle with the high-performance ToggleSwitch.
 * Retains full backward compatibility, style invariants, and type safety across the monorepo.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import {
  ToggleSwitch,
  type ToggleSwitchOption,
  type ToggleSwitchProps,
  type ToggleSwitchSize,
  areToggleSwitchPropsEqual,
} from './ToggleSwitch';

export type SegmentedToggleItem<T extends string = string> = ToggleSwitchOption<T>;
export type SegmentedToggleProps<T extends string = string> = ToggleSwitchProps<T>;
export type SegmentedToggleSize = ToggleSwitchSize;

export const areSegmentedTogglePropsEqual = areToggleSwitchPropsEqual;

export const SegmentedToggle = ToggleSwitch;
export const SegmentedControl = ToggleSwitch;

export type SegmentedControlProps<T extends string = string> = ToggleSwitchProps<T>;
export type SegmentedControlItem<T extends string = string> = ToggleSwitchOption<T>;
export type SegmentedControlSize = ToggleSwitchSize;

// Style definitions guaranteeing backward compatibility and APK shrink prevention invariants
export const segmentedToggleStyles = StyleSheet.create({
  container: {
    minWidth: '100%',
    flexGrow: 1,
  },
  scrollContent: {
    minWidth: '100%',
    flexGrow: 1,
  },
  itemInline: {
    minWidth: 64,
  },
});

export default SegmentedToggle;
