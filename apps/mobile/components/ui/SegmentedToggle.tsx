import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface SegmentedToggleItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
  disabled?: boolean;
}

export type SegmentedToggleSize = 'sm' | 'md';

export interface SegmentedToggleProps<T extends string = string> {
  items: SegmentedToggleItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedToggleSize;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function SegmentedToggle<T extends string = string>({
  items,
  value,
  onChange,
  size = 'sm',
  fullWidth = true,
  style,
}: SegmentedToggleProps<T>) {
  const { theme, isDark } = useTheme();

  const handleSelect = async (item: SegmentedToggleItem<T>) => {
    if (item.disabled || item.id === value) return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore
    }
    onChange(item.id);
  };

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === value;

        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleSelect(item)}
            disabled={item.disabled}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: Boolean(item.disabled) }}
            accessibilityLabel={item.label}
            style={[
              styles.item,
              isSmall ? styles.itemSm : styles.itemMd,
              isActive && [
                styles.itemActive,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ],
              item.disabled && styles.itemDisabled,
            ]}
          >
            {item.icon && (
              <View style={styles.iconWrap}>
                {item.icon}
              </View>
            )}

            <Text
              style={[
                styles.label,
                isSmall ? styles.labelSm : styles.labelMd,
                {
                  color: isActive ? theme.colors.link : theme.colors.mute,
                  fontWeight: isActive ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>

            {item.count !== undefined && item.count !== null && (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isActive
                      ? isDark
                        ? 'rgba(0, 112, 243, 0.22)'
                        : 'rgba(0, 112, 243, 0.12)'
                      : theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    {
                      color: isActive ? theme.colors.link : theme.colors.body,
                    },
                  ]}
                >
                  {item.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  fullWidth: {
    width: '100%',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radiusNumeric.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 180ms ease',
      } as any,
      default: {},
    }),
  },
  itemSm: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    minHeight: 34,
  },
  itemMd: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  itemActive: {
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  itemDisabled: {
    opacity: 0.45,
  },
  iconWrap: {
    marginRight: 1,
  },
  label: {
    letterSpacing: -0.1,
  },
  labelSm: {
    fontSize: 12.5,
  },
  labelMd: {
    fontSize: 13.5,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radiusNumeric.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
