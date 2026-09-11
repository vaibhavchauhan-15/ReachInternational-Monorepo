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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  INDIAN_STATES,
  getStateById,
  getStateByName,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { notifyUserUpdated } from '../../lib/notifications';
import {
  X,
  User,
  Phone,
  MapPin,
  Shield,
  ShieldCheck,
  CreditCard,
  Clock,
  Building2,
  ChevronDown,
  Check,
  Search,
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
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'service_engineer', label: 'Service Engineer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'operator', label: 'Operator' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'hr_manager', label: 'HR Manager' },
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
  const [role, setRole] = useState('service_engineer');
  const [shiftTime, setShiftTime] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [stateId, setStateId] = useState<string>('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Dropdown Picker States
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  // Supervisor State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorPickerVisible, setSupervisorPickerVisible] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState('');

  // Working Location State
  const [workingLocations, setWorkingLocations] = useState<Array<{ id: string; name: string; type?: string; city?: string }>>([]);
  const [workingLocationId, setWorkingLocationId] = useState('');
  const [workingLocationPickerVisible, setWorkingLocationPickerVisible] = useState(false);
  const [workingLocationSearch, setWorkingLocationSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setRole(user.role || 'service_engineer');
      setShiftTime(user.shift_time || '');
      setAddress(user.address || '');
      setCity(user.city || '');
      setDistrict(user.district || '');

      const matchedState = user.state_id
        ? getStateById(user.state_id)
        : user.state
        ? getStateByName(user.state)
        : undefined;

      setStateName(matchedState ? matchedState.name : user.state || '');
      setStateId(matchedState ? String(matchedState.id) : user.state_id ? String(user.state_id) : '');
      setAadhaarNumber(user.aadhaar_number ? formatAadhaar(user.aadhaar_number) : '');
      setLicenseNumber(user.license_number || '');
      setSupervisorId(user.supervisor_id || (user.supervisor_ids && user.supervisor_ids[0]) || '');
      setWorkingLocationId(user.working_location_id || (user.working_location ? user.working_location.id : '') || '');
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
      try {
        const { data: locs } = await supabase.rpc('get_active_working_locations_public');
        if (locs) setWorkingLocations(locs as Array<{ id: string; name: string; type?: string; city?: string }>);
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
  const selectedWorkingLocation = workingLocations.find((l) => l.id === workingLocationId);

  const filteredStates = INDIAN_STATES.filter((s) =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredSupervisors = supervisors.filter((s) =>
    s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase())
  );

  const filteredLocations = workingLocations.filter((l) =>
    l.name.toLowerCase().includes(workingLocationSearch.toLowerCase()) ||
    (l.city && l.city.toLowerCase().includes(workingLocationSearch.toLowerCase()))
  );

  const handleSave = async () => {
    setError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full Name is required.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setError('Valid 10-digit mobile phone number is required.');
      return;
    }
    if (!city.trim() || !district.trim() || !stateName.trim()) {
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
      const primarySupervisorId = isSupervisedRole(role) && supervisorId ? supervisorId : null;
      const supervisorIdsArray = primarySupervisorId ? [primarySupervisorId] : [];

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone,
          role,
          shift_time: shiftTime.trim() || null,
          address: address.trim() || null,
          city: city.trim(),
          district: district.trim(),
          state: stateName.trim(),
          state_id: stateId ? Number(stateId) : null,
          location: `${city.trim()}, ${district.trim()}, ${stateName.trim()}`,
          aadhaar_number: cleanAadhaar,
          license_number: formattedLic,
          supervisor_id: primarySupervisorId,
          supervisor_ids: supervisorIdsArray,
          working_location_id: workingLocationId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

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
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>CONTACT & IDENTITY</Text>

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
            </View>

            {/* Section 2: Operations & Address */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>OPERATIONS & ADDRESS</Text>

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
                    styles.pickerTrigger,
                    { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                  ]}
                >
                  <Text style={[styles.pickerTriggerText, { color: stateName ? theme.colors.ink : theme.colors.mute }]}>
                    {stateName || 'Select Indian state...'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 3: Identity & Regulatory Documents */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>REGULATORY DOCUMENTS</Text>

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
            </View>

            {/* Section 4: Role & Permissions */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>ACCESS ROLE & ASSIGNMENTS</Text>

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

              {/* Working Location Trigger */}
              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Working Location / Site</Text>
                <TouchableOpacity
                  onPress={() => setWorkingLocationPickerVisible(true)}
                  activeOpacity={0.8}
                  style={[
                    styles.pickerTrigger,
                    { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                  ]}
                >
                  <Text style={[styles.pickerTriggerText, { color: selectedWorkingLocation ? theme.colors.ink : theme.colors.mute }]}>
                    {selectedWorkingLocation ? `${selectedWorkingLocation.name}${selectedWorkingLocation.city ? ` (${selectedWorkingLocation.city})` : ''}` : 'Select working location...'}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" />
            <Button
              label="Save Changes"
              onPress={handleSave}
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

        {/* State Picker Modal */}
        <Modal visible={statePickerVisible} animationType="slide" transparent onRequestClose={() => setStatePickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select State</Text>
                <TouchableOpacity onPress={() => setStatePickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { borderBottomColor: theme.colors.hairline }]}>
                <Search size={16} color={theme.colors.mute} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.ink }]}
                  placeholder="Search state..."
                  placeholderTextColor={theme.colors.mute}
                  value={stateSearch}
                  onChangeText={setStateSearch}
                />
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                {filteredStates.map((st) => {
                  const isSelected = stateId === String(st.id) || stateName === st.name;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      onPress={() => {
                        setStateName(st.name);
                        setStateId(String(st.id));
                        setStatePickerVisible(false);
                        setStateSearch('');
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <Text style={[styles.modalItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '500' }]}>
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
        <Modal visible={supervisorPickerVisible} animationType="slide" transparent onRequestClose={() => setSupervisorPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Supervisor</Text>
                <TouchableOpacity onPress={() => setSupervisorPickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { borderBottomColor: theme.colors.hairline }]}>
                <Search size={16} color={theme.colors.mute} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.ink }]}
                  placeholder="Search supervisor..."
                  placeholderTextColor={theme.colors.mute}
                  value={supervisorSearch}
                  onChangeText={setSupervisorSearch}
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
                        {s.email ? <Text style={{ fontSize: 11, color: theme.colors.mute }}>{s.email}</Text> : null}
                      </View>
                      {isSelected && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Working Location Picker Modal */}
        <Modal visible={workingLocationPickerVisible} animationType="slide" transparent onRequestClose={() => setWorkingLocationPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Working Location</Text>
                <TouchableOpacity onPress={() => setWorkingLocationPickerVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { borderBottomColor: theme.colors.hairline }]}>
                <Search size={16} color={theme.colors.mute} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.ink }]}
                  placeholder="Search working location..."
                  placeholderTextColor={theme.colors.mute}
                  value={workingLocationSearch}
                  onChangeText={setWorkingLocationSearch}
                />
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => {
                    setWorkingLocationId('');
                    setWorkingLocationPickerVisible(false);
                  }}
                  style={[styles.modalItemRow, { borderBottomColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.modalItemText, { color: theme.colors.mute }]}>None (Unassigned)</Text>
                  {!workingLocationId && <Check size={16} color={theme.colors.link} />}
                </TouchableOpacity>

                {filteredLocations.map((l) => {
                  const isSelected = workingLocationId === l.id;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => {
                        setWorkingLocationId(l.id);
                        setWorkingLocationPickerVisible(false);
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isSelected && { backgroundColor: theme.colors.link + '12' },
                      ]}
                    >
                      <View>
                        <Text style={[styles.modalItemText, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '500' }]}>
                          {l.name}
                        </Text>
                        {l.city ? <Text style={{ fontSize: 11, color: theme.colors.mute }}>{l.city}</Text> : null}
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
  sectionCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
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
