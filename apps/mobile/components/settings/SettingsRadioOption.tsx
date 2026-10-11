import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '../ui/touch/Pressable';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { Check } from '../ui/icon';
import { haptics } from '../../lib/haptics';
import { radiusNumeric } from '@reachinternational/design-tokens';

export interface SettingsRadioOptionProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SettingsRadioOption({
  icon,
  title,
  description,
  selected,
  onSelect,
  disabled = false,
  style,
}: SettingsRadioOptionProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (disabled || selected) return;
    haptics.select();
    onSelect();
  };

  const selectedBg = isDark
    ? 'rgba(2, 132, 199, 0.12)'
    : 'rgba(2, 132, 199, 0.08)';

  return (
    <Pressable
      variant="listRow"
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[
        styles.container,
        selected && { backgroundColor: selectedBg },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: selected
                ? isDark
                  ? 'rgba(2, 132, 199, 0.25)'
                  : '#e0f2fe'
                : isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : '#f4f4f5',
            },
          ]}
        >
          {icon}
        </View>
      ) : null}

      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          style={[
            styles.title,
            {
              color: selected ? theme.colors.link : theme.colors.ink,
            },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            variant="caption"
            style={[styles.description, { color: theme.colors.mute }]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.radioCircle,
          {
            borderColor: selected ? theme.colors.link : theme.colors.hairline,
            backgroundColor: selected ? theme.colors.link : 'transparent',
          },
        ]}
      >
        {selected ? <Check size={12} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderRadius: radiusNumeric.md,
  },
  disabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    flexShrink: 1,
  },
  description: {
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
