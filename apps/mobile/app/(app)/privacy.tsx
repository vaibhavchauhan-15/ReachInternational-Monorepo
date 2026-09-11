/**
 * ReachInternational Mobile — Privacy Policy Screen
 * Enterprise fleet operations, telemetry privacy, and statutory KYC data protection policy.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
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
} from 'lucide-react-native';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Privacy%20Policy%20Inquiry`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header with Back Button */}
      <MobileHeader
        title="Privacy Policy"
        showBack={true}
        onPressBack={() => router.back()}
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
              <Text style={[styles.heroTitle, { color: theme.colors.ink }]}>Data Protection & Privacy</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.mute }]}>
                Last Updated: September 11, 2026 • Effective Immediately
              </Text>
            </View>
            <View style={[styles.versionPill, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.versionText, { color: theme.colors.mute }]}>v2026.09</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <Text style={[styles.leadParagraph, { color: theme.colors.body }]}>
            At {BRAND_NAME}, we prioritize the confidentiality, integrity, and security of operator records, industrial telemetry, and client fleet assets. This Privacy Policy governs the collection, processing, and protection of data captured through our mobile field application and enterprise platform.
          </Text>
        </Card>

        {/* Section 1: Data We Collect */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>1. INFORMATION WE COLLECT</Text>
          </View>

          <Text style={[styles.sectionDescription, { color: theme.colors.mute }]}>
            In order to coordinate machinery operations, track duty shifts, and maintain heavy equipment safety, we collect:
          </Text>

          {/* Operational Shift & Telemetry */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>Operational & Hour Meter Telemetry</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              • Hour Meter Readings (HMR): Initial and closing meter logs recorded at shift start and end.{'\n'}
              • Equipment Status: Operating hours, breakdown incident tickets, and hydraulic/structural checklist results.{'\n'}
              • Shift Timestamps: Check-in/check-out timestamps, overtime hour records, and base yard check-ins.
            </Text>
          </View>

          {/* Identity & Statutory KYC */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline, marginTop: 10 }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>Operator Identity & Statutory KYC</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              • Account Details: Full name, official email address, mobile phone number, and system role.{'\n'}
              • Statutory Credentials: Government identity numbers (Aadhaar masked in compliance with statutory standards) and Heavy Vehicle / Crane / MEWP Operator Driving Licences for machine authorization.
            </Text>
          </View>

          {/* Device & Diagnostics */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline, marginTop: 10 }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>Device & Operational Diagnostics</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              • Device platform runtime (React Native / Expo), OS version, and network connectivity state for offline cache synchronization.{'\n'}
              • Push notification tokens used strictly for critical shift collision alerts, breakdown notices, and dispatch dispatches.
            </Text>
          </View>
        </Card>

        {/* Section 2: Purpose of Processing */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>2. PURPOSE OF DATA PROCESSING</Text>
          </View>

          <Text style={[styles.sectionDescription, { color: theme.colors.mute }]}>
            We process operational and personal data strictly for legitimate industrial fleet management purposes:
          </Text>

          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Machinery Custody & Dispatch: </Text>
                Verifying qualified operator credentials before dispatching access to heavy industrial machinery.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Shift & Overtime Transparency: </Text>
                Accurately tracking machine running hours to prevent operator fatigue, schedule collisions, and billing discrepancies.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Preventative Fleet Maintenance: </Text>
                Forecasting servicing cycles, hydraulic inspections, and component replacements based on actual running hours.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: theme.colors.body }]}>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>Industrial Safety Audits: </Text>
                Maintaining tamper-evident logs for site safety investigations, regulatory inspections, and insurance compliance.
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 3: Data Security & Access Controls */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>3. DATA SECURITY & ACCESS CONTROLS</Text>
          </View>

          <Text style={[styles.sectionDescription, { color: theme.colors.body }]}>
            {BRAND_NAME} implements multi-layered enterprise cybersecurity controls to safeguard all platform records:
          </Text>

          <View style={styles.securityPoint}>
            <Text style={[styles.securityTitle, { color: theme.colors.ink }]}>• PostgreSQL Row-Level Security (RLS)</Text>
            <Text style={[styles.securityBody, { color: theme.colors.mute }]}>
              Data queries are strictly restricted at the database engine level according to user role and tenant scoping. Operators only access their own shifts and assigned equipment.
            </Text>
          </View>

          <View style={styles.securityPoint}>
            <Text style={[styles.securityTitle, { color: theme.colors.ink }]}>• Role-Based Access Control (RBAC)</Text>
            <Text style={[styles.securityBody, { color: theme.colors.mute }]}>
              System roles (Super Admin, Service Manager, Engineer, Operator, Client) possess compartmentalized privileges. Sensitive personal data (Aadhaar, contact details) is shielded from unauthorized peers.
            </Text>
          </View>

          <View style={styles.securityPoint}>
            <Text style={[styles.securityTitle, { color: theme.colors.ink }]}>• Cryptographic Transit & Storage</Text>
            <Text style={[styles.securityBody, { color: theme.colors.mute }]}>
              All communications between mobile devices, offline caches, and cloud servers are encrypted using TLS 1.3. User passwords and authentication tokens utilize salted cryptographic hashing and are never accessible to platform operators.
            </Text>
          </View>

          <View style={styles.securityPoint}>
            <Text style={[styles.securityTitle, { color: theme.colors.ink }]}>• Tamper-Evident Audit Logging</Text>
            <Text style={[styles.securityBody, { color: theme.colors.mute }]}>
              Modifications to machine hour readings, operator assignments, and account statuses produce immutable structured audit trails containing user IDs, timestamps, and network IPs.
            </Text>
          </View>
        </Card>

        {/* Section 4: Data Retention & User Rights */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>4. DATA RETENTION & OPERATOR RIGHTS</Text>
          </View>

          <Text style={[styles.leadParagraph, { color: theme.colors.body }]}>
            Heavy machinery safety inspection records, Hour Meter logs, and signed delivery challans are retained for a minimum of seven (7) years in accordance with industrial equipment safety regulations and statutory limitation acts.
          </Text>

          <Text style={[styles.bodyText, { color: theme.colors.body, marginTop: 8 }]}>
            Authorized operators have the right to request review of their personal profile, submit correction requests for contact and KYC credentials via the in-app Edit Profile workflow, or request permanent account erasure.
          </Text>

          {/* Zero Data Sale Guarantee */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline, marginTop: 10 }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>Strict Zero Data Sale Guarantee</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              {BRAND_NAME} never sells, monetizes, or trades personal identity details, operator records, or equipment telemetry with third-party advertisers or data brokers under any circumstances.
            </Text>
          </View>

          {/* Account Deletion Info */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline, marginTop: 10 }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>Account Deletion (Google Play Compliant)</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              • In-App: Settings → My Account → Request Account Deletion.{'\n'}
              • Web Portal: Visit {BRAND_WEBSITE_DISPLAY}/account-deletion.{'\n'}
              • Email: Send request to {BRAND_EMAIL}.{'\n'}
              Personal identity credentials and KYC documents are permanently expunged within 14 business days.
            </Text>
          </View>

          {/* 18+ Working Age */}
          <View style={[styles.insetSection, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline, marginTop: 10 }]}>
            <Text style={[styles.insetTitle, { color: theme.colors.ink }]}>18+ Working Age & Eligibility</Text>
            <Text style={[styles.insetText, { color: theme.colors.body }]}>
              Operating heavy industrial equipment is strictly restricted to verified personnel of legal working age (minimum 18 years) with valid statutory licences. We do not collect minor data.
            </Text>
          </View>
        </Card>

        {/* Section 5: Contact & Grievance */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>5. GRIEVANCE REDRESSAL & CONTACT</Text>
          </View>

          <Text style={[styles.bodyText, { color: theme.colors.body }]}>
            For privacy inquiries, statutory compliance requests, or data correction submissions, contact our Data Protection and Compliance Desk:
          </Text>

          <TouchableOpacity
            style={[styles.contactBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
            onPress={handleContactEmail}
          >
            <Mail size={16} color={theme.colors.link} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.contactLabel, { color: theme.colors.mute }]}>Compliance & Data Protection Office</Text>
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
  versionText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 12,
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
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacingNumeric.md,
  },
  insetSection: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
  },
  insetTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  insetText: {
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 13,
    lineHeight: 19,
  },
  securityPoint: {
    marginTop: 10,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  securityBody: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 11,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  copyrightText: {
    fontSize: 11,
  },
});
