/**
 * ReachInternational Mobile — createIconComponent Factory
 * Creates typed, memoized icon primitives bound to the canonical Icon component.
 */

import React, { memo } from 'react';
import { type ColorValue } from 'react-native';
import { Icon, type IconProps } from './Icon';
import type { IconName } from './registry';
import type { IconSizeLevel } from './sizes';

export type NamedIconProps = Omit<IconProps, 'name' | 'icon' | 'as'> & {
  name?: IconName;
  color?: string | ColorValue;
  size?: number | IconSizeLevel;
  strokeWidth?: number;
};

export function createIconComponent(iconName: IconName): React.FC<NamedIconProps> {
  const Component: React.FC<NamedIconProps> = memo(function NamedIcon(props: NamedIconProps) {
    return <Icon name={props.name || iconName} {...props} />;
  });
  (Component as any).displayName = `Icon(${String(iconName)})`;
  return Component;
}
