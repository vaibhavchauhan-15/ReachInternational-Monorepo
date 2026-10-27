/**
 * ReachInternational Mobile — Terms of Service Screen (Publicly Accessible)
 * Route: /terms
 * 
 * Publicly viewable enterprise fleet usage conditions, machinery custody responsibilities,
 * and industrial safety compliance.
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  Image,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  useTheme,
  MobileHeader,
  ReachLongLogo,
  Text,
} from '../components/ui';
import { Pressable } from '../components/ui/touch/Pressable';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  BRAND_NAME,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from '../lib/brand';
import {
  CheckCircle2,
  Mail,
  ExternalLink,
} from '../components/ui/icon';

export interface TermsOfServiceScreenProps {
  onPressBack?: () => void;
  backRoute?: string;
}

export default function TermsOfServiceScreen({ onPressBack, backRoute }: TermsOfServiceScreenProps = {}) {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isShortScreen = height < 740;

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Terms%20of%20Service%20Inquiry`);
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.canvas,
        },
      ]}
    >
      <MobileHeader
        title="Terms of Service"
        showBack={true}
        backRoute={backRoute}
        onPressBack={handleBack}
        showQuickAccess={false}
      />

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
        <View style={styles.termsWrapper}>
            {/* Terms Metadata Card */}
            <Card variant="elevated" style={styles.card}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Terms of Service
              </Text>
              <Text variant="caption" style={[styles.heroSubtitle, { color: theme.colors.mute }]}>
                Last Updated: September 11, 2026 • Effective Immediately
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              <Text variant="body" style={{ color: theme.colors.body }}>
                These Terms of Service (&quot;Agreement&quot;) govern the access and use of the {BRAND_NAME} mobile application and cloud fleet management platform. By signing in, recording equipment logs, or accessing client assets, you agree to comply with these terms.
              </Text>
            </Card>

            {/* Section 1: Authorized Access */}
            <Card variant="elevated" style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                  1. AUTHORIZED PERSONNEL & ACCOUNT SECURITY
                </Text>
              </View>

              <Text variant="body" style={{ color: theme.colors.body }}>
                Access to this application is restricted to authorized fleet personnel (Supervisors, Fleet Engineers, Heavy Machinery Operators, and Client Representatives).
              </Text>

              <View style={styles.bulletList}>
                <View style={styles.bulletRow}>
                  <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
                  <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                    <Text variant="label" style={{ color: theme.colors.ink }}>Credential Confidentiality: </Text>
                    You are responsible for safeguarding your login credentials. Sharing session keys, PINs, or passwords with third parties is strictly prohibited.
                  </Text>
                </View>

                <View style={styles.bulletRow}>
                  <CheckCircle2 size={15} color="#059669" style={styles.bulletIcon} />
                  <Text variant="caption" style={[styles.bulletText, { color: theme.colors.body }]}>
                    <Text variant="label" style={{ color: theme.colors.ink }}>Statutory Certification: </Text>
                    Equipment operators must maintain active, government-issued heavy equipment or crane operator licenses.
                  </Text>
                </View>
              </View>
            </Card>

            {/* Section 2: Hour Meter Readings (HMR) */}
            <Card variant="elevated" style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                  2. HOUR METER INTEGRITY & ANTI-FALSIFICATION
                </Text>
              </View>

              <Text variant="body" style={{ color: theme.colors.body }}>
                Hour Meter Readings (HMR) represent critical legal records utilized for industrial billing, shift payroll, preventative maintenance scheduling, and workplace safety insurance.
              </Text>

              <View
                style={[
                  styles.warningInset,
                  {
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    borderColor: 'rgba(220, 38, 38, 0.3)',
                  },
                ]}
              >
                <Text variant="label" style={{ color: '#dc2626', marginBottom: 4 }}>
                  Zero Tolerance for Telemetry Tampering
                </Text>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Intentional falsification or tampering of machinery running hours constitutes industrial misconduct, resulting in immediate account revocation.
                </Text>
              </View>
            </Card>

            {/* Section 3: Contact */}
            <Card variant="elevated" style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                  3. INQUIRIES & LEGAL NOTICES
                </Text>
              </View>

              <Text variant="body" style={{ color: theme.colors.body }}>
                For inquiries regarding our Terms of Service or enterprise contracts, reach out to our legal and fleet administration team:
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
                    Legal & Fleet Administration
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
          </View>
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  termsWrapper: {
    width: '100%',
    maxWidth: 800,
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
  heroSubtitle: {
    marginTop: 3,
  },
  divider: {
    height: 1,
    marginVertical: spacingNumeric.md,
  },
  sectionHeaderRow: {
    marginBottom: spacingNumeric.sm,
  },
  sectionTitle: {
    textTransform: 'uppercase',
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
  },
  warningInset: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.sm,
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
