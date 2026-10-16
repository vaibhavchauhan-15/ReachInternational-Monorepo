/**
 * ReachInternational Mobile — Preferences Settings Screen
 * Route: /settings/preferences
 * 
 * Displays persistent app appearance & ergonomics:
 * 1. Theme Mode (Dark, Light, System)
 * 2. Font Size Scaling (/settings/preferences/font-size)
 * 3. Haptic Feedback (Enable/Disable)
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  Text,
  Switch,
  SegmentedToggle,
  useToast,
} from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Palette,
  Type,
  Vibrate,
  ChevronRight,
} from '../../../../components/ui/icon';
import { haptics } from '../../../../lib/haptics';
import { usePreferences } from '../../../../lib/preferences/store';
import { useTypeScale } from '../../../../lib/typography/TypeScaleProvider';

const THEME_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
];

export default function PreferencesSettingsScreen() {
  const router = useRouter();
  const { theme, isDark, mode, setMode } = useTheme();
  const { hapticsEnabled, setHapticsEnabled } = usePreferences();
  const { preset } = useTypeScale();
  const { toast } = useToast();

  const handleBack = () => {
    router.replace('/settings');
  };

  const handleThemeChange = useCallback((newMode: string) => {
    setMode(newMode as 'light' | 'dark' | 'system');
  }, [setMode]);

  const handleToggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    if (val) {
      haptics.confirm();
    }
    toast('success', `Haptic feedback ${val ? 'enabled' : 'disabled'}`);
  };

  const fontLabel = {
    small: 'Small (92%)',
    medium: 'Default (100%)',
    large: 'Large (120%)',
  }[preset] || 'Default (100%)';

  return (
    <SettingsScreenContainer
      title="Preferences"
      showBack={true}
      backRoute="/settings"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Theme Card */}
      <Card
        variant="elevated"
        style={[
          styles.themeCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.themeHeaderRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: isDark
                  ? 'rgba(245, 158, 11, 0.15)'
                  : '#fef3c7',
              },
            ]}
          >
            <Palette size={20} color={isDark ? '#fbbf24' : '#d97706'} />
          </View>
          <View style={styles.textColumn}>
            <Text
              variant="subheading"
              style={[styles.cardTitle, { color: theme.colors.ink }]}
            >
              Theme Mode
            </Text>
            <Text
              variant="caption"
              style={[styles.cardSubtitle, { color: theme.colors.mute }]}
            >
              Synchronize with device OS or force dark/light appearance
            </Text>
          </View>
        </View>

        <SegmentedToggle
          items={THEME_OPTIONS}
          value={mode}
          onChange={handleThemeChange}
          size="md"
          fullWidth
          accessibilityLabel="Select theme mode: Dark, Light, or System"
        />
      </Card>

      {/* 2. Font Size Card */}
      <Pressable
        variant="card"
        haptic="select"
        onPress={() => router.push('/settings/preferences/font-size' as any)}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Font Size settings"
        style={[
          styles.navCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isDark
                ? 'rgba(2, 132, 199, 0.15)'
                : '#e0f2fe',
            },
          ]}
        >
          <Type size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
        </View>
        <View style={styles.textColumn}>
          <Text
            variant="subheading"
            style={[styles.cardTitle, { color: theme.colors.ink }]}
            numberOfLines={1}
          >
            Font Size
          </Text>
          <Text
            variant="caption"
            style={[styles.cardSubtitle, { color: theme.colors.mute }]}
            numberOfLines={1}
          >
            {fontLabel}
          </Text>
        </View>
        <View style={styles.chevronBox}>
          <ChevronRight size={18} color={theme.colors.mute} />
        </View>
      </Pressable>

      {/* 3. Haptic Feedback Card */}
      <View
        style={[
          styles.navCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isDark
                ? 'rgba(236, 72, 153, 0.15)'
                : '#fce7f3',
            },
          ]}
        >
          <Vibrate size={20} color={isDark ? '#f472b6' : '#db2777'} />
        </View>
        <View style={styles.textColumn}>
          <Text
            variant="subheading"
            style={[styles.cardTitle, { color: theme.colors.ink }]}
            numberOfLines={1}
          >
            Haptic Feedback
          </Text>
          <Text
            variant="caption"
            style={[styles.cardSubtitle, { color: theme.colors.mute }]}
            numberOfLines={1}
          >
            Tactile vibration feedback on interactions and confirmations
          </Text>
        </View>
        <View style={styles.switchWrapper}>
          <Switch
            value={hapticsEnabled}
            onValueChange={handleToggleHaptics}
            accessibilityLabel="Toggle Haptic Feedback"
          />
        </View>
      </View>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  themeCard: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 14,
  },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navCard: {
    minHeight: 64,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    flexShrink: 1,
  },
  cardSubtitle: {
    marginTop: 1,
  },
  switchWrapper: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
