import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '../ui/touch/Pressable';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { ChevronRight } from '../ui/icon';
import { haptics } from '../../lib/haptics';

export interface SettingsValueRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value: string;
  valueBadgeStatus?: 'active' | 'pending' | 'error' | 'neutral';
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function SettingsValueRow({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  valueBadgeStatus = 'neutral',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: SettingsValueRowProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (disabled || !onPress) return;
    haptics.select();
    onPress();
  };

  const defaultIconBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f4f5';
  const resolvedIconBg = iconBg || defaultIconBg;

  return (
    <Pressable
      variant="listRow"
      onPress={handlePress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${title}: ${value}`}
      style={[styles.container, disabled && styles.disabled, style]}
    >
      <View style={[styles.iconBox, { backgroundColor: resolvedIconBg }]}>
        {icon}
      </View>

      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          style={[styles.title, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            style={[styles.subtitle, { color: theme.colors.mute }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.valueRow}>
        <Badge status={valueBadgeStatus} customLabel={value} />
        {onPress ? <ChevronRight size={18} color={theme.colors.mute} /> : null}
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
  },
  disabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 38,
    height: 38,
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
  subtitle: {
    marginTop: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
