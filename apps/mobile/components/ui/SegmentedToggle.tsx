import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
  ReduceMotion,
} from 'react-native-reanimated';
import { SPATIAL, DUR } from '../../lib/motion/tokens';
import { useTheme } from './ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';
import { Text } from './Text';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

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
  items: SegmentedToggleItem<T>[];
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
    padding: 4,
    containerRadius: 14,
    pillRadius: 10,
    minHeight: 40,
    textVariant: 'subheading' as const,
    badgeTextVariant: 'caption' as const,
    itemPaddingHorizontal: 16,
    gap: 6,
  },
  lg: {
    padding: 5,
    containerRadius: 16,
    pillRadius: 12,
    minHeight: 46,
    textVariant: 'heading' as const,
    badgeTextVariant: 'label' as const,
    itemPaddingHorizontal: 18,
    gap: 8,
  },
} as const;

export function SegmentedToggle<T extends string = string>({
  items,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  style,
  itemStyle,
  activeColor,
  accessibilityLabel = 'Segmented navigation toggle',
}: SegmentedToggleProps<T>) {
  const { theme, isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const config = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const [containerWidth, setContainerWidth] = useState(0);
  const [itemLayouts, setItemLayouts] = useState<Record<number, { x: number; width: number }>>({});

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((i) => i.id === value);
    return idx >= 0 ? idx : 0;
  }, [items, value]);

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

  // Reanimated shared values for high-frequency 60fps sliding pill animation
  const animX = useSharedValue(0);
  const animWidth = useSharedValue(0);
  const animOpacity = useSharedValue(1);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (targetWidth <= 0) return;

    if (!isInitialized.current) {
      animX.value = targetX;
      animWidth.value = targetWidth;
      animOpacity.value = 1;
      isInitialized.current = true;
    } else {
      if (reduceMotion) {
        animX.value = targetX;
        animWidth.value = targetWidth;
      } else {
        animX.value = withSpring(targetX, {
          stiffness: 450,
          damping: 32,
          mass: 1,
        });
        animWidth.value = withSpring(targetWidth, {
          stiffness: 450,
          damping: 32,
          mass: 1,
        });
      }
    }
  }, [targetX, targetWidth, reduceMotion, animX, animWidth, animOpacity]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animX.value }],
    width: animWidth.value,
    opacity: animOpacity.value,
  }));

  const handleSelect = (item: SegmentedToggleItem<T>) => {
    if (item.disabled || item.id === value) return;
    try {
      haptics.select();
    } catch {
      // Haptics unavailable on some browser environments
    }
    onChange(item.id);
  };

  if (!items || items.length === 0) return null;

  const resolvedActiveColor = activeColor || '#0284c7';
  const inactiveTextColor = isDark ? '#a1a1aa' : '#52525b';

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - containerWidth) > 0.5) {
          setContainerWidth(w);
        }
      }}
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
      {/* 1. SLIDING ACTIVE INDICATOR PILL (iOS / Android Native) */}
      {Platform.OS !== 'web' && (
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
        const isActive = item.id === value;

        return (
          <Pressable
            key={item.id}
            variant="segmentedOption"
            haptic={false}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setItemLayouts((prev) => {
                if (prev[index]?.x === x && prev[index]?.width === width) return prev;
                return { ...prev, [index]: { x, width } };
              });
            }}
            onPress={() => handleSelect(item)}
            disabled={item.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: Boolean(item.disabled) }}
            accessibilityLabel={item.accessibilityLabel || (typeof item.label === 'string' ? item.label : undefined)}
            style={[
              styles.item,
              {
                minHeight: config.minHeight,
                paddingHorizontal: config.itemPaddingHorizontal,
                gap: config.gap,
                borderRadius: config.pillRadius,
              },
              Platform.OS === 'web' && isActive && {
                backgroundColor: resolvedActiveColor,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              } as any,
              fullWidth ? styles.itemFullWidth : styles.itemInline,
              item.disabled && styles.itemDisabled,
              itemStyle,
            ]}
          >
            {item.icon && (
              <View style={styles.iconWrap}>
                {item.icon}
              </View>
            )}

            {typeof item.label === 'string' ? (
              <Text
                variant={config.textVariant}
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
                      ? '#27272a'
                      : '#e4e4e7',
                    borderColor: isActive
                      ? 'rgba(255, 255, 255, 0.35)'
                      : isDark
                      ? '#3f3f46'
                      : '#d4d4d8',
                  },
                ]}
              >
                <Text
                  variant={config.badgeTextVariant}
                  style={[
                    styles.countText,
                    {
                      color: isActive
                        ? '#ffffff'
                        : isDark
                        ? '#d4d4d8'
                        : '#52525b',
                    },
                  ]}
                >
                  {item.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

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
  pillShadowLight: {
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.08,
        shadowRadius: 2.5,
        elevation: 2,
      },
    }),
  },
  pillShadowDark: {
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.35,
        shadowRadius: 2.5,
        elevation: 2,
      },
    }),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
  itemDisabled: {
    opacity: 0.4,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
        pointerEvents: 'none',
      } as any,
      default: {},
    }),
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
