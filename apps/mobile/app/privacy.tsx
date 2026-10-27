/**
 * ReachInternational Mobile — Privacy Policy Screen (Publicly Accessible)
 * Route: /privacy
 * 
 * Publicly viewable enterprise fleet operations, telemetry privacy,
 * and statutory KYC data protection policy.
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '../components/ui/touch/Pressable';
import {
  Card,
  useTheme,
  MobileHeader,
  ReachLongLogo,
  Text,
  Separator,
} from '../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from '../lib/brand';
import {
  CheckCircle2,
  Mail,
  ExternalLink,
} from '../components/ui/icon';

export interface PrivacyPolicyScreenProps {
  onPressBack?: () => void;
  backRoute?: string;
}

export default function PrivacyPolicyScreen({ onPressBack, backRoute }: PrivacyPolicyScreenProps = {}) {
  const router = useRouter();
  const { theme } = useTheme();

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Privacy%20Policy%20Inquiry`);
  };

  const handleBack = useCallback(() => {
    if (onPressBack) {
      onPressBack();
      return;
    }
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    if (backRoute) {
      router.replace(backRoute as any);
      return;
    }
    router.replace('/settings' as any);
  }, [onPressBack, backRoute, router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!backRoute && !onPressBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [backRoute, onPressBack, handleBack]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header with Back Button */}
      <MobileHeader
        title="Privacy Policy"
        showBack={true}
        backRoute={backRoute}
        onPressBack={handleBack}
        showQuickAccess={false}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Policy Metadata Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTitleCol}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Data Protection & Privacy
              </Text>
              <Text variant="caption" style={[styles.heroSubtitle, { color: theme.colors.mute }]}>
                Last Updated: September 11, 2026 • Effective Immediately
              </Text>
            </View>
            <View
              style={[
                styles.versionPill,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                v2026.09
              </Text>
            </View>
          </View>

          <Separator className="my-4" />

          <Text variant="body" style={{ color: theme.colors.body }}>
            At {BRAND_NAME}, we prioritize the confidentiality, integrity, and security of operator records, industrial telemetry, and client fleet assets. This Privacy Policy governs the collection, processing, and protection of data captured through our mobile field application and enterprise platform.
          </Text>
        </Card>

        {/* Section 1: Data We Collect */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
              1. INFORMATION WE COLLECT
            </Text>
          </View>

          <Text variant="caption" style={[styles.sectionDescription, { color: theme.colors.mute }]}>
            In order to coordinate machinery operations, track duty shifts, and maintain heavy equipment safety, we collect:
          </Text>

          {/* Operational Shift & Telemetry */}
          <View
            style={[
              styles.insetSection,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="label" style={[styles.insetTitle, { color: theme.colors.ink }]}>
              Operational & Hour Meter Telemetry
            </Text>
            <Text variant="caption" style={{ color: theme.colors.body }}>
              • Hour Meter Readings (HMR): Initial and closing meter logs recorded at shift start and end.{'\n'}
              • Equipment Status: Operating hours, breakdown incident tickets, and hydraulic/structural checklist results.{'\n'}
              • Shift Timestamps: Check-in/check-out timestamps, overtime hour records, and base yard check-ins.
            </Text>
          </View>

          {/* Identity & Statutory KYC */}
          <View
            style={[
              styles.insetSection,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                marginTop: 10,
              },
            ]}
          >
            <Text variant="label" style={[styles.insetTitle, { color: theme.colors.ink }]}>
              Operator Identity & Statutory KYC
            </Text>
            <Text variant="caption" style={{ color: theme.colors.body }}>
              • Account Details: Full name, official email address, mobile phone number, and system role.{'\n'}
              • Statutory Credentials: Government identity numbers (Aadhaar masked in compliance with statutory standards) and Heavy Vehicle / Crane / MEWP Operator Driving Licences for machine authorization.
            </Text>
          </View>

          {/* Device & Diagnostics */}
          <View
            style={[
              styles.insetSection,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                marginTop: 10,
              },
            ]}
          >
            <Text variant="label" style={[styles.insetTitle, { color: theme.colors.ink }]}>
              Device & Operational Diagnostics
            </Text>
            <Text variant="caption" style={{ color: theme.colors.body }}>
              • Device platform runtime (React Native / Expo), OS version, and network connectivity state for offline cache synchronization.{'\n'}
              • Push notification tokens used strictly for critical shift collision alerts, breakdown notices, and dispatch dispatches.
            </Text>
          </View>
        </Card>

        {/* Section 2: Purpose of Processing */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
              2. PURPOSE OF DATA PROCESSING
            </Text>
          </View>

          <Text variant="caption" style={[styles.sectionDescription, { color: theme.colors.mute }]}>
            We process operational and personal data strictly for legitimate industrial fleet management purposes:
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text variant="label" style={{ color: theme.colors.ink }}>Machinery Custody & Dispatch: </Text>
                Verifying qualified operator credentials before dispatching access to heavy industrial machinery.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text variant="label" style={{ color: theme.colors.ink }}>Shift & Overtime Transparency: </Text>
                Accurately tracking machine running hours to prevent operator fatigue, schedule collisions, and billing discrepancies.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text variant="label" style={{ color: theme.colors.ink }}>Preventative Fleet Maintenance: </Text>
                Forecasting servicing cycles, hydraulic inspections, and component replacements based on actual running hours.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text variant="label" style={{ color: theme.colors.ink }}>Industrial Safety Audits: </Text>
                Maintaining tamper-evident logs for site safety investigations, regulatory inspections, and insurance compliance.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 3: Data Security & Access Controls */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
              3. DATA SECURITY & ACCESS CONTROLS
            </Text>
          </View>

          <Text variant="caption" style={[styles.sectionDescription, { color: theme.colors.body }]}>
            {BRAND_NAME} implements multi-layered enterprise cybersecurity controls to safeguard all platform records:
          </Text>

          <View style={styles.securityPoint}>
            <Text variant="label" style={{ color: theme.colors.ink }}>• PostgreSQL Row-Level Security (RLS)</Text>
            <Text variant="caption" style={[styles.securityBody, { color: theme.colors.mute }]}>
              Data queries are strictly restricted at the database engine level according to user role and tenant scoping. Operators only access their own shifts and assigned equipment.
            </Text>
          </View>

          <View style={styles.securityPoint}>
            <Text variant="label" style={{ color: theme.colors.ink }}>• Role-Based Access Control (RBAC)</Text>
            <Text variant="caption" style={[styles.securityBody, { color: theme.colors.mute }]}>
              System roles (Super Admin, Service Manager, Engineer, Operator, Client) possess compartmentalized privileges. Sensitive personal data is shielded from unauthorized peers.
            </Text>
          </View>

          <View style={styles.securityPoint}>
            <Text variant="label" style={{ color: theme.colors.ink }}>• Cryptographic Transit & Storage</Text>
            <Text variant="caption" style={[styles.securityBody, { color: theme.colors.mute }]}>
              All communications between mobile devices, offline caches, and cloud servers are encrypted using TLS 1.3. User passwords and tokens utilize salted cryptographic hashing.
            </Text>
          </View>
        </Card>

        {/* Section 4: Data Retention & User Rights */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
              4. DATA RETENTION & OPERATOR RIGHTS
            </Text>
          </View>

          <Text variant="body" style={{ color: theme.colors.body }}>
            Heavy machinery safety inspection records, Hour Meter logs, and signed delivery challans are retained for a minimum of seven (7) years in accordance with industrial equipment safety regulations.
          </Text>

          {/* Zero Data Sale Guarantee */}
          <View
            style={[
              styles.insetSection,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                marginTop: 10,
              },
            ]}
          >
            <Text variant="label" style={[styles.insetTitle, { color: theme.colors.ink }]}>
              Strict Zero Data Sale Guarantee
            </Text>
            <Text variant="caption" style={{ color: theme.colors.body }}>
              {BRAND_NAME} never sells, monetizes, or trades personal identity details, operator records, or equipment telemetry with third-party advertisers or data brokers under any circumstances.
            </Text>
          </View>

          {/* Account Deletion Info */}
          <View
            style={[
              styles.insetSection,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                marginTop: 10,
              },
            ]}
          >
            <Text variant="label" style={[styles.insetTitle, { color: theme.colors.ink }]}>
              Account Deletion (Google Play Compliant)
            </Text>
            <Text variant="caption" style={{ color: theme.colors.body }}>
              • In-App: Settings → Account → Delete Account.{'\n'}
              • Web Portal: Visit {BRAND_WEBSITE_DISPLAY}/delete-account.{'\n'}
              • Email: Send request to {BRAND_EMAIL}.{'\n'}
              Personal identity credentials and KYC documents are permanently expunged within 14 business days.
            </Text>
          </View>
        </Card>

        {/* Section 5: Contact & Grievance */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
              5. GRIEVANCE REDRESSAL & CONTACT
            </Text>
          </View>

          <Text variant="body" style={{ color: theme.colors.body }}>
            For privacy inquiries, statutory compliance requests, or data correction submissions, contact our Data Protection and Compliance Desk:
          </Text>

          <Pressable
            variant="card"
            style={[
              styles.contactBox,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
            onPress={handleContactEmail}
          >
            <Mail size={16} color={theme.colors.link} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Compliance & Data Protection Office
              </Text>
              <Text variant="label" style={{ color: theme.colors.link }}>
                {BRAND_EMAIL}
              </Text>
            </View>
            <ExternalLink size={14} color={theme.colors.mute} />
          </Pressable>
        </Card>

        {/* Brand Footprint Footer */}
        <View style={styles.brandFooter}>
          <ReachLongLogo width={140} height={70} />
          <Text variant="micro" style={{ color: theme.colors.mute }}>
            © {new Date().getFullYear()} Reach International. All rights reserved.
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
  heroSubtitle: {
    marginTop: 3,
  },
  sectionHeaderRow: {
    marginBottom: spacingNumeric.sm,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  sectionDescription: {
    marginBottom: spacingNumeric.md,
  },
  insetSection: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
  },
  insetTitle: {
    marginBottom: 6,
  },
  bulletList: {
    gap: 10,
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
  },
  securityPoint: {
    marginTop: 10,
  },
  securityBody: {
    marginTop: 2,
  },
  contactBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.md,
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingNumeric.xl,
    gap: 4,
  },
  brandFooterText: {
    marginTop: 6,
  },
});
