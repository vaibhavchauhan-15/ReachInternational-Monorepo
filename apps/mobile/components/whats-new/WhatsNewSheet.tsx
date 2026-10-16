/**
 * ReachInternational Mobile — WhatsNewSheet Component
 * Production-ready bottom sheet modal announcing release highlights
 * and new features following app release or compatible OTA update.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { AppModal } from '../ui/AppModal';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { haptics } from '../../lib/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { ReleaseBadge } from './ReleaseBadge';
import { ReleaseHighlightRow } from './ReleaseHighlightRow';
import type { ReleaseItem, ReleaseHighlight } from '../../lib/whats-new/types';

export interface WhatsNewSheetProps {
  visible: boolean;
  onClose: () => void;
  release: ReleaseItem | null;
  highlights?: ReleaseHighlight[];
  onViewAllChanges?: () => void;
  testID?: string;
}

export function WhatsNewSheet({
  visible,
  onClose,
  release,
  highlights,
  onViewAllChanges,
  testID = 'whats-new-sheet',
}: WhatsNewSheetProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (!release) return null;

  const displayHighlights = highlights ?? release.highlights;

  const handleAcknowledge = () => {
    haptics.select();
    onClose();
  };

  const handleViewAll = () => {
    haptics.select();
    onClose();
    if (onViewAllChanges) {
      onViewAllChanges();
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleAcknowledge}
      variant="bottom"
      testID={testID}
      panelStyle={[
        styles.panel,
        {
          backgroundColor: isDark ? theme.colors.canvasElevated : '#ffffff',
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={styles.container}>
        {/* Release Header */}
        <View style={styles.header}>
          <ReleaseBadge
            version={release.version}
            type={release.type}
            isMajor={release.isMajor}
            style={styles.badge}
          />
          <Text variant="title" style={[styles.title, { color: theme.colors.ink }]}>
            {release.title}
          </Text>
          {release.subtitle ? (
            <Text variant="body" style={[styles.subtitle, { color: theme.colors.body }]}>
              {release.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Scrollable Highlights List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {displayHighlights.map((highlight, index) => (
            <ReleaseHighlightRow
              key={highlight.id}
              highlight={highlight}
              isLast={index === displayHighlights.length - 1}
            />
          ))}
        </ScrollView>

        {/* Footer Actions */}
        <View
          style={[
            styles.footer,
            {
              borderTopColor: theme.colors.hairline,
              paddingBottom: Math.max(insets.bottom, spacingNumeric.md),
            },
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            onPress={handleAcknowledge}
            style={styles.primaryButton}
            accessibilityLabel="Acknowledge release updates and continue"
          >
            Got it
          </Button>

          {onViewAllChanges ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleViewAll}
              style={styles.secondaryButton}
              accessibilityLabel="View full release notes and version history"
            >
              View all changes
            </Button>
          ) : null}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  container: {
    paddingTop: spacingNumeric.sm,
  },
  header: {
    paddingHorizontal: spacingNumeric.lg,
    paddingBottom: spacingNumeric.sm,
  },
  badge: {
    marginBottom: spacingNumeric.xs,
  },
  title: {
    marginBottom: spacingNumeric.xs,
  },
  subtitle: {
    marginTop: 2,
  },
  scrollView: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.xs,
  },
  footer: {
    paddingTop: spacingNumeric.md,
    paddingHorizontal: spacingNumeric.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacingNumeric.xs,
  },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: radiusNumeric.lg,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 44,
  },
});
