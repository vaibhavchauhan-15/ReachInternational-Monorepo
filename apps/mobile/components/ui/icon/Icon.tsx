/**
 * ReachInternational Mobile — Canonical Icon Component
 * The single icon component screens and primitives use across the mobile app.
 * UI-thread Reanimated 4 transforms, Material 3 spring tokens, and zero direct Lucide imports in screens.
 */

import React, { memo } from 'react';
import { type StyleProp, type ViewStyle, type ColorValue } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { useTypeScale } from '../../../lib/typography/TypeScaleProvider';
import {
  getIconDescriptor,
  type IconName,
  type LucideIcon,
  type IconBehaviorKey,
} from './registry';
import {
  resolveIconSize,
  resolveIconColor,
  type IconSizeLevel,
  type IconTone,
} from './sizes';
import { useIconBehavior } from './useIconBehavior';
import { MenuCloseMorph, EyeMorph } from './behaviors/morphPair';
import { AnimatedDrawCheck } from './behaviors/drawStroke';

export interface IconProps {
  /** Canonical name of the icon in the registry (e.g. 'chevron-down', 'menu', 'check') */
  name?: IconName | LucideIcon | React.ComponentType<any>;
  /** Backward-compatible alias for name */
  icon?: IconName | LucideIcon | React.ComponentType<any>;
  /** Backward-compatible alias for name */
  as?: IconName | LucideIcon | React.ComponentType<any>;

  /** Size token (e.g. 'xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'body'|'title') or explicit numeric size */
  size?: number | IconSizeLevel;
  /** Typography level alias for size */
  level?: IconSizeLevel;
  /** Legacy type variant alias for size */
  variant?: any;

  /** Color token tone (e.g. 'default' | 'muted' | 'primary' | 'danger' | 'success') */
  tone?: IconTone;
  /** Direct hex / rgba color override */
  color?: string | ColorValue;
  /** SVG stroke width (default: 2) */
  strokeWidth?: number;

  /** Dynamic state for stateful icons (e.g. 'open' | 'closed' | 'checked' | boolean) */
  state?: 'open' | 'closed' | 'checked' | 'unchecked' | 'active' | 'inactive' | 'copied' | string | boolean;
  /** Loading spinner state (continuous UI-thread rotation) */
  loading?: boolean;
  /** Key that triggers ring or pulse animation whenever it changes */
  pulseKey?: string | number | boolean;
  /** Explicit animation mode override */
  animate?: 'press' | 'mount' | 'none' | 'spin' | 'ring' | 'pulse' | 'auto';

  /** Degrees for rotateToggle (default: 180 for chevron, 45 for plus) */
  degrees?: number;
  /** Distance for slideNudge (default: 3dp) */
  slideDistance?: number;

  /** Container view style */
  style?: StyleProp<ViewStyle>;

  /** Accessibility */
  accessibilityLabel?: string;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';

  // Legacy compatibility props from previous Icon.tsx
  spinning?: boolean;
  anim?: 'pop' | 'nudge' | 'spin' | 'none';
}

export const Icon = memo(function Icon({
  name,
  icon,
  as,
  size,
  level,
  variant,
  tone,
  color,
  strokeWidth = 2,
  state,
  loading = false,
  pulseKey,
  animate = 'auto',
  degrees,
  slideDistance,
  style,
  accessibilityLabel,
  accessibilityElementsHidden,
  importantForAccessibility,
  spinning = false,
  anim,
}: IconProps) {
  const { theme } = useTheme();
  const { scale } = useTypeScale();

  const targetIdentifier = name || icon || as;
  const descriptor = getIconDescriptor(targetIdentifier);

  const effectiveSizeToken = size ?? level ?? variant;
  const computedSize = resolveIconSize(effectiveSizeToken, scale);
  const resolvedColor: string = String(resolveIconColor(tone, color, theme?.colors) ?? theme?.colors?.ink ?? '#171717');

  // Resolve legacy animation flags
  const effectiveLoading = loading || spinning || anim === 'spin';
  const effectiveAnimate = anim === 'spin'
    ? 'spin'
    : anim === 'nudge'
    ? 'press'
    : anim === 'none'
    ? 'none'
    : animate;

  const resolvedDegrees = degrees ?? (descriptor?.name === 'plus' ? 45 : 180);

  const behavior: IconBehaviorKey = descriptor?.defaultBehavior ?? 'static';

  const { animatedStyle, reduceMotion } = useIconBehavior({
    behavior,
    state,
    loading: effectiveLoading,
    pulseKey,
    animate: effectiveAnimate,
    degrees: resolvedDegrees,
    slideDistance,
  });

  if (!descriptor) {
    return null;
  }

  // Check for specialized morph pairs:
  // 1. Menu ↔ Close morph
  if ((descriptor.name === 'menu' || descriptor.name === 'x') && state !== undefined) {
    const isMenuOpen = descriptor.name === 'menu'
      ? (state === 'open' || state === true)
      : !(state === 'open' || state === true);

    return (
      <Animated.View
        style={[animatedStyle, style]}
        accessibilityElementsHidden={accessibilityElementsHidden ?? !accessibilityLabel}
        importantForAccessibility={importantForAccessibility ?? (!accessibilityLabel ? 'no' : 'auto')}
        accessibilityLabel={accessibilityLabel}
      >
        <MenuCloseMorph
          isOpen={isMenuOpen}
          size={computedSize}
          color={resolvedColor as any}
          strokeWidth={strokeWidth}
          reduceMotion={reduceMotion}
        />
      </Animated.View>
    );
  }

  // 2. Eye ↔ EyeOff morph
  if ((descriptor.name === 'eye' || descriptor.name === 'eye-off') && state !== undefined) {
    const isOff = descriptor.name === 'eye'
      ? (state === 'off' || state === 'closed' || state === false)
      : (state === 'on' || state === 'open' || state === true);

    return (
      <Animated.View
        style={[animatedStyle, style]}
        accessibilityElementsHidden={accessibilityElementsHidden ?? !accessibilityLabel}
        importantForAccessibility={importantForAccessibility ?? (!accessibilityLabel ? 'no' : 'auto')}
        accessibilityLabel={accessibilityLabel}
      >
        <EyeMorph
          isOff={isOff}
          size={computedSize}
          color={resolvedColor as any}
          strokeWidth={strokeWidth}
          reduceMotion={reduceMotion}
        />
      </Animated.View>
    );
  }

  // 3. Check / CheckCircle drawStroke on mount or checked state
  if (
    (descriptor.name === 'check' || descriptor.name === 'check-circle' || descriptor.name === 'check-circle2' || descriptor.name === 'check-square') &&
    (effectiveAnimate === 'mount' || state === 'checked' || state === true)
  ) {
    const checkVariant = descriptor.name.includes('circle')
      ? 'circle-check'
      : descriptor.name.includes('square')
      ? 'square-check'
      : 'check';

    return (
      <Animated.View
        style={[animatedStyle, style]}
        accessibilityElementsHidden={accessibilityElementsHidden ?? !accessibilityLabel}
        importantForAccessibility={importantForAccessibility ?? (!accessibilityLabel ? 'no' : 'auto')}
        accessibilityLabel={accessibilityLabel}
      >
        <AnimatedDrawCheck
          size={computedSize}
          color={resolvedColor as any}
          strokeWidth={strokeWidth}
          variant={checkVariant}
          reduceMotion={reduceMotion}
        />
      </Animated.View>
    );
  }

  const Glyph = descriptor.Static;

  return (
    <Animated.View
      style={[animatedStyle, style]}
      accessibilityElementsHidden={accessibilityElementsHidden ?? !accessibilityLabel}
      importantForAccessibility={importantForAccessibility ?? (!accessibilityLabel ? 'no' : 'auto')}
      accessibilityLabel={accessibilityLabel}
    >
      <Glyph
        size={computedSize}
        color={resolvedColor}
        strokeWidth={strokeWidth}
      />
    </Animated.View>
  );
});
