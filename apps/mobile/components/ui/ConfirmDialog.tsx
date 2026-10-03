import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { AlertCircle, AlertTriangle, Info, LogOut } from 'lucide-react-native';

export interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon,
  isLoading = false,
}) => {
  const { theme, isDark } = useTheme();

  const variantColors = {
    danger: {
      accent: theme.colors.error,
      bg: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.1)',
      border: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
      defaultIcon: <LogOut size={22} color={theme.colors.error} />,
      confirmBtnBg: theme.colors.error,
      confirmTextColor: '#ffffff',
    },
    warning: {
      accent: '#f59e0b',
      bg: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.1)',
      border: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
      defaultIcon: <AlertTriangle size={22} color="#f59e0b" />,
      confirmBtnBg: '#f59e0b',
      confirmTextColor: '#ffffff',
    },
    primary: {
      accent: theme.colors.link,
      bg: isDark ? 'rgba(0, 112, 243, 0.16)' : 'rgba(0, 112, 243, 0.1)',
      border: isDark ? 'rgba(0, 112, 243, 0.35)' : 'rgba(0, 112, 243, 0.25)',
      defaultIcon: <Info size={22} color={theme.colors.link} />,
      confirmBtnBg: theme.colors.link,
      confirmTextColor: '#ffffff',
    },
  };

  const currentVariant = variantColors[variant] || variantColors.danger;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={isLoading ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={isLoading ? undefined : onClose}>
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
              accessibilityRole="alert"
              accessibilityLabel={title}
            >
              {/* Icon Orb */}
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: currentVariant.bg,
                    borderColor: currentVariant.border,
                  },
                ]}
              >
                {icon || currentVariant.defaultIcon}
              </View>

              {/* Title & Description */}
              <Text style={[styles.title, { color: theme.colors.ink }]}>
                {title}
              </Text>
              <Text style={[styles.message, { color: theme.colors.mute }]}>
                {message}
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isLoading}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={cancelText}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.colors.ink }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onConfirm}
                  disabled={isLoading}
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: currentVariant.confirmBtnBg,
                      opacity: isLoading ? 0.7 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={confirmText}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={currentVariant.confirmTextColor} />
                  ) : (
                    <Text
                      style={[
                        styles.confirmBtnText,
                        { color: currentVariant.confirmTextColor },
                      ]}
                    >
                      {confirmText}
                    </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.35)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 14,
      },
    }),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.md,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacingNumeric.xs,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacingNumeric.lg,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // 44px minimum touch target
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // 44px minimum touch target
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
