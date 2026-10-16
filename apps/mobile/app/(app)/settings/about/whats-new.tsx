/**
 * ReachInternational Mobile — What's New & Release Notes History Screen
 * Route: /settings/about/whats-new
 *
 * Dedicated screen enabling users to explore current release highlights
 * and browse the verified version changelog on demand.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, useTheme, Text } from '../../../../components/ui';
import { SettingsScreenContainer } from '../../../../components/settings';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { ReleaseBadge, ReleaseHighlightRow } from '../../../../components/whats-new';
import { useWhatsNew } from '../../../../lib/whats-new';
import { Sparkles, History } from '../../../../components/ui/icon';

export default function WhatsNewScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { releaseHistory, getFilteredHighlights } = useWhatsNew();

  const handleBack = () => {
    router.replace('/settings/about' as any);
  };

  const latestRelease = releaseHistory[0];
  const pastReleases = releaseHistory.slice(1);

  return (
    <SettingsScreenContainer
      title="What's New"
      showBack={true}
      backRoute="/settings/about"
      onPressBack={handleBack}
      contentContainerStyle={styles.containerContent}
    >
      {/* Current Release Banner Card */}
      {latestRelease ? (
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
          <View style={styles.heroTop}>
            <View style={styles.heroHeaderRow}>
              <ReleaseBadge
                version={latestRelease.version}
                type={latestRelease.type}
                isMajor={latestRelease.isMajor}
              />
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {latestRelease.releaseDate}
              </Text>
            </View>

            <Text variant="heading" style={[styles.heroTitle, { color: theme.colors.ink }]}>
              {latestRelease.title}
            </Text>
            {latestRelease.subtitle ? (
              <Text variant="body" style={[styles.heroSubtitle, { color: theme.colors.body }]}>
                {latestRelease.subtitle}
              </Text>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

          <View style={styles.highlightsContainer}>
            {getFilteredHighlights(latestRelease).map((highlight, index, arr) => (
              <ReleaseHighlightRow
                key={highlight.id}
                highlight={highlight}
                isLast={index === arr.length - 1}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {/* Historical Releases Section */}
      {pastReleases.length > 0 ? (
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <History size={16} color={theme.colors.mute} />
            <Text variant="subheading" style={[styles.sectionTitle, { color: theme.colors.mute }]}>
              Previous Releases
            </Text>
          </View>

          {pastReleases.map((release) => (
            <Card
              key={release.releaseId}
              variant="elevated"
              style={[
                styles.pastCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.pastHeader}>
                <ReleaseBadge version={release.version} type={release.type} />
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  {release.releaseDate}
                </Text>
              </View>

              <Text variant="subheading" style={[styles.pastTitle, { color: theme.colors.ink }]}>
                {release.title}
              </Text>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              <View style={styles.highlightsContainer}>
                {getFilteredHighlights(release).map((highlight, idx, arr) => (
                  <ReleaseHighlightRow
                    key={highlight.id}
                    highlight={highlight}
                    isLast={idx === arr.length - 1}
                  />
                ))}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    paddingBottom: spacingNumeric['2xl'],
  },
  heroCard: {
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.lg,
  },
  heroTop: {
    marginBottom: spacingNumeric.sm,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xs,
  },
  heroTitle: {
    marginTop: spacingNumeric.xs,
    marginBottom: 4,
  },
  heroSubtitle: {
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacingNumeric.sm,
  },
  highlightsContainer: {
    paddingTop: 2,
  },
  historySection: {
    marginTop: spacingNumeric.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  pastCard: {
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xs,
  },
  pastTitle: {
    marginTop: 2,
  },
});
