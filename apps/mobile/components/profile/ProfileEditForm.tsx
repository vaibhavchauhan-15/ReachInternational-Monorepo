import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTheme } from '../ui/ThemeProvider';
import { showToast } from '../ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { ProfileUpdateSchema } from '@reachinternational/validation';
import { notifyProfileUpdated } from '../../lib/notifications';
import { MobileFormSectionCard } from '../forms';
import { User } from '../ui/icon';

export interface ProfileEditFormProps {
  currentUser?: any;
  onSuccess?: (req?: any) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export function ProfileEditForm({
  currentUser,
  onSuccess,
  onCancel,
  isModal = false,
}: ProfileEditFormProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, userProfile: authProfile, refreshSession } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const src = currentUser || authProfile || {};
    const meta = user?.user_metadata || {};

    setFullName(src.full_name || meta.full_name || '');
    setPhone(src.phone || meta.phone || '');
    setNameError(null);
    setPhoneError(null);
  }, [currentUser, authProfile, user]);

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError('Full name is required.');
      return false;
    }
    if (trimmed.length < 2) {
      setNameError('Full name must be at least 2 characters.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const validatePhone = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (!digitsOnly) {
      setPhoneError('Mobile number is required.');
      return false;
    }
    if (digitsOnly.length < 10) {
      setPhoneError('Enter a valid 10-digit mobile number.');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const isAllMandatoryFilled = Boolean(
    fullName.trim().length >= 2 &&
    !nameError &&
    phone.replace(/\D/g, '').length >= 10 &&
    !phoneError
  );

  const handleSubmit = async () => {
    const isNameValid = validateName(fullName);
    const isPhoneValid = validatePhone(phone);

    if (!isNameValid || !isPhoneValid) {
      showToast('warning', 'Validation Error', 'Please correct the highlighted errors before saving.');
      return;
    }

    const validationInput = {
      full_name: fullName.trim(),
      phone: phone.trim(),
    };

    const parsed = ProfileUpdateSchema.safeParse(validationInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Validation error in profile form.';
      showToast('warning', 'Validation Error', firstError);
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    const targetUserId = currentUser?.id || user?.id;
    if (!targetUserId) {
      showToast('error', 'Error', 'User identifier not found.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Uniqueness check for phone against other user accounts
      const { data: existingPhones } = await supabase
        .from('users')
        .select('id, phone')
        .neq('id', targetUserId)
        .not('phone', 'is', null);

      const hasDuplicatePhone = existingPhones?.some((u: any) => {
        if (!u.phone) return false;
        const uDigits = u.phone.replace(/\D/g, '');
        if (digitsOnly.length >= 10 && uDigits.length >= 10) {
          return digitsOnly.slice(-10) === uDigits.slice(-10);
        }
        return digitsOnly === uDigits;
      });

      if (hasDuplicatePhone) {
        showToast('error', 'Duplicate Phone', 'Another user account with this mobile number already exists.');
        setIsSubmitting(false);
        return;
      }

      // Update users table directly with full_name and phone
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (userUpdateError) throw userUpdateError;

      // Update Supabase auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });

      // Refresh cached auth profile
      try {
        await refreshSession();
      } catch (refreshErr) {
        console.warn('Session refresh note:', refreshErr);
      }

      notifyProfileUpdated(fullName.trim());
      showToast('success', 'Profile Updated', 'Your personal details have been updated successfully.');

      onSuccess?.();
    } catch (err: any) {
      console.error('Error updating personal details:', err);
      showToast('error', 'Update Failed', err?.message || 'Failed to update personal details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={isModal ? styles.modalContainer : styles.pageContainer}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: isModal ? 24 : Math.max(insets.bottom + 90, 120) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Personal Details Section Card */}
        <MobileFormSectionCard
          title="Personal Details"
          description="Update your name and primary contact number"
          icon={<User size={14} color={theme.colors.link} />}
          isMandatory={true}
          isCompleted={isAllMandatoryFilled}
        >
          <Input
            label="Full Name"
            required={true}
            editable={true}
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              validateName(t);
            }}
            onBlur={() => {
              validateName(fullName);
            }}
            placeholder="e.g. Rahul Sharma"
            error={nameError || undefined}
            containerStyle={styles.inputSpacing}
          />
          <Input
            label="Mobile Phone"
            required={true}
            editable={true}
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              validatePhone(t);
            }}
            onBlur={() => {
              validatePhone(phone);
            }}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            maxLength={15}
            error={phoneError || undefined}
            containerStyle={styles.inputSpacing}
          />
        </MobileFormSectionCard>

        {/* Action Buttons in One Balanced Row at Bottom of Page */}
        <View style={styles.actionsRow}>
          {onCancel && (
            <Button
              label="Cancel"
              onPress={onCancel}
              variant="outline"
              size="md"
              style={styles.actionBtn}
            />
          )}
          <Button
            label={isSubmitting ? 'Saving...' : 'Save Changes'}
            onPress={handleSubmit}
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={!isAllMandatoryFilled || isSubmitting}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    maxHeight: '90%',
  },
  pageContainer: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacingNumeric.md,
  },
  inputSpacing: {
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacingNumeric.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
  },
});
