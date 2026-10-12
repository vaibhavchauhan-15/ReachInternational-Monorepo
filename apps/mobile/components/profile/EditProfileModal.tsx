import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { Touchable } from '../ui/Touchable';
import { AppModal } from '../ui/AppModal';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X } from '../ui/icon';
import { ProfileEditForm } from './ProfileEditForm';
import { useAuth } from '../../lib/auth/useAuth';

export interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (req?: any) => void;
  currentUser?: any;
}

export function EditProfileModal({ visible, onClose, onSuccess, currentUser }: EditProfileModalProps) {
  const { theme } = useTheme();
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const approverLabel =
    role === 'admin'
      ? 'Super Administrator'
      : ['manager', 'hr'].includes(role || '')
      ? 'Administrator'
      : 'Manager / Administrator';

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvas }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
            <View>
              <Text variant="heading" style={{ color: theme.colors.ink }}>Edit Profile</Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 1 }}>
                {isSuperAdmin ? 'Direct database updates' : `Approval routed to ${approverLabel}`}
              </Text>
            </View>
            <Touchable preset="icon" onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={20} color={theme.colors.mute} />
            </Touchable>
          </View>

          <ProfileEditForm
            currentUser={currentUser}
            isModal={true}
            onCancel={onClose}
            onSuccess={(req) => {
              onSuccess?.(req);
              onClose();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
