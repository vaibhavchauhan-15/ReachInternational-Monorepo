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
import { Input, TimeInput, SearchableSelect, useTheme, Text, useToast, Badge, Alert } from '../../components/ui';
import { useMobileFormDraft, type MobileSignupDraftValues } from '../../lib/hooks/useFormDraft';
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
  finalizeSignupDocuments,
  MACHINE_CATEGORY_SELECT_OPTIONS,
  normalizeMachineCategory,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { validateSignupFormData } from '@reachinternational/validation';
import { mapSignupError } from '../../lib/auth/authErrors';
import { MobilePickedDocument } from '../../lib/documents';
import { MobileDocumentUploadCard } from '../../components/documents/MobileDocumentUploadCard';
import { useMobileSignupDocumentUploads } from '../../lib/hooks/useMobileSignupDocumentUploads';
import { getAppUrl } from '../../lib/env';
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
  ArrowLeft,
  Wrench,
  CheckCircle2,
  X,
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
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const sectionYPositions = useRef<Record<number, number>>({});
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const handleNavigateBack = useCallback(() => {
    haptics.select();
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  }, [router]);

  // Section 1: Account & Role
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [selectedMachineCategory, setSelectedMachineCategory] = useState('');

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

  // Section 5: Identity Verification
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Phase 5: Zero-Byte Staging Uploads Hook
  const {
    slots: docSlots,
    sessionToken: stagingSessionToken,
    pickAndUpload: pickAndUploadDoc,
    retryUpload: retryDocUpload,
    removeFile: removeDocFile,
    ensureFreshSessionForSubmit,
    clearAll: clearDocUploads,
    isMandatoryReady,
    isAnyUploading,
  } = useMobileSignupDocumentUploads();

  // Section 6: Security Credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Draft persistence: bundle non-credential fields
  const currentDraftValues = useMemo<MobileSignupDraftValues>(
    () => ({
      fullName,
      email,
      phone,
      selectedRole,
      selectedSupervisorId,
      selectedMachineCategory,
      shiftStartTime,
      shiftEndTime,
      street,
      city,
      district,
      stateVal,
      stateId,
      bankAccountNumber,
      bankIfscCode,
      aadhaarNumber,
      licenseNumber,
      agreedToTerms,
      bankDoc: null,
      aadhaarDoc: null,
      licenseDoc: null,
    }),
    [
      fullName,
      email,
      phone,
      selectedRole,
      selectedSupervisorId,
      selectedMachineCategory,
      shiftStartTime,
      shiftEndTime,
      street,
      city,
      district,
      stateVal,
      stateId,
      bankAccountNumber,
      bankIfscCode,
      aadhaarNumber,
      licenseNumber,
      agreedToTerms,
    ]
  );

  const handleRestoreDraft = useCallback((draft: Partial<MobileSignupDraftValues>) => {
    if (draft.fullName !== undefined) setFullName(draft.fullName);
    if (draft.email !== undefined) setEmail(draft.email);
    if (draft.phone !== undefined) setPhone(draft.phone);
    if (draft.selectedRole !== undefined) setSelectedRole(draft.selectedRole);
    if (draft.selectedSupervisorId !== undefined) setSelectedSupervisorId(draft.selectedSupervisorId);
    if (draft.selectedMachineCategory !== undefined) {
      const cleanCat = normalizeMachineCategory(draft.selectedMachineCategory) || draft.selectedMachineCategory;
      setSelectedMachineCategory(cleanCat);
    }
    if (draft.shiftStartTime !== undefined) setShiftStartTime(draft.shiftStartTime);
    if (draft.shiftEndTime !== undefined) setShiftEndTime(draft.shiftEndTime);
    if (draft.street !== undefined) setStreet(draft.street);
    if (draft.city !== undefined) setCity(draft.city);
    if (draft.district !== undefined) setDistrict(draft.district);
    if (draft.stateVal !== undefined) setStateVal(draft.stateVal);
    if (draft.stateId !== undefined) setStateId(draft.stateId);
    if (draft.bankAccountNumber !== undefined) setBankAccountNumber(draft.bankAccountNumber);
    if (draft.bankIfscCode !== undefined) setBankIfscCode(draft.bankIfscCode);
    if (draft.aadhaarNumber !== undefined) setAadhaarNumber(draft.aadhaarNumber);
    if (draft.licenseNumber !== undefined) setLicenseNumber(draft.licenseNumber);
    if (draft.agreedToTerms !== undefined) setAgreedToTerms(draft.agreedToTerms);
  }, []);

  const { restoredAt, clearDraft } = useMobileFormDraft(currentDraftValues, handleRestoreDraft);

  const handleStartFresh = useCallback(async () => {
    haptics.select();
    await clearDraft();
    clearDocUploads();
    setDraftDismissed(true);
    setIsSubmittedSuccess(false);
    setFullName('');
    setEmail('');
    setPhone('');
    setSelectedRole('operator');
    setSelectedSupervisorId('');
    setSelectedMachineCategory('');
    setShiftStartTime('08:00 AM');
    setShiftEndTime('08:00 PM');
    setStreet('');
    setCity('');
    setDistrict('');
    setStateVal('');
    setStateId(null);
    setBankAccountNumber('');
    setBankIfscCode('');
    setAadhaarNumber('');
    setLicenseNumber('');
    setPassword('');
    setConfirmPassword('');
    setAgreedToTerms(false);
    setFieldErrors({});
  }, [clearDraft, clearDocUploads]);

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
    if (val !== 'operator') {
      setSelectedMachineCategory('');
      clearFieldError('machine_category');
    }
    if (!isSupervisedRole(val)) {
      setSelectedSupervisorId('');
      clearFieldError('supervisor_id');
    }
  }, [clearFieldError]);

  const handleMachineCategoryChange = useCallback((val: string) => {
    const clean = normalizeMachineCategory(val) || val;
    setSelectedMachineCategory(clean);
    clearFieldError('machine_category');
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
    if (confirmPassword && val === confirmPassword) {
      clearFieldError('confirm_password');
    }
  }, [confirmPassword, clearFieldError]);

  const handleConfirmPasswordChange = useCallback((val: string) => {
    setConfirmPassword(val);
    clearFieldError('confirm_password');
    if (password && val === password) {
      clearFieldError('confirm_password');
    }
  }, [password, clearFieldError]);

  const passwordsMatch = useMemo(() => {
    return Boolean(
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      password === confirmPassword
    );
  }, [password, confirmPassword]);

  const scrollToSection = useCallback((secNum: number) => {
    haptics.select();
    const y = sectionYPositions.current[secNum];
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  }, []);

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
    (!isSupervisedRole(selectedRole) || Boolean(selectedSupervisorId)) &&
    (selectedRole !== 'operator' || Boolean(selectedMachineCategory))
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
    docSlots.bank_document.status === 'ready'
  );

  const section5Complete = Boolean(
    aadhaarNumber.replace(/\D/g, '').length === 12 &&
    docSlots.aadhaar.status === 'ready' &&
    (!docSlots.driving_license.mainUri || docSlots.driving_license.status === 'ready')
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
    section6Complete &&
    isMandatoryReady &&
    !isAnyUploading
  );

  const completedSectionsCount = useMemo(() => {
    return [
      section1Complete,
      section2Complete,
      section3Complete,
      section4Complete,
      section5Complete,
      section6Complete,
    ].filter(Boolean).length;
  }, [
    section1Complete,
    section2Complete,
    section3Complete,
    section4Complete,
    section5Complete,
    section6Complete,
  ]);

  const progressPercent = Math.round((completedSectionsCount / 6) * 100);

  // Missing fields list for gated submit indicator
  const missingFields = useMemo(() => {
    const list: string[] = [];
    if (!fullName.trim() || fullName.trim().length < 2) list.push('Full Name');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) list.push('Email Address');
    if (cleanPhone.length < 10) list.push('Mobile Number');
    if (selectedRole === 'operator' && !selectedMachineCategory) list.push('Machine Category');
    if (isSupervisedRole(selectedRole) && !selectedSupervisorId) list.push('Supervisor');
    if (!shiftStartTime.trim() || !shiftEndTime.trim() || !shiftSummary?.isValid) list.push('Shift Schedule');
    if (!street.trim()) list.push('Street Address');
    if (!city.trim() || city.trim().length < 2) list.push('City');
    if (!district.trim() || district.trim().length < 2) list.push('District');
    if (!stateVal.trim() && !stateId) list.push('State');
    if (!cleanBankAcc || !validateBankAccountNumber(cleanBankAcc).isValid) list.push('Bank Account Number');
    if (!cleanIfsc || !validateIfscCode(cleanIfsc).isValid) list.push('IFSC Code');
    if (docSlots.bank_document.status !== 'ready') list.push('Bank Document');
    if (aadhaarNumber.replace(/\D/g, '').length !== 12) list.push('Aadhaar Number');
    if (docSlots.aadhaar.status !== 'ready') list.push('Aadhaar Document');
    if (docSlots.driving_license.mainUri && docSlots.driving_license.status !== 'ready') list.push('Licence Document');
    if (isAnyUploading) list.push('Documents uploading...');
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
    selectedMachineCategory,
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
    docSlots.bank_document.status,
    docSlots.aadhaar.status,
    docSlots.driving_license.mainUri,
    docSlots.driving_license.status,
    isAnyUploading,
    aadhaarNumber,
    password,
    confirmPassword,
    agreedToTerms,
  ]);

  const missingMandatoryCount = missingFields.length;

  // Safe Account Creation Flow with Mutex & Error Mapping
  const handleSignup = async () => {
    if (isSubmittingRef.current || isLoading) return;

    // 1. Centralized Form Validation Check across all mandatory fields
    const validationRes = validateSignupFormData({
      fullName,
      email,
      phone,
      role: selectedRole,
      supervisorId: isSupervisedRole(selectedRole) ? selectedSupervisorId : null,
      machineCategory: selectedRole === 'operator' ? selectedMachineCategory : null,
      shiftStartTime,
      shiftEndTime,
      street,
      city,
      district,
      state: stateVal,
      bankAccountNumber,
      bankIfscCode,
      hasBankDoc: docSlots.bank_document.status === 'ready',
      aadhaarNumber,
      hasAadhaarDoc: docSlots.aadhaar.status === 'ready',
      licenseNumber,
      password,
      confirmPassword,
      agreedToTerms,
    });

    if (!validationRes.isValid) {
      setFieldErrors(validationRes.errors);
      toast('error', 'Please Fill Required Details', 'Highlighted fields below need your attention. Please fill them and tap submit.');
      haptics.error();

      // Smooth auto-scroll to the first section that contains an error
      const errKeys = Object.keys(validationRes.errors);
      let targetSection = 1;
      if (errKeys.some((k) => ['full_name', 'email', 'phone', 'role', 'supervisor_id', 'machine_category'].includes(k))) {
        targetSection = 1;
      } else if (errKeys.some((k) => ['shift_start_time', 'shift_end_time', 'shift_time'].includes(k))) {
        targetSection = 2;
      } else if (errKeys.some((k) => ['street', 'city', 'district', 'state'].includes(k))) {
        targetSection = 3;
      } else if (errKeys.some((k) => ['bank_account_number', 'bank_ifsc_code', 'bank_doc'].includes(k))) {
        targetSection = 4;
      } else if (errKeys.some((k) => ['aadhaar_number', 'aadhaar_doc', 'license_number', 'license_doc'].includes(k))) {
        targetSection = 5;
      } else if (errKeys.some((k) => ['password', 'confirm_password', 'terms'].includes(k))) {
        targetSection = 6;
      }

      const targetY = sectionYPositions.current[targetSection];
      if (typeof targetY === 'number') {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 16), animated: true });
      }
      return;
    }

    if (isAnyUploading) {
      toast('info', 'Upload in Progress', 'Please wait until document photos finish uploading before submitting.');
      return;
    }

    if (!isMandatoryReady) {
      toast('error', 'Documents Required', 'Please attach required bank and identity document photos.');
      haptics.error();
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsLoading(true);

    // 2. Ensure fresh session token (refresh if older than 1.5h)
    const sessionRes = await ensureFreshSessionForSubmit();
    if (!sessionRes.ok || !sessionRes.session) {
      toast('error', 'Upload Session Expired', sessionRes.error || 'Please re-upload documents.');
      isSubmittingRef.current = false;
      setIsLoading(false);
      haptics.reject();
      return;
    }
    const verifiedSession = sessionRes.session;

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
            machine_category: safeRole === 'operator' ? selectedMachineCategory || null : null,
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
            staging_session_token: verifiedSession,
            session: verifiedSession,
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
        try {
          await finalizeSignupDocuments({
            baseUrl: getAppUrl(),
            userId,
            session: verifiedSession,
          });
        } catch (finErr) {
          console.warn('[Signup] Finalize staged documents error:', finErr);
        }
      }

      // On successful signup: clear uploads & draft from storage
      clearDocUploads();
      await clearDraft();
      setIsSubmittedSuccess(true);

      toast(
        'success',
        'Registration Request Submitted! 🎉',
        'Your account is pending administrator approval. After approval, you can log in.'
      );
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1400);
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
          ref={scrollViewRef}
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
              {/* Back to Sign In Action */}
              <Pressable
                variant="plain"
                haptic="select"
                hitSlopToMin48={true}
                onPress={handleNavigateBack}
                style={styles.backRow}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
              >
                <ArrowLeft size={14} color={isDark ? '#a1a1aa' : '#64748b'} />
                <Text variant="caption" weight="medium" style={{ color: isDark ? '#a1a1aa' : '#64748b' }}>
                  Back to sign in
                </Text>
              </Pressable>

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

              {/* Draft Restored Notice Banner — 100% Parity with Web */}
              {Boolean(restoredAt) && !draftDismissed && (
                <View style={styles.draftNoticeWrapper}>
                  <Alert variant="info" style={styles.draftAlertBox}>
                    <View style={styles.draftNoticeContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Text variant="caption" style={styles.draftNoticeText}>
                          Draft restored from {new Date(restoredAt!).toLocaleString()}. Re-enter your password to continue.
                        </Text>
                        <Pressable
                          variant="plain"
                          haptic="select"
                          onPress={() => setDraftDismissed(true)}
                          hitSlopToMin48={true}
                          accessibilityRole="button"
                          accessibilityLabel="Dismiss draft alert"
                          style={{ padding: 4 }}
                        >
                          <X size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
                        </Pressable>
                      </View>
                      <Pressable
                        variant="plain"
                        haptic="select"
                        onPress={handleStartFresh}
                        hitSlopToMin48={true}
                        accessibilityRole="button"
                        accessibilityLabel="Start fresh"
                        style={styles.startFreshButton}
                      >
                        <Text variant="caption" weight="semiBold" style={styles.startFreshText}>
                          Start fresh
                        </Text>
                      </Pressable>
                    </View>
                  </Alert>
                </View>
              )}

              {/* Registration Progress Stepper */}
              <View
                style={[
                  styles.progressContainer,
                  {
                    backgroundColor: isDark ? '#141414' : '#f8fafc',
                    borderColor: isDark ? '#262626' : '#e2e8f0',
                  },
                ]}
              >
                <View style={styles.progressHeaderRow}>
                  <Text variant="caption" weight="semiBold" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                    Registration Progress
                  </Text>
                  <Text variant="caption" weight="medium" style={{ color: completedSectionsCount === 6 ? '#10b981' : '#0284c7' }}>
                    {completedSectionsCount} of 6 steps ({progressPercent}%)
                  </Text>
                </View>

                {/* Progress Track */}
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#262626' : '#e2e8f0' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(5, progressPercent)}%`,
                        backgroundColor: completedSectionsCount === 6 ? '#10b981' : '#0284c7',
                      },
                    ]}
                  />
                </View>

                {/* Step Chips */}
                <View style={styles.stepChipsRow}>
                  {[
                    { step: 1, label: 'Account', done: section1Complete },
                    { step: 2, label: 'Shift', done: section2Complete },
                    { step: 3, label: 'Address', done: section3Complete },
                    { step: 4, label: 'Bank', done: section4Complete },
                    { step: 5, label: 'ID', done: section5Complete },
                    { step: 6, label: 'Password', done: section6Complete },
                  ].map((s) => (
                    <Pressable
                      key={s.step}
                      variant="plain"
                      haptic="select"
                      onPress={() => scrollToSection(s.step)}
                      style={styles.stepChip}
                      hitSlopToMin48={true}
                      accessibilityLabel={`Step ${s.step}: ${s.label}`}
                    >
                      <View
                        style={[
                          styles.stepChipCircle,
                          {
                            backgroundColor: s.done
                              ? '#10b981'
                              : isDark
                              ? '#262626'
                              : '#ffffff',
                            borderColor: s.done
                              ? '#10b981'
                              : isDark
                              ? '#404040'
                              : '#cbd5e1',
                          },
                        ]}
                      >
                        {s.done ? (
                          <Check size={11} color="#ffffff" strokeWidth={3} />
                        ) : (
                          <Text
                            variant="micro"
                            weight="bold"
                            style={{ color: isDark ? '#a1a1aa' : '#64748b' }}
                          >
                            {s.step}
                          </Text>
                        )}
                      </View>
                      <Text
                        variant="micro"
                        weight={s.done ? 'semiBold' : 'normal'}
                        style={{
                          color: s.done
                            ? (isDark ? '#34d399' : '#059669')
                            : (isDark ? '#737373' : '#8f8f8f'),
                        }}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Section 1: Account & Role */}
              <View onLayout={(e) => { sectionYPositions.current[1] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={1}
                  title="ACCOUNT & ROLE"
                  description="Personal Details & Role Category"
                  isMandatory={true}
                  isCompleted={section1Complete}
                  style={{ zIndex: 60 }}
                >
                  <Input
                    label="Full Name"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    helperText="Enter your name as printed on Aadhaar card"
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
                    placeholder="ramesh@domain.com"
                    helperText="Account verification & notifications"
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
                    helperText="10-digit mobile number for login & OTP"
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

                  {/* Machine Category Selector (mandatory for Operator) */}
                  {selectedRole === 'operator' && (
                    <View style={[styles.supervisorWrapper, { borderTopColor: isDark ? '#262626' : '#ebebeb', zIndex: 10 }]}>
                      <SearchableSelect
                        label="Machine Category"
                        required
                        options={MACHINE_CATEGORY_SELECT_OPTIONS as unknown as { value: string; label: string }[]}
                        value={selectedMachineCategory}
                        onChange={handleMachineCategoryChange}
                        placeholder="Select machine category..."
                        leftIcon={<Wrench size={15} color={iconColor} />}
                        error={fieldErrors.machine_category}
                        modalTitle="Select Machine Category"
                        presentation="dropdown"
                      />
                    </View>
                  )}
                </MobileFormSectionCard>
              </View>

              {/* Section 2: Work Shift Schedule */}
              <View onLayout={(e) => { sectionYPositions.current[2] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={2}
                  title="WORK SHIFT SCHEDULE"
                  description="Specify your operational shift hours"
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
              </View>

              {/* Section 3: Address Details */}
              <View onLayout={(e) => { sectionYPositions.current[3] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={3}
                  title="ADDRESS DETAILS"
                  description="Residential / Worksite Base Location"
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
              </View>

              {/* Section 4: Banking Details */}
              <View onLayout={(e) => { sectionYPositions.current[4] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={4}
                  title="BANKING DETAILS"
                  description="For monthly salary & payment disbursement"
                  isMandatory={true}
                  isCompleted={section4Complete}
                  style={{ zIndex: 30 }}
                >
                  <View style={[styles.sectionHintBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.08)' : '#f0f9ff', borderColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#bae6fd' }]}>
                    <CreditCard size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
                    <Text variant="caption" style={{ flex: 1, color: isDark ? '#bae6fd' : '#0369a1' }}>
                      Your monthly salary will be transferred to this bank account (सैलरी इसी खाते में आएगी)
                    </Text>
                  </View>

                  <Input
                    label="Bank Account Number"
                    required
                    placeholder="9 to 18-digit Account Number"
                    helperText="Enter account number as written on your passbook"
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
                    helperText="11-character bank code on your passbook or cheque"
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
                    subtitle="Take photo of passbook first page or cancelled cheque"
                    docTypeCode="bank_document"
                    required
                    slot={docSlots.bank_document}
                    onPickSlot={(src) => {
                      clearFieldError('bank_doc');
                      pickAndUploadDoc('bank_document', src);
                    }}
                    onRetrySlot={() => retryDocUpload('bank_document')}
                    onRemoveSlot={() => removeDocFile('bank_document')}
                    errorMessage={fieldErrors.bank_doc}
                  />
                </MobileFormSectionCard>
              </View>

              {/* Section 5: Identity Verification */}
              <View onLayout={(e) => { sectionYPositions.current[5] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={5}
                  title="IDENTITY VERIFICATION"
                  description="Government ID & Licence Verification"
                  isMandatory={true}
                  isCompleted={section5Complete}
                  style={{ zIndex: 20 }}
                >
                  <Input
                    label="Aadhaar Card Number"
                    required
                    placeholder="12-digit Aadhaar Number"
                    helperText="12-digit number printed on your Aadhaar card"
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
                    helperText="Required if operating Forklift, Boom Lift, or other equipment."
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
                    subtitle="Take clear photo of front of your Aadhaar card"
                    docTypeCode="aadhaar"
                    required
                    slot={docSlots.aadhaar}
                    onPickSlot={(src) => {
                      clearFieldError('aadhaar_doc');
                      pickAndUploadDoc('aadhaar', src);
                    }}
                    onRetrySlot={() => retryDocUpload('aadhaar')}
                    onRemoveSlot={() => removeDocFile('aadhaar')}
                    errorMessage={fieldErrors.aadhaar_doc}
                  />

                  <MobileDocumentUploadCard
                    title="Licence Document (Optional)"
                    subtitle="Optional - Take photo of your driving licence"
                    docTypeCode="driving_license"
                    slot={docSlots.driving_license}
                    onPickSlot={(src) => {
                      clearFieldError('license_doc');
                      pickAndUploadDoc('driving_license', src);
                    }}
                    onRetrySlot={() => retryDocUpload('driving_license')}
                    onRemoveSlot={() => removeDocFile('driving_license')}
                    errorMessage={fieldErrors.license_doc}
                  />
                </MobileFormSectionCard>
              </View>

              {/* Section 6: Security Credentials */}
              <View onLayout={(e) => { sectionYPositions.current[6] = e.nativeEvent.layout.y; }}>
                <MobileFormSectionCard
                  stepNumber={6}
                  title="SECURITY CREDENTIALS"
                  description="Create a password to log into your account"
                  isMandatory={true}
                  isCompleted={section6Complete}
                  style={{ zIndex: 10 }}
                >
                  <Input
                    label="Password"
                    required
                    placeholder="••••••••••••"
                    helperText="At least 8 characters with upper, lower, and number (e.g. Reach@123)"
                    value={password}
                    onChangeText={handlePasswordChange}
                    isPassword
                    autoCapitalize="none"
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    error={fieldErrors.password}
                    isSuccess={passwordsMatch && !fieldErrors.password}
                    leftIcon={<Lock size={15} color={passwordsMatch && !fieldErrors.password ? '#10b981' : iconColor} />}
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
                    helperText="Re-type the exact same password"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    isPassword
                    autoCapitalize="none"
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    error={fieldErrors.confirm_password}
                    isSuccess={passwordsMatch && !fieldErrors.confirm_password}
                    leftIcon={<Lock size={15} color={passwordsMatch && !fieldErrors.confirm_password ? '#10b981' : iconColor} />}
                  />

                  {/* Confirm Password Real-time Match Indicator */}
                  {passwordsMatch && !fieldErrors.password && !fieldErrors.confirm_password && (
                    <View style={styles.passwordMatchBadge}>
                      <CheckCircle2 size={13} color="#10b981" />
                      <Text variant="caption" weight="medium" style={{ color: '#10b981' }}>
                        Passwords match
                      </Text>
                    </View>
                  )}
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <View style={styles.confirmMatchContainer}>
                      <View style={styles.confirmMatchRow}>
                        <AlertCircle size={12} color="#ef4444" strokeWidth={2.5} />
                        <Text variant="caption" weight="medium" style={{ color: '#ef4444' }}>
                          Passwords do not match
                        </Text>
                      </View>
                    </View>
                  )}
                </MobileFormSectionCard>
              </View>

              {/* Terms and Privacy Agreement Checkbox */}
              <View
                style={[
                  styles.termsWrapper,
                  Boolean(fieldErrors.terms) && {
                    borderColor: isDark ? '#f87171' : '#ee0000',
                    borderWidth: 1,
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
                    borderRadius: 10,
                    padding: 10,
                  },
                ]}
              >
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
                        borderColor: Boolean(fieldErrors.terms)
                          ? '#ef4444'
                          : agreedToTerms
                          ? '#0284c7'
                          : isDark
                          ? '#404040'
                          : '#d1d5db',
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
                  <View style={styles.termsErrorRow}>
                    <AlertCircle size={13} color="#ef4444" />
                    <Text variant="caption" style={styles.termsErrorText}>
                      {fieldErrors.terms}
                    </Text>
                  </View>
                )}
              </View>

              {/* Account Status Info Note Banner — Shown ONLY upon submission success */}
              {isSubmittedSuccess && (
                <View
                  style={[
                    styles.noteBox,
                    {
                      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                      borderColor: isDark ? '#047857' : '#a7f3d0',
                    },
                  ]}
                >
                  <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2 }} />
                  <Text
                    variant="caption"
                    style={[
                      styles.noteText,
                      { color: isDark ? '#ecfdf5' : '#065f46' },
                    ]}
                  >
                    <Text variant="label" style={{ color: isDark ? '#ecfdf5' : '#065f46' }}>Note: </Text>
                    Account status will be “pending” until approved by an administrator.
                  </Text>
                </View>
              )}

              {/* Gated Submit Button — ALWAYS clickable unless submitting */}
              <MobileSubmitButton
                isReady={isAllMandatoryFilled && isMandatoryReady && !isAnyUploading}
                isLoading={isLoading || isAnyUploading}
                onPress={handleSignup}
                label={isAnyUploading ? 'Uploading Documents...' : 'Request Platform Access'}
                loadingLabel={isAnyUploading ? 'Uploading Documents...' : 'Submitting Registration Request...'}
                missingCount={missingMandatoryCount}
                missingFields={missingFields}
                showHelperChip={false}
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    minHeight: 36,
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
  draftNoticeWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  draftAlertBox: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  draftNoticeContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
  },
  draftNoticeText: {
    color: '#0284c7',
  },
  startFreshButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  startFreshText: {
    color: '#0284c7',
    textDecorationLine: 'underline',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  stepChip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 44,
    paddingVertical: 2,
  },
  stepChipCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  passwordMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 4,
  },
  termsErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
});
