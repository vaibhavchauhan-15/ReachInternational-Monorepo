/**
 * ReachInternational Mobile — About Us Screen
 * Route: /settings/about/about-us
 * 
 * Comprehensive company profile, leadership credentials, and fleet solutions
 * synthesized from official Reach International company records (reachinternational.co.in).
 */

import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  ReachLongLogo,
  Text,
  Badge,
} from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../../../lib/haptics';
import {
  Building2,
  Users,
  ShieldCheck,
  Zap,
  Banknote,
  Star,
  Phone,
  Globe,
  Mail,
  ExternalLink,
  ChevronRight,
  Truck,
  CheckCircle2,
  Clock,
} from '../../../../components/ui/icon';

const COMPANY_PHONE = '+918800040308';
const COMPANY_PHONE_DISPLAY = '+91 88000 40308';
const COMPANY_WEBSITE = 'https://www.reachinternational.co.in';
const COMPANY_EMAIL = 'contact@reachinternational.co.in';

export default function AboutUsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleBack = () => {
    router.replace('/settings/about');
  };

  const handleCall = () => {
    haptics.select();
    Linking.openURL(`tel:${COMPANY_PHONE}`).catch(() => {});
  };

  const handleWebsite = () => {
    haptics.select();
    Linking.openURL(COMPANY_WEBSITE).catch(() => {});
  };

  const handleEmail = () => {
    haptics.select();
    Linking.openURL(`mailto:${COMPANY_EMAIL}?subject=Reach%20International%20Inquiry`).catch(() => {});
  };

  return (
    <SettingsScreenContainer
      title="About Us"
      showBack={true}
      backRoute="/settings/about"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Hero Brand Card with Transparent Long Logo */}
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
        <View style={styles.heroCenter}>
          <ReachLongLogo width={220} height={110} />
          <View style={styles.pillarsRow}>
            <View style={[styles.pillarPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <ShieldCheck size={13} color="#059669" />
              <Text variant="micro" style={{ color: theme.colors.ink }}>
                Safe
              </Text>
            </View>
            <View style={[styles.pillarPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <Zap size={13} color="#0284c7" />
              <Text variant="micro" style={{ color: theme.colors.ink }}>
                Quick
              </Text>
            </View>
            <View style={[styles.pillarPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <Banknote size={13} color="#d97706" />
              <Text variant="micro" style={{ color: theme.colors.ink }}>
                Cost-Effective
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 2. Company Story & Legacy */}
      <Card
        variant="elevated"
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe' }]}>
            <Building2 size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
          <View style={styles.sectionHeaderTextWrap}>
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Our Story
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Over a Decade of Heavy Lifting & Shifting Excellence
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

        <Text variant="body" style={[styles.paragraphText, { color: theme.colors.body }]}>
          Reach International develops advanced, progressive aerial access and material handling solutions with a dedicated commitment to elevating client operations with certified safety.
        </Text>

        <Text variant="body" style={[styles.paragraphText, { color: theme.colors.body }]}>
          With over 10 years of proven operational experience across industrial infrastructure in India, our certified engineering and operations team has mastered three non-negotiable standards: Safe, Quick, and Cost-Effective execution.
        </Text>

        <View style={[styles.highlightBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.08)' : 'rgba(2, 132, 199, 0.05)', borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.2)' }]}>
          <Star size={18} color={isDark ? '#38bdf8' : '#0284c7'} style={styles.highlightIcon} />
          <Text variant="caption" style={[styles.highlightText, { color: theme.colors.ink }]}>
            Customer trust is our primitive armor — backed by certified maintenance, zero-delay communication, and rigorous site-specific protocols.
          </Text>
        </View>
      </Card>

      {/* 3. Leadership & Directors */}
      <Card
        variant="elevated"
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
            <Users size={18} color={isDark ? '#34d399' : '#059669'} />
          </View>
          <View style={styles.sectionHeaderTextWrap}>
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Company Leadership
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Experienced Direction & Technical Governance
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

        {/* Director 1: Mr. Vishal */}
        <View style={[styles.leaderRow, { borderColor: theme.colors.hairline }]}>
          <View style={[styles.leaderAvatar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: theme.colors.hairline }]}>
            <Text variant="subheading" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
              V
            </Text>
          </View>
          <View style={styles.leaderInfo}>
            <View style={styles.leaderTitleRow}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Mr. Vishal
              </Text>
              <Badge variant="neutral">
                Director
              </Badge>
            </View>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Over 15 years of industry leadership in EWP access hire equipment, specialized attachments, and site safety compliance.
            </Text>
          </View>
        </View>

        {/* Director 2: Mr. Dhruv Sharma */}
        <View style={[styles.leaderRow, styles.leaderRowLast, { borderColor: theme.colors.hairline }]}>
          <View style={[styles.leaderAvatar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: theme.colors.hairline }]}>
            <Text variant="subheading" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
              DS
            </Text>
          </View>
          <View style={styles.leaderInfo}>
            <View style={styles.leaderTitleRow}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Mr. Dhruv Sharma
              </Text>
              <Badge variant="neutral">
                Director
              </Badge>
            </View>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Executive direction across operational expansion, fleet reliability, client partnerships, and industrial service excellence.
            </Text>
          </View>
        </View>
      </Card>

      {/* 4. Vision & Mission */}
      <Card
        variant="elevated"
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe' }]}>
            <Globe size={18} color={isDark ? '#a78bfa' : '#7c3aed'} />
          </View>
          <View style={styles.sectionHeaderTextWrap}>
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Vision & Mission
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Guiding Principles of Reach International
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

        {/* Vision */}
        <View style={styles.visionMissionBlock}>
          <Text variant="label" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
            VISION
          </Text>
          <Text variant="body" style={[styles.subText, { color: theme.colors.body }]}>
            To attain new heights in industrial access and lifting technologies while building transparent, lasting, and high-trust relationships with enterprise clients.
          </Text>
        </View>

        {/* Mission */}
        <View style={styles.visionMissionBlock}>
          <Text variant="label" style={{ color: isDark ? '#34d399' : '#059669' }}>
            MISSION
          </Text>
          <Text variant="body" style={[styles.subText, { color: theme.colors.body }]}>
            To turn our vision into everyday reality by equipping industries with certified, high-efficiency equipment and the reliable backing of our dedicated technical team.
          </Text>
        </View>
      </Card>

      {/* 5. Core Solutions & Fleet Portfolio */}
      <Card
        variant="elevated"
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
            <Truck size={18} color={isDark ? '#fbbf24' : '#d97706'} />
          </View>
          <View style={styles.sectionHeaderTextWrap}>
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Fleet Solutions & Products
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Rental, Hiring & Machinery Sales Across India
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.productGrid}>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Boom Lifts (Battery & Diesel)
            </Text>
          </View>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Scissor Lifts (Electric & RT Diesel)
            </Text>
          </View>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Forklifts & Reach Trucks
            </Text>
          </View>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Aerial Work Platforms (AWP)
            </Text>
          </View>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Vertical Mast & Material Lifts
            </Text>
          </View>
          <View style={[styles.productPill, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <CheckCircle2 size={13} color="#059669" />
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Aluminium Scaffolding
            </Text>
          </View>
        </View>
      </Card>

      {/* 6. Official Contact & Headquarters */}
      <Card
        variant="elevated"
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe' }]}>
            <Phone size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
          </View>
          <View style={styles.sectionHeaderTextWrap}>
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Get In Touch
            </Text>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Reach International Headquarters & Help Desk
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

        {/* Phone Action */}
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleCall}
          style={[styles.contactRow, { borderColor: theme.colors.hairline }]}
          accessibilityLabel="Call Reach International Support"
        >
          <View style={[styles.contactIconWrap, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <Phone size={16} color={theme.colors.link} />
          </View>
          <View style={styles.contactDetails}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Direct Helpline / WhatsApp
            </Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>
              {COMPANY_PHONE_DISPLAY}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.colors.mute} />
        </Pressable>

        {/* Website Action */}
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleWebsite}
          style={[styles.contactRow, { borderColor: theme.colors.hairline }]}
          accessibilityLabel="Open official website reachinternational.co.in"
        >
          <View style={[styles.contactIconWrap, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <Globe size={16} color={theme.colors.link} />
          </View>
          <View style={styles.contactDetails}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Official Website
            </Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>
              www.reachinternational.co.in
            </Text>
          </View>
          <ExternalLink size={16} color={theme.colors.mute} />
        </Pressable>

        {/* Email Action */}
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleEmail}
          style={[styles.contactRow, styles.contactRowLast, { borderColor: theme.colors.hairline }]}
          accessibilityLabel="Send email to Reach International"
        >
          <View style={[styles.contactIconWrap, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <Mail size={16} color={theme.colors.link} />
          </View>
          <View style={styles.contactDetails}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Inquiries & Fleet Requests
            </Text>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>
              {COMPANY_EMAIL}
            </Text>
          </View>
          <ExternalLink size={16} color={theme.colors.mute} />
        </Pressable>
      </Card>

      {/* Brand Footprint Footer */}
      <View style={styles.brandFooter}>
        <ReachLongLogo width={140} height={70} />
        <Text variant="micro" style={{ color: theme.colors.mute }}>
          © {new Date().getFullYear()} Reach International. All rights reserved.
        </Text>
      </View>
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 14,
  },
  heroCard: {
    padding: 20,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    alignItems: 'center',
    gap: 12,
  },
  pillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pillarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  sectionCard: {
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  paragraphText: {
    marginBottom: 10,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: 6,
  },
  highlightIcon: {
    marginTop: 2,
  },
  highlightText: {
    flex: 1,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  leaderRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  leaderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderInfo: {
    flex: 1,
    gap: 3,
  },
  leaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  visionMissionBlock: {
    gap: 4,
    marginBottom: 12,
  },
  subText: {
    marginTop: 2,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  contactRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  contactRowLast: {
    marginBottom: 0,
  },
  contactIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.lg,
    gap: 4,
  },
});
