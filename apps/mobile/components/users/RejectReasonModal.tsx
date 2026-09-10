import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { AlertTriangle, X } from 'lucide-react-native';

export interface RejectReasonModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  visible,
  onClose,
  userName = 'user',
  onConfirm,
  isSubmitting = false,
}) => {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('');
    }
  }, [visible]);

  const handleConfirm = async () => {
    await onConfirm(reason.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={isSubmitting ? undefined : onClose}>
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
                  <View style={[styles.iconWrap, { backgroundColor: theme.colors.error + '18' }]}>
                    <AlertTriangle size={16} color={theme.colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.colors.ink }]}>
                      Reject Change Request
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                      Decline profile changes for {userName}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  disabled={isSubmitting}
                >
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={styles.body}>
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: theme.colors.error + '10',
                      borderColor: theme.colors.error + '26',
                    },
                  ]}
                >
                  <Text style={[styles.infoBannerText, { color: theme.colors.error }]}>
                    The user&apos;s active profile will remain unchanged. You may optionally enter a rejection reason below.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.ink }]}>
                    Rejection Reason (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                        color: theme.colors.ink,
                      },
                    ]}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="e.g. Identity document not clear or timing mismatch"
                    placeholderTextColor={theme.colors.mute}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { borderColor: theme.colors.hairline },
                  ]}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.colors.ink }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: theme.colors.error },
                    isSubmitting && { opacity: 0.7 },
                  ]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirm Rejection</Text>
                  )}
                </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
    marginRight: spacingNumeric.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: spacingNumeric.xs,
  },
  body: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  infoBanner: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  infoBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    fontSize: 13,
    minHeight: 70,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 9,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: 9,
    borderRadius: radiusNumeric.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
