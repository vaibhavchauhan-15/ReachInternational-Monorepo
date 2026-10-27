/**
 * ReachInternational Mobile — Account Deletion Guide Screen
 * Clean, minimal, short on-point compliance & data erasure guide.
 * Fulfills Google Play Store policies and statutory DPDPA regulations.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Button,
  useTheme,
  MobileHeader,
  Text,
} from '../../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Clock,
  ArrowLeft,
} from '../../../components/ui/icon';

export default function AccountDeletionGuideScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Account Deletion Guide"
        showBack={true}
        backRoute="/account-deletion"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Policy Overview Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                },
              ]}
            >
              <ShieldCheck size={20} color="#0284c7" />
            </View>
            <View style={styles.headerTextCol}>
              <Text variant="subheading" style={{ color: theme.colors.ink }}>
                Account &amp; Data Erasure Policy
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Google Play Store Policy &amp; DPDPA Compliance
              </Text>
            </View>
          </View>

          <Text variant="body" style={[styles.bodyText, { color: theme.colors.body }]}>
            Under statutory data privacy regulations and Google Play Developer policies, you have the right to permanently delete your account and erase all associated personal records.
          </Text>
        </Card>

        {/* Section 1: Data Permanently Purged */}
        <Card
          variant="elevated"
          style={[
            styles.card,
            {
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.03)',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <CheckCircle2 size={16} color="#059669" />
            <Text variant="subheading" style={{ color: '#059669' }}>
              1. Data Permanently Purged
            </Text>
          </View>
          <Text variant="caption" style={[styles.listText, { color: theme.colors.ink }]}>
            • Full legal name, official business email, and phone number{'\n'}
            • Password credentials, active sessions, and auth tokens{'\n'}
            • Aadhaar and Driving Licence numbers and document scans{'\n'}
            • Device telemetry, push tokens (FCM/APNS), and cached files
          </Text>
        </Card>

        {/* Section 2: Permanent & Irreversible */}
        <Card
          variant="elevated"
          style={[
            styles.card,
            {
              borderColor: isDark ? 'rgba(220, 38, 38, 0.25)' : 'rgba(220, 38, 38, 0.2)',
              backgroundColor: isDark ? 'rgba(220, 38, 38, 0.05)' : 'rgba(220, 38, 38, 0.03)',
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <AlertTriangle size={16} color="#dc2626" />
            <Text variant="subheading" style={{ color: '#dc2626' }}>
              2. Permanent &amp; Irreversible
            </Text>
          </View>
          <Text variant="caption" style={[styles.listText, { color: theme.colors.ink }]}>
            • Account deletion is permanent and cannot be undone or recovered.{'\n'}
            • All platform access, machinery permissions, and keys are revoked immediately.{'\n'}
            • Re-joining will require complete re-onboarding and KYC verification as a new user.
          </Text>
        </Card>

        {/* Section 3: Statutory Machinery Records Exception */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeader}>
            <FileCheck size={16} color="#d97706" />
            <Text variant="subheading" style={{ color: '#d97706' }}>
              3. Statutory Equipment Records Exception
            </Text>
          </View>
          <Text variant="caption" style={[styles.bodyText, { color: theme.colors.body }]}>
            Under the Indian Factories Act (1948) and heavy equipment safety legislation, historical machine hour meter logs (HMR), pre-shift checklists, and maintenance breakdown records are decoupled from your identity and retained in an anonymized format under machinery asset codes for audit compliance.
          </Text>
        </Card>

        {/* Section 4: SLA & Processing Timeline */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.sectionHeader}>
            <Clock size={16} color="#0284c7" />
            <Text variant="subheading" style={{ color: '#0284c7' }}>
              4. Processing Timeline &amp; SLA
            </Text>
          </View>
          <Text variant="caption" style={[styles.bodyText, { color: theme.colors.body }]}>
            Requests are acknowledged within 48 hours and finalized within 14 business days. You will receive an automated email notification once the account de-provisioning is complete.
          </Text>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            label="Proceed to Account Deletion"
            onPress={() => router.push('/account-deletion')}
            variant="destructive"
            size="md"
            icon={<Trash2 size={16} color="#ffffff" />}
            fullWidth
          />

          <Button
            label="Back to Account Deletion"
            onPress={() => router.back()}
            variant="outline"
            size="md"
            icon={<ArrowLeft size={16} color={theme.colors.ink} />}
            fullWidth
            style={{ marginTop: spacingNumeric.sm }}
          />
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
    paddingBottom: spacingNumeric.xl,
  },
  card: {
    marginVertical: spacingNumeric.xs,
    padding: spacingNumeric.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bodyText: {
    marginTop: 2,
  },
  listText: {
    marginTop: 4,
  },
  actionsContainer: {
    marginTop: spacingNumeric.md,
    marginBottom: spacingNumeric.lg,
  },
});
