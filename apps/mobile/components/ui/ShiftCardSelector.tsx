/**
 * ReachInternational Mobile — Canonical Reusable ShiftCardSelector
 * Matches web ShiftCardSelector with instant response and smooth sliding animation.
 * Features:
 * - Segmented sliding pill selector with Reanimated 60fps spring transitions
 * - Instant 0ms switch upon touch with tactile haptics
 * - High-contrast active state and subtle inactive state
 * - Clean Shift A / Shift B / Shift C badge options (no cluttered time ranges)
 * - 44px minimum touch targets conforming to Apple HIG and Google Material 3
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from './ThemeProvider';
import { Moon } from './icon';
import { formatTo12Hour, getShiftDisplayTitle } from '@reachinternational/utils';
import { Text } from './Text';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

export interface ShiftCardItem {
  id?: string;
  code: string;
  name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  crosses_midnight?: boolean | null;
  scheduled_minutes?: number | null;
  [key: string]: any;
}

export interface ShiftCardSelectorProps {
  shiftCodes: ShiftCardItem[];
  selectedCode?: string;
  onSelect: (shift: ShiftCardItem) => void;
  todayLoggedShiftCodes?: string[];
  isConflicting?: (code: string) => boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export function formatCompactTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const formatted = formatTo12Hour(timeStr) || timeStr;
  return formatted.trim().replace(/^0(\d:)/, '$1').replace(/\s+(AM|PM)$/i, '$1');
}

export function formatCompactShiftRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '';
  const s = formatCompactTime(start);
  const e = formatCompactTime(end);
  if (s && e) return `${s}-${e}`;
  return s || e || '';
}

export function resolveShiftTimeRange(sc?: ShiftCardItem | null): string {
  if (!sc) return '';
  const range = formatCompactShiftRange(sc.start_time || sc.raw_start_time, sc.end_time || sc.raw_end_time);
  if (range) return range;
  const c = (sc.code || '').replace(/^shift\s+/i, '').trim().toUpperCase();
  if (c === 'S1' || c === 'A') return '6:00AM-2:00PM';
  if (c === 'S2' || c === 'B') return '2:00PM-10:00PM';
  if (c === 'S3' || c === 'C') return '10:00PM-6:00AM';
  return '';
}

export { getShiftDisplayTitle } from '@reachinternational/utils';

export function formatShiftBadgeTitle(sc: { code: string; name?: string | null }): string {
  if (sc.name && /^shift\s+[a-z0-9]/i.test(sc.name)) {
    return sc.name;
  }
  const code = (sc.code || '').trim().toUpperCase();
  if (code === 'S1' || code === 'A' || code === 'SHIFT A' || code === 'SHIFT-A') return 'Shift A';
  if (code === 'S2' || code === 'B' || code === 'SHIFT B' || code === 'SHIFT-B') return 'Shift B';
  if (code === 'S3' || code === 'C' || code === 'SHIFT C' || code === 'SHIFT-C') return 'Shift C';
  if (/^shift\s+/i.test(sc.code)) return sc.code;
  return `Shift ${sc.code}`;
}

export const ShiftCardSelector: React.FC<ShiftCardSelectorProps> = ({
  shiftCodes,
  selectedCode,
  onSelect,
  todayLoggedShiftCodes = [],
  isConflicting,
  disabled = false,
  containerStyle,
}) => {
  const { theme, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = useMemo(() => {
    if (!shiftCodes || shiftCodes.length === 0) return 0;
    const selNorm = (selectedCode || '').replace(/^shift\s+/i, '').trim().toUpperCase();
    const idx = shiftCodes.findIndex((sc) => {
      const scNorm = sc.code.replace(/^shift\s+/i, '').trim().toUpperCase();
      return (
        (selectedCode || '').toUpperCase() === sc.code.toUpperCase() ||
        (selNorm !== '' && selNorm === scNorm)
      );
    });
    return idx >= 0 ? idx : 0;
  }, [shiftCodes, selectedCode]);

  const activeShift = shiftCodes[activeIndex] || shiftCodes[0];
  const isLogged = activeShift
    ? todayLoggedShiftCodes.some(
        (c) =>
          c.toUpperCase() === activeShift.code.toUpperCase() ||
          c.replace(/^shift\s+/i, '').trim().toUpperCase() ===
            activeShift.code.replace(/^shift\s+/i, '').trim().toUpperCase()
      )
    : false;
  const hasConflict = isConflicting && activeShift ? Boolean(isConflicting(activeShift.code)) : false;

  const activePillColor = hasConflict ? '#ef4444' : isLogged ? '#059669' : '#0284c7';

  // Calculate pill geometry
  const padding = 3;
  const totalOptions = shiftCodes.length || 1;
  const itemWidth = containerWidth > 0 ? (containerWidth - padding * 2) / totalOptions : 0;

  const animX = useSharedValue(0);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (itemWidth <= 0) return;
    const targetX = padding + activeIndex * itemWidth;
    if (!isInitialized.current) {
      animX.value = targetX;
      isInitialized.current = true;
    } else {
      if (reduceMotion) {
        animX.value = targetX;
      } else {
        animX.value = withSpring(targetX, {
          stiffness: 450,
          damping: 34,
          mass: 1,
        });
      }
    }
  }, [activeIndex, itemWidth, reduceMotion]);

  const pillAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: animX.value }],
      width: Math.max(0, itemWidth),
    };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  const handlePress = (sc: ShiftCardItem, idx: number) => {
    if (disabled) return;
    try {
      haptics.select();
    } catch {
      // Haptics safe fallback
    }

    // Eagerly animate pill immediately on tap for instant 0ms response and buttery smooth 60fps sliding
    if (itemWidth > 0) {
      const nextX = padding + idx * itemWidth;
      if (reduceMotion) {
        animX.value = nextX;
      } else {
        animX.value = withSpring(nextX, {
          stiffness: 450,
          damping: 34,
          mass: 1,
        });
      }
    }
    onSelect(sc);
  };

  if (!shiftCodes || shiftCodes.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
          borderColor: theme.colors.hairline,
        },
        containerStyle,
      ]}
    >
      {/* 60fps Reanimated Sliding Indicator Pill with Smooth Spring Physics */}
      {containerWidth > 0 && itemWidth > 0 && (
        <Animated.View
          style={[
            styles.animatedPill,
            {
              backgroundColor: activePillColor,
            },
            pillAnimatedStyle,
          ]}
        />
      )}

      {/* Shift Option Buttons */}
      {shiftCodes.map((sc, idx) => {
        const isSelected = idx === activeIndex;
        const displayTitle = formatShiftBadgeTitle(sc);
        const timeRange = resolveShiftTimeRange(sc);
        const itemIsLogged = todayLoggedShiftCodes.some(
          (c) =>
            c.toUpperCase() === sc.code.toUpperCase() ||
            c.replace(/^shift\s+/i, '').trim().toUpperCase() ===
              sc.code.replace(/^shift\s+/i, '').trim().toUpperCase()
        );

        return (
          <Pressable
            key={sc.id || sc.code}
            variant="segmentedOption"
            haptic="select"
            onPress={() => handlePress(sc, idx)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${displayTitle}${timeRange ? ` (${timeRange})` : ''}`}
            style={[styles.optionBtn, { opacity: disabled ? 0.6 : 1 }]}
          >
            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <Text
                  variant="label"
                  numberOfLines={1}
                  style={[
                    styles.optionText,
                    {
                      color: isSelected
                        ? '#ffffff'
                        : isDark
                        ? '#cbd5e1'
                        : '#334155',
                    },
                  ]}
                >
                  {itemIsLogged ? `✓ ${displayTitle}` : displayTitle}
                </Text>
                {sc.crosses_midnight && (
                  <Moon
                    size={10}
                    color={isSelected ? '#ffffff' : theme.colors.mute}
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
              {isSelected && timeRange ? (
                <Text
                  variant="micro"
                  numberOfLines={1}
                  style={[
                    styles.timeText,
                    {
                      color: 'rgba(255, 255, 255, 0.72)',
                    },
                  ]}
                >
                  {timeRange}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    padding: 3,
    minHeight: 52,
    width: '100%',
    overflow: 'hidden',
  },
  animatedPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 23,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px -2px rgba(2, 132, 199, 0.4)',
        willChange: 'transform',
      } as any,
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  optionBtn: {
    flex: 1,
    minHeight: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    borderRadius: 23,
    paddingHorizontal: 6,
    paddingVertical: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    textAlign: 'center',
  },
  timeText: {
    textAlign: 'center',
    marginTop: 1,
  },
});
