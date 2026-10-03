/**
 * ReachInternational Mobile — About App Settings Sub-Page
 * Route: /settings/aboutapp & /setting/aboutapp
 * Displays application build version, runtime environment, official contacts,
 * Privacy Policy, Terms of Service, DPDP Act compliance, and Account Deletion.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Badge,
  useTheme,
  MobileHeader,
  ReachInternationalLogo,
} from '../../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from '../../../lib/brand';
import {
  Info,
  ExternalLink,
  Mail,
  ChevronRight,
  ShieldCheck,
  FileText,
  Lock,
  Trash2,
  Cpu,
  CheckCircle2,
} from 'lucide-react-native';

export default function AboutAppScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Edge-to-edge Top Header */}
      <MobileHeader
        title="About App"
        showBack={true}
        onPressBack={() => router.push('/(app)/settings' as any)}
        showQuickAccess={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* CARD 1: BRAND HERO & VERSION TELEMETRY */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.brandHeroCenter}>
            <ReachInternationalLogo size={24} showTagline={false} />
            <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>
              {BRAND_NAME}
            </Text>
            <Text style={[styles.brandTagline, { color: theme.colors.mute }]}>
              {BRAND_TAGLINE}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Badge status="active" customLabel="VERSION 1.0.0 (BUILD 42)" />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.specLine}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>Application Version</Text>
            <Text style={[styles.specValue, { color: theme.colors.ink }]}>v1.0.0 (Release 42)</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.specLine}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>Platform Runtime</Text>
            <Text style={[styles.specValue, { color: theme.colors.ink }]}>Expo SDK 57 • React Native</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.specLine}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>JavaScript Engine</Text>
            <Text style={[styles.specValue, { color: theme.colors.ink }]}>Hermes 0.81 (Bytecode AOT)</Text>
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 2: OFFICIAL CHANNELS & SUPPORT */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe' }]}>
              <Info size={17} color={isDark ? '#60a5fa' : '#2563eb'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>OFFICIAL CHANNELS</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Enterprise communication and technical support
              </Text>
            </View>
          </View>

          {/* Website Link */}
          <TouchableOpacity
            style={styles.touchLinkRow}
            onPress={() => Linking.openURL(BRAND_WEBSITE)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: theme.colors.ink }]}>Official Website</Text>
              <Text style={[styles.linkSubtitle, { color: theme.colors.link }]}>{BRAND_WEBSITE_DISPLAY}</Text>
            </View>
            <ExternalLink size={16} color={theme.colors.link} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Support Email */}
          <TouchableOpacity
            style={styles.touchLinkRow}
            onPress={() => Linking.openURL(`mailto:${BRAND_EMAIL}`)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: theme.colors.ink }]}>Support & Compliance Email</Text>
              <Text style={[styles.linkSubtitle, { color: theme.colors.link }]}>{BRAND_EMAIL}</Text>
            </View>
            <Mail size={16} color={theme.colors.link} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 3: LEGAL, POLICIES & ACCOUNT DELETION */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff' }]}>
              <FileText size={17} color={isDark ? '#818cf8' : '#4f46e5'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>LEGAL & POLICIES</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Compliance, data privacy, and governance documents
              </Text>
            </View>
          </View>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/privacy' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.policyIconCircle, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <ShieldCheck size={16} color={theme.colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.legalNavTitle, { color: theme.colors.ink }]}>Privacy Policy</Text>
              <Text style={[styles.legalNavDesc, { color: theme.colors.mute }]}>
                DPDP Act 2023 disclosures & telemetry practices
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.mute} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/terms' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.policyIconCircle, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <FileText size={16} color={theme.colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.legalNavTitle, { color: theme.colors.ink }]}>Terms of Service</Text>
              <Text style={[styles.legalNavDesc, { color: theme.colors.mute }]}>
                Platform usage rules, fleet operations & liability
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.mute} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          {/* Account Deletion */}
          <TouchableOpacity
            style={styles.legalNavRow}
            onPress={() => router.push('/(app)/account-deletion' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.policyIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}>
              <Trash2 size={16} color="#e11d48" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.legalNavTitle, { color: theme.colors.ink }]}>Account & Data Deletion</Text>
              <Text style={[styles.legalNavDesc, { color: theme.colors.mute }]}>
                Self-serve erasure request & Google Play 14-day SLA
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.mute} />
          </TouchableOpacity>
        </Card>

        {/* ========================================================================= */}
        {/* CARD 4: ENTERPRISE DATA PROTECTION STANDARDS */}
        {/* ========================================================================= */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
              <Lock size={17} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>SECURITY & COMPLIANCE</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.mute }]}>
                Monorepo architectural protections
              </Text>
            </View>
          </View>

          <View style={styles.complianceGrid}>
            <View style={styles.complianceItem}>
              <CheckCircle2 size={13} color="#059669" />
              <Text style={[styles.complianceText, { color: theme.colors.ink }]}>
                DPDP Act 2023 Compliant
              </Text>
            </View>
            <View style={styles.complianceItem}>
              <CheckCircle2 size={13} color="#059669" />
              <Text style={[styles.complianceText, { color: theme.colors.ink }]}>
                Zero Data Sale Guarantee
              </Text>
            </View>
            <View style={styles.complianceItem}>
              <CheckCircle2 size={13} color="#059669" />
              <Text style={[styles.complianceText, { color: theme.colors.ink }]}>
                UIDAI Aadhaar Masking Policy
              </Text>
            </View>
            <View style={styles.complianceItem}>
              <CheckCircle2 size={13} color="#059669" />
              <Text style={[styles.complianceText, { color: theme.colors.ink }]}>
                PostgreSQL Kernel RLS Enforcement
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.brandFooter}>
          <Text style={[styles.copyrightText, { color: theme.colors.mute }]}>
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </Text>
        </View>
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
  card: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  brandHeroCenter: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  specLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  specLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  specValue: {
    fontSize: 12.5,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  touchLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  linkTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  legalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  policyIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalNavTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  legalNavDesc: {
    fontSize: 11.5,
    marginTop: 1,
  },
  complianceGrid: {
    gap: 8,
  },
  complianceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  complianceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  brandFooter: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  copyrightText: {
    fontSize: 11.5,
  },
});
