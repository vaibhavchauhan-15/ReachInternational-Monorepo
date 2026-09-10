import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Button } from '../ui/Button';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, Copy, X, KeyRound } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

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
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialog,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.titleRow}>
                  <View style={[styles.keyIconWrap, { backgroundColor: theme.colors.warning + '18' }]}>
                    <KeyRound size={16} color={theme.colors.warning} />
                  </View>
                  <Text style={[styles.title, { color: theme.colors.ink }]}>
                    Password Reset Successful
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
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
                    <Check size={14} color={theme.colors.success} strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.noticeTitle, { color: theme.colors.success }]}>
                      New Password Generated
                    </Text>
                    <Text style={[styles.noticeSub, { color: theme.colors.mute }]}>
                      Password updated for <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{userName}</Text>. Share these credentials securely with the user.
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
                  <Text style={[styles.pwdLabel, { color: theme.colors.mute }]}>
                    TEMPORARY PASSWORD
                  </Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      value={temporaryPassword}
                      editable={false}
                      selectTextOnFocus
                      style={[
                        styles.pwdInput,
                        {
                          color: theme.colors.ink,
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={handleCopy}
                      activeOpacity={0.8}
                      style={[
                        styles.copyBtn,
                        {
                          backgroundColor: copied ? theme.colors.success : theme.colors.link,
                        },
                      ]}
                    >
                      {copied ? (
                        <>
                          <Check size={14} color="#ffffff" strokeWidth={2.5} />
                          <Text style={styles.copyBtnText}>Copied!</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={14} color="#ffffff" />
                          <Text style={styles.copyBtnText}>Copy</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  pwdWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 6,
  },
  pwdLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pwdInput: {
    flex: 1,
    height: 40,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 14,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radiusNumeric.sm,
    justifyContent: 'center',
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    padding: spacingNumeric.md,
    borderTopWidth: 1,
  },
});
