/**
 * Reach International Mobile — User Onboarding Screen
 * 95% identical replication of the Web Mobile Viewport Onboarding UI/UX,
 * with 5% native smart phone optimizations:
 * - Touch & haptic feedback on selectors, AM/PM buttons, uploads, and submit
 * - Auto-populates all existing user profile details from Supabase database; blanks only null/missing fields
 * - Clear inline feedback and gated submit guidance for mandatory fields
 * - Canonical reusable primitives: Input, TimeInput, SearchableSelect, MobileFormSectionCard, MobileAddressFields, MobileSalaryField, MobileDocumentUploadCard, MobileSubmitButton
 * - Saves remaining info to Supabase database, marks complete_profile = true, and unlocks the workspace.
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
  Image,
  useWindowDimensions,
} from 'react-native';

const loginPageImage = require('../../assets/loginpageimage.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
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
  parseProfileShiftTime,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import {
  MobilePickedDocument,
  UserDocumentInfo,
  fetchUserDocuments,
  uploadUserDocumentDirect,
  deleteUserDocument,
} from '../../lib/documents';
import { MobileDocumentUploadCard } from '../../components/documents/MobileDocumentUploadCard';
import {
  MobileFormSectionCard,
  MobileAddressFields,
  MobileSalaryField,
  MobileSubmitButton,
} from '../../components/forms';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  CreditCard,
  Building2,
  Info,
  Sun,
  Moon,
} from 'lucide-react-native';

const ONBOARDING_ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'HR' },
];

function formatTimeTo12Hour(timeStr?: string | null): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (clean.includes('AM') || clean.includes('PM')) return clean;
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${mins} ${period}`;
  }
  return clean;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();
  const { user, userProfile, refreshSession } = useAuth();
  const { width, height } = useWindowDimensions();

  // Responsive Breakpoints: Mobile (<=640px), Tablet (641px–1023px), Desktop (>=1024px)
  const isDesktop = width >= 1024;
  const isTablet = width >= 641 && width < 1024;
  const isShortScreen = height < 740;
  const isTinyScreen = width < 360;
  const showcaseWidth = isDesktop ? Math.min(540, Math.max(380, Math.round(width * 0.38))) : 0;
  const primarySkyBlue = isDark ? '#0ea5e9' : '#0284c7';

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [monthlySalary, setMonthlySalary] = useState('');

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

  // Supervisor Selection State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  // Existing documents already uploaded in DB
  const [existingDocs, setExistingDocs] = useState<Record<string, UserDocumentInfo>>({});

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  // If already onboarded, immediately route to dashboard
  useEffect(() => {
    if (userProfile?.complete_profile === true || (userProfile as any)?.complete_profile === 'yes') {
      router.replace('/(app)/dashboard');
    }
  }, [userProfile?.complete_profile, router]);

  // Load supervisors list for supervisor selector
  useEffect(() => {
    let isMounted = true;
    async function loadSupervisors() {
      setLoadingSupervisors(true);
      try {
        const { data, error } = await supabase.rpc('get_active_supervisors_public');
        if (!error && data && isMounted) {
          setSupervisors(data as Array<{ id: string; full_name: string }>);
        } else if (error) {
          console.warn('[Onboarding] RPC error loading supervisors:', error.message);
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
        console.warn('Failed to load supervisors for mobile onboarding:', err);
      } finally {
        if (isMounted) setLoadingSupervisors(false);
      }
    }

    loadSupervisors();
    return () => {
      isMounted = false;
    };
  }, []);

  // Hydrate user info from database (auto-fills everything available; leaves blank only null inputs)
  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      if (!user?.id) return;

      setEmail(user.email || '');

      // Load existing uploaded documents
      try {
        const docs = await fetchUserDocuments(user.id);
        if (isMounted) {
          const map: Record<string, UserDocumentInfo> = {};
          docs.forEach((d) => {
            map[d.document_type_code] = d;
          });
          setExistingDocs(map);
        }
      } catch (dErr) {
        console.warn('[Onboarding] Error loading documents:', dErr);
      }

      // Fetch fresh profile row from public.users
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile && isMounted) {
          // Full Name
          if (profile.full_name && profile.full_name !== user.email) {
            setFullName(profile.full_name);
          }
          // Phone
          if (profile.phone) {
            setPhone(profile.phone);
          }
          // Role
          if (profile.role) {
            setSelectedRole(profile.role);
          }
          // Supervisor
          if (profile.supervisor_id) {
            setSelectedSupervisorId(profile.supervisor_id);
          }
          // Monthly Salary
          if (profile.monthly_salary !== null && profile.monthly_salary !== undefined) {
            setMonthlySalary(String(profile.monthly_salary));
          }
          // Shift Timing
          if (profile.shift_start_time) {
            setShiftStartTime(formatTimeTo12Hour(profile.shift_start_time));
          }
          if (profile.shift_end_time) {
            setShiftEndTime(formatTimeTo12Hour(profile.shift_end_time));
          } else if (profile.shift_time) {
            const parsed = parseProfileShiftTime(profile.shift_time);
            if (parsed?.startTime && parsed?.endTime) {
              setShiftStartTime(parsed.startTime);
              setShiftEndTime(parsed.endTime);
            }
          }
          // Address Details
          if (profile.street) {
            setStreet(profile.street);
          } else if (profile.address) {
            setStreet(profile.address);
          }
          if (profile.city) {
            setCity(profile.city);
          }
          if (profile.district) {
            setDistrict(profile.district);
          }
          if (profile.state) {
            setStateVal(profile.state);
          }
          if (profile.state_id) {
            setStateId(Number(profile.state_id));
          }
          // Banking Details
          if (profile.bank_account_number) {
            setBankAccountNumber(profile.bank_account_number);
          }
          if (profile.bank_ifsc_code) {
            setBankIfscCode(profile.bank_ifsc_code);
          }
          // Identity Details
          if (profile.aadhaar_number) {
            setAadhaarNumber(formatAadhaar(profile.aadhaar_number));
          }
          if (profile.license_number) {
            setLicenseNumber(profile.license_number);
          }
        }
      } catch (pErr) {
        console.warn('[Onboarding] Error loading user profile:', pErr);
      }
    }

    loadUserData();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email]);

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

  const isOperator = selectedRole === 'operator';
  const hasValidSalary = !isOperator || (Boolean(monthlySalary) && Number(monthlySalary) > 0);

  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    cleanPhone.length >= 10 &&
    (!isSupervisedRole(selectedRole) || supervisors.length === 0 || selectedSupervisorId) &&
    hasValidSalary
  );

  const section2Complete = Boolean(
    shiftStartTime.trim().length > 0 &&
    shiftEndTime.trim().length > 0
  );

  const cleanBankAcc = bankAccountNumber.replace(/\D/g, '');
  const cleanIfsc = bankIfscCode.trim().toUpperCase();
  const hasBankDoc = Boolean(bankDoc || existingDocs['bank_document'] || existingDocs['bank_passbook']);

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
    hasBankDoc
  );

  const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
  const hasAadhaarDoc = Boolean(aadhaarDoc || existingDocs['aadhaar']);

  const section5Complete = Boolean(
    cleanAadhaar.length === 12 &&
    hasAadhaarDoc
  );

  const isAllMandatoryFilled = Boolean(
    section1Complete &&
    section2Complete &&
    section3Complete &&
    section4Complete &&
    section5Complete
  );

  const missingFields: string[] = [];
  if (!fullName.trim() || fullName.trim().length < 2) missingFields.push('Full Name');
  if (cleanPhone.length < 10) missingFields.push('Mobile Number');
  if (isSupervisedRole(selectedRole) && supervisors.length > 0 && !selectedSupervisorId) missingFields.push('Supervisor');
  if (isOperator && (!monthlySalary || Number(monthlySalary) <= 0)) missingFields.push('Monthly Salary');
  if (!shiftStartTime.trim() || !shiftEndTime.trim()) missingFields.push('Shift Timing');
  if (!street.trim()) missingFields.push('Street Address');
  if (!city.trim() || city.trim().length < 2) missingFields.push('City');
  if (!district.trim() || district.trim().length < 2) missingFields.push('District');
  if (!stateVal.trim() && !stateId) missingFields.push('State');
  if (!cleanBankAcc || !validateBankAccountNumber(cleanBankAcc).isValid) missingFields.push('Bank Account Number');
  if (!cleanIfsc || !validateIfscCode(cleanIfsc).isValid) missingFields.push('IFSC Code');
  if (!hasBankDoc) missingFields.push('Bank Document');
  if (cleanAadhaar.length !== 12) missingFields.push('Aadhaar Number');
  if (!hasAadhaarDoc) missingFields.push('Aadhaar Document');

  const missingMandatoryCount = missingFields.length;

  const handleCompleteOnboarding = async () => {
    if (isSubmittingRef.current || isLoading) return;

    const errors: Record<string, string> = {};

    if (!fullName || fullName.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    }
    if (cleanPhone.length < 10) {
      errors.phone = 'Mobile number must be at least 10 digits.';
    }
    if (isSupervisedRole(selectedRole) && supervisors.length > 0 && !selectedSupervisorId) {
      errors.supervisor_id = 'Please select a supervisor.';
    }
    if (isOperator && (!monthlySalary || Number(monthlySalary) <= 0)) {
      errors.monthly_salary = 'Monthly salary is mandatory for operator accounts and must be greater than 0.';
    }
    if (!shiftStartTime.trim()) {
      errors.shift_start_time = 'Shift start time is required.';
    }
    if (!shiftEndTime.trim()) {
      errors.shift_end_time = 'Shift end time is required.';
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
    if (!hasBankDoc) {
      setBankDocError('Please upload your bank passbook/cheque/statement.');
      errors.bank_doc = 'Bank document is required.';
    }
    if (cleanAadhaar.length !== 12) {
      errors.aadhaar_number = 'Aadhaar number must be exactly 12 digits.';
    }
    if (!hasAadhaarDoc) {
      setAadhaarDocError('Please upload your Aadhaar document.');
      errors.aadhaar_doc = 'Aadhaar document is required.';
    }
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        errors.license_number = licRes.error || 'Invalid driving licence format.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please complete all mandatory fields highlighted below.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    if (!user?.id) {
      setErrorMessage('Authentication session expired. Please log in again.');
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsLoading(true);

    const finalShift =
      shiftStartTime.trim() && shiftEndTime.trim()
        ? `${shiftStartTime.trim()} - ${shiftEndTime.trim()}`
        : shiftStartTime.trim() || shiftEndTime.trim() || null;

    try {
      // 1. Upload newly selected documents
      if (bankDoc) {
        try {
          await uploadUserDocumentDirect({
            userId: user.id,
            documentTypeCode: 'bank_document',
            doc: bankDoc,
          });
        } catch (bErr) {
          console.warn('[Onboarding] Bank document upload error:', bErr);
        }
      }
      if (aadhaarDoc) {
        try {
          await uploadUserDocumentDirect({
            userId: user.id,
            documentTypeCode: 'aadhaar',
            doc: aadhaarDoc,
          });
        } catch (uErr) {
          console.warn('[Onboarding] Aadhaar document upload error:', uErr);
        }
      }
      if (licenseDoc) {
        try {
          await uploadUserDocumentDirect({
            userId: user.id,
            documentTypeCode: 'driving_license',
            doc: licenseDoc,
          });
        } catch (lErr) {
          console.warn('[Onboarding] Licence document upload error:', lErr);
        }
      }

      // 2. Persist all updated user profile information to public.users
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone,
          role: selectedRole,
          supervisor_id: isSupervisedRole(selectedRole) ? selectedSupervisorId || null : null,
          shift_start_time: shiftStartTime.trim() || null,
          shift_end_time: shiftEndTime.trim() || null,
          street: street.trim(),
          city: city.trim(),
          district: district.trim(),
          state: stateVal.trim(),
          state_id: stateId,
          monthly_salary: isOperator && monthlySalary ? Number(monthlySalary) : null,
          bank_account_number: cleanBankAcc,
          bank_ifsc_code: cleanIfsc,
          aadhaar_number: cleanAadhaar,
          license_number: licenseNumber.trim().toUpperCase() || null,
          complete_profile: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        setErrorMessage(updateError.message || 'Failed to save profile details. Please try again.');
        isSubmittingRef.current = false;
        setIsLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      // Refresh session in auth state
      await refreshSession();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccessMessage('Profile completed successfully! Directing to dashboard...');

      setTimeout(() => {
        router.replace('/(app)/dashboard');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while saving profile.');
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
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: canvasBackground,
          flexDirection: isDesktop ? 'row' : 'column',
        },
      ]}
    >
      {/* Dynamic Status Bar */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ============================================================
          Left: Visual & Industrial Fleet Showcase Panel (Desktop only >= 1024px)
          Exact parity with Web app onboarding layout
          ============================================================ */}
      {isDesktop && (
        <View
          style={[
            styles.desktopShowcasePanel,
            {
              width: showcaseWidth,
              backgroundColor: isDark ? '#111111' : '#ffffff',
              borderRightColor: cardBorder,
            },
          ]}
        >
          {/* Atmospheric Brand Glow */}
          <View
            style={[
              styles.showcaseGlow,
              {
                backgroundColor: isDark
                  ? 'rgba(14, 165, 233, 0.12)'
                  : 'rgba(2, 132, 199, 0.08)',
              },
            ]}
          />

          {/* Top Brand Logo */}
          <View style={styles.showcaseLogoContainer}>
            <ReachInternationalLogo variant="full" size={28} iconType="scissor" />
          </View>

          {/* Central Hero Stage: Title + Machinery Asset */}
          <View style={styles.showcaseHeroContent}>
            <View style={styles.showcaseHeadingBlock}>
              <Text
                style={[
                  styles.showcaseTitle,
                  { color: isDark ? '#ffffff' : '#0f172a' },
                ]}
              >
                Complete setup.
              </Text>
              <Text style={[styles.showcaseSubtitle, { color: primarySkyBlue }]}>
                Unlock operations.
              </Text>
            </View>

            {/* Industrial Machinery Stage with Ground Pedestal */}
            <View style={styles.machineStageContainer}>
              <View
                style={[
                  styles.machinePedestalShadow,
                  {
                    backgroundColor: isDark
                      ? 'rgba(0, 0, 0, 0.85)'
                      : 'rgba(0, 0, 0, 0.16)',
                  },
                ]}
              />
              <Image
                source={loginPageImage}
                style={[
                  styles.machineImage,
                  {
                    maxHeight: Math.min(260, Math.max(160, height * 0.32)),
                  },
                ]}
                resizeMode="contain"
                accessible={true}
                accessibilityLabel="Reach International Aerial Boom Lift Fleet Equipment"
              />
            </View>
          </View>

          {/* Bottom Info Badge */}
          <View style={styles.showcaseBottomInfo}>
            <View style={styles.greenDot} />
            <Text style={[styles.showcaseBottomText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              One-time setup · Fast permanent verification
            </Text>
          </View>
        </View>
      )}

      {/* ============================================================
          Right: Dedicated Onboarding Form Workspace (Responsive Mobile / Tablet / Desktop)
          ============================================================ */}
      <View style={[styles.mainWorkspace, { backgroundColor: canvasBackground }]}>
        <KeyboardAvoidingView
          enabled={Platform.OS === 'ios'}
          behavior="padding"
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: isDesktop
                  ? 32
                  : isTablet
                  ? 28
                  : isTinyScreen
                  ? 12
                  : 16,
                paddingVertical: isShortScreen ? 14 : 24,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Main Card Container */}
            <View style={styles.centerContainer}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: cardBackground,
                    borderColor: cardBorder,
                    maxWidth: isDesktop ? 620 : isTablet ? 580 : 520,
                    paddingHorizontal: isDesktop
                      ? 28
                      : isTablet
                      ? 24
                      : isTinyScreen
                      ? 14
                      : 16,
                  },
                ]}
              >
                {/* Brand Logo Centered (clean wordmark without scissor lift SVG icon, hidden on Desktop since left showcase panel displays it) */}
                {!isDesktop && (
                  <View style={styles.logoContainer}>
                    <ReachInternationalLogo variant="full" size={26} showIcon={false} />
                  </View>
                )}

                {/* Card Title */}
                <Text style={[styles.title, { color: isDark ? '#ffffff' : '#0f172a' }]}>
                  Complete Your Profile
                </Text>
                <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Fill in your remaining profile and verification details to activate your account.
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
                style={{ zIndex: 50 }}
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
                  label="Email Address (Verified)"
                  value={email}
                  onChangeText={() => {}}
                  editable={false}
                  autoCapitalize="none"
                  leftIcon={<Mail size={15} color={iconColor} />}
                  helperText="Your authenticated corporate email account."
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
                  label="Assigned Role"
                  required
                  options={ONBOARDING_ROLES}
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

                {/* Monthly Salary Input for Operators */}
                {isOperator && (
                  <View style={styles.supervisorWrapper}>
                    <MobileSalaryField
                      value={monthlySalary}
                      onChangeText={(val) => {
                        setMonthlySalary(val);
                        clearFieldError('monthly_salary');
                      }}
                      role={selectedRole}
                      error={fieldErrors.monthly_salary}
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
                style={{ zIndex: 40 }}
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
                style={{ zIndex: 30 }}
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
                style={{ zIndex: 20 }}
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
                  existingDoc={existingDocs['bank_document'] || existingDocs['bank_passbook']}
                  onDocSelected={(doc) => {
                    setBankDoc(doc);
                    setBankDocError(null);
                    clearFieldError('bank_doc');
                  }}
                  onDocRemoved={async () => {
                    if (existingDocs['bank_document']) {
                      await deleteUserDocument(user!.id, 'bank_document', existingDocs['bank_document'].storage_path);
                      setExistingDocs((prev) => {
                        const copy = { ...prev };
                        delete copy['bank_document'];
                        return copy;
                      });
                    }
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
                style={{ zIndex: 10 }}
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
                  existingDoc={existingDocs['aadhaar']}
                  onDocSelected={(doc) => {
                    setAadhaarDoc(doc);
                    setAadhaarDocError(null);
                    clearFieldError('aadhaar_doc');
                  }}
                  onDocRemoved={async () => {
                    if (existingDocs['aadhaar']) {
                      await deleteUserDocument(user!.id, 'aadhaar', existingDocs['aadhaar'].storage_path);
                      setExistingDocs((prev) => {
                        const copy = { ...prev };
                        delete copy['aadhaar'];
                        return copy;
                      });
                    }
                    setAadhaarDoc(null);
                    setAadhaarDocError(null);
                  }}
                  errorMessage={aadhaarDocError || fieldErrors.aadhaar_doc}
                />

                <MobileDocumentUploadCard
                  title="Licence Document"
                  docTypeCode="driving_license"
                  selectedDoc={licenseDoc}
                  existingDoc={existingDocs['driving_license']}
                  onDocSelected={(doc) => {
                    setLicenseDoc(doc);
                    setLicenseDocError(null);
                  }}
                  onDocRemoved={async () => {
                    if (existingDocs['driving_license']) {
                      await deleteUserDocument(user!.id, 'driving_license', existingDocs['driving_license'].storage_path);
                      setExistingDocs((prev) => {
                        const copy = { ...prev };
                        delete copy['driving_license'];
                        return copy;
                      });
                    }
                    setLicenseDoc(null);
                    setLicenseDocError(null);
                  }}
                  errorMessage={licenseDocError}
                />
              </MobileFormSectionCard>

              {/* Informational Note Banner */}
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
                  <Text style={{ fontWeight: '700' }}>One-time setup: </Text>
                  Your profile details will be permanently saved. Once submitted, your workspace will be fully unlocked.
                </Text>
              </View>

              {/* Gated Submit Button matching web mobile view */}
              <MobileSubmitButton
                isReady={isAllMandatoryFilled}
                isLoading={isLoading}
                onPress={handleCompleteOnboarding}
                label="Save & Activate Account"
                loadingLabel="Saving Profile..."
                missingCount={missingMandatoryCount}
                missingFields={missingFields}
              />
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
    </View>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  // Desktop Left Showcase Panel
  desktopShowcasePanel: {
    height: '100%',
    borderRightWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  showcaseGlow: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.8,
    ...Platform.select({
      web: {
        filter: 'blur(50px)',
      },
      default: {},
    }),
  },
  showcaseLogoContainer: {
    alignItems: 'flex-start',
    zIndex: 2,
  },
  showcaseHeroContent: {
    marginVertical: 'auto',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 22,
    zIndex: 2,
    paddingVertical: 12,
  },
  showcaseHeadingBlock: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 2,
  },
  showcaseTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
  },
  showcaseSubtitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 38,
  },
  machineStageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
  },
  machinePedestalShadow: {
    position: 'absolute',
    bottom: 6,
    width: '85%',
    maxWidth: 320,
    height: 12,
    borderRadius: 9999,
    ...Platform.select({
      web: {
        filter: 'blur(4px)',
      },
      default: {
        opacity: 0.5,
      },
    }),
  },
  machineImage: {
    width: '100%',
    maxWidth: 340,
  },
  showcaseBottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  showcaseBottomText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainWorkspace: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  keyboardContainer: {
    flex: 1,
    height: '100%',
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
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
    marginTop: 6,
    marginBottom: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
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
