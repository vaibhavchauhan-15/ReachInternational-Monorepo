import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { validateAadhaarNumber, validateLicenseNumber, formatAadhaar } from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { X, UserPlus, User, Mail, Phone, Lock, MapPin, ChevronDown, Check, ShieldCheck, CreditCard, Clock, Search } from 'lucide-react-native';

const USER_ROLES = [
  { value: 'service_engineer', label: 'Service Engineer' },
  { value: 'manager', label: 'Manager' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operator' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'admin', label: 'Administrator' },
];

export interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('service_engineer');
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [shiftTime, setShiftTime] = useState('Day Shift (08:00 AM - 08:00 PM)');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('Welcome@123');

  // Supervisor State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState('');

  // Working Location State
  const [workingLocations, setWorkingLocations] = useState<Array<{ id: string; name: string; type: string; city?: string }>>([]);
  const [workingLocationId, setWorkingLocationId] = useState('');
  const [workingLocationModalVisible, setWorkingLocationModalVisible] = useState(false);
  const [workingLocationSearch, setWorkingLocationSearch] = useState('');

  React.useEffect(() => {
    async function loadSupervisors() {
      try {
        const { data, error } = await supabase.rpc('get_active_supervisors_public');
        if (!error && data) {
          setSupervisors(data as Array<{ id: string; full_name: string; email?: string }>);
        }
      } catch (err) {
        console.warn('Note: failed to load active supervisors for CreateUserModal:', err);
      }
    }

    async function loadWorkingLocations() {
      try {
        const { data, error } = await supabase.rpc('get_active_working_locations_public');
        if (!error && data) {
          setWorkingLocations(data as Array<{ id: string; name: string; type: string; city?: string }>);
        }
      } catch (err) {
        console.warn('Note: failed to load active working locations for CreateUserModal:', err);
      }
    }

    loadSupervisors();
    loadWorkingLocations();
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedSupervisor = supervisors.find((s) => s.id === supervisorId);
  const selectedWorkingLocation = workingLocations.find((l) => l.id === workingLocationId);

  const handleCreate = async () => {
    setError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full Name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Valid Email Address is required.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setError('Valid 10-digit mobile phone number is required.');
      return;
    }
    if (!city.trim() || !district.trim() || !stateVal.trim()) {
      setError('City, District, and State are required.');
      return;
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
      // 1. Direct Supabase Admin/Auth creation or public.users insert
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role,
            supervisor_id: isSupervisedRole(role) ? supervisorId || null : null,
            working_location_id: workingLocationId || null,
            shift_time: shiftTime.trim() || null,
            address: address.trim() || null,
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            location: `${city.trim()}, ${district.trim()}, ${stateVal.trim()}`,
            aadhaar_number: cleanAadhaar,
            license_number: formattedLic,
          },
        },
      });

      if (signUpErr) throw signUpErr;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user account.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleObj = USER_ROLES.find((r) => r.value === role) || USER_ROLES[0];

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
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.canvas }]}>
                <UserPlus size={18} color={theme.colors.link} />
              </View>
              <Text style={[styles.title, { color: theme.colors.ink }]}>Add Employee / User</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Input
              label="Full Name *"
              placeholder="e.g. Ramesh Verma"
              value={fullName}
              onChangeText={setFullName}
              leftIcon={<User size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Email Address *"
              placeholder="e.g. ramesh@reachinternation.com"
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

            {/* Role Trigger */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Designated Role *</Text>
              <TouchableOpacity
                onPress={() => setRolePickerVisible(true)}
                activeOpacity={0.8}
                style={[
                  styles.roleTrigger,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
              >
                <Text style={[styles.roleTriggerText, { color: theme.colors.ink }]}>{selectedRoleObj.label}</Text>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            {/* Conditional Supervisor Trigger */}
            {isSupervisedRole(role) && (
              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Assign Supervisor</Text>
                <TouchableOpacity
                  onPress={() => setSupervisorModalVisible(true)}
                  activeOpacity={0.8}
                  style={[
                    styles.roleTrigger,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                >
                  <Text style={[styles.roleTriggerText, { color: selectedSupervisor ? theme.colors.ink : theme.colors.mute }]}>
                    {selectedSupervisor ? selectedSupervisor.full_name : 'Select supervisor...'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            )}

            {/* Working Location Trigger for All Roles */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Working Location / Base</Text>
              <TouchableOpacity
                onPress={() => setWorkingLocationModalVisible(true)}
                activeOpacity={0.8}
                style={[
                  styles.roleTrigger,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
              >
                <Text style={[styles.roleTriggerText, { color: selectedWorkingLocation ? theme.colors.ink : theme.colors.mute }]}>
                  {selectedWorkingLocation ? `${selectedWorkingLocation.name}${selectedWorkingLocation.city ? ` (${selectedWorkingLocation.city})` : ''}` : 'Select working location...'}
                </Text>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Input
              label="Shift Schedule"
              placeholder="e.g. Day Shift (08:00 AM - 08:00 PM)"
              value={shiftTime}
              onChangeText={setShiftTime}
              leftIcon={<Clock size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Street Address"
              placeholder="e.g. Plot 42, MIDC Area"
              value={address}
              onChangeText={setAddress}
              leftIcon={<MapPin size={16} color={theme.colors.mute} />}
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="City *"
                  placeholder="Pune"
                  value={city}
                  onChangeText={setCity}
                  leftIcon={<MapPin size={16} color={theme.colors.mute} />}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="District *"
                  placeholder="Pune"
                  value={district}
                  onChangeText={setDistrict}
                  leftIcon={<MapPin size={16} color={theme.colors.mute} />}
                />
              </View>
            </View>

            <Input
              label="State *"
              placeholder="Maharashtra"
              value={stateVal}
              onChangeText={setStateVal}
              leftIcon={<MapPin size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Aadhaar Card Number"
              placeholder="12-digit Aadhaar Number"
              value={aadhaarNumber}
              onChangeText={setAadhaarNumber}
              keyboardType="number-pad"
              maxLength={14}
              leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Driving Licence Number"
              placeholder="e.g. MH12 20110012345"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              autoCapitalize="characters"
              maxLength={25}
              leftIcon={<CreditCard size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Initial Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon={<Lock size={16} color={theme.colors.mute} />}
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" />
            <Button
              label="Create User"
              onPress={handleCreate}
              isLoading={isLoading}
              variant="primary"
              size="md"
            />
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

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                {USER_ROLES.map((r) => {
                  const isSelected = role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => {
                        setRole(r.value);
                        setRolePickerVisible(false);
                      }}
                      style={[
                        styles.roleItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                        {r.label}
                      </Text>
                      {isSelected && <Check size={18} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Supervisor Picker Modal */}
        <Modal visible={supervisorModalVisible} animationType="slide" transparent onRequestClose={() => setSupervisorModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Supervisor</Text>
                <TouchableOpacity onPress={() => setSupervisorModalVisible(false)} style={styles.closeBtn}>
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

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                {supervisors
                  .filter((s) => {
                    const q = supervisorSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      s.full_name.toLowerCase().includes(q) ||
                      (s.email && s.email.toLowerCase().includes(q))
                    );
                  })
                  .map((s) => {
                    const isSelected = supervisorId === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          setSupervisorId(s.id);
                          setSupervisorModalVisible(false);
                          setSupervisorSearch('');
                        }}
                        style={[
                          styles.roleItemRow,
                          { borderBottomColor: theme.colors.hairline },
                          isSelected && { backgroundColor: theme.colors.link + '12' },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                            {s.full_name}
                          </Text>
                          {s.email && (
                            <Text style={{ fontSize: 11, color: theme.colors.mute }}>{s.email}</Text>
                          )}
                        </View>
                        {isSelected && <Check size={18} color={theme.colors.link} />}
                      </TouchableOpacity>
                    );
                  })}
                {supervisors.length === 0 && (
                  <View style={{ padding: spacingNumeric.md, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.mute, fontSize: 13 }}>No active supervisors found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Working Location Selection Modal */}
        <Modal visible={workingLocationModalVisible} animationType="slide" transparent onRequestClose={() => setWorkingLocationModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Working Location</Text>
                <TouchableOpacity onPress={() => setWorkingLocationModalVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: spacingNumeric.md, paddingVertical: spacingNumeric.xs }}>
                <Input
                  placeholder="Search working location..."
                  value={workingLocationSearch}
                  onChangeText={setWorkingLocationSearch}
                  leftIcon={<Search size={15} color={theme.colors.mute} />}
                />
              </View>

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                {workingLocations
                  .filter((l) => {
                    const q = workingLocationSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      l.name.toLowerCase().includes(q) ||
                      (l.city && l.city.toLowerCase().includes(q)) ||
                      (l.type && l.type.toLowerCase().includes(q))
                    );
                  })
                  .map((l) => {
                    const isSelected = workingLocationId === l.id;
                    return (
                      <TouchableOpacity
                        key={l.id}
                        onPress={() => {
                          setWorkingLocationId(l.id);
                          setWorkingLocationModalVisible(false);
                          setWorkingLocationSearch('');
                        }}
                        style={[
                          styles.roleItemRow,
                          { borderBottomColor: theme.colors.hairline },
                          isSelected && { backgroundColor: theme.colors.link + '12' },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                            {l.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.colors.mute }}>
                            {[l.type?.toUpperCase(), l.city].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        {isSelected && <Check size={18} color={theme.colors.link} />}
                      </TouchableOpacity>
                    );
                  })}
                {workingLocations.length === 0 && (
                  <View style={{ padding: spacingNumeric.md, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.mute, fontSize: 13 }}>No active working locations found</Text>
                  </View>
                )}
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
    maxHeight: '90%',
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
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  alertBox: {
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.xs,
  },
  inputGroup: {
    marginBottom: spacingNumeric.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  roleTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  roleTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: spacingNumeric.lg,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderTopWidth: 1,
    maxHeight: '65%',
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
    fontWeight: '700',
  },
  roleListScroll: {
    paddingHorizontal: spacingNumeric.md,
  },
  roleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
  },
  roleItemText: {
    fontSize: 14,
  },
});
