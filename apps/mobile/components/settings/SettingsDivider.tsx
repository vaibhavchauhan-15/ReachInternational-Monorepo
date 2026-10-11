import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';

export interface SettingsDividerProps {
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SettingsDivider({ inset = false, style }: SettingsDividerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: theme.colors.hairline },
        inset && styles.inset,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
  inset: {
    marginLeft: 52,
  },
});
