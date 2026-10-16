/**
 * ReachInternational Mobile — Press Feedback Matrix
 * Centralized mapping of component variants to Android RenderThread ripple,
 * subtle state layers, active opacity, and semantic haptics.
 * Adheres to Material Design 3 and iOS Human Interface Guidelines.
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
  | 'dropdownOption'
  | 'selectorOption'
  | 'card'
  | 'cardSelect'
  | 'kpiCard'
  | 'navTab'
  | 'toggle'
  | 'segmentedOption'
  | 'chip'
  | 'fab'
  | 'longPressRow'
  | 'plain';

export interface TouchFeedbackConfig {
  /** Android RenderThread ripple color */
  rippleColor: string;
  /** Android ripple borderless: true for circular / unbounded touches */
  borderless: boolean;
  /** Android ripple radius in dp */
  radius?: number;
  /** Android ripple foreground rendering: true for cards and solid buttons */
  foreground: boolean;
  /** iOS & Web active opacity on touch down (1.0 = no opacity change) */
  activeOpacity: number;
  /** UI-thread Reanimated micro-scale (1.0 = no scale transformation) */
  scale: number;
  /** Optional background tint applied during press on iOS / Web */
  pressedBackgroundColor?: string;
  /** Semantic haptic kind triggered on press */
  defaultHaptic?: SemanticHapticKind;
}

/**
 * Derives ripple color from theme according to Material 3 Expressive guidelines:
 * Light mode: ~8-10% on-surface ink overlay
 * Dark mode: ~12-14% on-surface elevated overlay
 */
export function getRippleColor(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(23, 23, 23, 0.08)';
}

/**
 * Resolves touch feedback parameters for any component class.
 */
export function getTouchFeedback(
  variant: TouchVariant = 'card',
  isDark: boolean = false,
  overrideRadius?: number
): TouchFeedbackConfig {
  const surfaceRipple = getRippleColor(isDark);

  switch (variant) {
    case 'primary':
    case 'buttonPrimary':
      return {
        // High contrast white ripple over primary blue (#0284c7 / #0ea5e9): rgba(255, 255, 255, 0.22)
        rippleColor: 'rgba(255, 255, 255, 0.22)',
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.88,
        scale: 0.98,
        defaultHaptic: undefined,
      };

    case 'danger':
    case 'buttonDanger':
      return {
        // High contrast white ripple over destructive red (#ee0000 / #dc2626): rgba(255, 255, 255, 0.22)
        rippleColor: 'rgba(255, 255, 255, 0.22)',
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.88,
        scale: 0.98,
        defaultHaptic: undefined,
      };

    case 'secondary':
    case 'buttonSecondary':
      return {
        // Standard surface ripple: rgba(23, 23, 23, 0.08) / rgba(255, 255, 255, 0.12)
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.85,
        scale: 0.98,
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 23, 23, 0.06)',
        defaultHaptic: undefined,
      };

    case 'outline':
    case 'buttonOutline':
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.82,
        scale: 0.98,
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(23, 23, 23, 0.05)',
        defaultHaptic: undefined,
      };

    case 'ghost':
    case 'buttonGhost':
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.75,
        scale: 0.98,
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 23, 23, 0.06)',
        defaultHaptic: undefined,
      };

    case 'icon':
    case 'iconButton':
      return {
        rippleColor: surfaceRipple,
        borderless: true,
        radius: overrideRadius ?? 22,
        foreground: false,
        activeOpacity: 0.70,
        scale: 1.0, // Zero distortion of icon glyphs
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(23, 23, 23, 0.08)',
        defaultHaptic: undefined,
      };

    case 'card':
    case 'kpiCard':
      return {
        // Elevated surface ripple: rgba(255, 255, 255, 0.08) / rgba(23, 23, 23, 0.05)
        rippleColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 23, 23, 0.05)',
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.lg,
        foreground: true,
        activeOpacity: 0.78,
        scale: 1.0, // Strictly 1.0: zero layout shift, zero text blurring, zero shadow clipping
        pressedBackgroundColor: undefined,
        defaultHaptic: undefined,
      };

    case 'cardSelect':
      return {
        // Tinted state layer: rgba(14, 165, 233, 0.16) / rgba(2, 132, 199, 0.10)
        rippleColor: isDark ? 'rgba(14, 165, 233, 0.16)' : 'rgba(2, 132, 199, 0.10)',
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.lg,
        foreground: true,
        activeOpacity: 0.78,
        scale: 1.0,
        defaultHaptic: 'select',
      };

    case 'listRow':
    case 'dropdownOption':
    case 'selectorOption':
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.sm,
        foreground: true,
        activeOpacity: 0.85,
        scale: 1.0, // Preserves dense list alignment
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(23, 23, 23, 0.04)',
        defaultHaptic: variant === 'listRow' ? undefined : 'select',
      };

    case 'navTab':
      return {
        // Tab indicator tint: rgba(14, 165, 233, 0.16) / rgba(2, 132, 199, 0.12)
        // Outer button ripple set to transparent to eradicate rectangular full-item Android highlight.
        // Single clean press feedback is rendered strictly within the inner icon pill container.
        rippleColor: 'transparent',
        borderless: true,
        radius: 24,
        foreground: false,
        activeOpacity: 1.0,
        scale: 1.0,
        pressedBackgroundColor: undefined,
        defaultHaptic: 'tap',
      };

    case 'toggle':
      return {
        rippleColor: isDark ? 'rgba(14, 165, 233, 0.20)' : 'rgba(2, 132, 199, 0.15)',
        borderless: true,
        radius: 20,
        foreground: false,
        activeOpacity: 0.90,
        scale: 1.0,
        defaultHaptic: 'toggleOn',
      };

    case 'segmentedOption':
      return {
        rippleColor: 'transparent',
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.full,
        foreground: false,
        activeOpacity: 0.85,
        scale: 1.0,
        pressedBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        defaultHaptic: 'select',
      };

    case 'chip':
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.full,
        foreground: true,
        activeOpacity: 0.85,
        scale: 1.0,
        defaultHaptic: 'select',
      };

    case 'fab':
      return {
        rippleColor: 'rgba(255, 255, 255, 0.22)',
        borderless: false,
        radius: radiusNumeric.full,
        foreground: true,
        activeOpacity: 0.88,
        scale: 0.96,
        defaultHaptic: undefined,
      };

    case 'longPressRow':
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        radius: overrideRadius ?? radiusNumeric.md,
        foreground: true,
        activeOpacity: 0.88,
        scale: 1.0,
        defaultHaptic: 'longPress',
      };

    case 'plain':
    default:
      return {
        rippleColor: surfaceRipple,
        borderless: false,
        foreground: false,
        activeOpacity: 0.88,
        scale: 1.0,
        defaultHaptic: undefined,
      };
  }
}
