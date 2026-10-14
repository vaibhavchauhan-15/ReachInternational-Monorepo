import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Text, useTheme, Button, Touchable, AppModal, Input } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, Copy, X, KeyRound } from '../ui/icon';
import * as Clipboard from 'expo-clipboard';

import { haptics } from '@/lib/haptics';

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
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(temporaryPassword);
      }
    } catch {
      // Fallback
    }
    haptics.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="center"
      panelStyle={{ padding: 0, overflow: 'hidden', maxWidth: 400 }}
    >
      <View style={{ width: '100%' }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.titleRow}>
            <View style={[styles.keyIconWrap, { backgroundColor: theme.colors.warning + '18' }]}>
              <KeyRound size={16} color={theme.colors.warning} />
            </View>
            <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>
              Password Reset Successful
            </Text>
          </View>
          <Touchable preset="icon" onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <X size={16} color={theme.colors.mute} />
          </Touchable>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Notice Banner */}
          <View
            style={[
              styles.noticeBanner,
              {
                backgroundColor: theme.colors.success + '14',
                borderColor: theme.colors.success + '33',
              },
            ]}
          >
            <View style={[styles.checkCircle, { backgroundColor: theme.colors.success + '26' }]}>
              <Check size={14} color={theme.colors.success} strokeWidth={2.5} animate="mount" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label" style={[styles.noticeTitle, { color: theme.colors.success }]}>
                New Password Generated
              </Text>
              <Text variant="caption" style={[styles.noticeSub, { color: theme.colors.mute }]}>
                Password updated for <Text variant="label" style={{ color: theme.colors.ink }}>{userName}</Text>. Share these credentials securely with the user.
              </Text>
            </View>
          </View>

          {/* Password Box */}
          <View
            style={[
              styles.pwdWell,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text variant="caption" style={[styles.pwdLabel, { color: theme.colors.mute }]}>
              TEMPORARY PASSWORD
            </Text>
            <Input
              value={temporaryPassword}
              editable={false}
              selectTextOnFocus
              style={{
                color: theme.colors.ink,
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              }}
              rightIcon={
                <Pressable
                  variant="plain"
                  hitSlopToMin48
                  onPress={handleCopy}
                  accessibilityRole="button"
                  accessibilityLabel={copied ? 'Password copied' : 'Copy temporary password'}
                  style={{ padding: 4 }}
                >
                  {copied ? (
                    <Check size={16} color={theme.colors.success} strokeWidth={2.5} animate="mount" />
                  ) : (
                    <Copy size={16} color={theme.colors.mute} />
                  )}
                </Pressable>
              }
            />
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
          <Button
            label="Done"
            onPress={onClose}
            variant="primary"
            size="md"
            fullWidth
          />
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm + 2,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  keyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  noticeTitle: {
    marginBottom: 2,
  },
  noticeSub: {
  },
  pwdWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 6,
  },
  pwdLabel: {
  },
  footer: {
    padding: spacingNumeric.md,
    borderTopWidth: 1,
  },
});

