import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { AlertCircle, AlertTriangle, Info, LogOut } from './icon';
import { Text } from './Text';
import { Dialog } from './overlay/Dialog';
import { Touchable } from './Touchable';
import { haptics } from '../../lib/haptics';

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
      defaultIcon: <LogOut size={22} color={theme.colors.error} animate="mount" />,
      confirmBtnBg: theme.colors.error,
      confirmTextColor: '#ffffff',
    },
    warning: {
      accent: '#f59e0b',
      bg: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.1)',
      border: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
      defaultIcon: <AlertTriangle size={22} color="#f59e0b" animate="mount" />,
      confirmBtnBg: '#f59e0b',
      confirmTextColor: '#ffffff',
    },
    primary: {
      accent: theme.colors.link,
      bg: isDark ? 'rgba(0, 112, 243, 0.16)' : 'rgba(0, 112, 243, 0.1)',
      border: isDark ? 'rgba(0, 112, 243, 0.35)' : 'rgba(0, 112, 243, 0.25)',
      defaultIcon: <Info size={22} color={theme.colors.link} animate="mount" />,
      confirmBtnBg: theme.colors.link,
      confirmTextColor: '#ffffff',
    },
  };

  const currentVariant = variantColors[variant] || variantColors.danger;

  const handleConfirm = () => {
    if (variant === 'danger' || variant === 'warning') {
      haptics.warning();
    } else {
      haptics.light();
    }
    onConfirm();
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      persistent={isLoading}
      contentStyle={styles.dialogCardOverride}
      testID="confirm-dialog-modal"
    >
      <View
        style={styles.innerContent}
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
        <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>
          {title}
        </Text>
        <Text variant="body" style={[styles.message, { color: theme.colors.mute }]}>
          {message}
        </Text>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <Touchable
            preset="button"
            onPress={onClose}
            disabled={isLoading}
            style={[
              styles.cancelBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={cancelText}
          >
            <Text variant="label" style={[styles.cancelBtnText, { color: theme.colors.ink }]}>
              {cancelText}
            </Text>
          </Touchable>

          <Touchable
            preset="button"
            onPress={handleConfirm}
            disabled={isLoading}
            style={[
              styles.confirmBtn,
              {
                backgroundColor: currentVariant.confirmBtnBg,
                opacity: isLoading ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={confirmText}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={currentVariant.confirmTextColor} />
                <Text
                  variant="label"
                  style={[
                    styles.confirmBtnText,
                    { color: currentVariant.confirmTextColor },
                  ]}
                >
                  {title.toLowerCase().includes('sign out') || confirmText.toLowerCase().includes('sign out')
                    ? 'Signing out...'
                    : 'Please wait...'}
                </Text>
              </View>
            ) : (
              <Text
                variant="label"
                style={[
                  styles.confirmBtnText,
                  { color: currentVariant.confirmTextColor },
                ]}
              >
                {confirmText}
              </Text>
            )}
          </Touchable>
        </View>
      </View>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialogCardOverride: {
    maxWidth: 360,
    borderRadius: 20,
    padding: spacingNumeric.lg,
    alignItems: 'center',
  },
  innerContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacingNumeric.xs,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacingNumeric.lg,
    paddingHorizontal: 8,
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
    minHeight: 46, // 46px comfortable touch target
  },
  cancelBtnText: {
    textAlign: 'center',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46, // 46px comfortable touch target
  },
  confirmBtnText: {
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
