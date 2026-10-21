/**
 * Reach International Mobile — Signup / Registration Screen
 * Clean, minimal, responsive, enterprise-grade native sign-up screen matching
 * Web & Mobile 100% parity across all 8 dimensions:
 * - Enterprise branding with clean Reach International wordmark & tagline
 * - Clear 6-section hierarchy (Account & Role, Work Shift Schedule, Address, Banking, Identity, Credentials)
 * - TanStack Query caching for supervisor dropdown with graceful loading, empty, and retry states
 * - Centralized form validation via @reachinternational/validation with instant error clearing on edit
 * - Comprehensive shift schedule validation including overnight shift duration and duplicate start/end detection
 * - Sanitized auth error mapping preventing raw database or internal disclosure
 * - Mutex-guarded submissions preventing double-taps while preserving all entered form state on recoverable errors
 * - Native keyboard awareness, accessible touch targets (min 44px), and tactile haptics
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Input, TimeInput, SearchableSelect, useTheme, Text, useToast, Badge } from '../../components/ui';
import { Pressable } from '../../components/ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
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
import { validateSignupFormData } from '@reachinternational/validation';
import { mapSignupError } from '../../lib/auth/authErrors';
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
  RotateCw,
  AlertCircle,
} from '../../components/ui/icon';

const SIGNUP_ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
];

export default function SignupScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  // Section 1: Account & Role
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  // Section 2: Work Shift Schedule
  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('08:00 PM');

  // Section 3: Address Details
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);

  // Section 4: Banking Details
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankDoc, setBankDoc] = useState<MobilePickedDocument | null>(null);
  const [bankDocError, setBankDocError] = useState<string | null>(null);

  // Section 5: Identity Verification
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDoc, setAadhaarDoc] = useState<MobilePickedDocument | null>(null);
  const [aadhaarDocError, setAadhaarDocError] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDoc, setLicenseDoc] = useState<MobilePickedDocument | null>(null);
  const [licenseDocError, setLicenseDocError] = useState<string | null>(null);

  // Section 6: Security Credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Validation & Mutex State
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Centralized inline field error dismissal
  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  }, []);

  // TanStack Query: Fetch active supervisors with background caching & stale handling
  const {
    data: supervisors = [],
    isLoading: loadingSupervisors,
    isError: supervisorError,
    refetch: refetchSupervisors,
  } = useQuery({
    queryKey: ['active_supervisors_public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_supervisors_public');
      if (error) {
        console.warn('[Signup] RPC get_active_supervisors_public error:', error.message);
        throw error;
      }
      return (data || []) as Array<{ id: string; full_name: string }>;
    },
    staleTime: 60 * 1000,
    retry: 2,
  });

  const supervisorOptions = useMemo(() => {
    return supervisors.map((s) => ({
      value: s.id,
      label: s.full_name,
    }));
  }, [supervisors]);

  // Real-time Shift Duration & Schedule Computation
  const shiftSummary = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    return computeShiftTiming({
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [shiftStartTime, shiftEndTime]);

  // Section 1 Handlers (Memoized for high performance)
  const handleFullNameChange = useCallback((val: string) => {
    setFullName(val);
    clearFieldError('full_name');
  }, [clearFieldError]);

  const handleEmailChange = useCallback((val: string) => {
    setEmail(val);
    clearFieldError('email');
  }, [clearFieldError]);

  const handlePhoneChange = useCallback((val: string) => {
    setPhone(val);
    clearFieldError('phone');
  }, [clearFieldError]);

  const handleRoleChange = useCallback((val: string) => {
    setSelectedRole(val);
    clearFieldError('role');
    if (!isSupervisedRole(val)) {
      setSelectedSupervisorId('');
      clearFieldError('supervisor_id');
    }
  }, [clearFieldError]);

  const handleSupervisorChange = useCallback((val: string) => {
    setSelectedSupervisorId(val);
    clearFieldError('supervisor_id');
  }, [clearFieldError]);

  // Section 2 Handlers: Real-time Shift Timing Validation
  const handleShiftStartChange = useCallback((val: string) => {
    setShiftStartTime(val);
    clearFieldError('shift_time');
    clearFieldError('shift_start_time');
    if (val && shiftEndTime) {
      const res = computeShiftTiming({ startTime: val, endTime: shiftEndTime });
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          shift_time:
            res.errorMessage === 'Start time and end time cannot be identical.'
              ? 'End time must be after start time'
              : res.errorMessage || 'End time must be after start time',
        }));
      } else {
        clearFieldError('shift_time');
      }
    }
  }, [shiftEndTime, clearFieldError]);

  const handleShiftEndChange = useCallback((val: string) => {
    setShiftEndTime(val);
    clearFieldError('shift_time');
    clearFieldError('shift_end_time');
    if (shiftStartTime && val) {
      const res = computeShiftTiming({ startTime: shiftStartTime, endTime: val });
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          shift_time:
            res.errorMessage === 'Start time and end time cannot be identical.'
              ? 'End time must be after start time'
              : res.errorMessage || 'End time must be after start time',
        }));
      } else {
        clearFieldError('shift_time');
      }
    }
  }, [shiftStartTime, clearFieldError]);

  // Section 4 Handlers
  const handleBankAccountChange = useCallback((val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 18);
    setBankAccountNumber(clean);
    clearFieldError('bank_account_number');
    if (clean.length > 0 && (clean.length < 9 || clean.length > 18)) {
      setFieldErrors((prev) => ({
        ...prev,
        bank_account_number: 'Account number required (9–18 digits)',
      }));
    } else if (clean.length >= 9) {
      const res = validateBankAccountNumber(clean);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          bank_account_number: res.error || 'Account number required (9–18 digits)',
        }));
      }
    }
  }, [clearFieldError]);

  const handleBankIfscChange = useCallback((val: string) => {
    const formatted = formatIfscCode(val);
    setBankIfscCode(formatted);
    clearFieldError('bank_ifsc_code');
    if (formatted.length === 11) {
      const res = validateIfscCode(formatted);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          bank_ifsc_code: res.error || '11-character IFSC required',
        }));
      }
    }
  }, [clearFieldError]);

  // Section 5 Handlers
  const handleAadhaarChange = useCallback((val: string) => {
    const formatted = formatAadhaar(val);
    setAadhaarNumber(formatted);
    clearFieldError('aadhaar_number');
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 12) {
      const res = validateAadhaarNumber(clean);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          aadhaar_number: res.error || '12-digit Aadhaar required',
        }));
      }
    }
  }, [clearFieldError]);

  const handleLicenseChange = useCallback((val: string) => {
    const formatted = val.toUpperCase();
    setLicenseNumber(formatted);
    clearFieldError('license_number');
    if (formatted.trim()) {
      const res = validateLicenseNumber(formatted);
      if (!res.isValid) {
        setFieldErrors((prev) => ({
          ...prev,
          license_number: res.error || 'Invalid licence format',
        }));
      }
    }
  }, [clearFieldError]);

  // Section 6 Handlers
  const handlePasswordChange = useCallback((val: string) => {
    setPassword(val);
    clearFieldError('password');
  }, [clearFieldError]);

  const handleConfirmPasswordChange = useCallback((val: string) => {
    setConfirmPassword(val);
    clearFieldError('confirm_password');
  }, [clearFieldError]);

  // Real-time Password Strength & Pattern Metrics
  const passwordMetrics = useMemo(() => {
    const hasMinLen = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (password.length > 0) {
      if (hasMinLen) score += 1;
      if (hasUpper && hasLower) score += 1;
      if (hasNum) score += 1;
      if (hasSpecial) score += 1;
    }

    let strengthLabel = 'Weak';
    let strengthColor = '#ef4444';
    if (score >= 4) {
      strengthLabel = 'Strong';
      strengthColor = '#10b981';
    } else if (score === 3) {
      strengthLabel = 'Good';
      strengthColor = '#0ea5e9';
    } else if (score === 2) {
      strengthLabel = 'Fair';
      strengthColor = '#f59e0b';
    } else {
      strengthLabel = 'Weak';
      strengthColor = '#ef4444';
    }

    return {
      score,
      strengthLabel,
      strengthColor,
      hasMinLen,
      hasUpperLower: hasUpper && hasLower,
      hasNum,
    };
  }, [password]);

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const cleanBankAcc = bankAccountNumber.replace(/\D/g, '');
  const cleanIfsc = bankIfscCode.trim().toUpperCase();

  // Completion Criteria per Section
  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase()) &&
    cleanPhone.length >= 10 &&
    (!isSupervisedRole(selectedRole) || Boolean(selectedSupervisorId))
  );

  const section2Complete = Boolean(
    shiftStartTime.trim().length > 0 &&
    shiftEndTime.trim().length > 0 &&
    shiftSummary?.isValid
  );

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

  // Missing fields list for gated submit indicator
  const missingFields = useMemo(() => {
    const list: string[] = [];
    if (!fullName.trim() || fullName.trim().length < 2) list.push('Full Name');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) list.push('Email Address');
    if (cleanPhone.length < 10) list.push('Mobile Number');
    if (isSupervisedRole(selectedRole) && !selectedSupervisorId) list.push('Supervisor');
    if (!shiftStartTime.trim() || !shiftEndTime.trim() || !shiftSummary?.isValid) list.push('Shift Schedule');
    if (!street.trim()) list.push('Street Address');
    if (!city.trim() || city.trim().length < 2) list.push('City');
    if (!district.trim() || district.trim().length < 2) list.push('District');
    if (!stateVal.trim() && !stateId) list.push('State');
    if (!cleanBankAcc || !validateBankAccountNumber(cleanBankAcc).isValid) list.push('Bank Account Number');
    if (!cleanIfsc || !validateIfscCode(cleanIfsc).isValid) list.push('IFSC Code');
    if (!bankDoc) list.push('Bank Document');
    if (aadhaarNumber.replace(/\D/g, '').length !== 12) list.push('Aadhaar Number');
    if (!aadhaarDoc) list.push('Aadhaar Document');
    if (!password || password.length < 8) list.push('Password');
    if (password !== confirmPassword) list.push('Confirm Password');
    if (!agreedToTerms) list.push('Terms of Service');
    return list;
  }, [
    fullName,
    email,
    cleanPhone,
    selectedRole,
    selectedSupervisorId,
    shiftStartTime,
    shiftEndTime,
    shiftSummary?.isValid,
    street,
    city,
    district,
    stateVal,
    stateId,
    cleanBankAcc,
    cleanIfsc,
    bankDoc,
    aadhaarNumber,
    aadhaarDoc,
    password,
    confirmPassword,
    agreedToTerms,
  ]);

  const missingMandatoryCount = missingFields.length;

  // Safe Account Creation Flow with Mutex & Error Mapping
  const handleSignup = async () => {
    if (isSubmittingRef.current || isLoading) return;

    // 1. Centralized Form Validation Check
    const validationRes = validateSignupFormData({
      fullName,
      email,
      phone,
      role: selectedRole,
      supervisorId: isSupervisedRole(selectedRole) ? selectedSupervisorId : null,
      shiftStartTime,
      shiftEndTime,
      street,
      city,
      district,
      state: stateVal,
      bankAccountNumber,
      bankIfscCode,
      hasBankDoc: Boolean(bankDoc),
      aadhaarNumber,
      hasAadhaarDoc: Boolean(aadhaarDoc),
      licenseNumber,
      password,
      confirmPassword,
      agreedToTerms,
    });

    if (!validationRes.isValid) {
      setFieldErrors(validationRes.errors);
      toast('warning', 'Missing Details', 'Please complete all required fields.');
      haptics.reject();
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
        const mapped = mapSignupError(error);
        toast(mapped.type, mapped.title, mapped.message);
        if (mapped.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
        }
        isSubmittingRef.current = false;
        setIsLoading(false);
        haptics.reject();
        return;
      }

      haptics.confirm();
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

      toast(
        'success',
        'Registration Submitted',
        'Your account is pending administrator approval. Once approved, you can log in.'
      );
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1200);
    } catch (err: any) {
      const mapped = mapSignupError(err);
      toast(mapped.type, mapped.title, mapped.message);
      if (mapped.fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
      }
      isSubmittingRef.current = false;
      setIsLoading(false);
      haptics.error();
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const iconColor = isDark ? '#737373' : '#9ca3af';

  const cardMaxWidth = Math.min(520, windowWidth - 24);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: canvasBackground }]}>
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
          {/* Main Elevated Card Container */}
          <View style={styles.centerContainer}>
            <View
              style={[
                styles.card,
                {
                  maxWidth: cardMaxWidth,
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              {/* Reach International Brand Wordmark & Official Tagline */}
              <View style={styles.logoContainer}>
                <ReachInternationalLogo variant="full" size={26} showIcon={false} />
              </View>

              {/* Card Title & Brief Context */}
              <View style={styles.titleWrapper}>
                <Text variant="heading" style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Create an account
                </Text>
                <Text variant="caption" style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#64748b' }]}>
                  Enter your details to request platform access
                </Text>
              </View>

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
                  placeholder="Vaibhav Chauhan"
                  value={fullName}
                  onChangeText={handleFullNameChange}
                  onBlur={() => {
                    if (!fullName.trim() || fullName.trim().length < 2) {
                      setFieldErrors((prev) => ({ ...prev, full_name: 'Full name required (min 2 chars)' }));
                    }
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  importantForAutofill="yes"
                  error={fieldErrors.full_name}
                  leftIcon={<User size={15} color={iconColor} />}
                />

                <Input
                  label="Email Address"
                  required
                  placeholder="vaibhav@domain.com"
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={() => {
                    const clean = email.trim().toLowerCase();
                    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
                      setFieldErrors((prev) => ({ ...prev, email: 'Valid email required' }));
                    }
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  importantForAutofill="yes"
                  error={fieldErrors.email}
                  leftIcon={<Mail size={15} color={iconColor} />}
                />

                <Input
                  label="Mobile Number"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onBlur={() => {
                    const clean = phone.replace(/\D/g, '');
                    if (!clean || clean.length < 10) {
                      setFieldErrors((prev) => ({ ...prev, phone: '10-digit mobile required' }));
                    }
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  importantForAutofill="yes"
                  error={fieldErrors.phone}
                  leftIcon={<Phone size={15} color={iconColor} />}
                />

                {/* Role Selector */}
                <SearchableSelect
                  label="Role Requested"
                  required
                  options={SIGNUP_ROLES}
                  value={selectedRole}
                  onChange={handleRoleChange}
                  placeholder="Select role..."
                  leftIcon={<User size={15} color={iconColor} />}
                  error={fieldErrors.role}
                  modalTitle="Select Account Role"
                  presentation="dropdown"
                  containerStyle={{ zIndex: 20 }}
                />

                {/* Supervisor Selector (required for Operator) */}
                {isSupervisedRole(selectedRole) && (
                  <View style={[styles.supervisorWrapper, { borderTopColor: isDark ? '#262626' : '#ebebeb', zIndex: 10 }]}>
                    <SearchableSelect
                      label="Select Supervisor"
                      required
                      options={supervisorOptions}
                      value={selectedSupervisorId}
                      onChange={handleSupervisorChange}
                      placeholder={
                        loadingSupervisors
                          ? 'Loading supervisors...'
                          : supervisorOptions.length === 0
                            ? supervisorError
                              ? 'Failed to load supervisors'
                              : 'No active supervisors found'
                            : 'Select supervisor...'
                      }
                      leftIcon={<ShieldCheck size={15} color={iconColor} />}
                      error={fieldErrors.supervisor_id}
                      modalTitle="Select Supervisor"
                      searchable
                      searchPlaceholder="Search supervisor..."
                      presentation="dropdown"
                    />
                    {Boolean(supervisorError) && (
                      <Pressable
                        variant="plain"
                        haptic="select"
                        onPress={() => refetchSupervisors()}
                        style={styles.retrySupervisorBtn}
                        hitSlopToMin48
                      >
                        <RotateCw size={12} color={isDark ? '#38bdf8' : '#0284c7'} />
                        <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                          Unable to load supervisors. Tap to retry.
                        </Text>
                      </Pressable>
                    )}
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
                    <Badge
                      variant="info"
                      solid
                      size="sm"
                      shape="pill"
                      label={`${shiftSummary.durationMinutes % 60 === 0
                        ? `${shiftSummary.durationMinutes / 60} hrs`
                        : `${Number(shiftSummary.durationHours.toFixed(1))} hrs`}${shiftSummary.isOvernight ? ' • Overnight' : ''}`}
                    />
                  ) : null
                }
              >
                <TimeInput
                  label="Shift Start Time"
                  value={shiftStartTime}
                  onChange={handleShiftStartChange}
                  required
                  toggleLayout="side-by-side"
                />
                <TimeInput
                  label="Shift End Time"
                  value={shiftEndTime}
                  onChange={handleShiftEndChange}
                  required
                  toggleLayout="side-by-side"
                />

                {Boolean(fieldErrors.shift_time || fieldErrors.shift_end_time) && (
                  <Text variant="caption" style={styles.inlineSectionError}>
                    {fieldErrors.shift_time || fieldErrors.shift_end_time}
                  </Text>
                )}
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
                  autoComplete="off"
                  importantForAutofill="no"
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
                  autoComplete="off"
                  importantForAutofill="no"
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
                  autoComplete="off"
                  importantForAutofill="no"
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
                  autoComplete="off"
                  importantForAutofill="no"
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
                  title="Licence Document (Optional)"
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
                  onChangeText={handlePasswordChange}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  importantForAutofill="yes"
                  error={fieldErrors.password}
                  leftIcon={<Lock size={15} color={iconColor} />}
                />

                {/* Password Strength & Pattern Requirements Indicator */}
                {password.length > 0 && (
                  <View style={styles.passwordStrengthContainer}>
                    <View style={styles.passwordStrengthRow}>
                      <View style={styles.strengthSegments}>
                        {[1, 2, 3, 4].map((seg) => (
                          <View
                            key={seg}
                            style={[
                              styles.strengthSegment,
                              {
                                backgroundColor:
                                  passwordMetrics.score >= seg
                                    ? passwordMetrics.strengthColor
                                    : isDark
                                      ? '#262626'
                                      : '#e5e7eb',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        variant="micro"
                        weight="semibold"
                        style={[
                          styles.strengthLabel,
                          { color: passwordMetrics.strengthColor },
                        ]}
                      >
                        {passwordMetrics.strengthLabel}
                      </Text>
                    </View>

                    {/* Compact Requirement Pattern Chips */}
                    <View style={styles.patternChipsRow}>
                      <View
                        style={[
                          styles.patternChip,
                          {
                            backgroundColor: passwordMetrics.hasMinLen
                              ? isDark
                                ? '#064e3b33'
                                : '#ecfdf5'
                              : isDark
                                ? '#1a1a1a'
                                : '#f4f4f5',
                            borderColor: passwordMetrics.hasMinLen
                              ? isDark
                                ? '#059669'
                                : '#10b981'
                              : isDark
                                ? '#2e2e2e'
                                : '#e5e7eb',
                          },
                        ]}
                      >
                        {passwordMetrics.hasMinLen ? (
                          <Check size={10} color="#10b981" strokeWidth={2.5} />
                        ) : (
                          <View
                            style={[
                              styles.patternDot,
                              { backgroundColor: isDark ? '#525252' : '#9ca3af' },
                            ]}
                          />
                        )}
                        <Text
                          variant="micro"
                          weight={passwordMetrics.hasMinLen ? 'semibold' : 'normal'}
                          style={{
                            color: passwordMetrics.hasMinLen
                              ? isDark
                                ? '#34d399'
                                : '#059669'
                              : isDark
                                ? '#737373'
                                : '#8f8f8f',
                          }}
                        >
                          8+ chars
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.patternChip,
                          {
                            backgroundColor: passwordMetrics.hasUpperLower
                              ? isDark
                                ? '#064e3b33'
                                : '#ecfdf5'
                              : isDark
                                ? '#1a1a1a'
                                : '#f4f4f5',
                            borderColor: passwordMetrics.hasUpperLower
                              ? isDark
                                ? '#059669'
                                : '#10b981'
                              : isDark
                                ? '#2e2e2e'
                                : '#e5e7eb',
                          },
                        ]}
                      >
                        {passwordMetrics.hasUpperLower ? (
                          <Check size={10} color="#10b981" strokeWidth={2.5} />
                        ) : (
                          <View
                            style={[
                              styles.patternDot,
                              { backgroundColor: isDark ? '#525252' : '#9ca3af' },
                            ]}
                          />
                        )}
                        <Text
                          variant="micro"
                          weight={passwordMetrics.hasUpperLower ? 'semibold' : 'normal'}
                          style={{
                            color: passwordMetrics.hasUpperLower
                              ? isDark
                                ? '#34d399'
                                : '#059669'
                              : isDark
                                ? '#737373'
                                : '#8f8f8f',
                          }}
                        >
                          Upper & lower
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.patternChip,
                          {
                            backgroundColor: passwordMetrics.hasNum
                              ? isDark
                                ? '#064e3b33'
                                : '#ecfdf5'
                              : isDark
                                ? '#1a1a1a'
                                : '#f4f4f5',
                            borderColor: passwordMetrics.hasNum
                              ? isDark
                                ? '#059669'
                                : '#10b981'
                              : isDark
                                ? '#2e2e2e'
                                : '#e5e7eb',
                          },
                        ]}
                      >
                        {passwordMetrics.hasNum ? (
                          <Check size={10} color="#10b981" strokeWidth={2.5} />
                        ) : (
                          <View
                            style={[
                              styles.patternDot,
                              { backgroundColor: isDark ? '#525252' : '#9ca3af' },
                            ]}
                          />
                        )}
                        <Text
                          variant="micro"
                          weight={passwordMetrics.hasNum ? 'semibold' : 'normal'}
                          style={{
                            color: passwordMetrics.hasNum
                              ? isDark
                                ? '#34d399'
                                : '#059669'
                              : isDark
                                ? '#737373'
                                : '#8f8f8f',
                          }}
                        >
                          1+ number
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <Input
                  label="Confirm Password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  importantForAutofill="yes"
                  error={fieldErrors.confirm_password}
                  leftIcon={<Lock size={15} color={iconColor} />}
                />

                {/* Confirm Password Real-time Match Indicator */}
                {confirmPassword.length > 0 && (
                  <View style={styles.confirmMatchContainer}>
                    {confirmPassword === password ? (
                      <View style={styles.confirmMatchRow}>
                        <Check size={12} color="#10b981" strokeWidth={2.5} />
                        <Text variant="caption" weight="medium" style={{ color: '#10b981' }}>
                          Passwords match
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.confirmMatchRow}>
                        <AlertCircle size={12} color="#ef4444" strokeWidth={2.5} />
                        <Text variant="caption" weight="medium" style={{ color: '#ef4444' }}>
                          Passwords do not match
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </MobileFormSectionCard>

              {/* Account Status Info Note Banner */}
              <View
                style={[
                  styles.noteBox,
                  {
                    backgroundColor: isDark ? '#082f49' : '#f0f9ff',
                    borderColor: isDark ? '#0284c7' : '#bae6fd',
                  },
                ]}
              >
                <Info size={15} color={isDark ? '#38bdf8' : '#0284c7'} style={{ marginTop: 2 }} />
                <Text
                  variant="caption"
                  style={[
                    styles.noteText,
                    { color: isDark ? '#e0f2fe' : '#0369a1' },
                  ]}
                >
                  <Text variant="label" style={{ color: isDark ? '#e0f2fe' : '#0369a1' }}>Note: </Text>
                  Account status will be “pending” until approved by an administrator.
                </Text>
              </View>

              {/* Terms and Privacy Agreement Checkbox */}
              <View style={styles.termsWrapper}>
                <Pressable
                  variant="toggle"
                  haptic="toggle"
                  style={styles.termsRow}
                  onPress={() => {
                    setAgreedToTerms((prev) => {
                      const next = !prev;
                      if (next) clearFieldError('terms');
                      return next;
                    });
                  }}
                  hitSlopToMin48={true}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreedToTerms }}
                  accessibilityLabel="Agree to Terms of Service and Privacy Policy"
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      {
                        borderColor: agreedToTerms ? '#0284c7' : isDark ? '#404040' : '#d1d5db',
                        backgroundColor: agreedToTerms ? '#0284c7' : 'transparent',
                      },
                    ]}
                  >
                    {agreedToTerms && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <Text variant="caption" style={{ flex: 1, color: isDark ? '#9ca3af' : '#6b7280' }}>
                    I have read and agree to the{' '}
                    <Text
                      variant="caption"
                      style={{ color: '#0284c7' }}
                      onPress={() => router.push('/terms')}
                    >
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text
                      variant="caption"
                      style={{ color: '#0284c7' }}
                      onPress={() => router.push('/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </Pressable>
                {Boolean(fieldErrors.terms) && (
                  <Text variant="caption" style={styles.termsErrorText}>
                    {fieldErrors.terms}
                  </Text>
                )}
              </View>

              {/* Gated Submit Button */}
              <MobileSubmitButton
                isReady={isAllMandatoryFilled}
                isLoading={isLoading}
                onPress={handleSignup}
                label="Request Platform Access"
                loadingLabel="Submitting Registration Request..."
                missingCount={missingMandatoryCount}
                missingFields={missingFields}
              />

              {/* Card Footer: Sign In Link */}
              <View style={[styles.cardFooter, { borderTopColor: isDark ? '#262626' : '#ebebeb' }]}>
                <Text variant="body" style={[styles.cardFooterText, { color: isDark ? '#71717a' : '#888888' }]}>
                  Already have an account?
                </Text>
                <Pressable
                  variant="plain"
                  haptic="select"
                  onPress={() => {
                    router.push('/(auth)/login');
                  }}
                  hitSlopToMin48={true}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                >
                  <Text variant="label" style={[styles.signInLinkText, { color: '#0284c7' }]}>
                    Sign in
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Screen Footer & Copyright */}
          <View style={styles.screenFooter}>
            <Text
              variant="micro"
              style={[
                styles.copyrightText,
                { color: isDark ? '#737373' : '#8f8f8f' },
              ]}
            >
              &copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.
            </Text>
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
  titleWrapper: {
    marginBottom: 14,
  },
  title: {
  },
  subtitle: {
    marginTop: 2,
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supervisorWrapper: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
    marginTop: 2,
  },
  retrySupervisorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  inlineSectionError: {
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 6,
  },
  noteText: {
    flex: 1,
  },
  termsWrapper: {
    marginTop: 10,
    marginBottom: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsErrorText: {
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 28,
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
  },
  signInLinkText: {
  },
  screenFooter: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyrightText: {
    textAlign: 'center',
  },
  passwordStrengthContainer: {
    width: '100%',
    marginTop: -4,
    marginBottom: 8,
    gap: 6,
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  strengthSegments: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    minWidth: 44,
    textAlign: 'right',
  },
  patternChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  patternChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  patternDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  confirmMatchContainer: {
    marginTop: -4,
    marginBottom: 4,
  },
  confirmMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
