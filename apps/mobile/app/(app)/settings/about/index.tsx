/**
 * ReachInternational Mobile — About App Hub Screen
 * Route: /settings/about
 * 
 * Displays verified application governance, legal policies, and help channels:
 * 1. App Information (/settings/about/app-info)
 * 2. Privacy Policy (/settings/about/privacy)
 * 3. Terms & Conditions (/settings/about/terms)
 * 4. Support & Contact (/settings/about/support)
 * 5. Cookie Policy (/settings/about/cookies)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme, Text, Card } from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Sparkles,
  Building2,
  Info,
  FileText,
  ClipboardList,
  Mail,
  Shield,
  ChevronRight,
  Layers,
} from '../../../../components/ui/icon';

interface AboutNavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
}

function AboutNavCard({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: AboutNavCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      variant="card"
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.navCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.textColumn}>
        <Text
          variant="subheading"
          weight="semibold"
          style={[styles.cardTitle, { color: theme.colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          style={[styles.cardSubtitle, { color: theme.colors.mute }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.chevronBox}>
        <ChevronRight size={18} color={theme.colors.mute} />
      </View>
    </Pressable>
  );
}

export default function AboutAppHomeScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings');
  };

  const appVersion = Constants.expoConfig?.version || '1.3.0';

  return (
    <SettingsScreenContainer
      title="About App"
      showBack={true}
      backRoute="/settings"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* App Identity Banner Card */}
      <Card
        variant="elevated"
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.heroRow}>
          <View
            style={[
              styles.heroIconBox,
              {
                backgroundColor: isDark
                  ? 'rgba(2, 132, 199, 0.2)'
                  : '#e0f2fe',
              },
            ]}
          >
            <Layers size={22} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
          <View style={styles.heroTextCol}>
            <View style={styles.heroTitleRow}>
              <Text
                variant="subheading"
                weight="semibold"
                style={{ color: theme.colors.ink }}
              >
                Reach International
              </Text>
              <View
                style={[
                  styles.versionPill,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#f4f4f5',
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  variant="micro"
                  weight="medium"
                  style={{ color: theme.colors.mute }}
                >
                  v{appVersion}
                </Text>
              </View>
            </View>
            <Text
              variant="caption"
              style={{ color: theme.colors.mute }}
              numberOfLines={2}
            >
              Enterprise machinery fleet operations, telemetry & running log management.
            </Text>
          </View>
        </View>
      </Card>

      {/* Section 1: Application & Release */}
      <View style={styles.sectionHeader}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.sectionTitle, { color: theme.colors.mute }]}
        >
          APPLICATION & RELEASE
        </Text>
        <Text
          variant="caption"
          style={[styles.sectionSubtitle, { color: theme.colors.mute }]}
        >
          Release notes, corporate background, and device runtime specifications.
        </Text>
      </View>

      {/* 0. What's New */}
      <AboutNavCard
        icon={<Sparkles size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="What's New"
        subtitle="Latest features, performance enhancements & release notes"
        onPress={() => router.push('/settings/about/whats-new' as any)}
        accessibilityLabel="Navigate to What's New and Release Notes"
      />

      {/* 1. About Us */}
      <AboutNavCard
        icon={<Building2 size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="About Us"
        subtitle="Company story, leadership, EWP fleet & core values"
        onPress={() => router.push('/settings/about/about-us' as any)}
        accessibilityLabel="Navigate to About Us and Company Profile"
      />

      {/* 2. App Information */}
      <AboutNavCard
        icon={<Info size={20} color={isDark ? '#34d399' : '#059669'} />}
        iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
        title="App Information"
        subtitle="Version, runtime environment, Hermes engine & specs"
        onPress={() => router.push('/settings/about/app-info' as any)}
        accessibilityLabel="Navigate to App Information"
      />

      {/* Section 2: Governance & Compliance */}
      <View style={styles.sectionHeader}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.sectionTitle, { color: theme.colors.mute }]}
        >
          GOVERNANCE & COMPLIANCE
        </Text>
        <Text
          variant="caption"
          style={[styles.sectionSubtitle, { color: theme.colors.mute }]}
        >
          Operational shift telemetry and statutory KYC protection policies.
        </Text>
      </View>

      {/* 3. Privacy Policy */}
      <AboutNavCard
        icon={<FileText size={20} color={isDark ? '#38bdf8' : '#0284c7'} />}
        iconBg={isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'}
        title="Privacy Policy"
        subtitle="Operational shift telemetry and statutory KYC protection"
        onPress={() => router.push('/settings/about/privacy' as any)}
        accessibilityLabel="Navigate to Privacy Policy"
      />

      {/* 4. Terms & Conditions */}
      <AboutNavCard
        icon={<ClipboardList size={20} color={isDark ? '#818cf8' : '#4f46e5'} />}
        iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
        title="Terms & Conditions"
        subtitle="Enterprise fleet usage rules & HMR integrity standards"
        onPress={() => router.push('/settings/about/terms' as any)}
        accessibilityLabel="Navigate to Terms and Conditions"
      />

      {/* 5. Cookies & Storage Policy */}
      <AboutNavCard
        icon={<Shield size={20} color={isDark ? '#fbbf24' : '#d97706'} />}
        iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
        title="Cookies & Storage Policy"
        subtitle="Hardware keystores, offline caches & session storage"
        onPress={() => router.push('/settings/about/cookies' as any)}
        accessibilityLabel="Navigate to Cookie Policy"
      />

      {/* Section 3: Support & Operations */}
      <View style={styles.sectionHeader}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.sectionTitle, { color: theme.colors.mute }]}
        >
          SUPPORT & OPERATIONS
        </Text>
        <Text
          variant="caption"
          style={[styles.sectionSubtitle, { color: theme.colors.mute }]}
        >
          Enterprise technical help desk and official company contact.
        </Text>
      </View>

      {/* 6. Support & Contact */}
      <AboutNavCard
        icon={<Mail size={20} color={isDark ? '#60a5fa' : '#2563eb'} />}
        iconBg={isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe'}
        title="Support & Contact"
        subtitle="Enterprise technical help desk and official website"
        onPress={() => router.push('/settings/about/support' as any)}
        accessibilityLabel="Navigate to Support and Contact"
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 12,
  },
  heroCard: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 4,
    gap: 2,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    marginTop: 1,
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
  chevronBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
