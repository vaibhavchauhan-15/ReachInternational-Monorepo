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
import { X, UserPlus, User, Mail, Phone, Lock, MapPin, ChevronDown, Check, ShieldCheck, CreditCard } from 'lucide-react-native';

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
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('Welcome@123');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        setError(aadhaarRes.error || 'Please enter a valid 12-digit Aadhaar number.');
        return;
      }
      cleanAadhaar = aadhaarRes.clean || null;
    }

    let formattedLic: string | null = null;
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        setError(licRes.error || 'Please enter a valid driving licence number.');
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
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
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
