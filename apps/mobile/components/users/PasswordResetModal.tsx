import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Text, Button, useTheme, AppModal, showToast } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { KeyRound, Check, Copy, X } from '../ui/icon';

export interface PasswordResetModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  temporaryPassword: string;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  visible,
  onClose,
  userName,
  temporaryPassword,
}) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 640;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (!temporaryPassword) return;
      await Clipboard.setStringAsync(temporaryPassword);
      haptics.confirm();
      setCopied(true);
      showToast('success', 'Copied to Clipboard', 'Temporary password copied to clipboard');
      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      haptics.reject();
      showToast('error', 'Copy Failed', 'Failed to copy password to clipboard');
    }
  }, [temporaryPassword]);

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      variant={isDesktop ? 'center' : 'bottom'}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 480,
              width: '100%',
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }
      }
      testID="password-reset-modal"
    >
      <View style={[styles.container, { backgroundColor: theme.colors.canvasElevated }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.12)',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
                },
              ]}
            >
              <KeyRound size={16} color={isDark ? '#fbbf24' : '#d97706'} />
            </View>
            <Text variant="heading" weight="semibold" style={{ color: theme.colors.ink }}>
              Password Reset Successful
            </Text>
          </View>

          <Pressable
            variant="iconButton"
            haptic="tap"
            hitSlopToMin48
            onPress={handleClose}
            style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
            accessibilityLabel="Close dialog"
          >
            <X size={16} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Success Notice Banner */}
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.30)' : 'rgba(16, 185, 129, 0.22)',
              },
            ]}
          >
            <View
              style={[
                styles.checkCircle,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.20)',
                },
              ]}
            >
              <Check size={14} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <View style={styles.noticeTextWrap}>
              <Text variant="label" weight="semibold" style={{ color: isDark ? '#a7f3d0' : '#065f46' }}>
                New Password Generated
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                Password updated for{' '}
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {userName}
                </Text>
                . Share these credentials securely with the user.
              </Text>
            </View>
          </View>

          {/* Generated Temporary Password Box */}
          <View
            style={[
              styles.passwordCard,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="micro" weight="bold" style={{ color: theme.colors.mute }}>
              GENERATED TEMPORARY PASSWORD
            </Text>

            <View style={styles.passwordInputRow}>
              <View
                style={[
                  styles.passwordValueContainer,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <Text
                  variant="mono"
                  weight="semibold"
                  style={{ color: theme.colors.ink }}
                  selectable
                >
                  {temporaryPassword}
                </Text>
              </View>

              <Pressable
                variant="primary"
                haptic="confirm"
                onPress={handleCopy}
                style={[
                  styles.copyBtn,
                  {
                    backgroundColor: copied
                      ? '#10b981'
                      : isDark
                      ? '#0ea5e9'
                      : '#0284c7',
                  },
                ]}
                accessibilityLabel="Copy temporary password to clipboard"
              >
                {copied ? (
                  <View style={styles.btnContentRow}>
                    <Check size={14} color="#ffffff" />
                    <Text variant="caption" weight="semibold" style={{ color: '#ffffff' }}>
                      Copied!
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnContentRow}>
                    <Copy size={14} color="#ffffff" />
                    <Text variant="caption" weight="semibold" style={{ color: '#ffffff' }}>
                      Copy
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Done CTA */}
          <Button
            label="Done"
            variant="secondary"
            size="md"
            onPress={handleClose}
            style={styles.doneBtn}
          />
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noticeTextWrap: {
    flex: 1,
  },
  passwordCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  passwordValueContainer: {
    flex: 1,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
    height: 42,
    justifyContent: 'center',
  },
  copyBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doneBtn: {
    width: '100%',
    minHeight: 44,
  },
});
