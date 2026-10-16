import React, { useState, memo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Icon } from './icon';
import { AppModal } from './AppModal';
import { Touchable } from './Touchable';
import { haptics } from '../../lib/haptics';
import { ReachBrandEmblem, ReachInternationalLogo } from '../branding';
import { Share2, Copy, Check, ExternalLink, X } from './icon';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';

export interface SharedLinkPreviewCardProps {
  url: string;
  title?: string;
  description?: string;
  style?: ViewStyle;
  onClose?: () => void;
  asModal?: boolean;
  visible?: boolean;
}

/**
 * SharedLinkPreviewCard — Enterprise rich link preview card & modal.
 * Shows the official Reach International brand logo preview, URL pill,
 * metadata, and 1-tap Copy/Share actions.
 *
 * Polarity: In dark theme uses the LIGHT logo; in light theme uses the DARK logo.
 */
export const SharedLinkPreviewCard = memo(function SharedLinkPreviewCard({
  url,
  title = 'Reach International Fleet Portal',
  description = 'Direct link to fleet machinery specification, daily logs, and maintenance records.',
  style,
  onClose,
  asModal = false,
  visible = true,
}: SharedLinkPreviewCardProps) {
  const { theme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title, text: description, url });
          return;
        }
        await handleCopy();
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(url, { dialogTitle: title });
      } else {
        await handleCopy();
      }
    } catch {
      // Fallback to copy
      await handleCopy();
    }
  };

  const domain = React.useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'www.reachinternational.co.in';
    }
  }, [url]);

  const cardContent = (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
    >
      {/* Header Row: Brand Emblem, Domain Pill, Close Button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <ReachBrandEmblem size={28} />
          <View style={styles.headerTextWrap}>
            <Text variant="label" style={[styles.brandTitle, { color: theme.colors.ink }]}>
              REACH INTERNATIONAL
            </Text>
            <View style={styles.domainRow}>
              <View style={[styles.liveDot, { backgroundColor: '#10b981' }]} />
              <Text variant="caption" style={[styles.domainText, { color: theme.colors.mute }]}>
                {domain}
              </Text>
            </View>
          </View>
        </View>

        {onClose && (
          <Touchable
            preset="icon"
            onPress={onClose}
            style={[
              styles.closeBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Icon name={X} variant="body" color={theme.colors.mute} />
          </Touchable>
        )}
      </View>

      {/* Visual Logo Banner Preview */}
      <View
        style={[
          styles.previewBanner,
          {
            backgroundColor: isDark ? '#09090b' : '#f8fafc',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <ReachInternationalLogo
          size={28}
          showTagline={true}
          variant={isDark ? 'light' : 'dark'}
        />
      </View>

      {/* Title & Description */}
      <View style={styles.bodyWrap}>
        <Text
          variant="subheading"
          style={[styles.contentTitle, { color: theme.colors.ink }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          style={[styles.contentDesc, { color: theme.colors.mute }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>

      {/* URL Pill Bar */}
      <View
        style={[
          styles.urlPill,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Text
          variant="mono"
          style={[styles.urlText, { color: theme.colors.link }]}
          numberOfLines={1}
        >
          {url}
        </Text>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <Touchable
          preset="button"
          onPress={() => {
            haptics.select();
            handleCopy();
          }}
          style={[
            styles.actionBtn,
            styles.copyBtn,
            {
              backgroundColor: copied
                ? isDark
                  ? '#064e3b'
                  : '#d1fae5'
                : theme.colors.canvas,
              borderColor: copied ? '#10b981' : theme.colors.hairline,
            },
          ]}
        >
          {copied ? (
            <>
              <Icon name={Check} animate="mount" variant="caption" color="#10b981" />
              <Text variant="label" style={[styles.actionBtnText, { color: '#10b981' }]}>
                Copied Link
              </Text>
            </>
          ) : (
            <>
              <Icon name={Copy} variant="caption" color={theme.colors.ink} />
              <Text
                variant="label"
                style={[styles.actionBtnText, { color: theme.colors.ink }]}
              >
                Copy Link
              </Text>
            </>
          )}
        </Touchable>

        <Touchable
          preset="button"
          onPress={() => {
            haptics.select();
            handleShare();
          }}
          style={[
            styles.actionBtn,
            styles.shareBtn,
            { backgroundColor: theme.colors.link },
          ]}
        >
          <Icon name={Share2} variant="caption" color="#ffffff" />
          <Text variant="label" style={[styles.actionBtnText, { color: '#ffffff' }]}>
            Share Link
          </Text>
        </Touchable>
      </View>
    </View>
  );

  if (asModal) {
    return (
      <AppModal
        visible={visible}
        onClose={onClose || (() => {})}
        variant="center"
        testID="shared-link-preview-modal"
      >
        <View style={styles.modalContainer}>{cardContent}</View>
      </AppModal>
    );
  }

  return cardContent;
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
  },
  cardContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTextWrap: {
    gap: 2,
  },
  brandTitle: {},
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  domainText: {},
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBanner: {
    height: 72,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bodyWrap: {
    gap: 4,
  },
  contentTitle: {},
  contentDesc: {},
  urlPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  urlText: {},
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  copyBtn: {
    borderWidth: 1,
  },
  shareBtn: {},
  actionBtnText: {},
});
