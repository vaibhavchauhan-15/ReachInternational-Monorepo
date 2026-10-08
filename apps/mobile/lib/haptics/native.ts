/**
 * ReachInternational Mobile — Native Haptics Binding
 * Thin binding to ReachHaptics Expo module with defensive fallback.
 */

import { Platform } from 'react-native';
import ReachHaptics from '../../modules/reach-haptics';

export function performNativeHaptic(kind: string): boolean {
  if (Platform.OS !== 'android') return false;
  if (!ReachHaptics || typeof ReachHaptics.perform !== 'function') return false;
  try {
    return !!ReachHaptics.perform(kind);
  } catch {
    return false;
  }
}

export function isNativeHapticsSupported(): boolean {
  return Platform.OS === 'android' && !!ReachHaptics && typeof ReachHaptics.perform === 'function';
}
