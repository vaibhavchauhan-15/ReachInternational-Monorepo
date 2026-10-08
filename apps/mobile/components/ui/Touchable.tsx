/**
 * ReachInternational Mobile — Touchable Primitive
 * Bridges to the canonical touch architecture in components/ui/touch/Pressable.
 */

import React, { memo } from 'react';
import {
  Pressable,
  type PressableProps,
  usePressProgress,
} from './touch/Pressable';
import type { TouchVariant } from './touch/feedback';
import type { HapticKind } from '../../lib/haptics';

export { usePressProgress };

export type TouchablePreset = 'card' | 'row' | 'button' | 'icon' | 'nav';

export interface TouchableProps extends Omit<PressableProps, 'variant' | 'haptic'> {
  preset?: TouchablePreset;
  variant?: TouchVariant;
  haptic?: HapticKind | false;
}

const PRESET_TO_VARIANT: Record<TouchablePreset, TouchVariant> = {
  card: 'card',
  row: 'listRow',
  button: 'buttonPrimary',
  icon: 'iconButton',
  nav: 'navTab',
};

export const Touchable = memo(function Touchable({
  preset = 'card',
  variant,
  ...rest
}: TouchableProps) {
  const resolvedVariant = variant || PRESET_TO_VARIANT[preset] || 'card';

  return <Pressable variant={resolvedVariant} {...rest} />;
});

export default Touchable;
