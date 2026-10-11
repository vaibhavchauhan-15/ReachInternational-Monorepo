import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '../ui/touch/Pressable';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { ChevronRight } from '../ui/icon';
import { haptics } from '../../lib/haptics';

export interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  badge?: {
    label: string;
    status?: 'active' | 'pending' | 'error' | 'neutral';
  };
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function SettingsRow({
  icon,
  iconBg,
  title,
  subtitle,
  badge,
  rightElement,
  showChevron = true,
  onPress,
  disabled = false,
  destructive = false,
  accessibilityLabel,
  style,
}: SettingsRowProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (disabled || !onPress) return;
    haptics.select();
    onPress();
  };

  const defaultIconBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f4f5';
  const resolvedIconBg = iconBg || defaultIconBg;

  const content = (
    <View style={[styles.innerRow, style]}>
      <View style={[styles.iconBox, { backgroundColor: resolvedIconBg }]}>
        {icon}
      </View>

      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text
            variant="subheading"
            style={[
              styles.title,
              { color: destructive ? theme.colors.error : theme.colors.ink },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {badge ? (
            <Badge
              status={badge.status || 'neutral'}
              customLabel={badge.label}
            />
          ) : null}
        </View>
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

      {rightElement ? (
        <View style={styles.accessoryBox}>{rightElement}</View>
      ) : showChevron && onPress ? (
        <View style={styles.accessoryBox}>
          <ChevronRight size={18} color={theme.colors.mute} />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        variant="listRow"
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        style={[styles.pressableWrapper, disabled && styles.disabled]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.pressableWrapper, disabled && styles.disabled]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  pressableWrapper: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 1,
  },
  accessoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
  },
});
