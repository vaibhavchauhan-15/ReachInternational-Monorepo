/**
 * ReachInternational Mobile — Terms of Service Screen
 * Enterprise fleet usage conditions, machinery custody responsibilities, and industrial safety compliance.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  MobileHeader,
  ReachInternationalLogo,
} from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from '../../lib/brand';
import {
  CheckCircle2,
  Mail,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react-native';

const loginPageImage = require('../../assets/loginpageimage.png');

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  // Responsive Breakpoints: Mobile (<=640px), Tablet (641px–1023px), Desktop (>=1024px)
  const isDesktop = width >= 1024;
  const isTablet = width >= 641 && width < 1024;
  const isShortScreen = height < 740;
  const showcaseWidth = isDesktop ? Math.min(520, Math.max(380, Math.round(width * 0.38))) : 0;
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Terms%20of%20Service%20Inquiry`);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.canvas,
          flexDirection: isDesktop ? 'row' : 'column',
        },
      ]}
    >
      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only >= 1024px)
          Exact parity with Web desktop split layout
          ============================================================ */}
      {isDesktop && (
        <View
          style={[
            styles.desktopShowcasePanel,
            {
              width: showcaseWidth,
              backgroundColor: isDark ? '#111111' : '#ffffff',
              borderRightColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Atmospheric Brand Glow */}
          <View
            style={[
              styles.showcaseGlow,
              {
                backgroundColor: isDark
                  ? 'rgba(14, 165, 233, 0.12)'
                  : 'rgba(2, 132, 199, 0.08)',
              },
            ]}
          />

          {/* Top Header Row with Back Button & Logo */}
          <View style={styles.showcaseHeaderRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[
                styles.showcaseBackBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <ArrowLeft size={16} color={theme.colors.ink} />
            </TouchableOpacity>
            <ReachInternationalLogo variant="full" size={28} iconType="scissor" />
          </View>

          {/* Central Hero Stage: Title + Machinery Asset */}
          <View style={styles.showcaseHeroContent}>
            <View style={styles.showcaseHeadingBlock}>
              <Text
                style={[
                  styles.showcaseTitle,
                  { color: isDark ? '#ffffff' : '#0f172a' },
                ]}
              >
                Platform Terms.
              </Text>
              <Text style={[styles.showcaseSubtitle, { color: primarySkyBlue }]}>
                Safety & Compliance.
              </Text>
            </View>

            {/* Industrial Machinery Stage with Ground Pedestal */}
            <View style={styles.machineStageContainer}>
              <View
                style={[
                  styles.machinePedestalShadow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 0, 0, 0.85)'
                      : 'rgba(0, 0, 0, 0.16)',
                  },
                ]}
              />
              <Image
                source={loginPageImage}
                style={[
                  styles.machineImage,
                  {
                    maxHeight: Math.min(260, Math.max(160, height * 0.32)),
                  },
                ]}
                resizeMode="contain"
                accessible={true}
                accessibilityLabel="Reach International Aerial Boom Lift Fleet Equipment"
              />
            </View>
          </View>

          {/* Bottom Info Badge */}
          <View style={styles.showcaseBottomInfo}>
            <View style={styles.greenDot} />
            <Text style={[styles.showcaseBottomText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Enterprise Fleet Governance · Statutory Safety
            </Text>
          </View>
        </View>
      )}

      {/* ============================================================
          Right: Dedicated Terms Content Workspace
          ============================================================ */}
      <View style={[styles.mainWorkspace, { backgroundColor: theme.colors.canvas }]}>
        {/* On Mobile/Tablet: Standard MobileHeader. On Desktop: Desktop Header Bar */}
        {!isDesktop ? (
          <MobileHeader
            title="Terms of Service"
            showBack={true}
            onPressBack={() => router.back()}
            showQuickAccess={false}
          />
        ) : (
          <View
            style={[
              styles.desktopHeaderBar,
              {
                borderBottomColor: theme.colors.hairline,
                backgroundColor: theme.colors.canvasElevated,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.desktopBackRow}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <ArrowLeft size={16} color={theme.colors.ink} />
              <Text style={[styles.desktopBackText, { color: theme.colors.ink }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.desktopHeaderTitle, { color: theme.colors.ink }]}>
              Terms of Service
            </Text>
            <View style={{ width: 60 }} />
          </View>
        )}

        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: isDesktop ? 40 : spacingNumeric.md,
              paddingVertical: isShortScreen ? 14 : spacingNumeric.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.termsWrapper, { maxWidth: isDesktop ? 760 : '100%' }]}>
        {/* Terms Metadata Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTitleCol}>
              <Text style={[styles.heroTitle, { color: theme.colors.ink }]}>Terms of Service</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.mute }]}>
                Last Updated: September 11, 2026 • Effective Immediately
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <Text style={[styles.leadParagraph, { color: theme.colors.body }]}>
            These Terms of Service ("Agreement") govern the access and use of the {BRAND_NAME} mobile application and cloud fleet management platform. By signing in, recording equipment logs, or accessing client assets, you agree to comply with these terms.
          </Text>
        </Card>

        {/* Section 1: Authorized Access & Operator Scope */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>1. AUTHORIZED PERSONNEL & ACCOUNT SECURITY</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            Access to this application is restricted to authorized fleet personnel (Supervisors, Fleet Engineers, Heavy Machinery Operators, and Client Representatives).
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Credential Confidentiality: </Text>
                You are responsible for safeguarding your login credentials. Sharing session keys, PINs, or passwords with third parties is strictly prohibited.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Statutory Certification: </Text>
                Equipment operators must maintain active, government-issued heavy equipment or crane operator licenses. Operators must immediately cease operation if their license expires or is suspended.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 2: Hour Meter Readings (HMR) & Telemetry Truthfulness */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>2. HOUR METER INTEGRITY & ANTI-FALSIFICATION</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            Hour Meter Readings (HMR) represent critical legal records utilized for industrial billing, shift payroll, preventative maintenance scheduling, and workplace safety insurance.
          </Text>

          {/* Warning Inset */}
          <View style={[styles.warningInset, { backgroundColor: 'rgba(220, 38, 38, 0.08)', borderColor: 'rgba(220, 38, 38, 0.3)' }]}>
            <Text style={[styles.warningTitle, { color: '#dc2626' }]}>Zero Tolerance for Telemetry Tampering</Text>
            <Text style={[styles.warningText, { color: theme.colors.ink }]}>
              Intentional inflation, under-reporting, backward meter entry, or falsification of machinery running hours constitutes industrial misconduct, resulting in immediate account revocation, contractual penalties, and potential statutory prosecution.
            </Text>
          </View>

          <View style={[styles.bulletList, { marginTop: 12 }]}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                Operators must input initial meter readings upon shift commencement and final readings upon shift termination.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                All meter updates are cryptographically hashed and tied to the operator ID with immutable audit timestamps.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 3: Shift Management & Overtime Safety */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>3. SHIFT ASSIGNMENT & DUAL CUSTODY RULES</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            To protect worker safety and eliminate fatigue hazards:
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>No Dual Custody: </Text>
                An operator cannot be actively operating multiple machines simultaneously across overlapping shift hours.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Overtime Shift Conflict Resolution: </Text>
                Whenever overtime hours overlap with subsequent machine assignments, the operator and site supervisor must resolve shift conflicts before finalizing duty logs.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 4: Daily Inspection & Breakdown Reporting */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>4. INSPECTIONS & BREAKDOWN REPORTING</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            Prior to operating any equipment:
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Pre-Shift Checklist: </Text>
                Inspect hydraulic systems, battery voltage, brakes, emergency stop mechanisms, and tire/track condition.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Immediate Breakdown Logging: </Text>
                If machinery exhibits mechanical or structural instability, immediately halt operation and flag the machine status as "Breakdown" in the mobile app.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Operating Capacity: </Text>
                Never exceed maximum working load limits (Safe Working Load / SWL) specified by the equipment manufacturer.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 5: Intellectual Property & Restrictions */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>5. SYSTEM RESTRICTIONS & IP RIGHTS</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            All rights, source code, data architectures, trademarks, and interfaces of {BRAND_NAME} are the exclusive intellectual property of Reach International.
          </Text>

          <Text style={[styles.bodyText, { color: theme.colors.body, marginTop: 8 }]}>
            Users shall not decompile, reverse-engineer, inject automated scraping bots, or bypass Row-Level Security policies governing the cloud database.
          </Text>
        </Card>

        {/* Section 6: Limitation of Liability */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>6. LIMITATION OF LIABILITY</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            {BRAND_NAME} provides telemetry tracking, machine hours logging, and scheduling tools. Active worksite safety, certified machinery operation, and adherence to environmental health and safety (EHS) regulations remain the direct responsibility of the certified operator and worksite contractor.
          </Text>
        </Card>

        {/* Section 7: Contact & Support */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>7. INQUIRIES & LEGAL NOTICES</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            For inquiries regarding our Terms of Service or enterprise contracts, reach out to our legal and fleet administration team:
          </Text>

          <TouchableOpacity
            style={[styles.contactBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
            onPress={handleContactEmail}
          >
            <Mail size={16} color={theme.colors.link} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.contactLabel, { color: theme.colors.mute }]}>Legal & Fleet Administration</Text>
              <Text style={[styles.contactValue, { color: theme.colors.link }]}>{BRAND_EMAIL}</Text>
              <Text style={[styles.contactLabel, { color: theme.colors.mute, marginTop: 2 }]}>Web: {BRAND_WEBSITE_DISPLAY}</Text>
            </View>
            <ExternalLink size={14} color={theme.colors.mute} />
          </TouchableOpacity>
        </Card>

        {/* Brand Footprint Footer */}
        <View style={styles.brandFooter}>
          <ReachInternationalLogo size={18} showTagline={false} />
          <Text style={[styles.brandFooterText, { color: theme.colors.mute }]}>
            {BRAND_NAME} • {BRAND_TAGLINE}
          </Text>
          <Text style={[styles.copyrightText, { color: theme.colors.mute }]}>
            {BRAND_WEBSITE_DISPLAY} • {BRAND_EMAIL}
          </Text>
          <Text style={[styles.copyrightText, { color: theme.colors.mute, marginTop: 2 }]}>
            © {new Date().getFullYear()} Reach International. All rights reserved.
          </Text>
        </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  // Desktop Left Showcase Panel
  desktopShowcasePanel: {
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  showcaseGlow: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.8,
    ...Platform.select({
      web: {
        filter: 'blur(50px)',
      },
      default: {},
    }),
  },
  showcaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  showcaseBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseHeroContent: {
    marginVertical: 'auto',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 22,
    zIndex: 2,
    paddingVertical: 12,
  },
  showcaseHeadingBlock: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 2,
  },
  showcaseTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
  },
  showcaseSubtitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
  },
  machineStageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
  },
  machinePedestalShadow: {
    position: 'absolute',
    bottom: 6,
    width: '85%',
    maxWidth: 320,
    height: 12,
    borderRadius: 9999,
    ...Platform.select({
      web: {
        filter: 'blur(4px)',
      },
      default: {
        opacity: 0.5,
      },
    }),
  },
  machineImage: {
    width: '100%',
    maxWidth: 340,
  },
  showcaseBottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  showcaseBottomText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainWorkspace: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  desktopHeaderBar: {
    height: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  desktopBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desktopBackText: {
    fontSize: 14,
    fontWeight: '600',
  },
  desktopHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  termsWrapper: {
    width: '100%',
    alignSelf: 'center',
    gap: spacingNumeric.md,
  },
  content: {
    padding: spacingNumeric.md,
    paddingBottom: spacingNumeric['3xl'],
  },
  card: {
    marginBottom: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.lg,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
  },
  heroTitleCol: {
    flex: 1,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  versionText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13.5,
    marginTop: 3,
  },
  divider: {
    height: 1,
    marginVertical: spacingNumeric.md,
  },
  leadParagraph: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionHeaderRow: {
    marginBottom: spacingNumeric.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  bulletList: {
    gap: 10,
    marginTop: spacingNumeric.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  warningInset: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.sm,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.md,
  },
  contactLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.xl,
    gap: 4,
  },
  brandFooterText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  copyrightText: {
    fontSize: 12,
  },
});
