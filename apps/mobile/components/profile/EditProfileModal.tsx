import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Input, Button, TimeInput, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { validateAadhaarNumber, validateLicenseNumber } from '@reachinternational/utils';
import {
  X,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function parseShiftTimes(shiftStr?: string | null): { start: string; end: string } {
  if (!shiftStr) {
    return { start: '08:00 AM', end: '08:00 PM' };
  }
  const matches = shiftStr.match(/\b(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)\b/g);
  if (matches && matches.length >= 2) {
    const normalize = (t: string) => {
      const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        const h = parseInt(match[1], 10);
        const formattedH = h >= 1 && h <= 12 ? String(h).padStart(2, '0') : String(h % 12 || 12).padStart(2, '0');
        const formattedM = match[2];
        const period = (match[3] || (h >= 12 ? 'PM' : 'AM')).toUpperCase();
        return `${formattedH}:${formattedM} ${period}`;
      }
      return t.trim();
    };
    return { start: normalize(matches[0]), end: normalize(matches[1]) };
  }
  return { start: '08:00 AM', end: '08:00 PM' };
}

export function EditProfileModal({ visible, onClose, onSuccess }: EditProfileModalProps) {
  const { theme } = useTheme();
  const { user, role } = useAuth();
  const metadata = user?.user_metadata || {};

  const [fullName, setFullName] = useState(metadata.full_name || '');
  const [phone, setPhone] = useState(metadata.phone || '');

  const initialTimes = parseShiftTimes(metadata.shift_time);
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [endTime, setEndTime] = useState(initialTimes.end);

  const [address, setAddress] = useState(metadata.address || '');
  const [city, setCity] = useState(metadata.city || '');
  const [district, setDistrict] = useState(metadata.district || '');
  const [stateName, setStateName] = useState(metadata.state || 'Maharashtra');
  const [aadhaarNumber, setAadhaarNumber] = useState(metadata.aadhaar_number || '');
  const [licenseNumber, setLicenseNumber] = useState(metadata.license_number || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && user) {
      const meta = user.user_metadata || {};
      setFullName(meta.full_name || '');
      setPhone(meta.phone || '');
      const times = parseShiftTimes(meta.shift_time);
      setStartTime(times.start);
      setEndTime(times.end);
      setAddress(meta.address || '');
      setCity(meta.city || '');
      setDistrict(meta.district || '');
      setStateName(meta.state || 'Maharashtra');
      setAadhaarNumber(meta.aadhaar_number || '');
      setLicenseNumber(meta.license_number || '');
    }
  }, [visible, user]);

  const isSuperAdmin = role === 'super_admin';
  const approverLabel =
    role === 'admin'
      ? 'Super Administrator'
      : ['manager', 'service_manager', 'hr_manager'].includes(role || '')
      ? 'Administrator'
      : 'Manager / Administrator';

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (aadhaarNumber.trim()) {
      const aRes = validateAadhaarNumber(aadhaarNumber);
      if (!aRes.isValid) {
        Alert.alert('Invalid Aadhaar', aRes.error || 'Please check your 12-digit Aadhaar number.');
        return;
      }
    }

    if (licenseNumber.trim()) {
      const lRes = validateLicenseNumber(licenseNumber);
      if (!lRes.isValid) {
        Alert.alert('Invalid Licence', lRes.error || 'Please check your driving licence format.');
        return;
      }
    }

    const finalShift =
      startTime.trim() && endTime.trim()
        ? `${startTime.trim()} - ${endTime.trim()}`
        : startTime.trim() || endTime.trim() || '';

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        shift_time: finalShift || null,
        address: address.trim() || null,
        city: city.trim() || 'Mumbai',
        district: district.trim() || 'Mumbai',
        state: stateName.trim() || 'Maharashtra',
        aadhaar_number: aadhaarNumber.trim() || null,
        license_number: licenseNumber.trim().toUpperCase() || null,
      };

      if (isSuperAdmin) {
        // Direct update for Super Admin
        const { error } = await supabase
          .from('users')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user?.id);

        if (error) throw error;

        // Update auth metadata
        await supabase.auth.updateUser({
          data: {
            ...payload,
            location: `${payload.city}, ${payload.district}, ${payload.state}`,
          },
        });

        Alert.alert('Success', 'Your profile details have been updated directly.');
      } else {
        // Submit profile change request
        const targetApprover =
          role === 'admin'
            ? 'super_admin'
            : ['manager', 'service_manager', 'hr_manager', 'store_manager'].includes(role || '')
            ? 'admin'
            : 'manager';

        // Check if existing pending request exists
        const { data: existing } = await supabase
          .from('profile_change_requests')
          .select('id')
          .eq('user_id', user?.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase
            .from('profile_change_requests')
            .update({
              requested_data: payload,
              target_approver_role: targetApprover,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from('profile_change_requests')
            .insert({
              user_id: user?.id,
              requester_role: role || 'operator',
              current_data: {
                full_name: metadata.full_name,
                phone: metadata.phone,
                shift_time: metadata.shift_time,
                address: metadata.address,
                city: metadata.city,
                district: metadata.district,
                state: metadata.state,
                aadhaar_number: metadata.aadhaar_number,
                license_number: metadata.license_number,
              },
              requested_data: payload,
              target_approver_role: targetApprover,
              status: 'pending',
            });

          if (insErr) throw insErr;
        }

        Alert.alert(
          'Request Submitted',
          `Your profile update request has been routed to your ${approverLabel} for review.`
        );
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error submitting profile changes:', err);
      Alert.alert('Error', err?.message || 'Failed to submit profile changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvas }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
            <View>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Edit Profile</Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                {isSuperAdmin ? 'Direct database updates' : `Approval routed to ${approverLabel}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Status Notice */}
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: isSuperAdmin ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)',
                  borderColor: isSuperAdmin ? 'rgba(16,185,129,0.3)' : 'rgba(14,165,233,0.3)',
                },
              ]}
            >
              {isSuperAdmin ? (
                <CheckCircle size={16} color={theme.colors.success} style={{ marginTop: 2 }} />
              ) : (
                <AlertCircle size={16} color={theme.colors.link} style={{ marginTop: 2 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.noticeTitle,
                    { color: isSuperAdmin ? theme.colors.success : theme.colors.link },
                  ]}
                >
                  {isSuperAdmin ? 'Instant Update' : 'Approval Required'}
                </Text>
                <Text style={[styles.noticeText, { color: theme.colors.mute }]}>
                  {isSuperAdmin
                    ? 'As a Super Admin, your modifications apply immediately.'
                    : `Changes will be reviewed by your ${approverLabel} before updating your profile.`}
                </Text>
              </View>
            </View>

            {/* Section 1: Personal Details */}
            <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>1. Personal Details</Text>
            <Input
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Rahul Sharma"
              containerStyle={styles.inputSpacing}
            />
            <Input
              label="Mobile Phone *"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              containerStyle={styles.inputSpacing}
            />
            <Input
              label="Aadhaar Card Number"
              value={aadhaarNumber}
              onChangeText={setAadhaarNumber}
              placeholder="12-digit Aadhaar"
              keyboardType="numeric"
              maxLength={14}
              containerStyle={styles.inputSpacing}
            />
            <Input
              label="Driving Licence"
              value={licenseNumber}
              onChangeText={(t) => setLicenseNumber(t.toUpperCase())}
              placeholder="e.g. MH12 20110012345"
              autoCapitalize="characters"
              containerStyle={styles.inputSpacing}
            />

            {/* Section 2: Shift Timing */}
            <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginTop: 14 }]}>
              2. Shift Timing
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TimeInput
                  label="Shift Start Time"
                  value={startTime}
                  onChangeText={setStartTime}
                  containerStyle={styles.inputSpacing}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Shift End Time"
                  value={endTime}
                  onChangeText={setEndTime}
                  containerStyle={styles.inputSpacing}
                />
              </View>
            </View>

            {/* Section 3: Address */}
            <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginTop: 14 }]}>
              3. Address
            </Text>
            <Input
              label="State *"
              value={stateName}
              onChangeText={setStateName}
              placeholder="e.g. Maharashtra"
              containerStyle={styles.inputSpacing}
            />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="District"
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="e.g. Thane"
                  containerStyle={styles.inputSpacing}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="City *"
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Pune"
                  containerStyle={styles.inputSpacing}
                />
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.modalFooter, { borderTopColor: theme.colors.hairline }]}>
            <Button
              label="Cancel"
              onPress={onClose}
              variant="outline"
              size="md"
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              label={isSubmitting ? 'Submitting...' : isSuperAdmin ? 'Save Directly' : 'Submit for Approval'}
              onPress={handleSubmit}
              variant="primary"
              size="md"
              disabled={isSubmitting}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  modalBody: {
    padding: spacingNumeric.md,
  },
  noticeBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputSpacing: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
});

