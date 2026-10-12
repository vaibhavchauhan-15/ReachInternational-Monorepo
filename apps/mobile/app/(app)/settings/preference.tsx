/**
 * ReachInternational Mobile — Preferences Settings
 * Route: /settings/preference & /settings/prefrences & /settings/preferences
 * 
 * Displays strictly the 3 canonical preference cards:
 * 1. Theme (Dark, Light, System toggle in one row)
 * 2. Font Size (navigates to dedicated page /settings/fontsize)
 * 3. Haptic Feedback (toggle switch)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  Text,
  Switch,
  SegmentedToggle,
  useToast,
} from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Palette,
  Type,
  Vibrate,
  ChevronRight,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';
import { usePreferences } from '../../../lib/preferences/store';

const THEME_OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
];

export default function PreferenceSettingsScreen() {
  const router = useRouter();
  const { theme, isDark, mode, setMode } = useTheme();
  const { hapticsEnabled, setHapticsEnabled } = usePreferences();
  const { toast } = useToast();

  const handleThemeChange = (newMode: string) => {
    setMode(newMode as 'light' | 'dark' | 'system');
  };

  const handleToggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    if (val) {
      haptics.confirm();
    }
    toast('success', `Haptic feedback ${val ? 'enabled' : 'disabled'}`);
  };

  return (
    <SettingsScreenContainer
      title="Preferences"
      showBack={true}
      onPressBack={() => router.back()}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Theme Card (Dark, Light, System toggle in one row) */}
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
          <Text
            variant="subheading"
            style={[styles.cardTitle, { color: theme.colors.ink }]}
          >
            Theme
          </Text>
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

      {/* 2. Font Size Card (navigates to dedicated page with preview) */}
      <Pressable
        variant="card"
        haptic="select"
        onPress={() => router.push('/settings/fontsize' as any)}
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
        <Text
          variant="subheading"
          style={[styles.cardTitle, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          Font Size
        </Text>
        <View style={styles.chevronBox}>
          <ChevronRight size={18} color={theme.colors.mute} />
        </View>
      </Pressable>

      {/* 3. Haptic Card (with toggle switch) */}
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
        <Text
          variant="subheading"
          style={[styles.cardTitle, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          Haptic Feedback
        </Text>
        <Switch
          value={hapticsEnabled}
          onValueChange={handleToggleHaptics}
          accessibilityLabel="Toggle Haptic Feedback"
        />
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
    minHeight: 56,
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
  cardTitle: {
    flex: 1,
  },
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
