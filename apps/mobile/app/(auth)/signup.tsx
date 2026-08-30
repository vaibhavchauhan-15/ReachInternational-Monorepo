import React, { useState, useRef } from 'react';
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
import { Button, Input, Card, useTheme } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { validateAadhaarNumber, validateLicenseNumber, formatAadhaar } from '@reachinternational/utils';
import {
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  X,
  Check,
  ArrowLeft,
} from 'lucide-react-native';

const SIGNUP_ROLES = [
  { value: 'service_engineer', label: 'Service Engineer', desc: 'Field operations & breakdown resolution' },
  { value: 'manager', label: 'Manager', desc: 'Operations, fleet, client contracts & business management' },
  { value: 'service_manager', label: 'Service Manager', desc: 'Service planning, engineer dispatch & FSR approval' },
  { value: 'store_manager', label: 'Store Manager', desc: 'Inventory stock ledger & transfers' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Raise complaints & machine inspection' },
  { value: 'operator', label: 'Operator', desc: 'Machine duty & daily running hour logs' },
  { value: 'mechanic', label: 'Mechanic / Technician', desc: 'Repair work orders & parts request' },
  { value: 'hr_manager', label: 'HR Manager', desc: 'Staff onboarding & payroll management' },
];

export default function SignupScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('service_engineer');
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedRoleObj = SIGNUP_ROLES.find((r) => r.value === selectedRole) || SIGNUP_ROLES[0];

  const handleSignup = async () => {
    if (isSubmittingRef.current || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');

    // Field Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Full name is required (minimum 2 characters).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid email address is required.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Valid 10-digit mobile number is required.');
      return;
    }
    if (!city.trim() || city.trim().length < 2) {
      setErrorMessage('City is required.');
      return;
    }
    if (!district.trim() || district.trim().length < 2) {
      setErrorMessage('District is required.');
      return;
    }
    if (!stateVal.trim() || stateVal.trim().length < 2) {
      setErrorMessage('State is required.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
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

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role: selectedRole,
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            aadhaar_number: cleanAadhaar,
            license_number: formattedLic,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        isSubmittingRef.current = false;
        setIsLoading(false);
      } else {
        setSuccessMessage('Account request submitted successfully! Please wait for administrator approval.');
        // Keep isLoading=true and isSubmittingRef=true during redirect
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during signup.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flexContainer, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Soft Background Glow Circles */}
        <View style={[styles.ambientGlowTop, { backgroundColor: theme.colors.link + '15' }]} />
        <View style={[styles.ambientGlowBottom, { backgroundColor: theme.colors.violet + '15' }]} />

        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <ArrowLeft size={16} color={theme.colors.ink} />
          </TouchableOpacity>

          <View style={styles.brandRow}>
            <View style={[styles.logoEmblem, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.logoLetter, { color: theme.colors.canvas }]}>R</Text>
            </View>
            <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>Reach International</Text>
          </View>

          <TouchableOpacity
            onPress={() => setMode(isDark ? 'light' : 'dark')}
            style={[styles.themeBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.mute }}>
              {isDark ? 'LIGHT' : 'DARK'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroHeadline, { color: theme.colors.ink }]}>
            Join your machine fleet team
          </Text>
        </View>

        {/* Form Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[styles.formTitle, { color: theme.colors.ink, marginBottom: spacingNumeric.md }]}>
            Create Your Account
          </Text>

          {errorMessage ? (
            <View style={[styles.alertContainer, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={[styles.alertText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={[styles.alertContainer, { backgroundColor: theme.colors.success + '1a', borderColor: theme.colors.success }]}>
              <Text style={[styles.alertText, { color: theme.colors.success }]}>{successMessage}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name *"
            placeholder="Rahul Sharma"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            leftIcon={<User size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Email Address *"
            placeholder="rahul@domain.in"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
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

          {/* Role Selector Trigger */}
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Account Role Requested *</Text>
            <TouchableOpacity
              onPress={() => setRoleModalVisible(true)}
              activeOpacity={0.8}
              style={[
                styles.selectTrigger,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
            >
              <View style={styles.roleSelectedLeft}>
                <ShieldCheck size={16} color={theme.colors.link} />
                <View>
                  <Text style={[styles.roleSelectTitle, { color: theme.colors.ink }]}>
                    {selectedRoleObj.label}
                  </Text>
                  <Text style={[styles.roleSelectDesc, { color: theme.colors.mute }]} numberOfLines={1}>
                    {selectedRoleObj.desc}
                  </Text>
                </View>
              </View>
              <ChevronDown size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Address Fields */}
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
            label="Aadhaar Card Number *"
            placeholder="12-digit Aadhaar Number"
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
            keyboardType="number-pad"
            maxLength={14}
            leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Driving Licence Number (Optional)"
            placeholder="e.g. MH12 20110012345"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
            maxLength={25}
            leftIcon={<CreditCard size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Password *"
            placeholder="••••••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={16} color={theme.colors.mute} />}
          />

          <Input
            label="Confirm Password *"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            leftIcon={<Lock size={16} color={theme.colors.mute} />}
          />

          {/* Admin Approval Notice */}
          <View style={[styles.noticeBox, { backgroundColor: theme.colors.link + '12', borderColor: theme.colors.link + '30' }]}>
            <Text style={[styles.noticeText, { color: theme.colors.link }]}>
              <Text style={{ fontWeight: '700' }}>Note: </Text>
              Account status will be &ldquo;pending&rdquo; until authorized by an administrator.
            </Text>
          </View>

          <Button
            label="Request Platform Access"
            onPress={handleSignup}
            isLoading={isLoading}
            shape="square"
            fullWidth
            style={styles.signupBtn}
          />

          <View style={styles.footerLinkRow}>
            <Text style={[styles.footerText, { color: theme.colors.mute }]}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={[styles.footerLink, { color: theme.colors.link }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      {/* Role Picker Bottom Sheet Modal */}
      <Modal visible={roleModalVisible} animationType="slide" transparent onRequestClose={() => setRoleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Account Role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
              {SIGNUP_ROLES.map((r) => {
                const isSelected = selectedRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => {
                      setSelectedRole(r.value);
                      setRoleModalVisible(false);
                    }}
                    style={[
                      styles.roleItemRow,
                      { borderBottomColor: theme.colors.hairline },
                      isSelected && { backgroundColor: theme.colors.link + '12' },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleItemTitle, { color: isSelected ? theme.colors.link : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.roleItemDesc, { color: theme.colors.mute }]}>{r.desc}</Text>
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
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: spacingNumeric.lg,
    paddingTop: 52,
    paddingBottom: 40,
    position: 'relative',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.lg,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoEmblem: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  heroSection: {
    marginBottom: spacingNumeric.md,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  card: {
    width: '100%',
    padding: spacingNumeric.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 12,
    marginBottom: spacingNumeric.md,
  },
  alertContainer: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginBottom: spacingNumeric.md,
  },
  alertText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: spacingNumeric.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  roleSelectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  roleSelectTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  roleSelectDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  noticeBox: {
    padding: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginVertical: spacingNumeric.xs,
  },
  noticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  signupBtn: {
    marginTop: spacingNumeric.md,
  },
  footerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  footerText: {
    fontSize: 12,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '700',
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
    maxHeight: '75%',
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
  modalCloseBtn: {
    padding: 4,
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
  roleItemTitle: {
    fontSize: 14,
  },
  roleItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
});
