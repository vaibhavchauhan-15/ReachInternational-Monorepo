/**
 * Reach International Mobile — Signup / Registration Screen
 * 95% identical replication of the Web Mobile Viewport Signup UI/UX,
 * with 5% native smart phone optimizations:
 * - Touch & haptic feedback on selectors, checkboxes, AM/PM, uploads, and submit
 * - Uses canonical reusable UI components (Input, TimeInput, SearchableSelect, MobileFormSectionCard, MobileAddressFields, MobileDocumentUploadCard, MobileSubmitButton)
 * - Safe areas and responsive theming (Light/Dark).
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { Input, Alert, TimeInput, SearchableSelect, useTheme } from '../../components/ui';
import { ReachInternationalLogo } from '../../components/branding/ReachInternationalLogo';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  validateBankAccountNumber,
  validateIfscCode,
  formatIfscCode,
  computeShiftTiming,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { MobilePickedDocument, uploadUserDocumentDirect } from '../../lib/documents';
import { MobileDocumentUploadCard } from '../../components/documents/MobileDocumentUploadCard';
import {
  MobileFormSectionCard,
  MobileAddressFields,
  MobileSubmitButton,
} from '../../components/forms';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  CreditCard,
  Building2,
  Check,
  Info,
  Sun,
  Moon,
} from 'lucide-react-native';

const SIGNUP_ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
];

export default function SignupScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');

  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('08:00 PM');

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);

  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankDoc, setBankDoc] = useState<MobilePickedDocument | null>(null);
  const [bankDocError, setBankDocError] = useState<string | null>(null);

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDoc, setAadhaarDoc] = useState<MobilePickedDocument | null>(null);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDoc, setLicenseDoc] = useState<MobilePickedDocument | null>(null);
  const [licenseDocError, setLicenseDocError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Supervisor Selection State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const clearFieldError = (fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function loadSupervisors() {
      setLoadingSupervisors(true);
      try {
        const { data, error } = await supabase.rpc('get_active_supervisors_public');
        if (!error && data && isMounted) {
          setSupervisors(data as Array<{ id: string; full_name: string }>);
        } else if (error) {
          console.warn('[Signup] RPC get_active_supervisors_public error:', error.message);
          // Fallback query if RPC fails
          const { data: directData } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'supervisor')
            .in('status', ['active', 'approved']);
          if (directData && isMounted && directData.length > 0) {
            setSupervisors(directData as Array<{ id: string; full_name: string }>);
          }
        }
      } catch (err) {
        console.warn('Failed to load active supervisors for mobile signup:', err);
      } finally {
        if (isMounted) setLoadingSupervisors(false);
      }
    }

    loadSupervisors();
    return () => {
      isMounted = false;
    };
  }, []);

  const shiftSummary = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    return computeShiftTiming({
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [shiftStartTime, shiftEndTime]);

  const handleBankAccountChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 18);
    setBankAccountNumber(clean);
    clearFieldError('bank_account_number');
    if (clean.length > 0 && (clean.length < 9 || clean.length > 18)) {
      setFieldErrors((prev) => ({
        ...prev,
        bank_account_number: 'Account number must be between 9 and 18 digits.',
      }));
    } else if (clean.length >= 9) {
      const res = validateBankAccountNumber(clean);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          bank_account_number: res.error || 'Invalid bank account number.',
        }));
      }
    }
  };

  const handleBankIfscChange = (val: string) => {
    const formatted = formatIfscCode(val);
    setBankIfscCode(formatted);
    clearFieldError('bank_ifsc_code');
    if (formatted.length === 11) {
      const res = validateIfscCode(formatted);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          bank_ifsc_code: res.error || 'Invalid IFSC code format (e.g. SBIN0001234).',
        }));
      }
    }
  };

  const handleAadhaarChange = (val: string) => {
    const formatted = formatAadhaar(val);
    setAadhaarNumber(formatted);
    clearFieldError('aadhaar_number');
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 12) {
      const res = validateAadhaarNumber(clean);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          aadhaar_number: res.error || 'Invalid 12-digit Aadhaar number.',
        }));
      }
    }
  };

  const handleLicenseChange = (val: string) => {
    const formatted = val.toUpperCase();
    setLicenseNumber(formatted);
    clearFieldError('license_number');
    if (formatted.trim()) {
      const res = validateLicenseNumber(formatted);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          license_number: res.error || 'Invalid driving licence format.',
        }));
      }
    }
  };

  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase()) &&
    cleanPhone.length >= 10 &&
    (!isSupervisedRole(selectedRole) || supervisors.length === 0 || selectedSupervisorId)
  );

  const section2Complete = Boolean(
    shiftStartTime.trim().length > 0 &&
    shiftEndTime.trim().length > 0
  );

  const cleanBankAcc = bankAccountNumber.replace(/\D/g, '');
  const cleanIfsc = bankIfscCode.trim().toUpperCase();

  const section3Complete = Boolean(
    street.trim().length >= 2 &&
    city.trim().length >= 2 &&
    district.trim().length >= 2 &&
    (stateVal.trim().length > 0 || stateId !== null)
  );

  const section4Complete = Boolean(
    cleanBankAcc.length >= 9 &&
    cleanBankAcc.length <= 18 &&
    validateBankAccountNumber(cleanBankAcc).isValid &&
    cleanIfsc.length === 11 &&
    validateIfscCode(cleanIfsc).isValid &&
    Boolean(bankDoc)
  );

  const section5Complete = Boolean(
    aadhaarNumber.replace(/\D/g, '').length === 12 &&
    Boolean(aadhaarDoc)
  );

  const section6Complete = Boolean(
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    password === confirmPassword &&
    agreedToTerms
  );

  const isAllMandatoryFilled = Boolean(
    section1Complete &&
    section2Complete &&
    section3Complete &&
    section4Complete &&
    section5Complete &&
    section6Complete
  );

  const missingFields: string[] = [];
  if (!fullName.trim() || fullName.trim().length < 2) missingFields.push('Full Name');
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) missingFields.push('Email Address');
  if (cleanPhone.length < 10) missingFields.push('Mobile Number');
  if (isSupervisedRole(selectedRole) && supervisors.length > 0 && !selectedSupervisorId) missingFields.push('Supervisor');
  if (!shiftStartTime.trim() || !shiftEndTime.trim()) missingFields.push('Shift Timing');
  if (!street.trim()) missingFields.push('Street Address');
  if (!city.trim() || city.trim().length < 2) missingFields.push('City');
  if (!district.trim() || district.trim().length < 2) missingFields.push('District');
  if (!stateVal.trim() && !stateId) missingFields.push('State');
  if (!cleanBankAcc || !validateBankAccountNumber(cleanBankAcc).isValid) missingFields.push('Bank Account Number');
  if (!cleanIfsc || !validateIfscCode(cleanIfsc).isValid) missingFields.push('IFSC Code');
  if (!bankDoc) missingFields.push('Bank Document');
  if (aadhaarNumber.replace(/\D/g, '').length !== 12) missingFields.push('Aadhaar Number');
  if (!aadhaarDoc) missingFields.push('Aadhaar Document');
  if (!password || password.length < 8) missingFields.push('Password');
  if (password !== confirmPassword) missingFields.push('Confirm Password');
  if (!agreedToTerms) missingFields.push('Terms of Service');

  const missingMandatoryCount = missingFields.length;

  const handleSignup = async () => {
    if (isSubmittingRef.current || isLoading) return;

    const errors: Record<string, string> = {};

    if (!fullName || fullName.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    }

    if (!email || !email.includes('@')) {
      errors.email = 'Please provide a valid email address.';
    }

    if (cleanPhone.length < 10) {
      errors.phone = 'Mobile number must be at least 10 digits.';
    }

    if (isSupervisedRole(selectedRole) && supervisors.length > 0 && !selectedSupervisorId) {
      errors.supervisor_id = 'Please select a supervisor.';
    }

    if (!street || street.trim().length < 2) {
      errors.street = 'Street address is required.';
    }
    if (!city || city.trim().length < 2) {
      errors.city = 'City/town is required.';
    }
    if (!district || district.trim().length < 2) {
      errors.district = 'District is required.';
    }
    if (!stateVal && !stateId) {
      errors.state = 'State is required.';
    }

    if (!cleanBankAcc || cleanBankAcc.length < 9) {
      errors.bank_account_number = 'Bank account number must be between 9 and 18 digits.';
    }
    if (!cleanIfsc || cleanIfsc.length !== 11) {
      errors.bank_ifsc_code = 'IFSC code must be exactly 11 characters.';
    }
    if (!bankDoc) {
      setBankDocError('Please upload your bank passbook/cheque/statement.');
      errors.bank_doc = 'Bank document is required.';
    }

    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      errors.aadhaar_number = 'Aadhaar number must be exactly 12 digits.';
    }
    if (!aadhaarDoc) {
      setAadhaarDocError('Please upload your Aadhaar document.');
      errors.aadhaar_doc = 'Aadhaar document is required.';
    }

    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        errors.license_number = licRes.error || 'Invalid driving licence format.';
      }
    }

    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (password !== confirmPassword) {
      errors.confirm_password = 'Passwords do not match.';
    }

    if (!agreedToTerms) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please correct the highlighted fields before submitting.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsLoading(true);

    const finalShift =
      shiftStartTime.trim() && shiftEndTime.trim()
        ? `${shiftStartTime.trim()} - ${shiftEndTime.trim()}`
        : shiftStartTime.trim() || shiftEndTime.trim() || null;

    const allowedRoleValues = SIGNUP_ROLES.map((r) => r.value);
    const safeRole = allowedRoleValues.includes(selectedRole) ? selectedRole : 'operator';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role: safeRole,
            supervisor_id: isSupervisedRole(safeRole) ? selectedSupervisorId || null : null,
            shift_time: finalShift,
            shift_start_time: shiftStartTime.trim() || null,
            shift_end_time: shiftEndTime.trim() || null,
            street: street.trim(),
            address: street.trim(),
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateId,
            location: `${street.trim() ? `${street.trim()}, ` : ''}${city.trim()}, ${district.trim()}, ${stateVal.trim()}`,
            monthly_salary: null,
            bank_account_number: bankAccountNumber.trim(),
            bank_ifsc_code: bankIfscCode.trim().toUpperCase(),
            aadhaar_number: aadhaarNumber.replace(/\D/g, ''),
            license_number: licenseNumber.trim().toUpperCase() || null,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        isSubmittingRef.current = false;
        setIsLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (data?.user?.id) {
          const userId = data.user.id;
          if (bankDoc) {
            try {
              await uploadUserDocumentDirect({
                userId,
                documentTypeCode: 'bank_document',
                doc: bankDoc,
              });
            } catch (bErr) {
              console.warn('[Signup] Bank document upload deferred:', bErr);
            }
          }
          if (aadhaarDoc) {
            try {
              await uploadUserDocumentDirect({
                userId,
                documentTypeCode: 'aadhaar',
                doc: aadhaarDoc,
              });
            } catch (uErr) {
              console.warn('[Signup] Aadhaar upload deferred:', uErr);
            }
          }
          if (licenseDoc) {
            try {
              await uploadUserDocumentDirect({
                userId,
                documentTypeCode: 'driving_license',
                doc: licenseDoc,
              });
            } catch (uErr) {
              console.warn('[Signup] Licence upload deferred:', uErr);
            }
          }
        }

        setSuccessMessage('Registration request submitted successfully! Your account is pending administrator approval. After approval from the administrator, you can log in.');
        setTimeout(() => {
          router.replace({
            pathname: '/(auth)/login',
            params: {
              message: 'Registration request submitted successfully! Your account is pending administrator approval. After approval from the administrator, you can log in.',
            },
          });
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during signup.');
      isSubmittingRef.current = false;
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const iconColor = isDark ? '#737373' : '#9ca3af';

  const supervisorOptions = useMemo(() => {
    return supervisors.map((s) => ({
      value: s.id,
      label: s.full_name,
    }));
  }, [supervisors]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: canvasBackground }]}>
      {/* Dynamic Status Bar */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card Container matching web mobile viewport */}
          <View style={styles.centerContainer}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              {/* Brand Logo Centered (clean wordmark without scissor lift SVG icon) */}
              <View style={styles.logoContainer}>
                <ReachInternationalLogo variant="full" size={26} showIcon={false} />
              </View>

              {/* Card Title */}
              <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                Create an account
              </Text>

              {/* Global Error Banner */}
              {errorMessage && Object.keys(fieldErrors).length === 0 ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="error">{errorMessage}</Alert>
                </View>
              ) : null}

              {/* Global Success Banner */}
              {successMessage ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="success">{successMessage}</Alert>
                </View>
              ) : null}

              {/* Section 1: Account & Role */}
              <MobileFormSectionCard
                stepNumber={1}
                title="ACCOUNT & ROLE"
                isMandatory={true}
                isCompleted={section1Complete}
                style={{ zIndex: 60 }}
              >
                <Input
                  label="Full Name"
                  required
                  placeholder="Rahul Sharma"
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    clearFieldError('full_name');
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  error={fieldErrors.full_name}
                  leftIcon={<User size={15} color={iconColor} />}
                />

                <Input
                  label="Email Address"
                  required
                  placeholder="rahul@domain.com"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    clearFieldError('email');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  error={fieldErrors.email}
                  leftIcon={<Mail size={15} color={iconColor} />}
                />

                <Input
                  label="Mobile Number"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    clearFieldError('phone');
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  error={fieldErrors.phone}
                  leftIcon={<Phone size={15} color={iconColor} />}
                />

                {/* Role Selector using Reusable SearchableSelect with role names only */}
                <SearchableSelect
                  label="Role Requested"
                  required
                  options={SIGNUP_ROLES}
                  value={selectedRole}
                  onChange={(val) => {
                    setSelectedRole(val);
                    if (!isSupervisedRole(val)) {
                      setSelectedSupervisorId('');
                    }
                  }}
                  placeholder="Select role..."
                  leftIcon={<User size={15} color={iconColor} />}
                  error={fieldErrors.role}
                  modalTitle="Select Account Role"
                  presentation="dropdown"
                  containerStyle={{ zIndex: 20 }}
                />

                {/* Conditional Supervisor Selector using Reusable SearchableSelect */}
                {isSupervisedRole(selectedRole) && (
                  <View style={[styles.supervisorWrapper, { zIndex: 10 }]}>
                    <SearchableSelect
                      label="Select Supervisor"
                      required
                      options={supervisorOptions}
                      value={selectedSupervisorId}
                      onChange={(val) => {
                        setSelectedSupervisorId(val);
                        clearFieldError('supervisor_id');
                      }}
                      placeholder={
                        loadingSupervisors
                          ? 'Loading supervisors...'
                          : supervisorOptions.length === 0
                          ? 'No active supervisors found'
                          : 'Select supervisor...'
                      }
                      leftIcon={<ShieldCheck size={15} color={iconColor} />}
                      error={fieldErrors.supervisor_id}
                      modalTitle="Select Supervisor"
                      searchable
                      searchPlaceholder="Search supervisor..."
                      presentation="dropdown"
                    />
                  </View>
                )}
              </MobileFormSectionCard>

              {/* Section 2: Work Shift Schedule */}
              <MobileFormSectionCard
                stepNumber={2}
                title="WORK SHIFT SCHEDULE"
                isMandatory={true}
                isCompleted={section2Complete}
                style={{ zIndex: 50 }}
                headerAction={
                  shiftSummary?.isValid ? (
                    <Text style={[styles.durationSmallText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                      {shiftSummary.durationMinutes % 60 === 0
                        ? `${shiftSummary.durationMinutes / 60} hrs`
                        : `${Number(shiftSummary.durationHours.toFixed(1))} hrs`}
                    </Text>
                  ) : null
                }
              >
                <TimeInput
                  label="Shift Start Time"
                  value={shiftStartTime}
                  onChange={setShiftStartTime}
                  required
                  toggleLayout="side-by-side"
                />
                <TimeInput
                  label="Shift End Time"
                  value={shiftEndTime}
                  onChange={setShiftEndTime}
                  required
                  toggleLayout="side-by-side"
                />
              </MobileFormSectionCard>

              {/* Section 3: Address Details */}
              <MobileFormSectionCard
                stepNumber={3}
                title="ADDRESS DETAILS"
                isMandatory={true}
                isCompleted={section3Complete}
                style={{ zIndex: 40 }}
              >
                <MobileAddressFields
                  street={street}
                  city={city}
                  district={district}
                  stateName={stateVal}
                  stateId={stateId}
                  onStreetChange={(val) => {
                    setStreet(val);
                    clearFieldError('street');
                  }}
                  onCityChange={(val) => {
                    setCity(val);
                    clearFieldError('city');
                  }}
                  onDistrictChange={(val) => {
                    setDistrict(val);
                    clearFieldError('district');
                  }}
                  onStateChange={(id, name) => {
                    setStateId(id);
                    setStateVal(name);
                    clearFieldError('state');
                  }}
                  errors={{
                    street: fieldErrors.street,
                    city: fieldErrors.city,
                    district: fieldErrors.district,
                    state: fieldErrors.state,
                  }}
                  required={true}
                />
              </MobileFormSectionCard>

              {/* Section 4: Banking Details */}
              <MobileFormSectionCard
                stepNumber={4}
                title="BANKING DETAILS"
                isMandatory={true}
                isCompleted={section4Complete}
                style={{ zIndex: 30 }}
              >
                <Input
                  label="Bank Account Number"
                  required
                  placeholder="9 to 18-digit Account Number"
                  value={bankAccountNumber}
                  onChangeText={handleBankAccountChange}
                  keyboardType="numeric"
                  maxLength={18}
                  error={fieldErrors.bank_account_number}
                  leftIcon={<CreditCard size={15} color={iconColor} />}
                />

                <Input
                  label="IFSC Code"
                  required
                  placeholder="e.g. SBIN0001234"
                  value={bankIfscCode}
                  onChangeText={handleBankIfscChange}
                  autoCapitalize="characters"
                  maxLength={11}
                  error={fieldErrors.bank_ifsc_code}
                  leftIcon={<Building2 size={15} color={iconColor} />}
                />

                <MobileDocumentUploadCard
                  title="Bank Account Document"
                  docTypeCode="bank_document"
                  required
                  selectedDoc={bankDoc}
                  onDocSelected={(doc) => {
                    setBankDoc(doc);
                    setBankDocError(null);
                    clearFieldError('bank_doc');
                  }}
                  onDocRemoved={() => {
                    setBankDoc(null);
                    setBankDocError(null);
                  }}
                  errorMessage={bankDocError || fieldErrors.bank_doc}
                />
              </MobileFormSectionCard>

              {/* Section 5: Identity Verification */}
              <MobileFormSectionCard
                stepNumber={5}
                title="IDENTITY VERIFICATION"
                isMandatory={true}
                isCompleted={section5Complete}
                style={{ zIndex: 20 }}
              >
                <Input
                  label="Aadhaar Card Number"
                  required
                  placeholder="12-digit Aadhaar Number"
                  value={aadhaarNumber}
                  onChangeText={handleAadhaarChange}
                  keyboardType="numeric"
                  maxLength={14}
                  error={fieldErrors.aadhaar_number}
                  leftIcon={<ShieldCheck size={15} color={iconColor} />}
                />

                <Input
                  label="Driving Licence Number (Optional)"
                  placeholder="e.g. MH12 20110012345"
                  value={licenseNumber}
                  onChangeText={handleLicenseChange}
                  autoCapitalize="characters"
                  maxLength={25}
                  error={fieldErrors.license_number}
                  leftIcon={<CreditCard size={15} color={iconColor} />}
                />

                <MobileDocumentUploadCard
                  title="Aadhaar Document"
                  docTypeCode="aadhaar"
                  required
                  selectedDoc={aadhaarDoc}
                  onDocSelected={(doc) => {
                    setAadhaarDoc(doc);
                    setAadhaarDocError(null);
                    clearFieldError('aadhaar_doc');
                  }}
                  onDocRemoved={() => {
                    setAadhaarDoc(null);
                    setAadhaarDocError(null);
                  }}
                  errorMessage={aadhaarDocError || fieldErrors.aadhaar_doc}
                />

                <MobileDocumentUploadCard
                  title="Licence Document"
                  docTypeCode="driving_license"
                  selectedDoc={licenseDoc}
                  onDocSelected={(doc) => {
                    setLicenseDoc(doc);
                    setLicenseDocError(null);
                  }}
                  onDocRemoved={() => {
                    setLicenseDoc(null);
                    setLicenseDocError(null);
                  }}
                  errorMessage={licenseDocError}
                />
              </MobileFormSectionCard>

              {/* Section 6: Security Credentials */}
              <MobileFormSectionCard
                stepNumber={6}
                title="SECURITY CREDENTIALS"
                isMandatory={true}
                isCompleted={section6Complete}
                style={{ zIndex: 10 }}
              >
                <Input
                  label="Password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    clearFieldError('password');
                  }}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={fieldErrors.password}
                  leftIcon={<Lock size={15} color={iconColor} />}
                />

                <Input
                  label="Confirm Password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    clearFieldError('confirm_password');
                  }}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={fieldErrors.confirm_password}
                  leftIcon={<Lock size={15} color={iconColor} />}
                />
              </MobileFormSectionCard>

              {/* Note Banner */}
              <View
                style={[
                  styles.noteBox,
                  {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                    borderColor: isDark ? 'rgba(2, 132, 199, 0.25)' : 'rgba(2, 132, 199, 0.2)',
                  },
                ]}
              >
                <Info size={15} color="#0284c7" style={{ marginTop: 2 }} />
                <Text
                  style={[
                    styles.noteText,
                    { color: isDark ? '#7dd3fc' : '#0369a1' },
                  ]}
                >
                  <Text style={{ fontWeight: '700' }}>Note: </Text>
                  Account status will be “pending” until approved by an administrator.
                </Text>
              </View>

              {/* Terms and Privacy Agreement Checkbox */}
              <View style={{ marginTop: 10, marginBottom: 8 }}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAgreedToTerms((prev) => {
                      const next = !prev;
                      if (next) clearFieldError('terms');
                      return next;
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      borderWidth: 1.5,
                      borderColor: agreedToTerms ? '#0284c7' : isDark ? '#404040' : '#d1d5db',
                      backgroundColor: agreedToTerms ? '#0284c7' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    {agreedToTerms && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 18 }}>
                    I have read and agree to the{' '}
                    <Text
                      style={{ color: '#0284c7', fontWeight: '600' }}
                      onPress={() => router.push('/(app)/terms')}
                    >
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={{ color: '#0284c7', fontWeight: '600' }}
                      onPress={() => router.push('/(app)/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>
                {fieldErrors.terms && (
                  <Text style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, marginLeft: 28 }}>
                    {fieldErrors.terms}
                  </Text>
                )}
              </View>

              {/* Gated Submit Button matching web mobile view */}
              <MobileSubmitButton
                isReady={isAllMandatoryFilled}
                isLoading={isLoading}
                onPress={handleSignup}
                label="Request Platform Access"
                loadingLabel="Submitting Registration Request..."
                missingCount={missingMandatoryCount}
                missingFields={missingFields}
              />

              {/* Card Footer */}
              <View style={[styles.cardFooter, { borderTopColor: isDark ? '#262626' : '#ebebeb' }]}>
                <Text style={[styles.cardFooterText, { color: isDark ? '#71717a' : '#888888' }]}>
                  Already have an account?
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    router.push('/(auth)/login');
                  }}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Text style={[styles.signInLinkText, { color: '#0284c7' }]}>
                    Sign in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bottom Screen Footer & Theme Toggle */}
          <View style={styles.screenFooter}>
            <View style={styles.footerInner}>
              <Text
                style={[
                  styles.copyrightText,
                  { color: isDark ? '#737373' : '#8f8f8f' },
                ]}
              >
                &copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.
              </Text>

              {/* Floating Theme Switcher */}
              <TouchableOpacity
                style={[
                  styles.themeToggleBtn,
                  {
                    backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0',
                    borderColor: cardBorder,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setMode(isDark ? 'light' : 'dark');
                }}
                activeOpacity={0.7}
                accessibilityLabel="Toggle Theme"
                hitSlop={8}
              >
                {isDark ? (
                  <Sun size={15} color="#e0e0e0" />
                ) : (
                  <Moon size={15} color="#333333" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 6,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  bannerContainer: {
    marginBottom: 12,
  },
  durationSmallText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 14,
  },
  supervisorWrapper: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardFooterText: {
    fontSize: 12.5,
  },
  signInLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  screenFooter: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 4,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  copyrightText: {
    flex: 1,
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  themeToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
