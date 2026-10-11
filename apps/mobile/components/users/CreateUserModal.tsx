import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform} from 'react-native';
import { Text, Button, Input, useTheme, SearchableSelect, type SelectOption, AppModal, Touchable, showToast } from '../ui';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  parseProfileShiftTime,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { notifyUserCreated } from '../../lib/notifications';
import {
  MobileFormSectionCard,
  MobileAddressFields,
  MobileSalaryField,
  MobileSubmitButton,
} from '../forms';
import {
  X,
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  ChevronDown,
  Check,
  ShieldCheck,
  CreditCard,
  Clock,
  CheckCircle2,
} from '../ui/icon';

const USER_ROLES: Array<{ value: string; label: string }> = [
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'hr', label: 'HR' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

export interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSuperAdmin?: boolean;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  visible,
  onClose,
  onSuccess,
  isSuperAdmin = true,
}) => {
  const { theme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('operator');
  const [shiftTime, setShiftTime] = useState('Day Shift (08:00 AM - 08:00 PM)');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('Maharashtra');
  const [stateIdVal, setStateIdVal] = useState<number>(27);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('Welcome@123');

  const [monthlySalary, setMonthlySalary] = useState('');

  // Supervisor State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [supervisorId, setSupervisorId] = useState('');

  React.useEffect(() => {
    async function loadSupervisors() {
      try {
        const { data: sups } = await supabase.rpc('get_active_supervisors_public');
        if (sups) setSupervisors(sups as Array<{ id: string; full_name: string; email?: string }>);
      } catch {
        // ignore
      }
    }
    if (visible) {
      loadSupervisors();
    }
  }, [visible]);

  const [isLoading, setIsLoading] = useState(false);

  const availableRoles = isSuperAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => r.value !== 'super_admin');

  const roleSelectOptions = useMemo<SelectOption[]>(() => {
    return availableRoles.map((r) => ({
      value: r.value,
      label: r.label,
    }));
  }, [availableRoles]);

  const supervisorSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'None (Unassigned)' },
      ...supervisors.map((s) => ({
        value: s.id,
        label: s.full_name,
        description: s.email || undefined,
      })),
    ];
  }, [supervisors]);

  const isOperator = role === 'operator';
  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    email.trim().includes('@') &&
    cleanPhone.length >= 10 &&
    password.trim().length >= 6
  );
  const section2Complete = Boolean(shiftTime.trim().length > 0);
  const section3Complete = Boolean(street.trim() && city.trim() && district.trim() && stateVal.trim());
  const section4Complete = isOperator ? Boolean(monthlySalary && Number(monthlySalary) > 0) : true;

  const isAllMandatoryFilled = section1Complete && section2Complete && section3Complete && section4Complete;
  const missingMandatoryCount = [
    !section1Complete,
    !section2Complete,
    !section3Complete,
    isOperator && !section4Complete,
  ].filter(Boolean).length;

  const handleCreate = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      showToast('warning', 'Validation Error', 'Full Name is required (minimum 2 characters).');
      return;
    }
    if (cleanPhone.length < 10) {
      showToast('warning', 'Validation Error', 'Valid 10-digit mobile phone number is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('warning', 'Validation Error', 'Valid email address is required.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      showToast('warning', 'Validation Error', 'Password must be at least 6 characters.');
      return;
    }
    if (!street.trim() || !city.trim() || !district.trim() || !stateVal.trim()) {
      showToast('warning', 'Validation Error', 'Street address, City, District, and State are required.');
      return;
    }

    if (role === 'operator') {
      const sal = Number(monthlySalary);
      if (!monthlySalary || isNaN(sal) || sal <= 0) {
        showToast('warning', 'Validation Error', 'Monthly salary is mandatory for operator accounts and must be greater than 0.');
        return;
      }
    }

    let cleanAadhaar: string | null = null;
    if (aadhaarNumber.trim()) {
      const aadhaarRes = validateAadhaarNumber(aadhaarNumber);
      if (!aadhaarRes.isValid) {
        showToast('warning', 'Validation Error', aadhaarRes.error || 'Invalid Aadhaar number.');
        return;
      }
      cleanAadhaar = aadhaarRes.clean || null;
    }

    let formattedLic: string | null = null;
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        showToast('warning', 'Validation Error', licRes.error || 'Invalid driving licence format.');
        return;
      }
      formattedLic = licRes.formatted || licenseNumber.trim().toUpperCase();
    }

    setIsLoading(true);
    try {
      const sal = role === 'operator' ? Number(monthlySalary) : null;
      // 1. Direct Supabase Admin/Auth creation
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role,
            supervisor_id: isSupervisedRole(role) ? supervisorId || null : null,
            shift_time: shiftTime.trim() || null,
            street: street.trim() || null,
            address: street.trim() || null,
            monthly_salary: sal,
            complete_profile: true,
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateIdVal ? Number(stateIdVal) : null,
            location: `${street.trim()}, ${city.trim()}, ${district.trim()}, ${stateVal.trim()}`,
            aadhaar_number: cleanAadhaar,
            license_number: formattedLic,
            status: 'active',
          },
        },
      });

      if (signUpErr) throw signUpErr;

      // Ensure status is active in users table
      if (data.user) {
        try {
          const parsedShift = shiftTime.trim() ? parseProfileShiftTime(shiftTime) : null;
          await supabase
            .from('users')
            .update({
              status: 'active',
              role,
              supervisor_id: isSupervisedRole(role) ? supervisorId || null : null,
              shift_start_time: parsedShift?.startTime || null,
              shift_end_time: parsedShift?.endTime || null,
              street: street.trim() || null,
              address: street.trim() || null,
              monthly_salary: sal,
              complete_profile: true,
              city: city.trim(),
              district: district.trim(),
              state: stateVal.trim(),
              state_id: stateIdVal ? Number(stateIdVal) : null,
              aadhaar_number: cleanAadhaar,
              license_number: formattedLic,
            })
            .eq('id', data.user.id);

          if (isSupervisedRole(role) && supervisorId) {
            try {
              await supabase
                .from('user_supervisors')
                .upsert({ user_id: data.user.id, supervisor_id: supervisorId }, { onConflict: 'user_id,supervisor_id' });
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      }

      haptics.success();
      notifyUserCreated(fullName.trim(), role);
      showToast('success', 'User Created', `Account for ${fullName} has been created successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      haptics.error();
      showToast('error', 'Creation Failed', err?.message || 'Failed to create user account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      persistent={isLoading}
      testID="create-user-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ width: '100%' }}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.link + '14' }]}>
                <UserPlus size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>Add Employee / User</Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  Create authenticated system account
                </Text>
              </View>
            </View>
            <Touchable preset="icon" onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </Touchable>
          </View>

          {/* Direct Activation Notice */}
          <View style={[styles.activationBanner, { backgroundColor: '#10b98112', borderColor: '#10b98133' }]}>
            <CheckCircle2 size={15} color="#10b981" />
            <Text style={[styles.activationBannerText, { color: '#047857' }]}>
              Direct Account Activation: Account is instantly verified and activated upon creation. The employee can immediately log in.
            </Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Section 1: Account Credentials */}
            <MobileFormSectionCard
              stepNumber={1}
              title="Account Credentials"
              description="Login email, initial password & designated role"
              isMandatory={true}
              isCompleted={section1Complete}
            >
              <Input
                label="Full Name *"
                placeholder="e.g. Ramesh Verma"
                value={fullName}
                onChangeText={setFullName}
                leftIcon={<User size={16} color={theme.colors.mute} />}
              />

              <Input
                label="Email Address *"
                placeholder="e.g. ramesh@reachinternational.co.in"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Mail size={16} color={theme.colors.mute} />}
              />

              <Input
                label="Mobile Number *"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                leftIcon={<Phone size={16} color={theme.colors.mute} />}
              />

              {/* Designated Role Selector */}
              <SearchableSelect
                label="Designated Role"
                required
                options={roleSelectOptions}
                value={role}
                onChange={(val) => setRole(val)}
                placeholder="Select designated role..."
                modalTitle="Select System Role"
                leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
              />

              {/* Conditional Supervisor Selector */}
              {isSupervisedRole(role) && (
                <SearchableSelect
                  label="Assign Supervisor"
                  options={supervisorSelectOptions}
                  value={supervisorId}
                  onChange={(val) => setSupervisorId(val)}
                  placeholder="Select supervisor..."
                  modalTitle="Select Supervisor"
                  leftIcon={<User size={16} color={theme.colors.mute} />}
                />
              )}

              <Input
                label="Initial Password *"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                leftIcon={<Lock size={16} color={theme.colors.mute} />}
              />
            </MobileFormSectionCard>

            {/* Section 2: Shift Schedule */}
            <MobileFormSectionCard
              stepNumber={2}
              title="Shift Schedule"
              description="Operating work schedule window"
              isMandatory={true}
              isCompleted={section2Complete}
            >
              <Input
                label="Shift Schedule *"
                placeholder="e.g. Day Shift (08:00 AM - 08:00 PM)"
                value={shiftTime}
                onChangeText={setShiftTime}
                leftIcon={<Clock size={16} color={theme.colors.mute} />}
              />
            </MobileFormSectionCard>

            {/* Section 3: Work Location & Address */}
            <MobileFormSectionCard
              stepNumber={3}
              title="Work Location & Address"
              description="Street + City/Town/Village + District + State"
              isMandatory={true}
              isCompleted={section3Complete}
            >
              <MobileAddressFields
                street={street}
                city={city}
                district={district}
                stateName={stateVal}
                stateId={stateIdVal}
                onStreetChange={setStreet}
                onCityChange={setCity}
                onDistrictChange={setDistrict}
                onStateChange={(id, name) => {
                  setStateIdVal(id);
                  setStateVal(name);
                }}
                required={true}
              />
            </MobileFormSectionCard>

            {/* Section 4: Compensation & Identity */}
            <MobileFormSectionCard
              stepNumber={4}
              title="Compensation & KYC"
              description={
                isOperator
                  ? 'Mandatory operator base compensation & official KYC'
                  : 'Base compensation & official KYC (Optional)'
              }
              isMandatory={isOperator}
              isCompleted={section4Complete}
            >
              <MobileSalaryField
                value={monthlySalary}
                onChangeText={setMonthlySalary}
                role={role}
              />

              <Input
                label="Aadhaar Card Number"
                placeholder="12-digit Aadhaar Number"
                value={aadhaarNumber}
                onChangeText={(val: string) => setAadhaarNumber(formatAadhaar(val))}
                keyboardType="number-pad"
                maxLength={14}
                leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
              />

              <Input
                label="Driving Licence Number"
                placeholder="e.g. MH12 20110012345"
                value={licenseNumber}
                onChangeText={(val: string) => setLicenseNumber(val.toUpperCase())}
                autoCapitalize="characters"
                maxLength={25}
                leftIcon={<CreditCard size={16} color={theme.colors.mute} />}
              />
            </MobileFormSectionCard>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" style={{ flex: 1, marginRight: 8 }} />
            <View style={{ flex: 1.5 }}>
              <MobileSubmitButton
                isReady={isAllMandatoryFilled}
                isLoading={isLoading}
                label="Create User"
                loadingLabel="Creating Account..."
                missingCount={missingMandatoryCount}
                onPress={handleCreate}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '92%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
  },
  subtitle: {
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  activationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  activationBannerText: {
    flex: 1,
  },
  alertBox: {
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
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
});
