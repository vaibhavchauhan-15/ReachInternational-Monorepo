/**
 * ReachInternational Mobile — Press Feedback Matrix
 * Centralized mapping of component variants to Android RenderThread ripple,
 * spring press scale, and semantic haptics.
 */

import { radiusNumeric } from '@reachinternational/design-tokens';
import type { SemanticHapticKind } from '../../../lib/haptics';

export type TouchVariant =
  | 'buttonPrimary'
  | 'buttonSecondary'
  | 'buttonDanger'
  | 'buttonOutline'
  | 'buttonGhost'
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'outline'
  | 'ghost'
  | 'icon'
  | 'iconButton'
  | 'listRow'
  | 'card'
  | 'cardSelect'
  | 'navTab'
  | 'toggle'
  | 'segmentedOption'
  | 'chip'
  | 'fab'
  | 'longPressRow'
  | 'plain';

export interface TouchFeedbackConfig {
  rippleColor: string;
  borderless: boolean;
  radius?: number;
  scale: number;
  defaultHaptic?: SemanticHapticKind;
  foreground: boolean;
}

/**
 * Derives ripple color from theme according to Material 3 Expressive guidelines:
 * Light mode: ~10-12% on-surface ink overlay
 * Dark mode: ~14-16% on-surface elevated overlay
 */
export function getRippleColor(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(23, 23, 23, 0.10)';
}

/**
 * Resolves touch feedback parameters for any component class.
 */
export function getTouchFeedback(
  variant: TouchVariant = 'card',
  isDark: boolean = false,
  overrideRadius?: number
): TouchFeedbackConfig {
  const rippleColor = getRippleColor(isDark);

  switch (variant) {
    case 'primary':
    case 'buttonPrimary':
    case 'secondary':
    case 'buttonSecondary':
    case 'danger':
    case 'buttonDanger':
    case 'outline':
    case 'buttonOutline':
    case 'ghost':
    case 'buttonGhost':
      return {
        rippleColor,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        scale: 0.98,
        defaultHaptic: undefined, // Result haptic (confirm/reject) comes from submit result
        foreground: true,
      };

    case 'icon':
    case 'iconButton':
      return {
        rippleColor,
        borderless: true,
        radius: 24,
        scale: 1.0,
        defaultHaptic: undefined,
        foreground: false,
      };

    case 'listRow':
      return {
        rippleColor,
        borderless: false,
        scale: 1.0,
        defaultHaptic: undefined,
        foreground: true,
      };

    case 'card':
      return {
        rippleColor,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.lg,
        scale: 1.0,
        defaultHaptic: undefined,
        foreground: true,
      };

    case 'cardSelect':
      return {
        rippleColor,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.lg,
        scale: 1.0,
        defaultHaptic: 'select',
        foreground: true,
      };

    case 'navTab':
      return {
        rippleColor,
        borderless: false,
        radius: radiusNumeric.full,
        scale: 1.0,
        defaultHaptic: 'tap',
        foreground: true,
      };

    case 'toggle':
      return {
        rippleColor,
        borderless: true,
        radius: 20,
        scale: 1.0,
        defaultHaptic: 'toggleOn',
        foreground: false,
      };

    case 'segmentedOption':
    case 'chip':
      return {
        rippleColor,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.full,
        scale: 1.0,
        defaultHaptic: 'select',
        foreground: true,
      };

    case 'fab':
      return {
        rippleColor,
        borderless: false,
        radius: radiusNumeric.full,
        scale: 0.97,
        defaultHaptic: undefined, // Action result haptic only
        foreground: true,
      };

    case 'longPressRow':
      return {
        rippleColor,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        scale: 0.98,
        defaultHaptic: 'longPress',
        foreground: true,
      };

    case 'plain':
    default:
      return {
        rippleColor: 'transparent',
        borderless: false,
        scale: 1.0,
        defaultHaptic: undefined,
        foreground: false,
      };
  }
}
