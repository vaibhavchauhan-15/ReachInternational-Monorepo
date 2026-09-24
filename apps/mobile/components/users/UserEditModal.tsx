import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  parseProfileShiftTime,
  getStateById,
  getStateByName,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { notifyUserUpdated } from '../../lib/notifications';
import {
  MobileFormSectionCard,
  MobileAddressFields,
  MobileSalaryField,
  MobileSubmitButton,
} from '../forms';
import {
  X,
  User,
  Phone,
  ShieldCheck,
  CreditCard,
  Clock,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import type { UserRecord } from './UserDetailModal';

export interface UserEditModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: () => void;
  isSuperAdmin?: boolean;
}

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'hr', label: 'HR' },
  { value: 'operator', label: 'Operator' },
];

export const UserEditModal: React.FC<UserEditModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
  isSuperAdmin = false,
}) => {
  const { theme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('operator');
  const [shiftTime, setShiftTime] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [stateId, setStateId] = useState<number>(27);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Dropdown Picker States
  const [rolePickerVisible, setRolePickerVisible] = useState(false);

  // Supervisor State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPickerVisible, setSupervisorPickerVisible] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');

  // Working Location State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setRole(user.role || 'operator');
      setShiftTime(user.shift_time || '');
      setStreet(user.street || user.address || '');
      setCity(user.city || '');
      setDistrict(user.district || '');
      setMonthlySalary(user.monthly_salary ? String(user.monthly_salary) : '');

      const matchedState = user.state_id
        ? getStateById(user.state_id)
        : user.state
        ? getStateByName(user.state)
        : undefined;

      setStateName(matchedState ? matchedState.name : user.state || 'Maharashtra');
      setStateId(matchedState ? matchedState.id : user.state_id || 27);
      setAadhaarNumber(user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : '');
      setLicenseNumber(user.license_number || '');
      setSupervisorId(user.supervisor_id || (user.supervisor_ids && user.supervisor_ids[0]) || '');
      setError('');
    }
  }, [user]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const { data: sups } = await supabase.rpc('get_active_supervisors_public');
        if (sups) setSupervisors(sups as Array<{ id: string; full_name: string; email?: string }>);
      } catch {
        // ignore
      }
    }
    if (visible) {
      loadMetadata();
    }
  }, [visible]);

  if (!user) return null;

  const roleOptions = isSuperAdmin
    ? ALL_ROLES
    : ALL_ROLES.filter((r) => r.value !== 'super_admin');

  const selectedRoleObj = ALL_ROLES.find((r) => r.value === role) || ALL_ROLES[0];
  const selectedSupervisor = supervisors.find((s) => s.id === supervisorId);

  const filteredSupervisors = supervisors.filter((s) =>
    s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(supervisorSearch.toLowerCase()))
  );

  const isOperator = role === 'operator';
  const isSalaryRequired = isOperator;

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const section1Complete = Boolean(fullName.trim().length >= 2 && cleanPhone.length >= 10);
  const section2Complete = Boolean(shiftTime.trim().length > 0);
  const section3Complete = Boolean(street.trim() && city.trim() && district.trim() && stateName.trim());
  const section4Complete = isSalaryRequired ? Boolean(monthlySalary && Number(monthlySalary) > 0) : true;

  const isAllMandatoryFilled = section1Complete && section2Complete && section3Complete && section4Complete;
  const missingMandatoryCount = [
    !section1Complete,
    !section2Complete,
    !section3Complete,
    isSalaryRequired && !section4Complete,
  ].filter(Boolean).length;

  const handleSave = async () => {
    setError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full Name is required.');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Valid 10-digit mobile phone number is required.');
      return;
    }
    if (!street.trim() || !city.trim() || !district.trim() || !stateName.trim()) {
      setError('Street address, City, District, and State are required.');
      return;
    }

    if (role === 'operator') {
      const sal = Number(monthlySalary);
      if (!monthlySalary || isNaN(sal) || sal <= 0) {
        setError('Monthly salary is mandatory for operator accounts and must be greater than 0.');
        return;
      }
    }

    let cleanAadhaar: string | null = null;
    if (aadhaarNumber.trim()) {
      const aadhaarRes = validateAadhaarNumber(aadhaarNumber);
      if (!aadhaarRes.isValid) {
        setError(aadhaarRes.error || 'Invalid Aadhaar number.');
        return;
      }
      cleanAadhaar = aadhaarRes.clean || null;
    }

    let formattedLic: string | null = null;
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        setError(licRes.error || 'Invalid driving licence format.');
        return;
      }
      formattedLic = licRes.formatted || licenseNumber.trim().toUpperCase();
    }

    setIsLoading(true);
    try {
      const primarySupervisorId = isSupervisedRole(role) && supervisorId ? supervisorId : null;
      const parsedShift = shiftTime.trim() ? parseProfileShiftTime(shiftTime) : null;
      const sal = role === 'operator' ? Number(monthlySalary) : null;

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone,
          role,
          shift_start_time: parsedShift?.startTime || null,
          shift_end_time: parsedShift?.endTime || null,
          street: street.trim() || null,
          address: street.trim() || null,
          monthly_salary: sal,
          city: city.trim(),
          district: district.trim(),
          state: stateName.trim(),
          state_id: stateId || null,
          aadhaar_number: cleanAadhaar,
          license_number: formattedLic,
          supervisor_id: primarySupervisorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      if (isSupervisedRole(role) && primarySupervisorId) {
        try {
          await supabase
            .from('user_supervisors')
            .upsert({ user_id: user.id, supervisor_id: primarySupervisorId }, { onConflict: 'user_id,supervisor_id' });
        } catch {
          // ignore
        }
      }

      // Sync employees directory record if present
      try {
        await supabase
          .from('employees')
          .update({
            full_name: fullName.trim(),
            phone: cleanPhone,
            designation: selectedRoleObj.label,
          })
          .eq('user_id', user.id);
      } catch {
        // ignore
      }

      notifyUserUpdated(fullName.trim(), role);
      Alert.alert('Account Updated', `Account details for ${fullName} have been saved successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user account details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.link + '14' }]}>
                <User size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>Edit User Account</Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  {user.full_name} ({user.email})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '14', borderColor: theme.colors.error + '33' }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                {error}
              </Text>
            </View>
          ) : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Section 1: Contact & Identity Info */}
            <MobileFormSectionCard
              stepNumber={1}
              title="Contact Details"
              description="Full name and verified mobile phone"
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
                label="Mobile Phone Number *"
                placeholder="+91 98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                leftIcon={<Phone size={16} color={theme.colors.mute} />}
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
                stateName={stateName}
                stateId={stateId}
                onStreetChange={setStreet}
                onCityChange={setCity}
                onDistrictChange={setDistrict}
                onStateChange={(id, name) => {
                  setStateId(id);
                  setStateName(name);
                }}
                required={true}
              />
            </MobileFormSectionCard>

            {/* Section 4: Role, Compensation & Regulatory Documents */}
            <MobileFormSectionCard
              stepNumber={4}
              title="Role, Compensation & KYC"
              description={
                isOperator
                  ? 'Designated role, mandatory operator base salary & official KYC'
                  : 'Designated role, base salary & official KYC (Optional)'
              }
              isMandatory={isOperator}
              isCompleted={section4Complete}
            >
              {/* Designated Role Trigger */}
              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Designated Role *</Text>
                <TouchableOpacity
                  onPress={() => setRolePickerVisible(true)}
                  activeOpacity={0.8}
                  style={[
                    styles.pickerTrigger,
                    { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                  ]}
                >
                  <Text style={[styles.pickerTriggerText, { color: theme.colors.ink }]}>{selectedRoleObj.label}</Text>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* Conditional Supervisor Trigger */}
              {isSupervisedRole(role) && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Assign Supervisor</Text>
                  <TouchableOpacity
                    onPress={() => setSupervisorPickerVisible(true)}
                    activeOpacity={0.8}
                    style={[
                      styles.pickerTrigger,
                      { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                    ]}
                  >
                    <Text style={[styles.pickerTriggerText, { color: selectedSupervisor ? theme.colors.ink : theme.colors.mute }]}>
                      {selectedSupervisor ? selectedSupervisor.full_name : 'Select supervisor...'}
                    </Text>
                    <ChevronDown size={16} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Operator Monthly Salary */}
              <MobileSalaryField
                value={monthlySalary}
                onChangeText={setMonthlySalary}
                role={role}
              />

              <Input
                label="Aadhaar Card Number"
                placeholder="12-digit Aadhaar Number"
                value={aadhaarNumber}
                onChangeText={(val) => setAadhaarNumber(formatAadhaar(val))}
                keyboardType="number-pad"
                maxLength={14}
                leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
              />

              <Input
                label="Driving Licence Number"
                placeholder="e.g. MH12 20110012345"
                value={licenseNumber}
                onChangeText={(val) => setLicenseNumber(val.toUpperCase())}
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
                label="Save Changes"
                loadingLabel="Saving Changes..."
                missingCount={missingMandatoryCount}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>

        {/* Role Picker Modal */}
        <Modal visible={rolePickerVisible} animationType="slide" transparent onRequestClose={() => setRolePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select System Role</Text>
                <TouchableOpacity onPress={() => setRolePickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                {roleOptions.map((r) => {
                  const isSelected = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => {
                        setRole(r.value);
                        setRolePickerVisible(false);
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <Text style={[styles.modalItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '500' }]}>
                        {r.label}
                      </Text>
                      {isSelected && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Supervisor Picker Modal */}
        <Modal visible={supervisorPickerVisible} animationType="slide" transparent onRequestClose={() => setSupervisorPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Supervisor</Text>
                <TouchableOpacity onPress={() => setSupervisorPickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: spacingNumeric.md, paddingVertical: spacingNumeric.xs }}>
                <Input
                  placeholder="Search supervisor..."
                  value={supervisorSearch}
                  onChangeText={setSupervisorSearch}
                  leftIcon={<User size={15} color={theme.colors.mute} />}
                />
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => {
                    setSupervisorId('');
                    setSupervisorPickerVisible(false);
                  }}
                  style={[styles.modalItemRow, { borderBottomColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.modalItemText, { color: theme.colors.mute }]}>None (Unassigned)</Text>
                  {!supervisorId && <Check size={16} color={theme.colors.link} />}
                </TouchableOpacity>

                {filteredSupervisors.map((s) => {
                  const isSelected = supervisorId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        setSupervisorId(s.id);
                        setSupervisorPickerVisible(false);
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <View>
                        <Text style={[styles.modalItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '500' }]}>
                          {s.full_name}
                        </Text>
                        {s.email ? <Text style={{ fontSize: 11, color: theme.colors.mute, marginTop: 2 }}>{s.email}</Text> : null}
                      </View>
                      {isSelected && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
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
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
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
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  pickerTriggerText: {
    fontSize: 13,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '75%',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalListScroll: {
    maxHeight: 320,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 13,
  },
});
