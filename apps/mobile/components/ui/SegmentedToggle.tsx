import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  type StyleProp,
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
import { radiusNumeric } from '@reachinternational/design-tokens';
import { Text } from './Text';
import { haptics } from '../../lib/haptics';

export interface SegmentedToggleItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export type SegmentedToggleSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SegmentedToggleProps<T extends string = string> {
  items?: SegmentedToggleItem<T>[];
  options?: SegmentedToggleItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedToggleSize;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
  activeColor?: string;
  accessibilityLabel?: string;
}

const SIZE_CONFIGS = {
  xs: {
    padding: 2.5,
    containerRadius: 8,
    pillRadius: 6,
    minHeight: 32,
    textVariant: 'caption' as const,
    badgeTextVariant: 'caption' as const,
    itemPaddingHorizontal: 8,
    gap: 4,
  },
  sm: {
    padding: 3,
    containerRadius: 10,
    pillRadius: 7,
    minHeight: 36,
    textVariant: 'label' as const,
    badgeTextVariant: 'caption' as const,
    itemPaddingHorizontal: 12,
    gap: 5,
  },
  md: {
    padding: 3.5,
    containerRadius: 12,
    pillRadius: 9,
    minHeight: 40,
    textVariant: 'subheading' as const,
    badgeTextVariant: 'caption' as const,
    itemPaddingHorizontal: 16,
    gap: 6,
  },
  lg: {
    padding: 4.5,
    containerRadius: 14,
    pillRadius: 10,
    minHeight: 46,
    textVariant: 'heading' as const,
    badgeTextVariant: 'label' as const,
    itemPaddingHorizontal: 18,
    gap: 8,
  },
} as const;

/**
 * Snappy, fluid spring configuration adhering to Apple HIG & Vercel Geist motion standards.
 * Eliminates sluggish overshoot while preserving organic fluidity.
 */
const SPRING_CONFIG = {
  stiffness: 440,
  damping: 34,
  mass: 0.8,
} as const;

// ---------------------------------------------------------------------------
// Pure, Memoized Individual Segment Item
// Prevents re-rendering untouched segments when switching between two tabs.
// ---------------------------------------------------------------------------
interface SegmentItemProps<T extends string = string> {
  item: SegmentedToggleItem<T>;
  index: number;
  isActive: boolean;
  onSelect: (item: SegmentedToggleItem<T>, index: number) => void;
  config: (typeof SIZE_CONFIGS)[SegmentedToggleSize];
  fullWidth: boolean;
  isDark: boolean;
  itemStyle?: StyleProp<ViewStyle>;
  resolvedActiveColor: string;
  inactiveTextColor: string;
  showFallbackPill: boolean;
  onMeasure?: (index: number, x: number, width: number) => void;
}

function BaseSegmentItem<T extends string = string>({
  item,
  index,
  isActive,
  onSelect,
  config,
  fullWidth,
  isDark,
  itemStyle,
  resolvedActiveColor,
  inactiveTextColor,
  showFallbackPill,
  onMeasure,
}: SegmentItemProps<T>) {
  const handlePress = useCallback(() => {
    onSelect(item, index);
  }, [item, index, onSelect]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!onMeasure) return;
      const { x, width } = e.nativeEvent.layout;
      onMeasure(index, x, width);
    },
    [index, onMeasure]
  );

  return (
    <Pressable
      onLayout={fullWidth ? undefined : handleLayout}
      onPress={handlePress}
      disabled={item.disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive, disabled: Boolean(item.disabled) }}
      accessibilityLabel={item.accessibilityLabel || (typeof item.label === 'string' ? item.label : undefined)}
      android_ripple={null}
      style={({ pressed }) => [
        styles.item,
        {
          minHeight: config.minHeight,
          paddingHorizontal: config.itemPaddingHorizontal,
          gap: config.gap,
          borderRadius: config.pillRadius,
          backgroundColor:
            !isActive && pressed
              ? isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.05)'
              : 'transparent',
          opacity: isActive && pressed ? 0.92 : item.disabled ? 0.38 : 1,
        },
        fullWidth ? styles.itemFullWidth : styles.itemInline,
        itemStyle,
      ]}
    >
      {/* Frame 0 fallback pill: renders instantly before container measurement occurs */}
      {showFallbackPill && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: config.pillRadius,
              backgroundColor: resolvedActiveColor,
            },
            styles.pillShadowBrand,
          ]}
        />
      )}

      {item.icon && <View style={styles.iconWrap}>{item.icon}</View>}

      {typeof item.label === 'string' ? (
        <Text
          variant={config.textVariant}
          weight={isActive ? 'semibold' : 'medium'}
          style={[
            styles.itemText,
            {
              color: isActive ? '#ffffff' : inactiveTextColor,
            },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      ) : (
        item.label
      )}

      {item.badge}

      {item.count !== undefined && item.count !== null && (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: isActive
                ? 'rgba(255, 255, 255, 0.22)'
                : isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : '#e4e4e7',
              borderColor: isActive
                ? 'rgba(255, 255, 255, 0.35)'
                : isDark
                ? 'rgba(255, 255, 255, 0.18)'
                : '#d4d4d8',
            },
          ]}
        >
          <Text
            variant={config.badgeTextVariant}
            weight={isActive ? 'semibold' : 'medium'}
            style={[
              styles.countText,
              {
                color: isActive
                  ? '#ffffff'
                  : isDark
                  ? '#f4f4f5'
                  : '#3f3f46',
              },
            ]}
          >
            {item.count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const SegmentItem = React.memo(BaseSegmentItem) as typeof BaseSegmentItem;

// ---------------------------------------------------------------------------
// Base SegmentedToggle Component
// ---------------------------------------------------------------------------
function BaseSegmentedToggle<T extends string = string>({
  items: rawItems,
  options: rawOptions,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  style,
  itemStyle,
  activeColor,
  accessibilityLabel = 'Segmented navigation toggle',
}: SegmentedToggleProps<T>) {
  const items = useMemo(() => rawItems || rawOptions || [], [rawItems, rawOptions]);
  const { isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const config = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  // Optimistic active ID: responds synchronously to touch at 0ms, eliminating selection lag
  const [selectedId, setSelectedId] = useState<T>(value);

  // Sync internal state when controlled value prop updates externally
  useEffect(() => {
    setSelectedId(value);
  }, [value]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [itemLayouts, setItemLayouts] = useState<Record<number, { x: number; width: number }>>({});

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((i) => i.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [items, selectedId]);

  // Derive target pill geometry
  const { targetX, targetWidth } = useMemo(() => {
    if (items.length === 0) return { targetX: 0, targetWidth: 0 };

    if (fullWidth && containerWidth > 0) {
      const availWidth = Math.max(0, containerWidth - config.padding * 2);
      const tabW = availWidth / items.length;
      return {
        targetX: config.padding + activeIndex * tabW,
        targetWidth: tabW,
      };
    }

    const measured = itemLayouts[activeIndex];
    if (measured && measured.width > 0) {
      return { targetX: measured.x, targetWidth: measured.width };
    }

    if (containerWidth > 0) {
      const availWidth = Math.max(0, containerWidth - config.padding * 2);
      const tabW = availWidth / items.length;
      return {
        targetX: config.padding + activeIndex * tabW,
        targetWidth: tabW,
      };
    }

    return { targetX: 0, targetWidth: 0 };
  }, [items.length, itemLayouts, activeIndex, containerWidth, config.padding, fullWidth]);

  // Reanimated shared values for high-frequency 60/120fps GPU sliding pill animation
  const animX = useSharedValue(0);
  const animWidth = useSharedValue(0);
  const isInitializedRef = useRef(false);
  const lastAnimatedIndexRef = useRef<number>(-1);

  // Synchronize indicator position on dimension changes or external value changes
  useEffect(() => {
    if (targetWidth <= 0) return;

    if (!isInitializedRef.current) {
      animX.value = targetX;
      animWidth.value = targetWidth;
      isInitializedRef.current = true;
      lastAnimatedIndexRef.current = activeIndex;
      return;
    }

    // Only animate if this target hasn't already been animated synchronously by handleSelect
    if (lastAnimatedIndexRef.current !== activeIndex) {
      if (reduceMotion) {
        animX.value = targetX;
        animWidth.value = targetWidth;
      } else {
        animX.value = withSpring(targetX, SPRING_CONFIG);
        if (Math.abs(animWidth.value - targetWidth) > 1) {
          animWidth.value = withSpring(targetWidth, SPRING_CONFIG);
        }
      }
      lastAnimatedIndexRef.current = activeIndex;
    } else if (Math.abs(animWidth.value - targetWidth) > 1) {
      // Container resized or orientation changed: snap width and position cleanly
      animWidth.value = targetWidth;
      animX.value = targetX;
    }
  }, [targetX, targetWidth, activeIndex, reduceMotion, animX, animWidth]);

  // High-performance animated style: animates purely on UI thread via transform matrix
  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animX.value }],
    width: animWidth.value,
  }));

  const handleSelect = useCallback(
    (item: SegmentedToggleItem<T>, index: number) => {
      if (item.disabled || item.id === selectedId) return;

      try {
        haptics.select();
      } catch {
        // Haptics safe fallback for web/unsupported environments
      }

      // 1. Optimistic immediate visual highlight on touch (0ms)
      setSelectedId(item.id);

      // 2. Eagerly glide pill on UI thread immediately
      if (fullWidth && containerWidth > 0) {
        const availWidth = Math.max(0, containerWidth - config.padding * 2);
        const tabW = availWidth / items.length;
        const nextX = config.padding + index * tabW;

        if (reduceMotion) {
          animX.value = nextX;
          animWidth.value = tabW;
        } else {
          animX.value = withSpring(nextX, SPRING_CONFIG);
          // In fullWidth, width is identical across segments, so avoid width oscillation layout passes
          animWidth.value = tabW;
        }
        lastAnimatedIndexRef.current = index;
      } else if (itemLayouts[index]) {
        const measured = itemLayouts[index];
        if (reduceMotion) {
          animX.value = measured.x;
          animWidth.value = measured.width;
        } else {
          animX.value = withSpring(measured.x, SPRING_CONFIG);
          if (Math.abs(animWidth.value - measured.width) > 1) {
            animWidth.value = withSpring(measured.width, SPRING_CONFIG);
          }
        }
        lastAnimatedIndexRef.current = index;
      }

      // 3. Dispatch change callback to parent
      onChange(item.id);
    },
    [selectedId, fullWidth, containerWidth, config.padding, items.length, reduceMotion, animX, animWidth, itemLayouts, onChange]
  );

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 0.5) {
      setContainerWidth(w);
    }
  }, [containerWidth]);

  const handleMeasureItem = useCallback((index: number, x: number, width: number) => {
    setItemLayouts((prev) => {
      if (prev[index]?.x === x && prev[index]?.width === width) return prev;
      return { ...prev, [index]: { x, width } };
    });
  }, []);

  if (!items || items.length === 0) return null;

  const resolvedActiveColor = activeColor || (isDark ? '#0ea5e9' : '#0284c7');
  const inactiveTextColor = isDark ? '#a1a1aa' : '#52525b';

  return (
    <View
      onLayout={handleContainerLayout}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          padding: config.padding,
          borderRadius: config.containerRadius,
          minHeight: config.minHeight + config.padding * 2,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f4f4f5',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e4e7',
        },
        fullWidth ? styles.fullWidth : styles.inline,
        style,
      ]}
    >
      {/* 1. SLIDING ACTIVE INDICATOR PILL (Smooth GPU-accelerated spring glide on Native & Web) */}
      {containerWidth > 0 && targetWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            {
              top: config.padding,
              bottom: config.padding,
              borderRadius: config.pillRadius,
              backgroundColor: resolvedActiveColor,
              borderColor: resolvedActiveColor,
            },
            styles.pillShadowBrand,
            pillAnimatedStyle,
          ]}
        />
      )}

      {/* 2. TAB ITEMS */}
      {items.map((item, index) => {
        const isActive = item.id === selectedId;
        const showFallbackPill = isActive && containerWidth === 0;

        return (
          <SegmentItem
            key={item.id}
            item={item}
            index={index}
            isActive={isActive}
            onSelect={handleSelect}
            config={config}
            fullWidth={fullWidth}
            isDark={isDark}
            itemStyle={itemStyle}
            resolvedActiveColor={resolvedActiveColor}
            inactiveTextColor={inactiveTextColor}
            showFallbackPill={showFallbackPill}
            onMeasure={fullWidth ? undefined : handleMeasureItem}
          />
        );
      })}
    </View>
  );
}

/**
 * Custom shallow equality comparator for SegmentedToggle.
 * Ensures the component only re-renders when relevant props or item attributes change,
 * shielding it from parent re-render storms.
 */
function areSegmentedTogglePropsEqual<T extends string = string>(
  prev: SegmentedToggleProps<T>,
  next: SegmentedToggleProps<T>
): boolean {
  if (prev.value !== next.value) return false;
  if (prev.size !== next.size) return false;
  if (prev.fullWidth !== next.fullWidth) return false;
  if (prev.activeColor !== next.activeColor) return false;
  if (prev.accessibilityLabel !== next.accessibilityLabel) return false;
  if (prev.onChange !== next.onChange) return false;
  if (prev.style !== next.style) return false;
  if (prev.itemStyle !== next.itemStyle) return false;

  const prevItems = prev.items || prev.options || [];
  const nextItems = next.items || next.options || [];

  if (prevItems.length !== nextItems.length) return false;

  for (let i = 0; i < prevItems.length; i++) {
    const p = prevItems[i];
    const n = nextItems[i];
    if (
      p.id !== n.id ||
      p.label !== n.label ||
      p.count !== n.count ||
      p.disabled !== n.disabled ||
      p.icon !== n.icon ||
      p.badge !== n.badge
    ) {
      return false;
    }
  }

  return true;
}

export const SegmentedToggle = React.memo(
  BaseSegmentedToggle,
  areSegmentedTogglePropsEqual
) as typeof BaseSegmentedToggle;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  inline: {
    alignSelf: 'flex-start',
  },
  slidingPill: {
    position: 'absolute',
    left: 0,
    borderWidth: 1,
    zIndex: 0,
    ...Platform.select({
      web: {
        willChange: 'transform',
      } as any,
      default: {},
    }),
  },
  pillShadowBrand: {
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
      } as any,
      default: {
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.32,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
        outlineStyle: 'none',
      } as any,
      default: {},
    }),
  },
  itemFullWidth: {
    flex: 1,
    flexBasis: 0,
    width: '100%',
  },
  itemInline: {
    flexGrow: 0,
    flexShrink: 0,
  },
  itemText: {
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    borderRadius: radiusNumeric.full,
    paddingHorizontal: 6.5,
    paddingVertical: 1,
    borderWidth: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    textAlign: 'center',
  },
});
