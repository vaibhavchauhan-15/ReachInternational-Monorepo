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
  TextInput,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  INDIAN_STATES,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import {
  X,
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  ChevronDown,
  Check,
  ShieldCheck,
  CreditCard,
  Clock,
  Search,
  CheckCircle2,
} from 'lucide-react-native';

const USER_ROLES = [
  { value: 'service_engineer', label: 'Service Engineer' },
  { value: 'manager', label: 'Manager' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operator' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'hr_manager', label: 'HR Manager' },
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
  const [role, setRole] = useState('service_engineer');
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [shiftTime, setShiftTime] = useState('Day Shift (08:00 AM - 08:00 PM)');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('Maharashtra');
  const [stateIdVal, setStateIdVal] = useState('27');
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
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

  const availableRoles = isSuperAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => r.value !== 'super_admin');

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

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
            supervisor_ids: isSupervisedRole(role) && supervisorId ? [supervisorId] : [],
            working_location_id: workingLocationId || null,
            shift_time: shiftTime.trim() || null,
            address: address.trim() || null,
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateIdVal ? Number(stateIdVal) : null,
            location: `${city.trim()}, ${district.trim()}, ${stateVal.trim()}`,
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
          await supabase
            .from('users')
            .update({
              status: 'active',
              role,
              supervisor_id: isSupervisedRole(role) ? supervisorId || null : null,
              supervisor_ids: isSupervisedRole(role) && supervisorId ? [supervisorId] : [],
              working_location_id: workingLocationId || null,
              shift_time: shiftTime.trim() || null,
              address: address.trim() || null,
              city: city.trim(),
              district: district.trim(),
              state: stateVal.trim(),
              state_id: stateIdVal ? Number(stateIdVal) : null,
              aadhaar_number: cleanAadhaar,
              license_number: formattedLic,
            })
            .eq('id', data.user.id);
        } catch {
          // ignore
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user account.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedRoleObj = availableRoles.find((r) => r.value === role) || availableRoles[0];

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
                <UserPlus size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>Add Employee / User</Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  Create authenticated system account
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Direct Activation Notice */}
          <View style={[styles.activationBanner, { backgroundColor: '#10b98112', borderColor: '#10b98133' }]}>
            <CheckCircle2 size={15} color="#10b981" />
            <Text style={[styles.activationBannerText, { color: '#047857' }]}>
              Direct Account Activation: Account is instantly verified and activated upon creation. The employee can immediately log in.
            </Text>
          </View>

          {error ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '14', borderColor: theme.colors.error + '33' }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                {error}
              </Text>
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

            {/* State Picker Trigger */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>State *</Text>
              <TouchableOpacity
                onPress={() => setStatePickerVisible(true)}
                activeOpacity={0.8}
                style={[
                  styles.roleTrigger,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
              >
                <Text style={[styles.roleTriggerText, { color: stateVal ? theme.colors.ink : theme.colors.mute }]}>
                  {stateVal || 'Select state...'}
                </Text>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

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
                {availableRoles.map((r) => {
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

        {/* State Picker Modal */}
        <Modal visible={statePickerVisible} animationType="slide" transparent onRequestClose={() => setStatePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Indian State</Text>
                <TouchableOpacity onPress={() => setStatePickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchWrap, { borderBottomColor: theme.colors.hairline }]}>
                <Search size={15} color={theme.colors.mute} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.ink }]}
                  placeholder="Search state..."
                  placeholderTextColor={theme.colors.mute}
                  value={stateSearch}
                  onChangeText={setStateSearch}
                />
              </View>

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                {filteredStates.map((st) => {
                  const isSelected = stateIdVal === String(st.id) || stateVal === st.name;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      onPress={() => {
                        setStateVal(st.name);
                        setStateIdVal(String(st.id));
                        setStatePickerVisible(false);
                        setStateSearch('');
                      }}
                      style={[
                        styles.roleItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '500' }]}>
                        {st.name}
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
                <TouchableOpacity
                  onPress={() => {
                    setSupervisorId('');
                    setSupervisorModalVisible(false);
                  }}
                  style={[styles.roleItemRow, { borderBottomColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.roleItemText, { color: theme.colors.mute }]}>None (Unassigned)</Text>
                  {!supervisorId && <Check size={18} color={theme.colors.link} />}
                </TouchableOpacity>
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
                        }}
                        style={[
                          styles.roleItemRow,
                          { borderBottomColor: theme.colors.hairline },
                          isSelected && { backgroundColor: theme.colors.link + '12' },
                        ]}
                      >
                        <View>
                          <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                            {s.full_name}
                          </Text>
                          {s.email ? <Text style={{ fontSize: 11, color: theme.colors.mute, marginTop: 2 }}>{s.email}</Text> : null}
                        </View>
                        {isSelected && <Check size={18} color={theme.colors.link} />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Working Location Picker Modal */}
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
                  placeholder="Search working locations..."
                  value={workingLocationSearch}
                  onChangeText={setWorkingLocationSearch}
                  leftIcon={<Search size={15} color={theme.colors.mute} />}
                />
              </View>

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => {
                    setWorkingLocationId('');
                    setWorkingLocationModalVisible(false);
                  }}
                  style={[styles.roleItemRow, { borderBottomColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.roleItemText, { color: theme.colors.mute }]}>None (Unassigned)</Text>
                  {!workingLocationId && <Check size={18} color={theme.colors.link} />}
                </TouchableOpacity>
                {workingLocations
                  .filter((l) => {
                    const q = workingLocationSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      l.name.toLowerCase().includes(q) ||
                      (l.city && l.city.toLowerCase().includes(q))
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
                        }}
                        style={[
                          styles.roleItemRow,
                          { borderBottomColor: theme.colors.hairline },
                          isSelected && { backgroundColor: theme.colors.link + '12' },
                        ]}
                      >
                        <View>
                          <Text style={[styles.roleItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                            {l.name}
                          </Text>
                          {l.city ? <Text style={{ fontSize: 11, color: theme.colors.mute, marginTop: 2 }}>{l.city}</Text> : null}
                        </View>
                        {isSelected && <Check size={18} color={theme.colors.link} />}
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
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
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
  rowInputs: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleTrigger: {
    height: 44,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleTriggerText: {
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  roleListScroll: {
    maxHeight: 300,
  },
  roleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  roleItemText: {
    fontSize: 13,
  },
});
