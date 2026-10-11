import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/Switch';
import { useTheme } from '../ui/ThemeProvider';
import { haptics } from '../../lib/haptics';

export interface SettingsSwitchRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  showBadge?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function SettingsSwitchRow({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  showBadge = false,
  activeLabel = 'ON',
  inactiveLabel = 'OFF',
  accessibilityLabel,
  style,
}: SettingsSwitchRowProps) {
  const { theme, isDark } = useTheme();

  const handleToggle = (nextValue: boolean) => {
    if (disabled) return;
    haptics.select();
    onValueChange(nextValue);
  };

  const defaultIconBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f4f4f5';
  const resolvedIconBg = iconBg || defaultIconBg;

  return (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      <View style={[styles.iconBox, { backgroundColor: resolvedIconBg }]}>
        {icon}
      </View>

      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text
            variant="subheading"
            style={[styles.title, { color: theme.colors.ink }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {showBadge ? (
            <Badge
              status={value ? 'active' : 'error'}
              customLabel={value ? activeLabel : inactiveLabel}
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

      <Switch
        value={value}
        onValueChange={handleToggle}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel || title}
      />
    </View>
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
});
