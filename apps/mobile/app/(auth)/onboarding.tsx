import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { Button, Input, Card, TimeInput, useTheme } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  INDIAN_STATES,
  computeShiftTiming,
  parseProfileShiftTime,
} from '@reachinternational/utils';
import {
  User as UserIcon,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  X,
  Check,
  Info,
} from 'lucide-react-native';

const ONBOARDING_ROLES = [
  { value: 'service_engineer', label: 'Service Engineer', desc: 'Field operations & breakdown resolution' },
  { value: 'manager', label: 'Manager', desc: 'Operations, fleet, client contracts & business management' },
  { value: 'service_manager', label: 'Service Manager', desc: 'Service planning, engineer dispatch & FSR approval' },
  { value: 'store_manager', label: 'Store Manager', desc: 'Inventory stock ledger & transfers' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Raise complaints & machine inspection' },
  { value: 'operator', label: 'Operator', desc: 'Machine duty & daily running hour logs' },
  { value: 'mechanic', label: 'Mechanic / Technician', desc: 'Repair work orders & parts request' },
  { value: 'hr_manager', label: 'HR Manager', desc: 'Staff onboarding & payroll management' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, userProfile, refreshSession } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('service_engineer');
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('08:00 PM');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-fill fields from existing profile if available
  useEffect(() => {
    if (userProfile) {
      if (userProfile.full_name && userProfile.full_name !== user?.email) {
        setFullName(userProfile.full_name);
      }
      if (userProfile.phone) setPhone(userProfile.phone);
      if (userProfile.role) setSelectedRole(userProfile.role);
      if (userProfile.shift_time) {
        const parsed = parseProfileShiftTime(userProfile.shift_time);
        if (parsed && parsed.startTime && parsed.endTime) {
          setShiftStartTime(parsed.startTime);
          setShiftEndTime(parsed.endTime);
        }
      }
      if (userProfile.city) setCity(userProfile.city);
      if (userProfile.district) setDistrict(userProfile.district);
      if (userProfile.address) setAddress(userProfile.address);
      if (userProfile.state) setStateVal(userProfile.state);
      if (userProfile.state_id) setStateId(userProfile.state_id);
      if (userProfile.aadhaar_number) setAadhaarNumber(formatAadhaar(userProfile.aadhaar_number));
      if (userProfile.license_number) setLicenseNumber(userProfile.license_number);
    }
  }, [userProfile, user]);

  const selectedRoleObj = ONBOARDING_ROLES.find((r) => r.value === selectedRole) || ONBOARDING_ROLES[0];

  const shiftSummary = React.useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    return computeShiftTiming({
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [shiftStartTime, shiftEndTime]);

  const handleComplete = async () => {
    if (isSubmittingRef.current || isLoading) return;
    setErrorMessage('');

    // Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Full name is required (minimum 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Valid 10-digit mobile number is required.');
      return;
    }
    if (!shiftStartTime.trim()) {
      setErrorMessage('Shift start time is required.');
      return;
    }
    if (!shiftEndTime.trim()) {
      setErrorMessage('Shift end time is required.');
      return;
    }
    if (!city.trim() || city.trim().length < 2) {
      setErrorMessage('City/Town/Village is required.');
      return;
    }
    if (!district.trim() || district.trim().length < 2) {
      setErrorMessage('District is required.');
      return;
    }
    if (!stateVal.trim() && !stateId) {
      setErrorMessage('State is required.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Street / Site address is required.');
      return;
    }
    if (!aadhaarNumber.trim()) {
      setErrorMessage('Aadhaar card number is required.');
      return;
    }
    const aadhaarRes = validateAadhaarNumber(aadhaarNumber);
    if (!aadhaarRes.isValid) {
      setErrorMessage(aadhaarRes.error || 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    const cleanAadhaar = aadhaarRes.clean || null;

    let formattedLic: string | null = null;
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        setErrorMessage(licRes.error || 'Please enter a valid driving licence number.');
        return;
      }
      formattedLic = licRes.formatted || licenseNumber.trim().toUpperCase();
    }

    const finalShift =
      shiftStartTime.trim() && shiftEndTime.trim()
        ? `${shiftStartTime.trim()} - ${shiftEndTime.trim()}`
        : shiftStartTime.trim() || shiftEndTime.trim() || null;

    if (!user?.id) {
      setErrorMessage('Authentication session expired. Please log in again.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      // 1. Attempt atomic RPC
      const { error: rpcError } = await supabase.rpc('complete_user_onboarding_atomic', {
        p_user_id: user.id,
        p_full_name: fullName.trim(),
        p_phone: cleanPhone,
        p_role: selectedRole,
        p_shift_time: finalShift,
        p_address: address.trim(),
        p_city: city.trim(),
        p_district: district.trim(),
        p_state: stateVal.trim(),
        p_state_id: stateId,
        p_aadhaar_number: cleanAadhaar,
        p_license_number: formattedLic,
      });

      if (rpcError) {
        // Fallback: direct table update
        console.warn('[Mobile Onboarding] RPC error, using direct table update fallback:', rpcError.message);
        const { error: directError } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            phone: cleanPhone,
            role: selectedRole,
            shift_time: finalShift,
            address: address.trim(),
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateId,
            aadhaar_number: cleanAadhaar,
            license_number: formattedLic,
            complete_profile: 'yes',
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (directError) {
          setErrorMessage(directError.message || 'Failed to update profile. Please try again.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }
      }

      await refreshSession();

      const destination = selectedRole === 'operator' ? '/(app)/operations' : '/(app)/machines';
      router.replace(destination as any);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.link + '18', borderColor: theme.colors.link + '30' }]}>
            <Text style={[styles.badgeText, { color: theme.colors.link }]}>Setup Required</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Complete Profile</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            Fill in your shift timings, operational site, and identity records to activate your account.
          </Text>
        </View>

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error + '40' }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Card variant="elevated" style={styles.formCard}>
          {/* Section 1: Account Information & Role */}
          <View style={[styles.sectionContainer, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.sectionHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={[styles.stepPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.stepNumber, { color: theme.colors.link }]}>1</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Account & Role</Text>
            </View>

            <Input
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Rahul Sharma"
              autoCapitalize="words"
              leftIcon={<UserIcon size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Mobile Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              leftIcon={<Phone size={16} color={theme.colors.mute} />}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.ink }]}>
                Assigned Role <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectTrigger,
                  { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated },
                ]}
                onPress={() => setRoleModalVisible(true)}
              >
                <View style={styles.selectTriggerContent}>
                  <Text style={[styles.selectTriggerText, { color: theme.colors.ink }]}>
                    {selectedRoleObj.label}
                  </Text>
                  <Text style={[styles.selectTriggerDesc, { color: theme.colors.mute }]} numberOfLines={1}>
                    {selectedRoleObj.desc}
                  </Text>
                </View>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 2: Work Shift Schedule */}
          <View style={[styles.sectionContainer, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.sectionHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={[styles.stepPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.stepNumber, { color: theme.colors.link }]}>2</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Work Shift Schedule</Text>
              {shiftSummary?.isValid && (
                <View style={[styles.shiftBadge, { backgroundColor: theme.colors.link + '15', borderColor: theme.colors.link + '30' }]}>
                  <Text style={[styles.shiftBadgeText, { color: theme.colors.link }]}>
                    {shiftSummary.isOvernight ? '🌙' : '☀️'} {shiftSummary.durationFormatted}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.timeInputsRow}>
              <View style={styles.timeInputCol}>
                <TimeInput
                  label="Shift Start"
                  value={shiftStartTime}
                  onChange={setShiftStartTime}
                  required
                />
              </View>
              <View style={styles.timeInputCol}>
                <TimeInput
                  label="Shift End"
                  value={shiftEndTime}
                  onChange={setShiftEndTime}
                  required
                />
              </View>
            </View>
          </View>

          {/* Section 3: Work Location & Address */}
          <View style={[styles.sectionContainer, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.sectionHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={[styles.stepPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.stepNumber, { color: theme.colors.link }]}>3</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Work Location & Address</Text>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Input
                  label="City / Town *"
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Pune"
                  leftIcon={<MapPin size={16} color={theme.colors.mute} />}
                />
              </View>
              <View style={styles.col}>
                <Input
                  label="District *"
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="e.g. Pune"
                  leftIcon={<MapPin size={16} color={theme.colors.mute} />}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.ink }]}>
                State <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectTrigger,
                  { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated },
                ]}
                onPress={() => setStateModalVisible(true)}
              >
                <Text
                  style={[
                    styles.selectTriggerText,
                    { color: stateVal ? theme.colors.ink : theme.colors.mute },
                  ]}
                >
                  {stateVal || 'Select State...'}
                </Text>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Input
              label="Street / Site Base Address *"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Plot No. 42, MIDC Chakan"
              leftIcon={<MapPin size={16} color={theme.colors.mute} />}
            />
          </View>

          {/* Section 4: Identity Verification */}
          <View style={[styles.sectionContainer, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.sectionHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View style={[styles.stepPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.stepNumber, { color: theme.colors.link }]}>4</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Identity Verification</Text>
            </View>

            <Input
              label="Aadhaar Card Number *"
              value={aadhaarNumber}
              onChangeText={(val) => setAadhaarNumber(formatAadhaar(val))}
              placeholder="12-digit Aadhaar Number"
              keyboardType="number-pad"
              maxLength={14}
              leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Driving Licence Number (Optional)"
              value={licenseNumber}
              onChangeText={(val) => setLicenseNumber(val.toUpperCase())}
              placeholder="e.g. MH12 20110012345"
              autoCapitalize="characters"
              maxLength={25}
              leftIcon={<CreditCard size={16} color={theme.colors.mute} />}
            />
          </View>

          {/* One-Time Reassurance Banner */}
          <View style={[styles.noticeBox, { backgroundColor: theme.colors.link + '12', borderColor: theme.colors.link + '30' }]}>
            <Info size={16} color={theme.colors.link} style={{ marginTop: 1 }} />
            <Text style={[styles.noticeText, { color: theme.colors.link, flex: 1 }]}>
              <Text style={{ fontWeight: '700' }}>Fast One-Time Setup: </Text>
              Your profile is verified once and saved permanently. Subsequent logins will route directly to your dashboard.
            </Text>
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <Button
              label={isLoading ? 'Saving Profile...' : 'Complete Profile & Enter'}
              onPress={handleComplete}
              isLoading={isLoading}
              shape="square"
              fullWidth
            />
          </View>
        </Card>
      </ScrollView>

      {/* Role Picker Modal */}
      <Modal visible={roleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={[styles.modalHeader, { borderColor: theme.colors.hairline }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Your Role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} hitSlop={8}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {ONBOARDING_ROLES.map((r) => {
                const isSelected = selectedRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.modalOption,
                      { borderColor: theme.colors.hairline },
                      isSelected && { backgroundColor: theme.colors.link + '15' },
                    ]}
                    onPress={() => {
                      setSelectedRole(r.value);
                      setRoleModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: isSelected ? theme.colors.link : theme.colors.ink }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                        {r.desc}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={theme.colors.link} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* State Picker Modal */}
      <Modal visible={stateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={[styles.modalHeader, { borderColor: theme.colors.hairline }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)} hitSlop={8}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <Input
                value={stateSearch}
                onChangeText={setStateSearch}
                placeholder="Search state..."
              />
            </View>
            <ScrollView style={styles.modalList}>
              {filteredStates.map((s) => {
                const isSelected = stateId === s.id || stateVal === s.name;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.modalOption,
                      { borderColor: theme.colors.hairline },
                      isSelected && { backgroundColor: theme.colors.link + '15' },
                    ]}
                    onPress={() => {
                      setStateVal(s.name);
                      setStateId(s.id);
                      setStateModalVisible(false);
                      setStateSearch('');
                    }}
                  >
                    <Text style={[styles.optionLabel, { color: isSelected ? theme.colors.link : theme.colors.ink }]}>
                      {s.name}
                    </Text>
                    {isSelected && <Check size={18} color={theme.colors.link} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.lg,
    paddingBottom: spacingNumeric['3xl'],
  },
  header: {
    marginBottom: spacingNumeric.lg,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  formCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  sectionContainer: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  stepPill: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInputCol: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#ef4444',
  },
  selectTrigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectTriggerContent: {
    flex: 1,
    marginRight: 8,
  },
  selectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectTriggerDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  submitContainer: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: radiusNumeric.md,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
