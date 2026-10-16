/**
 * ReachInternational Mobile — Dedicated Support & Contact Screen
 * Route: /settings/about/support
 * 
 * Provides verified enterprise support channels, direct email contact,
 * and official website access.
 */

import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTheme,
  Text,
} from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_EMAIL,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
} from '../../../../lib/brand';
import {
  Mail,
  ExternalLink,
  ChevronRight,
} from '../../../../components/ui/icon';
import { haptics } from '../../../../lib/haptics';

export default function SupportContactScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  const handleEmailPress = () => {
    haptics.select();
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Support%20Inquiry`);
  };

  const handleWebsitePress = () => {
    haptics.select();
    Linking.openURL(BRAND_WEBSITE);
  };

  return (
    <SettingsScreenContainer
      title="Support & Contact"
      showBack={true}
      backRoute="/settings/about"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Official Email Support Card */}
      <Pressable
        variant="card"
        haptic="select"
        onPress={handleEmailPress}
        accessibilityRole="button"
        accessibilityLabel="Email technical support"
        style={[
          styles.contactCard,
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
                ? 'rgba(59, 130, 246, 0.15)'
                : '#dbeafe',
            },
          ]}
        >
          <Mail size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
        </View>

        <View style={styles.textCol}>
          <Text
            variant="caption"
            style={{ color: theme.colors.mute }}
          >
            Technical Support Email
          </Text>
          <Text
            variant="subheading"
            style={{ color: theme.colors.ink }}
            numberOfLines={1}
          >
            {BRAND_EMAIL}
          </Text>
        </View>

        <View style={styles.chevronBox}>
          <ChevronRight size={18} color={theme.colors.mute} />
        </View>
      </Pressable>

      {/* 2. Official Website Card */}
      <Pressable
        variant="card"
        haptic="select"
        onPress={handleWebsitePress}
        accessibilityRole="button"
        accessibilityLabel="Visit official website"
        style={[
          styles.contactCard,
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
          <ExternalLink size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
        </View>

        <View style={styles.textCol}>
          <Text
            variant="caption"
            style={{ color: theme.colors.mute }}
          >
            Official Website
          </Text>
          <Text
            variant="subheading"
            style={{ color: theme.colors.ink }}
            numberOfLines={1}
          >
            {BRAND_WEBSITE_DISPLAY}
          </Text>
        </View>

        <View style={styles.chevronBox}>
          <ChevronRight size={18} color={theme.colors.mute} />
        </View>
      </Pressable>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  contactCard: {
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
  textCol: {
    flex: 1,
    gap: 2,
  },
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
