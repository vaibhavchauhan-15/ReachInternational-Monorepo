import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme } from './ThemeProvider';
import { ReachBrandEmblem, ReachInternationalLogo } from '../branding';
import { Share2, Copy, Check, ExternalLink, X } from 'lucide-react-native';
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

  const domain = 'www.reachinternational.co.in';

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
            <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>
              REACH INTERNATIONAL
            </Text>
            <View style={styles.domainRow}>
              <View style={[styles.liveDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.domainText, { color: theme.colors.mute }]}>
                {domain}
              </Text>
            </View>
          </View>
        </View>

        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={theme.colors.mute} />
          </TouchableOpacity>
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
          style={[styles.contentTitle, { color: theme.colors.ink }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
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
          style={[styles.urlText, { color: theme.colors.link }]}
          numberOfLines={1}
        >
          {url}
        </Text>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleCopy}
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
          activeOpacity={0.7}
        >
          {copied ? (
            <>
              <Check size={14} color="#10b981" />
              <Text style={[styles.actionBtnText, { color: '#10b981' }]}>
                Copied Link
              </Text>
            </>
          ) : (
            <>
              <Copy size={14} color={theme.colors.ink} />
              <Text
                style={[styles.actionBtnText, { color: theme.colors.ink }]}
              >
                Copy Link
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          style={[
            styles.actionBtn,
            styles.shareBtn,
            { backgroundColor: theme.colors.link },
          ]}
          activeOpacity={0.8}
        >
          <Share2 size={14} color="#ffffff" />
          <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
            Share Link
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (asModal) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={styles.modalContainer}>{cardContent}</View>
        </View>
      </Modal>
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
  brandTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
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
  domainText: {
    fontSize: 10,
    fontWeight: '500',
  },
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
  contentTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  contentDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  urlPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  urlText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
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
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
