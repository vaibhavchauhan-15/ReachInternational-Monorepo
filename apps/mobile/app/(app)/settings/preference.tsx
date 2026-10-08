/**
 * ReachInternational Mobile — Preferences & Theme Settings Sub-Page
 * Route: /settings/preference & /setting/prefrence & /settings/prefrence
 * Color Appearance (Light, Dark, System), Font Size Scaling with live text preview,
 * Haptic Feedback toggle, and instant animated feedback toasts.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Badge,
  useTheme,
  MobileHeader,
} from '../../../components/ui';
import { Text, Text as TypographyText } from '../../../components/ui/Text';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { Switch } from '../../../components/ui/Switch';
import { useTypeScale } from '../../../lib/typography/TypeScaleProvider';
import { usePreferences, setHapticsEnabled } from '../../../lib/preferences/store';
import { useReducedMotion } from '../../../lib/preferences/useReducedMotion';
import { spacingNumeric, radiusNumeric, type FontScalePreset } from '@reachinternational/design-tokens';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Type,
  Vibrate,
  Check,
  CheckCircle2,
  Sparkles,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';

const FONT_OPTIONS: { id: FontScalePreset; label: string; desc: string }[] = [
  { id: 'small', label: 'Small (92%)', desc: 'Compact density, maximum screen fit' },
  { id: 'medium', label: 'Medium (100%)', desc: 'Standard platform density' },
  { id: 'large', label: 'Large (120%)', desc: 'High visibility outdoors' },
];

export default function PreferenceSettingsScreen() {
  const router = useRouter();
  const { theme, isDark, mode, setMode } = useTheme();
  const { preset, setPreset, scale } = useTypeScale();
  const { hapticsEnabled } = usePreferences();
  const reducedMotion = useReducedMotion();

  // Live Toast Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);

    Animated.spring(toastAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 90,
      friction: 8,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setToastMessage(null);
      });
    }, 2200);
  };

  const handleSetTheme = (newMode: 'light' | 'dark' | 'system') => {
    setMode(newMode);
    const label = newMode === 'system' ? 'System Default' : newMode === 'dark' ? 'Dark' : 'Light';
    showToast(`Color theme set to ${label}`);
  };

  const handleSelectFontSize = (option: FontScalePreset) => {
    setPreset(option);
    const item = FONT_OPTIONS.find((f) => f.id === option);
    showToast(`Display scale set to ${item?.label || option}`);
  };

  const handleToggleHaptics = (value: boolean) => {
    setHapticsEnabled(value);
    if (value) {
      // Play a preview confirmation haptic when enabled
      haptics.confirm();
    }
    showToast(`Haptic feedback ${value ? 'enabled' : 'disabled'}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Edge-to-edge Top Header */}
      <MobileHeader
        title="Preferences"
        showBack={true}
        onPressBack={() => router.push('/(app)/settings' as any)}
        showQuickAccess={false}
      />

      {/* Floating Animated Feedback Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
              borderColor: '#059669',
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <CheckCircle2 size={16} color="#059669" animate="mount" />
          <Text style={[styles.toastText, { color: isDark ? '#34d399' : '#065f46' }]}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* CARD 1: COLOR THEME / APPEARANCE */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
              <Palette size={18} color={isDark ? '#fbbf24' : '#d97706'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>APP APPEARANCE</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Select your preferred color theme
              </Text>
            </View>
          </View>

          <View style={styles.themeOptionsGrid}>
            {/* Light */}
            <Pressable
              variant="card"
              haptic="select"
              onPress={() => handleSetTheme('light')}
              style={[
                styles.themeCardOption,
                {
                  backgroundColor: mode === 'light' ? `${theme.colors.link}12` : theme.colors.canvas,
                  borderColor: mode === 'light' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.themeIconWrapper, { backgroundColor: mode === 'light' ? theme.colors.link : theme.colors.canvasElevated }]}>
                <Sun size={18} color={mode === 'light' ? '#ffffff' : theme.colors.ink} />
              </View>
              <Text style={[styles.themeOptionTitle, { color: theme.colors.ink }]}>Light</Text>
              <Text style={[styles.themeOptionDesc, { color: theme.colors.mute }]}>Clean day mode</Text>
              {mode === 'light' && (
                <View style={[styles.activeCheckPill, { backgroundColor: theme.colors.link }]}>
                  <Check size={11} color="#ffffff" />
                </View>
              )}
            </Pressable>

            {/* Dark */}
            <Pressable
              variant="card"
              haptic="select"
              onPress={() => handleSetTheme('dark')}
              style={[
                styles.themeCardOption,
                {
                  backgroundColor: mode === 'dark' ? `${theme.colors.link}12` : theme.colors.canvas,
                  borderColor: mode === 'dark' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.themeIconWrapper, { backgroundColor: mode === 'dark' ? theme.colors.link : theme.colors.canvasElevated }]}>
                <Moon size={18} color={mode === 'dark' ? '#ffffff' : theme.colors.ink} />
              </View>
              <Text style={[styles.themeOptionTitle, { color: theme.colors.ink }]}>Dark</Text>
              <Text style={[styles.themeOptionDesc, { color: theme.colors.mute }]}>OLED deep black</Text>
              {mode === 'dark' && (
                <View style={[styles.activeCheckPill, { backgroundColor: theme.colors.link }]}>
                  <Check size={11} color="#ffffff" />
                </View>
              )}
            </Pressable>

            {/* System */}
            <Pressable
              variant="card"
              haptic="select"
              onPress={() => handleSetTheme('system')}
              style={[
                styles.themeCardOption,
                {
                  backgroundColor: mode === 'system' ? `${theme.colors.link}12` : theme.colors.canvas,
                  borderColor: mode === 'system' ? theme.colors.link : theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.themeIconWrapper, { backgroundColor: mode === 'system' ? theme.colors.link : theme.colors.canvasElevated }]}>
                <Monitor size={18} color={mode === 'system' ? '#ffffff' : theme.colors.ink} />
              </View>
              <Text style={[styles.themeOptionTitle, { color: theme.colors.ink }]}>System</Text>
              <Text style={[styles.themeOptionDesc, { color: theme.colors.mute }]}>Device match</Text>
              {mode === 'system' && (
                <View style={[styles.activeCheckPill, { backgroundColor: theme.colors.link }]}>
                  <Check size={11} color="#ffffff" />
                </View>
              )}
            </Pressable>
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 2: FONT SIZE & DISPLAY DENSITY */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' }]}>
              <Type size={18} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>FONT SIZE & SCALE</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Adjust text size for outdoor visibility and reading comfort
              </Text>
            </View>
          </View>

          <View style={styles.fontOptionsList}>
            {FONT_OPTIONS.map((item) => {
              const isSelected = preset === item.id;
              return (
                <Pressable
                  key={item.id}
                  variant="listRow"
                  haptic="select"
                  onPress={() => handleSelectFontSize(item.id)}
                  style={[
                    styles.fontOptionRow,
                    {
                      backgroundColor: isSelected ? `${theme.colors.link}10` : theme.colors.canvas,
                      borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fontOptionLabel, { color: theme.colors.ink }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.fontOptionDesc, { color: theme.colors.mute }]}>
                      {item.desc}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        backgroundColor: isSelected ? theme.colors.link : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Live Text Preview Box */}
          <View
            style={[
              styles.previewBox,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.previewHeader}>
              <Sparkles size={13} color={theme.colors.link} />
              <TypographyText variant="caption" style={{ color: theme.colors.link }}>
                LIVE PREVIEW ({Math.round(scale * 100)}%)
              </TypographyText>
            </View>
            <TypographyText variant="heading" style={{ color: theme.colors.ink }}>
              Machine M/C-0001
            </TypographyText>
            <TypographyText variant="body" style={{ color: theme.colors.mute }}>
              Shift A · 06:00 AM – 02:00 PM
            </TypographyText>
            <TypographyText variant="caption" style={{ color: theme.colors.mute }}>
              Last HMR 1204.5
            </TypographyText>
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 3: TACTILE HAPTIC FEEDBACK */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.hapticRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : '#fce7f3' }]}>
              <Vibrate size={18} color={isDark ? '#f472b6' : '#db2777'} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.hapticTitle, { color: theme.colors.ink }]}>
                Haptic feedback
              </Text>
              <Text style={[styles.hapticSubtitle, { color: theme.colors.mute }]}>
                Soft vibration on selections and confirmations. Follows your phone's touch-feedback setting.
              </Text>
            </View>

            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              accessibilityLabel="Toggle haptic feedback"
            />
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 4: REDUCED MOTION (SYSTEM-DRIVEN) */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.hapticRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
              <Sparkles size={18} color={isDark ? '#34d399' : '#059669'} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.hapticTitle, { color: theme.colors.ink }]}>
                Reduced motion
              </Text>
              <Text style={[styles.hapticSubtitle, { color: theme.colors.mute }]}>
                {reducedMotion
                  ? 'Active — animations are simplified based on your device accessibility setting.'
                  : 'Follows device setting — standard spring animations and smooth transitions enabled.'}
              </Text>
            </View>

            <Badge
              status={reducedMotion ? 'active' : 'neutral'}
              customLabel={reducedMotion ? 'SYSTEM ON' : 'SYSTEM OFF'}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 80,
  },
  floatingToast: {
    position: 'absolute',
    top: 54,
    left: spacingNumeric.md,
    right: spacingNumeric.md,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  toastText: {
    flex: 1,
  },
  card: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
  },
  sectionSubtitle: {
    marginTop: 1,
  },
  themeOptionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  themeCardOption: {
    flex: 1,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  themeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  themeOptionTitle: {
  },
  themeOptionDesc: {
    textAlign: 'center',
  },
  activeCheckPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontOptionsList: {
    gap: 8,
  },
  fontOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  fontOptionLabel: {
  },
  fontOptionDesc: {
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  previewBox: {
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  hapticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hapticTitle: {
  },
  hapticSubtitle: {
    marginTop: 2,
  },
});
