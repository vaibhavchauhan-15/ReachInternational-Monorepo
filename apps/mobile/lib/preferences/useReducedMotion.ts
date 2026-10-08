/**
 * ReachInternational Mobile — System Reduced Motion Hook
 * Resolves system animator scale / AccessibilityInfo into a boolean flag.
 * Respects OS settings without manual in-app override.
 */

import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

let systemReducedMotionSync = false;

// Initialize and listen to system accessibility reduce motion changes
if (typeof AccessibilityInfo?.isReduceMotionEnabled === 'function') {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      systemReducedMotionSync = !!enabled;
    })
    .catch(() => {});

  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    systemReducedMotionSync = !!enabled;
  });
}

/**
 * Returns whether reduced motion is active according to device OS settings.
 * First consults Reanimated's worklet-aware hook, falling back to AccessibilityInfo.
 */
export function useReducedMotion(): boolean {
  try {
    const reanimatedValue = useReanimatedReducedMotion();
    return reanimatedValue ?? systemReducedMotionSync;
  } catch {
    const [reducedMotion, setReducedMotion] = useState(systemReducedMotionSync);

    useEffect(() => {
      let isMounted = true;
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (isMounted) setReducedMotion(!!enabled);
        })
        .catch(() => {});

      const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (isMounted) setReducedMotion(!!enabled);
      });

      return () => {
        isMounted = false;
        sub.remove();
      };
    }, []);

    return reducedMotion;
  }
}

/**
 * Synchronous snapshot of system reduced motion setting for non-hook logic
 */
export function isReducedMotionActive(): boolean {
  return systemReducedMotionSync;
}
