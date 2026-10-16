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
import { Pressable } from '../components/ui/touch/Pressable';
import {
  Card,
  useTheme,
  MobileHeader,
  ReachInternationalLogo,
  Text,
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
  ArrowLeft,
} from '../components/ui/icon';

const loginPageImage = require('../assets/loginpageimage.png');

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
  const showcaseWidth = isDesktop ? Math.min(520, Math.max(380, Math.round(width * 0.38))) : 0;
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${BRAND_EMAIL}?subject=Terms%20of%20Service%20Inquiry`);
  };

  const handleBack = useCallback(() => {
    if (onPressBack) {
      onPressBack();
      return;
    }
    if (backRoute) {
      router.replace(backRoute as any);
      return;
    }
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings' as any);
    }
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
          flexDirection: isDesktop ? 'row' : 'column',
        },
      ]}
    >
      {/* Desktop Left Showcase Panel (>=1024px) */}
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
          {/* Top Header Row with Back Button & Logo */}
          <View style={styles.showcaseHeaderRow}>
            <Pressable
              variant="iconButton"
              hitSlopToMin48
              onPress={handleBack}
              style={[
                styles.showcaseBackBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={16} color={theme.colors.ink} />
            </Pressable>
            <ReachInternationalLogo variant="full" size={28} iconType="scissor" />
          </View>

          {/* Central Hero Stage */}
          <View style={styles.showcaseHeroContent}>
            <View style={styles.showcaseHeadingBlock}>
              <Text
                variant="display"
                style={{ color: isDark ? '#ffffff' : '#0f172a' }}
              >
                Platform Terms.
              </Text>
              <Text
                variant="heading"
                style={{ color: primarySkyBlue }}
              >
                Safety & Compliance.
              </Text>
            </View>

            <View style={styles.machineStageContainer}>
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
            <Text variant="caption" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
              Enterprise Fleet Governance · Statutory Safety
            </Text>
          </View>
        </View>
      )}

      {/* Main Workspace */}
      <View style={[styles.mainWorkspace, { backgroundColor: theme.colors.canvas }]}>
        {!isDesktop ? (
          <MobileHeader
            title="Terms of Service"
            showBack={true}
            backRoute={backRoute}
            onPressBack={handleBack}
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
            <Pressable
              variant="buttonGhost"
              hitSlopToMin48
              onPress={handleBack}
              style={styles.desktopBackRow}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={16} color={theme.colors.ink} />
              <Text variant="label" style={{ color: theme.colors.ink }}>
                Back
              </Text>
            </Pressable>
            <Text variant="subheading" style={{ color: theme.colors.ink }}>
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
              <ReachInternationalLogo size={18} showTagline={false} />
              <Text variant="caption" style={[styles.brandFooterText, { color: theme.colors.mute }]}>
                {BRAND_NAME} • {BRAND_TAGLINE}
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
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
  machineStageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
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
