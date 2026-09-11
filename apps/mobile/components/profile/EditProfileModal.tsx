import React, { useState, useEffect, useMemo } from 'react';
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
  FlatList,
  TextInput,
} from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TimeInput } from '../ui/TimeInput';
import { useTheme } from '../ui/ThemeProvider';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  INDIAN_STATES,
  getStateByName,
  getStateById,
  validateAadhaarNumber,
  validateLicenseNumber,
} from '@reachinternational/utils';
import { ProfileUpdateSchema } from '@reachinternational/validation';
import { notifyProfileUpdated, notifyProfileRequestSubmitted } from '../../lib/notifications';
import {
  X,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react-native';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentUser?: any;
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

export function EditProfileModal({ visible, onClose, onSuccess, currentUser }: EditProfileModalProps) {
  const { theme } = useTheme();
  const { user, role, userProfile: authProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [startTime, setStartTime] = useState('08:00 AM');
  const [endTime, setEndTime] = useState('08:00 PM');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [district, setDistrict] = useState('Mumbai');
  const [stateName, setStateName] = useState('Maharashtra');
  const [stateId, setStateId] = useState<number>(27);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      const src = currentUser || authProfile || {};
      const meta = user?.user_metadata || {};

      setFullName(src.full_name || meta.full_name || '');
      setPhone(src.phone || meta.phone || '');
      
      const times = parseShiftTimes(src.shift_time || meta.shift_time);
      setStartTime(times.start);
      setEndTime(times.end);
      
      setAddress(src.address || meta.address || '');
      setCity(src.city || meta.city || 'Mumbai');
      setDistrict(src.district || meta.district || 'Mumbai');

      const sName = src.state || meta.state || 'Maharashtra';
      const sObj = getStateByName(sName) || (src.state_id ? getStateById(src.state_id) : undefined) || getStateById(27);
      setStateName(sObj?.name || sName);
      setStateId(sObj?.id || 27);

      setAadhaarNumber(src.aadhaar_number || meta.aadhaar_number || '');
      setLicenseNumber(src.license_number || meta.license_number || '');
    }
  }, [visible, currentUser, authProfile, user]);

  const isSuperAdmin = role === 'super_admin';
  const approverLabel =
    role === 'admin'
      ? 'Super Administrator'
      : ['manager', 'service_manager', 'hr_manager', 'store_manager'].includes(role || '')
      ? 'Administrator'
      : 'Manager / Administrator';

  const filteredStates = useMemo(() => {
    if (!stateSearchQuery.trim()) return INDIAN_STATES;
    const q = stateSearchQuery.trim().toLowerCase();
    return INDIAN_STATES.filter((s) => s.name.toLowerCase().includes(q));
  }, [stateSearchQuery]);

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

    let cleanAadhaar: string | null = null;
    if (aadhaarNumber.trim()) {
      const aRes = validateAadhaarNumber(aadhaarNumber);
      if (!aRes.isValid) {
        Alert.alert('Invalid Aadhaar', aRes.error || 'Please check your 12-digit Aadhaar number.');
        return;
      }
      cleanAadhaar = aRes.clean || null;
    }

    let formattedLicense: string | null = null;
    if (licenseNumber.trim()) {
      const lRes = validateLicenseNumber(licenseNumber);
      if (!lRes.isValid) {
        Alert.alert('Invalid Licence', lRes.error || 'Please check your driving licence format.');
        return;
      }
      formattedLicense = lRes.formatted || licenseNumber.trim().toUpperCase();
    }

    const finalShift =
      startTime.trim() && endTime.trim()
        ? `${startTime.trim()} - ${endTime.trim()}`
        : startTime.trim() || endTime.trim() || '';

    const resolvedStateObj = getStateByName(stateName) || getStateById(stateId);
    const resolvedStateName = resolvedStateObj?.name || stateName.trim() || 'Maharashtra';
    const resolvedStateId = resolvedStateObj?.id || stateId || 27;

    // Validate using Zod ProfileUpdateSchema
    const validationInput = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      shift_time: finalShift || null,
      address: address.trim() || null,
      city: city.trim() || 'Mumbai',
      district: district.trim() || 'Mumbai',
      state: resolvedStateName,
      state_id: resolvedStateId,
      aadhaar_number: cleanAadhaar,
      license_number: formattedLicense,
    };

    const parsed = ProfileUpdateSchema.safeParse(validationInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Validation error in profile form.';
      Alert.alert('Validation Error', firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Uniqueness check: Phone
      if (user?.id) {
        const { data: existingPhones } = await supabase
          .from('users')
          .select('id, phone')
          .neq('id', user.id)
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
          Alert.alert('Duplicate Phone', 'Another user account with this mobile number already exists.');
          setIsSubmitting(false);
          return;
        }

        // 2. Uniqueness check: Aadhaar
        if (cleanAadhaar) {
          const { data: existingAadhaar } = await supabase
            .from('users')
            .select('id')
            .neq('id', user.id)
            .eq('aadhaar_number', cleanAadhaar)
            .maybeSingle();

          if (existingAadhaar) {
            Alert.alert('Duplicate Aadhaar', 'Another user account with this Aadhaar number already exists.');
            setIsSubmitting(false);
            return;
          }
        }

        // 3. Uniqueness check: Driving Licence
        if (formattedLicense) {
          const { data: existingLic } = await supabase
            .from('users')
            .select('id')
            .neq('id', user.id)
            .ilike('license_number', formattedLicense)
            .maybeSingle();

          if (existingLic) {
            Alert.alert('Duplicate Licence', 'Another user account with this driving licence number already exists.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload = {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        shift_time: parsed.data.shift_time || null,
        address: parsed.data.address || null,
        city: parsed.data.city,
        district: parsed.data.district,
        state: parsed.data.state,
        state_id: parsed.data.state_id,
        aadhaar_number: cleanAadhaar,
        license_number: formattedLicense,
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

        notifyProfileUpdated(payload.full_name);
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

        const activeSource = currentUser || authProfile || {};
        const meta = user?.user_metadata || {};
        const currentData = {
          full_name: activeSource.full_name || meta.full_name || '',
          phone: activeSource.phone || meta.phone || '',
          shift_time: activeSource.shift_time || meta.shift_time || null,
          address: activeSource.address || meta.address || null,
          city: activeSource.city || meta.city || 'Mumbai',
          district: activeSource.district || meta.district || 'Mumbai',
          state: activeSource.state || meta.state || 'Maharashtra',
          state_id: activeSource.state_id || 27,
          aadhaar_number: activeSource.aadhaar_number || meta.aadhaar_number || null,
          license_number: activeSource.license_number || meta.license_number || null,
        };

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
              current_data: currentData,
              requested_data: payload,
              target_approver_role: targetApprover,
              status: 'pending',
            });

          if (insErr) throw insErr;
        }

        notifyProfileRequestSubmitted(targetApprover);
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
            
            {/* State Picker Button */}
            <Text style={[styles.fieldLabel, { color: theme.colors.mute }]}>State *</Text>
            <TouchableOpacity
              style={[
                styles.stateSelectorBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
              onPress={() => {
                setStateSearchQuery('');
                setStatePickerVisible(true);
              }}
            >
              <Text style={[styles.stateSelectorText, { color: theme.colors.ink }]}>
                {stateName || 'Select Indian State'}
              </Text>
              <ChevronDown size={18} color={theme.colors.mute} />
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="District *"
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

            <Input
              label="Street / Landmark Address"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Plot No. 42, MIDC Industrial Area"
              containerStyle={styles.inputSpacing}
            />

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

      {/* Indian States Selector Modal */}
      <Modal visible={statePickerVisible} animationType="slide" transparent onRequestClose={() => setStatePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.statePickerSheet, { backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select State / UT</Text>
              <TouchableOpacity onPress={() => setStatePickerVisible(false)} style={styles.closeBtn}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { borderColor: theme.colors.hairline }]}>
              <Search size={16} color={theme.colors.mute} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.ink }]}
                placeholder="Search state or union territory..."
                placeholderTextColor={theme.colors.mute}
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
                autoFocus
              />
              {stateSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStateSearchQuery('')}>
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredStates}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.name.toLowerCase() === stateName.toLowerCase();
                return (
                  <TouchableOpacity
                    style={[
                      styles.stateItem,
                      {
                        borderBottomColor: theme.colors.hairline,
                        backgroundColor: isSelected ? 'rgba(0, 112, 243, 0.08)' : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      setStateName(item.name);
                      setStateId(item.id);
                      setStatePickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.stateItemText,
                        {
                          color: isSelected ? theme.colors.link : theme.colors.ink,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && <Check size={18} color={theme.colors.link} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  statePickerSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    height: '75%',
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  stateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  stateSelectorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacingNumeric.md,
    marginBottom: spacingNumeric.xs,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  stateItemText: {
    fontSize: 14,
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


